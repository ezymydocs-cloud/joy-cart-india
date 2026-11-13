-- ============================================================================
-- TRENDYTOYZ MIGRATION 0019: First Order 20% Discount Coupon Toggle & TRENDY20 Code
-- ============================================================================
-- 1. Adds configurable columns to store_settings:
--    - first_order_discount_enabled: Turn entire 20% first-order offer ON / OFF
--    - first_order_coupon_required: Toggle whether entering a coupon code is mandatory
--      (Defaults to TRUE: customer MUST enter coupon code e.g. TRENDY20)
--    - first_order_coupon_code: The code to match (Defaults to 'TRENDY20' for printed cards)
--    - first_order_discount_percent: Discount percent (Defaults to 20%)
-- 2. Updates check_coupon to validate TRENDY20 against first_order eligibility
-- 3. Updates place_order to respect first_order_coupon_required toggle
-- ============================================================================

-- STEP 1: Add columns to public.store_settings
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS first_order_discount_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS first_order_coupon_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS first_order_coupon_code text NOT NULL DEFAULT 'TRENDY20',
  ADD COLUMN IF NOT EXISTS first_order_discount_percent numeric NOT NULL DEFAULT 20;

-- Update row 1 with defaults (coupon required = true for printed cards)
UPDATE public.store_settings
SET first_order_discount_enabled = true,
    first_order_coupon_required = true,
    first_order_coupon_code = 'TRENDY20',
    first_order_discount_percent = 20
WHERE id = 1;

-- STEP 2: Register TRENDY20 in public.coupons table
INSERT INTO public.coupons (
  code,
  description,
  discount_type,
  discount_value,
  min_order,
  is_active
)
VALUES (
  'TRENDY20',
  'First Order 20% Discount (Physical Promo Card)',
  'percent',
  20,
  0,
  true
)
ON CONFLICT (code) DO UPDATE
SET description = EXCLUDED.description,
    discount_type = 'percent',
    discount_value = 20,
    is_active = true;

-- STEP 3: Update check_coupon to handle first order coupon codes (e.g. TRENDY20)
CREATE OR REPLACE FUNCTION public.check_coupon(p_code text, p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_sub numeric := 0;
  v_settings store_settings%ROWTYPE;
  v_clean_code text := upper(trim(p_code));
  v_fo_code text;
  v_fo_res jsonb;
  v_fo_disc numeric;
BEGIN
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RAISE EXCEPTION 'Please enter a coupon code';
  END IF;

  -- Compute product subtotal for active items
  SELECT COALESCE(sum(p.price * (e->>'quantity')::int), 0) INTO v_sub
  FROM jsonb_array_elements(COALESCE(p_items,'[]'::jsonb)) e
  JOIN products p ON p.id = (e->>'product_id')::uuid AND p.status = 'active';

  IF v_sub <= 0 THEN
    RAISE EXCEPTION 'Your cart is empty or products are unavailable';
  END IF;

  SELECT * INTO v_settings FROM store_settings WHERE id = 1;
  v_fo_code := upper(trim(COALESCE(v_settings.first_order_coupon_code, 'TRENDY20')));

  -- If this is the First Order promo card code (e.g. TRENDY20)
  IF v_clean_code = v_fo_code THEN
    IF NOT COALESCE(v_settings.first_order_discount_enabled, true) THEN
      RAISE EXCEPTION 'The first-order 20%% offer is currently not active';
    END IF;

    -- Validate user eligibility server-side
    v_fo_res := public.check_first_order_eligibility();
    IF (v_fo_res->>'eligible')::boolean IS NOT TRUE THEN
      IF v_fo_res->>'reason' = 'not_logged_in' THEN
        RAISE EXCEPTION 'Please log in to your account to use coupon code %', v_fo_code;
      ELSIF v_fo_res->>'reason' = 'not_verified' THEN
        RAISE EXCEPTION 'Please verify your email or phone to activate coupon %', v_fo_code;
      ELSIF v_fo_res->>'reason' = 'already_ordered' THEN
        RAISE EXCEPTION 'Coupon % is only valid on your first order', v_fo_code;
      ELSIF v_fo_res->>'reason' = 'already_claimed' THEN
        RAISE EXCEPTION 'Coupon % has already been claimed for this account or mobile number', v_fo_code;
      ELSE
        RAISE EXCEPTION '%', COALESCE(v_fo_res->>'message', 'You are not eligible for this coupon');
      END IF;
    END IF;

    v_fo_disc := round(v_sub * (COALESCE(v_settings.first_order_discount_percent, 20) / 100.0), 2);
    RETURN jsonb_build_object(
      'id', 'first_order',
      'code', v_fo_code,
      'discount', v_fo_disc,
      'description', 'First Order ' || COALESCE(v_settings.first_order_discount_percent, 20) || '% Discount',
      'is_first_order', true
    );
  END IF;

  -- Otherwise, validate standard coupon
  RETURN public._coupon_discount(p_code, v_sub);
END $$;

REVOKE EXECUTE ON FUNCTION public.check_coupon(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_coupon(text, jsonb) TO authenticated;

-- STEP 4: Update place_order to respect first_order_coupon_required toggle
DROP FUNCTION IF EXISTS public.place_order(jsonb, uuid, text, text, text, boolean);

CREATE OR REPLACE FUNCTION public.place_order(
  p_items jsonb,
  p_address_id uuid,
  p_payment_method text,
  p_idempotency_key text,
  p_coupon_code text DEFAULT NULL,
  p_apply_first_order boolean DEFAULT true
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_user auth.users%ROWTYPE;
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
  v_coupon_disc numeric(10,2) := 0;
  v_first_order_disc numeric(10,2) := 0;
  v_total_disc numeric(10,2) := 0;
  v_code text;
  v_unit_price numeric(10,2);
  v_line_total numeric(10,2);
  v_item_name text;
  v_norm_email text;
  v_norm_phone text;
  v_eligible_res jsonb;
  v_claim_status text;
  v_fo_code text;
  v_fo_required boolean := true;
  v_fo_enabled boolean := true;
  v_clean_coupon text := '';
  v_is_fo_coupon boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Please log in to place an order'; END IF;
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) < 8 THEN RAISE EXCEPTION 'Invalid request'; END IF;
  
  -- Handle idempotency
  SELECT * INTO v_existing FROM orders WHERE user_id = v_uid AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('order_id', v_existing.id, 'order_number', v_existing.order_number, 'duplicate', true);
  END IF;

  IF p_payment_method NOT IN ('cod','razorpay') THEN RAISE EXCEPTION 'Invalid payment method'; END IF;
  
  SELECT * INTO v_settings FROM store_settings WHERE id = 1;
  IF p_payment_method = 'razorpay' AND NOT COALESCE(v_settings.razorpay_enabled, false) THEN
    RAISE EXCEPTION 'Online payment is not available right now';
  END IF;
  
  -- Verify address: belongs to current user or admin
  SELECT * INTO v_addr FROM addresses WHERE id = p_address_id AND (user_id = v_uid OR public.is_admin());
  IF NOT FOUND THEN RAISE EXCEPTION 'Please choose a delivery address'; END IF;

  SELECT * INTO v_user FROM auth.users WHERE id = v_uid;
  SELECT * INTO v_prof FROM profiles WHERE id = v_uid;
  
  v_norm_email := lower(trim(coalesce(v_user.email, v_prof.email, '')));
  v_norm_phone := public.normalize_phone(coalesce(v_addr.phone, v_user.phone, v_prof.phone, ''));

  SELECT count(*) INTO v_count FROM jsonb_array_elements(COALESCE(p_items,'[]'::jsonb));
  IF v_count = 0 THEN RAISE EXCEPTION 'Your cart is empty'; END IF;
  IF v_count > 50 THEN RAISE EXCEPTION 'Too many items'; END IF;

  -- Load first-order settings
  v_fo_code := upper(trim(COALESCE(v_settings.first_order_coupon_code, 'TRENDY20')));
  v_fo_required := COALESCE(v_settings.first_order_coupon_required, true);
  v_fo_enabled := COALESCE(v_settings.first_order_discount_enabled, true);

  IF p_coupon_code IS NOT NULL AND length(trim(p_coupon_code)) > 0 THEN
    v_clean_coupon := upper(trim(p_coupon_code));
    IF v_clean_coupon = v_fo_code THEN
      v_is_fo_coupon := true;
    END IF;
  END IF;
  
  -- Insert initial order record
  INSERT INTO orders (
    user_id, payment_method, subtotal, shipping_total, total,
    customer_name, customer_email, customer_phone, shipping_address, idempotency_key
  )
  VALUES (
    v_uid, p_payment_method, 0, 0, 0,
    v_addr.full_name, COALESCE(v_prof.email, v_user.email), v_addr.phone,
    jsonb_build_object('full_name', v_addr.full_name, 'phone', v_addr.phone, 'line1', v_addr.line1, 'line2', v_addr.line2,
      'landmark', v_addr.landmark, 'city', v_addr.city, 'state', v_addr.state, 'pincode', v_addr.pincode),
    p_idempotency_key
  )
  RETURNING id, order_number INTO v_order_id, v_order_number;

  -- Process line items with stock validation
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
    
    IF v_item.variant_id IS NOT NULL THEN
      UPDATE product_variants
      SET stock = stock - v_item.quantity
      WHERE id = v_item.variant_id::uuid AND stock >= v_item.quantity;
      IF NOT FOUND THEN RAISE EXCEPTION 'Not enough stock for variant of %', v_prod.name; END IF;
      UPDATE products SET stock = stock - v_item.quantity WHERE id = v_prod.id;
    ELSE
      IF v_prod.stock < v_item.quantity THEN RAISE EXCEPTION 'Not enough stock for %', v_prod.name; END IF;
      UPDATE products SET stock = stock - v_item.quantity WHERE id = v_prod.id;
    END IF;

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

  -- 1. If the coupon code passed matches the First Order coupon code (e.g. TRENDY20):
  IF v_is_fo_coupon THEN
    IF v_fo_enabled THEN
      v_eligible_res := public.check_first_order_eligibility();
      IF (v_eligible_res->>'eligible')::boolean IS TRUE THEN
        v_first_order_disc := round(v_sub * (COALESCE(v_settings.first_order_discount_percent, 20) / 100.0), 2);
        v_code := v_fo_code;
        v_claim_status := CASE WHEN p_payment_method = 'cod' THEN 'completed' ELSE 'reserved' END;
        INSERT INTO public.first_order_claims (user_id, order_id, phone, email, discount_amount, status)
        VALUES (v_uid, v_order_id, v_norm_phone, v_norm_email, v_first_order_disc, v_claim_status);
      ELSE
        RAISE EXCEPTION 'Coupon % is not valid for this account: %', v_fo_code, COALESCE(v_eligible_res->>'message', 'Not eligible');
      END IF;
    END IF;

  ELSE
    -- 2. Normal coupon check (if a different coupon code was passed)
    IF v_clean_coupon <> '' THEN
      BEGIN
        v_cp := check_coupon(v_clean_coupon, p_items);
        v_coupon_disc := (v_cp->>'discount')::numeric;
        v_code := v_cp->>'code';
        UPDATE coupons SET used_count = used_count + 1 WHERE code = v_code;
      EXCEPTION WHEN OTHERS THEN
        v_coupon_disc := 0;
        v_code := NULL;
      END;
    END IF;

    -- 3. If first-order coupon is NOT required (admin set first_order_coupon_required = false in settings):
    -- Then auto-apply to eligible first-time verified user!
    IF v_fo_enabled AND (NOT v_fo_required) AND (p_apply_first_order IS TRUE) THEN
      v_eligible_res := public.check_first_order_eligibility();
      IF (v_eligible_res->>'eligible')::boolean IS TRUE THEN
        v_first_order_disc := round(v_sub * (COALESCE(v_settings.first_order_discount_percent, 20) / 100.0), 2);
        v_claim_status := CASE WHEN p_payment_method = 'cod' THEN 'completed' ELSE 'reserved' END;
        INSERT INTO public.first_order_claims (user_id, order_id, phone, email, discount_amount, status)
        VALUES (v_uid, v_order_id, v_norm_phone, v_norm_email, v_first_order_disc, v_claim_status);
      END IF;
    END IF;
  END IF;

  v_total_disc := v_coupon_disc + v_first_order_disc;

  -- Update final totals on orders table
  UPDATE orders
  SET subtotal = v_sub,
      shipping_total = v_ship,
      discount = v_total_disc,
      coupon_code = COALESCE(v_code, p_coupon_code),
      first_order_discount = v_first_order_disc,
      discount_type = CASE
        WHEN v_first_order_disc > 0 AND v_coupon_disc > 0 THEN 'first_order+coupon'
        WHEN v_first_order_disc > 0 THEN 'first_order'
        WHEN v_coupon_disc > 0 THEN 'coupon'
        ELSE NULL
      END,
      total = GREATEST(0, v_sub + v_ship - v_total_disc)
  WHERE id = v_order_id;

  INSERT INTO order_status_history (order_id, status, note, changed_by, changed_by_role)
  VALUES (v_order_id, 'placed', 'Order placed', v_uid, 'customer');

  RETURN jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number, 'duplicate', false);
END $function$;

REVOKE EXECUTE ON FUNCTION public.place_order(jsonb, uuid, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, uuid, text, text, text, boolean) TO authenticated;
