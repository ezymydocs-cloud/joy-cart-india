CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent','flat')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  min_order numeric NOT NULL DEFAULT 0,
  max_discount numeric,
  usage_limit integer,
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin coupons" ON public.coupons FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.orders ADD COLUMN coupon_code text, ADD COLUMN discount numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public._coupon_discount(p_code text, p_subtotal numeric)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c coupons%ROWTYPE; d numeric;
BEGIN
  SELECT * INTO c FROM coupons WHERE upper(code) = upper(trim(p_code));
  IF NOT FOUND OR NOT c.is_active THEN RAISE EXCEPTION 'Invalid coupon code'; END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN RAISE EXCEPTION 'This coupon has expired'; END IF;
  IF c.usage_limit IS NOT NULL AND c.used_count >= c.usage_limit THEN RAISE EXCEPTION 'This coupon has been fully used'; END IF;
  IF p_subtotal < c.min_order THEN RAISE EXCEPTION 'Add items worth ₹% or more to use this coupon', c.min_order; END IF;
  d := CASE WHEN c.discount_type = 'percent' THEN round(p_subtotal * c.discount_value / 100, 2) ELSE c.discount_value END;
  IF c.max_discount IS NOT NULL AND d > c.max_discount THEN d := c.max_discount; END IF;
  IF d > p_subtotal THEN d := p_subtotal; END IF;
  RETURN jsonb_build_object('id', c.id, 'code', c.code, 'discount', d, 'description', c.description);
END $$;

CREATE OR REPLACE FUNCTION public.check_coupon(p_code text, p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_sub numeric;
BEGIN
  SELECT COALESCE(sum(p.price * (e->>'quantity')::int), 0) INTO v_sub
  FROM jsonb_array_elements(COALESCE(p_items,'[]'::jsonb)) e JOIN products p ON p.id = (e->>'product_id')::uuid AND p.status = 'active';
  RETURN public._coupon_discount(p_code, v_sub);
END $$;
REVOKE EXECUTE ON FUNCTION public._coupon_discount(text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_coupon(text, jsonb) TO authenticated;

DROP FUNCTION public.place_order(jsonb, uuid, text, text);
CREATE FUNCTION public.place_order(p_items jsonb, p_address_id uuid, p_payment_method text, p_idempotency_key text, p_coupon_code text DEFAULT NULL)
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
  SELECT * INTO v_addr FROM addresses WHERE id = p_address_id AND user_id = v_uid;
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
    SELECT (e->>'product_id')::uuid AS product_id, sum((e->>'quantity')::int) AS qty
    FROM jsonb_array_elements(p_items) e GROUP BY 1 ORDER BY 1
  LOOP
    IF v_item.qty IS NULL OR v_item.qty < 1 OR v_item.qty > 99 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    SELECT * INTO v_prod FROM products WHERE id = v_item.product_id FOR UPDATE;
    IF NOT FOUND OR v_prod.status <> 'active' THEN RAISE EXCEPTION 'A product in your cart is no longer available'; END IF;
    IF v_prod.stock < v_item.qty THEN RAISE EXCEPTION 'Only % left in stock for "%"', v_prod.stock, v_prod.name; END IF;
    IF p_payment_method = 'cod' AND NOT COALESCE(v_prod.cod_enabled, false) THEN
      RAISE EXCEPTION 'Cash on Delivery is not available for "%". Please pay online.', v_prod.name;
    END IF;
    UPDATE products SET stock = stock - v_item.qty WHERE id = v_prod.id;
    SELECT url INTO v_img FROM product_images WHERE product_id = v_prod.id ORDER BY sort_order, created_at LIMIT 1;
    v_line_ship := CASE WHEN v_prod.shipping_enabled AND v_prod.shipping_charge > 0 THEN v_prod.shipping_charge ELSE 0 END;
    INSERT INTO order_items (order_id, product_id, product_name, sku, image_url, unit_price, mrp, quantity, shipping_charge, line_total)
    VALUES (v_order_id, v_prod.id, v_prod.name, v_prod.sku, v_img, v_prod.price, v_prod.mrp, v_item.qty, v_line_ship, v_prod.price * v_item.qty);
    v_sub := v_sub + v_prod.price * v_item.qty;
    v_ship := v_ship + v_line_ship;
  END LOOP;
  IF p_coupon_code IS NOT NULL AND length(trim(p_coupon_code)) > 0 THEN
    PERFORM 1 FROM coupons WHERE upper(code) = upper(trim(p_coupon_code)) FOR UPDATE;
    v_cp := public._coupon_discount(p_coupon_code, v_sub);
    v_disc := (v_cp->>'discount')::numeric;
    v_code := v_cp->>'code';
    UPDATE coupons SET used_count = used_count + 1 WHERE id = (v_cp->>'id')::uuid;
  END IF;
  UPDATE orders SET subtotal = v_sub, shipping_total = v_ship, discount = v_disc, coupon_code = v_code, total = v_sub + v_ship - v_disc WHERE id = v_order_id;
  INSERT INTO order_status_history (order_id, status, note, changed_by, changed_by_role) VALUES (v_order_id, 'placed', 'Order placed', v_uid, 'customer');
  RETURN jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number, 'duplicate', false);
END $function$;
REVOKE EXECUTE ON FUNCTION public.place_order(jsonb, uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, uuid, text, text, text) TO authenticated;