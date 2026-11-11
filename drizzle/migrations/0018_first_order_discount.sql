-- ============================================================================
-- TRENDYTOYZ: First Order 20% Off System
-- Run this script in Supabase SQL Editor in the order written.
-- ============================================================================

-- STEP 1: Add First Order columns to public.orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS first_order_discount numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type text DEFAULT NULL;

-- STEP 2: Phone normalization helper function
-- Standardizes Indian phone numbers to 10 digits (removes +91, 91 prefix, spaces, dashes)
CREATE OR REPLACE FUNCTION public.normalize_phone(p_phone text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_clean text;
BEGIN
  IF p_phone IS NULL THEN RETURN ''; END IF;
  v_clean := regexp_replace(p_phone, '\D', '', 'g');
  IF length(v_clean) = 12 AND v_clean LIKE '91%' THEN
    v_clean := substr(v_clean, 3);
  END IF;
  IF length(v_clean) > 10 THEN
    v_clean := right(v_clean, 10);
  END IF;
  RETURN v_clean;
END $$;

-- STEP 3: Create the first_order_claims table
CREATE TABLE IF NOT EXISTS public.first_order_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  phone text NOT NULL,
  email text NOT NULL,
  discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('reserved', 'completed', 'released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- STEP 4: Abuse prevention indexes (Partial Unique Indexes)
-- Prevents a user, phone number, or email from having more than ONE active discount claim across all accounts.
-- When an order is cancelled/failed, status becomes 'released', which automatically frees the discount for reuse.
CREATE UNIQUE INDEX IF NOT EXISTS idx_first_order_claims_active_user
  ON public.first_order_claims (user_id)
  WHERE status IN ('reserved', 'completed');

CREATE UNIQUE INDEX IF NOT EXISTS idx_first_order_claims_active_phone
  ON public.first_order_claims (phone)
  WHERE status IN ('reserved', 'completed') AND length(phone) = 10;

CREATE UNIQUE INDEX IF NOT EXISTS idx_first_order_claims_active_email
  ON public.first_order_claims (email)
  WHERE status IN ('reserved', 'completed') AND length(email) > 3;

CREATE INDEX IF NOT EXISTS idx_first_order_claims_order_id
  ON public.first_order_claims (order_id);

-- STEP 5: Row Level Security on first_order_claims
ALTER TABLE public.first_order_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "first_order_claims_select" ON public.first_order_claims;
CREATE POLICY "first_order_claims_select" ON public.first_order_claims
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- No client insert/update policies: only SECURITY DEFINER functions can write
REVOKE INSERT, UPDATE, DELETE ON public.first_order_claims FROM authenticated, anon;
GRANT SELECT ON public.first_order_claims TO authenticated;
GRANT ALL ON public.first_order_claims TO service_role;

-- STEP 6: Eligibility check RPC function
CREATE OR REPLACE FUNCTION public.check_first_order_eligibility()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user auth.users%ROWTYPE;
  v_norm_email text;
  v_norm_phone text;
  v_order_count int;
  v_active_claims int;
  v_is_verified boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'not_logged_in',
      'message', 'Login & verify to get 20% off your first order.'
    );
  END IF;

  SELECT * INTO v_user FROM auth.users WHERE id = v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'user_not_found', 'message', 'User account not found.');
  END IF;

  -- Verify identity: either email confirmed OR phone confirmed
  IF v_user.email_confirmed_at IS NOT NULL OR v_user.phone_confirmed_at IS NOT NULL THEN
    v_is_verified := true;
  END IF;

  v_norm_email := lower(trim(coalesce(v_user.email, '')));
  v_norm_phone := public.normalize_phone(coalesce(v_user.phone, v_user.raw_user_meta_data->>'phone', ''));

  IF NOT v_is_verified THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'not_verified',
      'email', v_norm_email,
      'phone', v_norm_phone,
      'message', 'Please verify your email or phone to activate your 20% first-order discount.'
    );
  END IF;

  -- Rule 1: User must have 0 non-cancelled orders
  SELECT count(*) INTO v_order_count
  FROM public.orders
  WHERE user_id = v_uid AND status != 'cancelled';

  IF v_order_count > 0 THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'already_ordered',
      'message', 'This offer is only valid on your first order.'
    );
  END IF;

  -- Rule 3: Cross-account abuse prevention (same phone or email cannot claim twice)
  SELECT count(*) INTO v_active_claims
  FROM public.first_order_claims
  WHERE status IN ('reserved', 'completed')
    AND (
      user_id = v_uid
      OR (v_norm_phone <> '' AND phone = v_norm_phone)
      OR (v_norm_email <> '' AND email = v_norm_email)
    );

  IF v_active_claims > 0 THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'already_claimed',
      'message', 'First order discount has already been claimed for this account or mobile number.'
    );
  END IF;

  RETURN jsonb_build_object(
    'eligible', true,
    'discount_percent', 20,
    'email', v_norm_email,
    'phone', v_norm_phone,
    'message', '🎉 20% OFF applied on your first order!'
  );
END $$;
GRANT EXECUTE ON FUNCTION public.check_first_order_eligibility() TO authenticated;

-- STEP 7: Automatic Trigger to release first order discount on order cancellation
CREATE OR REPLACE FUNCTION public.handle_order_cancellation_first_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    UPDATE public.first_order_claims
    SET status = 'released', updated_at = now()
    WHERE order_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_release_first_order_on_cancel ON public.orders;
CREATE TRIGGER trg_release_first_order_on_cancel
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_cancellation_first_order();

-- STEP 8: Atomic Server-Side Order Placement with First Order 20% Discount
DROP FUNCTION IF EXISTS public.place_order(jsonb, uuid, text, text, text);
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
  v_is_free boolean;
  v_unit_price numeric(10,2);
  v_line_total numeric(10,2);
  v_item_name text;
  v_norm_email text;
  v_norm_phone text;
  v_eligible_res jsonb;
  v_is_eligible boolean := false;
  v_claim_status text;
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

  -- 1. Check Coupon Discount (if provided)
  IF p_coupon_code IS NOT NULL AND length(trim(p_coupon_code)) > 0 THEN
    BEGIN
      v_cp := check_coupon(trim(p_coupon_code), p_items);
      v_coupon_disc := (v_cp->>'discount')::numeric;
      v_code := v_cp->>'code';
      UPDATE coupons SET used_count = used_count + 1 WHERE code = v_code;
    EXCEPTION WHEN OTHERS THEN
      v_coupon_disc := 0;
      v_code := NULL;
    END;
  END IF;

  -- 2. Server-side First Order 20% Discount verification & calculation
  IF p_apply_first_order IS TRUE THEN
    v_eligible_res := public.check_first_order_eligibility();
    IF (v_eligible_res->>'eligible')::boolean IS TRUE THEN
      -- 20% on product subtotal (not shipping/tax)
      v_first_order_disc := round(v_sub * 0.20, 2);
      v_is_eligible := true;
      
      -- Reserve or complete the claim atomically
      v_claim_status := CASE WHEN p_payment_method = 'cod' THEN 'completed' ELSE 'reserved' END;
      
      -- Atomic insert into first_order_claims. Partial unique index prevents concurrent duplicates!
      INSERT INTO public.first_order_claims (user_id, order_id, phone, email, discount_amount, status)
      VALUES (v_uid, v_order_id, v_norm_phone, v_norm_email, v_first_order_disc, v_claim_status);
    END IF;
  END IF;

  v_total_disc := v_coupon_disc + v_first_order_disc;

  -- Update final totals on orders table
  UPDATE orders
  SET subtotal = v_sub,
      shipping_total = v_ship,
      discount = v_total_disc,
      coupon_code = v_code,
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
