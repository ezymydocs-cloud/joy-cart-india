-- Migration 0014: Ensure order payment update policies and atomic confirm_order_payment RPC
-- Fixes: "Online payment completed but order shows Payment Pending"

-- 1. Ensure confirm_order_payment RPC exists with SECURITY DEFINER
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
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Idempotent: If already marked paid, return success immediately
  IF v_o.payment_status = 'paid' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_paid', true,
      'order_number', v_o.order_number,
      'payment_status', 'paid'
    );
  END IF;

  -- Mark order as paid and placed
  UPDATE orders
  SET
    payment_status = 'paid',
    razorpay_order_id = COALESCE(nullif(p_razorpay_order_id, ''), v_o.razorpay_order_id),
    razorpay_payment_id = COALESCE(nullif(p_razorpay_payment_id, ''), v_o.razorpay_payment_id),
    status = CASE WHEN status = 'cancelled' THEN 'placed' ELSE status END,
    cancel_reason = NULL,
    cancelled_by = NULL,
    updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO order_status_history (order_id, status, note, changed_by, changed_by_role)
  VALUES (
    p_order_id,
    'placed',
    'Payment captured successfully via ' || p_source || ' (' || COALESCE(p_razorpay_payment_id, 'online') || ')',
    v_o.user_id,
    'system'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'order_number', v_o.order_number,
    'payment_status', 'paid'
  );
END $$;

REVOKE ALL ON FUNCTION public.confirm_order_payment(uuid, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirm_order_payment(uuid, text, text, text) TO authenticated, service_role;

-- 2. Add RLS policy for authenticated users to update their own order payment status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'orders update self payment'
  ) THEN
    CREATE POLICY "orders update self payment" ON public.orders
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- 3. Add RLS policy for service_role to update orders freely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'orders service_role update'
  ) THEN
    CREATE POLICY "orders service_role update" ON public.orders
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
