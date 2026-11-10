-- Migration 0013: Fix order integrity, immutable order numbers, variant images, and payment security

-- 1. Ensure razorpay_order_id is unique across orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_razorpay_order_id_key'
  ) THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_razorpay_order_id_key UNIQUE (razorpay_order_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- In case duplicate nulls or previous test records exist, use a unique index on non-null
  CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_razorpay_order_id_unique ON public.orders(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
END $$;

-- 2. Add multiple images support to product_variants table
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';

-- 3. Immutable order_number trigger: Prevent any UPDATE from changing an existing order_number
CREATE OR REPLACE FUNCTION public.enforce_order_number_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.order_number IS NOT NULL AND NEW.order_number IS DISTINCT FROM OLD.order_number THEN
    RAISE EXCEPTION 'Order number is immutable and cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_number_immutable ON public.orders;
CREATE TRIGGER trg_order_number_immutable
BEFORE UPDATE OF order_number ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_number_immutable();

-- 4. Update cancel_my_order to STRICTLY guard against cancelling paid orders
CREATE OR REPLACE FUNCTION public.cancel_my_order(p_order_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_o orders%ROWTYPE;
BEGIN
  SELECT * INTO v_o FROM orders WHERE id = p_order_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  
  -- If payment is already paid, do not allow automatic or customer cancellation without store approval
  IF v_o.payment_status = 'paid' THEN
    RAISE EXCEPTION 'This order has already been paid and confirmed. Please contact customer support for cancellations or refunds.';
  END IF;

  IF v_o.status NOT IN ('placed','accepted','packed') THEN
    RAISE EXCEPTION 'Order can be cancelled only before it is shipped. Once shipped and tracking is generated, cancellation is not possible.';
  END IF;

  PERFORM public._restore_stock(p_order_id);
  UPDATE orders SET status = 'cancelled', cancel_reason = COALESCE(nullif(btrim(p_reason),''), 'Cancelled by customer'), cancelled_by = 'customer'
  WHERE id = p_order_id;

  INSERT INTO order_status_history (order_id, status, note, changed_by, changed_by_role)
  VALUES (p_order_id, 'cancelled', COALESCE(nullif(btrim(p_reason),''), 'Cancelled by customer'), auth.uid(), 'customer');
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.cancel_my_order(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_my_order(uuid, text) TO authenticated;

-- 5. Safe atomic function to attach Razorpay order ID to internal order
CREATE OR REPLACE FUNCTION public.attach_razorpay_order(p_order_id uuid, p_razorpay_order_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_o orders%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_o FROM orders WHERE id = p_order_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_o.payment_status = 'paid' THEN RAISE EXCEPTION 'Order is already paid'; END IF;

  UPDATE orders SET razorpay_order_id = p_razorpay_order_id, updated_at = now() WHERE id = p_order_id;
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.attach_razorpay_order(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.attach_razorpay_order(uuid, text) TO authenticated;

-- 6. Safe atomic function to confirm online payment (called by verify endpoint or webhook)
CREATE OR REPLACE FUNCTION public.confirm_order_payment(
  p_order_id uuid,
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_source text DEFAULT 'customer_verify'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_o orders%ROWTYPE;
BEGIN
  SELECT * INTO v_o FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  
  -- Verify razorpay_order_id matches if previously set
  IF v_o.razorpay_order_id IS NOT NULL AND v_o.razorpay_order_id <> p_razorpay_order_id THEN
    RAISE EXCEPTION 'Razorpay order ID mismatch';
  END IF;

  -- Idempotent: If already paid with same payment id, return success
  IF v_o.payment_status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'already_paid', true, 'order_number', v_o.order_number);
  END IF;

  UPDATE orders
  SET
    payment_status = 'paid',
    razorpay_order_id = p_razorpay_order_id,
    razorpay_payment_id = p_razorpay_payment_id,
    status = CASE WHEN status = 'cancelled' THEN 'placed' ELSE status END,
    cancel_reason = NULL,
    cancelled_by = NULL,
    updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO order_status_history (order_id, status, note, changed_by, changed_by_role)
  VALUES (p_order_id, 'placed', 'Payment captured successfully via ' || p_source || ' (' || p_razorpay_payment_id || ')', v_o.user_id, 'system');

  RETURN jsonb_build_object('ok', true, 'order_number', v_o.order_number);
END $$;

REVOKE ALL ON FUNCTION public.confirm_order_payment(uuid, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirm_order_payment(uuid, text, text, text) TO authenticated, service_role;
