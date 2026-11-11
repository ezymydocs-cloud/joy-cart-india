-- Migration 0017: Fix Harley typo & Address verification in place_order
-- 1. Correct typo in product descriptions
UPDATE public.products
SET short_description = REPLACE(short_description, 'collecters', 'collectors'),
    description = REPLACE(description, 'collecters', 'collectors')
WHERE short_description ILIKE '%collecters%' OR description ILIKE '%collecters%';

-- 2. Update place_order to allow address validation for admin users as well
CREATE OR REPLACE FUNCTION public.place_order(
  p_items jsonb,
  p_address_id uuid,
  p_payment_method text,
  p_idempotency_key text,
  p_coupon_code text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_existing orders%ROWTYPE;
  v_addr addresses%ROWTYPE;
  v_prof profiles%ROWTYPE;
  v_settings store_settings%ROWTYPE;
  v_item record;
  v_prod products%ROWTYPE;
  v_img text;
  v_sub numeric(10,2) := 0;
  v_ship numeric(10,2) := 0;
  v_line_ship numeric(10,2);
  v_order_id uuid;
  v_order_number text;
  v_count int;
  v_cp jsonb;
  v_disc numeric(10,2) := 0;
  v_code text;
  v_is_free boolean;
  v_unit_price numeric(10,2);
  v_line_total numeric(10,2);
  v_item_name text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Please log in to place an order'; END IF;
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) < 8 THEN RAISE EXCEPTION 'Invalid request'; END IF;
  SELECT * INTO v_existing FROM orders WHERE user_id = v_uid AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('order_id', v_existing.id, 'order_number', v_existing.order_number, 'duplicate', true);
  END IF;
  IF p_payment_method NOT IN ('cod','razorpay') THEN RAISE EXCEPTION 'Invalid payment method'; END IF;
  SELECT * INTO v_settings FROM store_settings WHERE id = 1;
  IF p_payment_method = 'razorpay' AND NOT COALESCE(v_settings.razorpay_enabled, false) THEN
    RAISE EXCEPTION 'Online payment is not available right now';
  END IF;
  
  -- Verify delivery address: belongs to current user or admin
  SELECT * INTO v_addr FROM addresses WHERE id = p_address_id AND (user_id = v_uid OR public.is_admin());
  IF NOT FOUND THEN RAISE EXCEPTION 'Please choose a delivery address'; END IF;

  SELECT * INTO v_prof FROM profiles WHERE id = v_uid;
  SELECT count(*) INTO v_count FROM jsonb_array_elements(COALESCE(p_items,'[]'::jsonb));
  IF v_count = 0 THEN RAISE EXCEPTION 'Your cart is empty'; END IF;
  IF v_count > 50 THEN RAISE EXCEPTION 'Too many items'; END IF;
  
  INSERT INTO orders (user_id, payment_method, subtotal, shipping_total, total, customer_name, customer_email, customer_phone, shipping_address, idempotency_key)
  VALUES (v_uid, p_payment_method, 0, 0, 0, v_addr.full_name, COALESCE(v_prof.email, (SELECT email FROM auth.users WHERE id = v_uid)), v_addr.phone,
    jsonb_build_object('full_name', v_addr.full_name, 'phone', v_addr.phone, 'line1', v_addr.line1, 'line2', v_addr.line2,
      'landmark', v_addr.landmark, 'city', v_addr.city, 'state', v_addr.state, 'pincode', v_addr.pincode),
    p_idempotency_key)
  RETURNING id, order_number INTO v_order_id, v_order_number;

  FOR v_item IN
    SELECT (x->>'product_id')::uuid as product_id,
           (x->>'quantity')::int as quantity,
           (x->>'variant_id')::text as variant_id,
           (x->>'variant_name')::text as variant_name,
           COALESCE((x->>'is_free')::boolean, false) as is_free,
           (x->>'bogo_parent_id')::text as bogo_parent_id
    FROM jsonb_array_elements(p_items) as x
  LOOP
    IF v_item.quantity < 1 OR v_item.quantity > 99 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    SELECT * INTO v_prod FROM products WHERE id = v_item.product_id FOR UPDATE;
    IF NOT FOUND OR v_prod.status != 'active' THEN RAISE EXCEPTION 'Product % unavailable', v_item.product_id; END IF;
    
    -- Check variant stock or product stock
    IF v_item.variant_id IS NOT NULL THEN
      -- Variant purchase
      UPDATE product_variants
      SET stock = stock - v_item.quantity
      WHERE id = v_item.variant_id::uuid AND stock >= v_item.quantity;
      IF NOT FOUND THEN RAISE EXCEPTION 'Not enough stock for variant of %', v_prod.name; END IF;
      UPDATE products SET stock = stock - v_item.quantity WHERE id = v_prod.id;
    ELSE
      -- Regular product purchase
      IF v_prod.stock < v_item.quantity THEN RAISE EXCEPTION 'Not enough stock for %', v_prod.name; END IF;
      UPDATE products SET stock = stock - v_item.quantity WHERE id = v_prod.id;
    END IF;

    -- Calculate line pricing (free if BOGO gift)
    IF v_item.is_free THEN
      v_unit_price := 0;
      v_line_total := 0;
      v_item_name := v_prod.name || ' [FREE BOGO GIFT]';
    ELSE
      v_unit_price := v_prod.price;
      v_line_total := v_prod.price * v_item.quantity;
      v_sub := v_sub + v_line_total;
      v_item_name := v_prod.name;
    END IF;

    IF v_item.variant_name IS NOT NULL AND length(v_item.variant_name) > 0 THEN
      v_item_name := v_item_name || ' (' || v_item.variant_name || ')';
    END IF;

    IF v_prod.shipping_enabled AND NOT v_item.is_free THEN
      v_line_ship := COALESCE(v_prod.shipping_charge, 0) * v_item.quantity;
      v_ship := v_ship + v_line_ship;
    END IF;

    SELECT url INTO v_img FROM product_images WHERE product_id = v_prod.id ORDER BY sort_order LIMIT 1;
    INSERT INTO order_items (order_id, product_id, product_name, price, quantity, line_total, product_image, variant_id, variant_name, is_free_gift)
    VALUES (v_order_id, v_prod.id, v_item_name, v_unit_price, v_item.quantity, v_line_total, v_img, v_item.variant_id, v_item.variant_name, v_item.is_free);
  END LOOP;

  -- Apply Coupon Discount
  IF p_coupon_code IS NOT NULL AND length(trim(p_coupon_code)) > 0 THEN
    BEGIN
      v_cp := check_coupon(trim(p_coupon_code), p_items);
      v_disc := (v_cp->>'discount')::numeric;
      v_code := v_cp->>'code';
      UPDATE coupons SET used_count = used_count + 1 WHERE code = v_code;
    EXCEPTION WHEN OTHERS THEN
      v_disc := 0;
      v_code := NULL;
    END;
  END IF;

  UPDATE orders SET subtotal = v_sub, shipping_total = v_ship, discount = v_disc, coupon_code = v_code, total = GREATEST(0, v_sub + v_ship - v_disc) WHERE id = v_order_id;
  INSERT INTO order_status_history (order_id, status, note, changed_by, changed_by_role) VALUES (v_order_id, 'placed', 'Order placed', v_uid, 'customer');
  RETURN jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number, 'duplicate', false);
END $function$;

REVOKE EXECUTE ON FUNCTION public.place_order(jsonb, uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, uuid, text, text, text) TO authenticated;
