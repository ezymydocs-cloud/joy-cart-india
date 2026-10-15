
-- ===== Roles =====
CREATE TYPE public.app_role AS ENUM ('admin','user');
CREATE TYPE public.order_status AS ENUM ('placed','accepted','packed','shipped','delivered','cancelled');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

CREATE POLICY "own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

-- ===== Profiles =====
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profile select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, email)
  VALUES (NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
          NEW.raw_user_meta_data->>'phone',
          NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant admin only to verified owner emails
CREATE OR REPLACE FUNCTION public.grant_owner_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND lower(NEW.email) IN ('trendytoyz.info@gmail.com','sallu@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created_admin AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.grant_owner_admin();
CREATE TRIGGER on_auth_user_confirmed_admin AFTER UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.grant_owner_admin();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== Addresses =====
CREATE TABLE public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL CHECK (phone ~ '^[6-9][0-9]{9}$'),
  line1 text NOT NULL,
  line2 text,
  landmark text,
  city text NOT NULL,
  state text NOT NULL,
  pincode text NOT NULL CHECK (pincode ~ '^[1-9][0-9]{5}$'),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.addresses(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;
GRANT ALL ON public.addresses TO service_role;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "addr select" ON public.addresses FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "addr insert" ON public.addresses FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "addr update" ON public.addresses FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "addr delete" ON public.addresses FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_default_address(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM addresses WHERE id = p_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Address not found';
  END IF;
  UPDATE addresses SET is_default = (id = p_id) WHERE user_id = auth.uid();
END $$;

-- ===== Catalog =====
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  short_description text,
  description text,
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  mrp numeric(10,2) CHECK (mrp IS NULL OR mrp >= 0),
  sku text UNIQUE,
  stock int NOT NULL DEFAULT 0 CHECK (stock >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('active','draft')),
  is_featured boolean NOT NULL DEFAULT false,
  shipping_enabled boolean NOT NULL DEFAULT false,
  shipping_charge numeric(10,2) NOT NULL DEFAULT 0 CHECK (shipping_charge >= 0),
  in_package text,
  age_group text,
  brand text,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.products(category_id);
CREATE TRIGGER products_touch BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TABLE public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url text NOT NULL,
  storage_path text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.product_images(product_id);
CREATE TABLE public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  subtitle text,
  desktop_image_url text NOT NULL,
  mobile_image_url text,
  link_url text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.couriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  tracking_url_template text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.store_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  store_name text NOT NULL DEFAULT 'TrendyToyz',
  store_address text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '8446418374',
  email text NOT NULL DEFAULT 'trendytoyz.info@gmail.com',
  instagram text NOT NULL DEFAULT 'https://instagram.com/trendy_toyzz',
  whatsapp text NOT NULL DEFAULT '918446418374',
  razorpay_enabled boolean NOT NULL DEFAULT false,
  razorpay_key_id text,
  admin_notification_email text NOT NULL DEFAULT 'trendytoyz.info@gmail.com',
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['categories','products','product_images','banners','couriers','store_settings'] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "admin write %1$s" ON public.%1$I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t);
  END LOOP;
END $$;
CREATE POLICY "public categories" ON public.categories FOR SELECT TO anon, authenticated USING (is_active OR public.is_admin());
CREATE POLICY "public products" ON public.products FOR SELECT TO anon, authenticated USING (status = 'active' OR public.is_admin());
CREATE POLICY "public product images" ON public.product_images FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND (p.status = 'active' OR public.is_admin())));
CREATE POLICY "public banners" ON public.banners FOR SELECT TO anon, authenticated USING (is_active OR public.is_admin());
CREATE POLICY "public couriers" ON public.couriers FOR SELECT TO anon, authenticated USING (is_active OR public.is_admin());
CREATE POLICY "public settings" ON public.store_settings FOR SELECT TO anon, authenticated USING (true);

-- ===== Orders =====
CREATE SEQUENCE public.order_number_seq START 101;
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE DEFAULT ('TT-' || lpad(nextval('public.order_number_seq')::text, 6, '0')),
  user_id uuid NOT NULL,
  status public.order_status NOT NULL DEFAULT 'placed',
  payment_method text NOT NULL CHECK (payment_method IN ('cod','razorpay')),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded')),
  subtotal numeric(10,2) NOT NULL,
  shipping_total numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text NOT NULL,
  shipping_address jsonb NOT NULL,
  courier_id uuid,
  courier_name text,
  awb_number text,
  tracking_url text,
  cancel_reason text,
  cancelled_by text,
  idempotency_key text NOT NULL,
  razorpay_order_id text,
  razorpay_payment_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX ON public.orders(user_id, created_at DESC);
CREATE INDEX ON public.orders(status);
CREATE TRIGGER orders_touch BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid,
  product_name text NOT NULL,
  sku text,
  image_url text,
  unit_price numeric(10,2) NOT NULL,
  mrp numeric(10,2),
  quantity int NOT NULL CHECK (quantity > 0),
  shipping_charge numeric(10,2) NOT NULL DEFAULT 0,
  line_total numeric(10,2) NOT NULL
);
CREATE INDEX ON public.order_items(order_id);

CREATE TABLE public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status public.order_status NOT NULL,
  note text,
  changed_by uuid,
  changed_by_role text NOT NULL DEFAULT 'customer',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.order_status_history(order_id, created_at);

CREATE TABLE public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  recipient text NOT NULL,
  template text NOT NULL,
  subject text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.email_logs(order_id);

GRANT SELECT ON public.orders, public.order_items, public.order_status_history TO authenticated;
GRANT SELECT ON public.email_logs TO authenticated;
GRANT ALL ON public.orders, public.order_items, public.order_status_history, public.email_logs TO service_role;
GRANT USAGE ON SEQUENCE public.order_number_seq TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders select" ON public.orders FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "items select" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "history select" ON public.order_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "emails admin" ON public.email_logs FOR SELECT TO authenticated USING (public.is_admin());

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- ===== Place order (server-side pricing, atomic stock) =====
CREATE OR REPLACE FUNCTION public.place_order(p_items jsonb, p_address_id uuid, p_payment_method text, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  -- lock products in a stable order to avoid deadlocks
  FOR v_item IN
    SELECT (e->>'product_id')::uuid AS product_id, sum((e->>'quantity')::int) AS qty
    FROM jsonb_array_elements(p_items) e
    GROUP BY 1 ORDER BY 1
  LOOP
    IF v_item.qty IS NULL OR v_item.qty < 1 OR v_item.qty > 99 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    SELECT * INTO v_prod FROM products WHERE id = v_item.product_id FOR UPDATE;
    IF NOT FOUND OR v_prod.status <> 'active' THEN RAISE EXCEPTION 'A product in your cart is no longer available'; END IF;
    IF v_prod.stock < v_item.qty THEN
      RAISE EXCEPTION 'Only % left in stock for "%"', v_prod.stock, v_prod.name;
    END IF;
    UPDATE products SET stock = stock - v_item.qty WHERE id = v_prod.id;
    SELECT url INTO v_img FROM product_images WHERE product_id = v_prod.id ORDER BY sort_order, created_at LIMIT 1;
    v_line_ship := CASE WHEN v_prod.shipping_enabled AND v_prod.shipping_charge > 0 THEN v_prod.shipping_charge ELSE 0 END;
    INSERT INTO order_items (order_id, product_id, product_name, sku, image_url, unit_price, mrp, quantity, shipping_charge, line_total)
    VALUES (v_order_id, v_prod.id, v_prod.name, v_prod.sku, v_img, v_prod.price, v_prod.mrp, v_item.qty, v_line_ship, v_prod.price * v_item.qty);
    v_sub := v_sub + v_prod.price * v_item.qty;
    v_ship := v_ship + v_line_ship;
  END LOOP;

  UPDATE orders SET subtotal = v_sub, shipping_total = v_ship, total = v_sub + v_ship WHERE id = v_order_id;
  INSERT INTO order_status_history (order_id, status, note, changed_by, changed_by_role) VALUES (v_order_id, 'placed', 'Order placed', v_uid, 'customer');

  RETURN jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number, 'duplicate', false);
END $$;
REVOKE ALL ON FUNCTION public.place_order(jsonb, uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, uuid, text, text) TO authenticated;

-- ===== Status transitions =====
CREATE OR REPLACE FUNCTION public._restore_stock(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE products p SET stock = p.stock + oi.quantity
  FROM order_items oi WHERE oi.order_id = p_order_id AND oi.product_id = p.id;
END $$;
REVOKE ALL ON FUNCTION public._restore_stock(uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_order_status(p_order_id uuid, p_status public.order_status, p_note text DEFAULT NULL, p_courier_id uuid DEFAULT NULL, p_awb text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_o orders%ROWTYPE;
  v_c couriers%ROWTYPE;
  v_ok boolean;
  v_awb text := nullif(btrim(p_awb), '');
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO v_o FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  v_ok := (v_o.status = 'placed' AND p_status IN ('accepted','cancelled'))
       OR (v_o.status = 'accepted' AND p_status IN ('packed','cancelled'))
       OR (v_o.status = 'packed' AND p_status IN ('shipped','cancelled'))
       OR (v_o.status = 'shipped' AND p_status = 'delivered');
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Cannot change order from % to %', v_o.status, p_status;
  END IF;

  IF p_status = 'cancelled' THEN
    IF nullif(btrim(p_note), '') IS NULL THEN RAISE EXCEPTION 'Please give a reason for cancelling'; END IF;
    PERFORM public._restore_stock(p_order_id);
    UPDATE orders SET status = 'cancelled', cancel_reason = p_note, cancelled_by = 'admin',
      payment_status = CASE WHEN payment_status = 'paid' THEN 'refunded' ELSE payment_status END
    WHERE id = p_order_id;
  ELSIF p_status = 'shipped' THEN
    IF p_courier_id IS NULL OR v_awb IS NULL THEN RAISE EXCEPTION 'Courier and AWB number are required'; END IF;
    SELECT * INTO v_c FROM couriers WHERE id = p_courier_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Courier not found'; END IF;
    UPDATE orders SET status = 'shipped', courier_id = v_c.id, courier_name = v_c.name, awb_number = v_awb,
      tracking_url = CASE WHEN nullif(v_c.tracking_url_template,'') IS NULL THEN NULL ELSE replace(v_c.tracking_url_template, '{AWB}', v_awb) END
    WHERE id = p_order_id;
  ELSIF p_status = 'delivered' THEN
    UPDATE orders SET status = 'delivered', payment_status = CASE WHEN payment_method = 'cod' THEN 'paid' ELSE payment_status END WHERE id = p_order_id;
  ELSE
    UPDATE orders SET status = p_status WHERE id = p_order_id;
  END IF;

  INSERT INTO order_status_history (order_id, status, note, changed_by, changed_by_role)
  VALUES (p_order_id, p_status, nullif(btrim(p_note),''), auth.uid(), 'admin');
  RETURN jsonb_build_object('ok', true, 'status', p_status);
END $$;
REVOKE ALL ON FUNCTION public.admin_update_order_status(uuid, public.order_status, text, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status(uuid, public.order_status, text, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_my_order(p_order_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_o orders%ROWTYPE;
BEGIN
  SELECT * INTO v_o FROM orders WHERE id = p_order_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_o.status NOT IN ('placed','accepted','packed') THEN
    RAISE EXCEPTION 'Order can be cancelled only before it is shipped. Once shipped and tracking is generated, cancellation is not possible.';
  END IF;
  PERFORM public._restore_stock(p_order_id);
  UPDATE orders SET status = 'cancelled', cancel_reason = COALESCE(nullif(btrim(p_reason),''), 'Cancelled by customer'), cancelled_by = 'customer',
    payment_status = CASE WHEN payment_status = 'paid' THEN 'refunded' ELSE payment_status END
  WHERE id = p_order_id;
  INSERT INTO order_status_history (order_id, status, note, changed_by, changed_by_role)
  VALUES (p_order_id, 'cancelled', COALESCE(nullif(btrim(p_reason),''), 'Cancelled by customer'), auth.uid(), 'customer');
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.cancel_my_order(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_my_order(uuid, text) TO authenticated;

-- ===== Admin reports =====
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb; v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT jsonb_build_object(
    'total_sales', COALESCE((SELECT sum(total) FROM orders WHERE status <> 'cancelled'), 0),
    'total_orders', (SELECT count(*) FROM orders),
    'today_orders', (SELECT count(*) FROM orders WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = v_today),
    'pending', (SELECT count(*) FROM orders WHERE status IN ('placed','accepted','packed')),
    'placed', (SELECT count(*) FROM orders WHERE status = 'placed'),
    'shipped', (SELECT count(*) FROM orders WHERE status = 'shipped'),
    'delivered', (SELECT count(*) FROM orders WHERE status = 'delivered'),
    'cancelled', (SELECT count(*) FROM orders WHERE status = 'cancelled'),
    'low_stock', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'stock', stock) ORDER BY stock) FROM products WHERE stock <= 5), '[]'::jsonb),
    'chart', (SELECT jsonb_agg(jsonb_build_object('day', d::date, 'sales', COALESCE(s.sales,0), 'orders', COALESCE(s.cnt,0)) ORDER BY d)
      FROM generate_series(v_today - 13, v_today, interval '1 day') d
      LEFT JOIN (SELECT (created_at AT TIME ZONE 'Asia/Kolkata')::date AS day, sum(total) AS sales, count(*) AS cnt
                 FROM orders WHERE status <> 'cancelled' GROUP BY 1) s ON s.day = d::date)
  ) INTO v;
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_customers()
RETURNS TABLE (id uuid, full_name text, email text, phone text, created_at timestamptz, order_count bigint, total_spent numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, p.email, p.phone, p.created_at,
    count(o.id) AS order_count,
    COALESCE(sum(o.total) FILTER (WHERE o.status <> 'cancelled'), 0)::numeric AS total_spent
  FROM profiles p LEFT JOIN orders o ON o.user_id = p.id
  GROUP BY p.id ORDER BY p.created_at DESC;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_customers() TO authenticated;

-- ===== Seed =====
INSERT INTO public.store_settings (id, store_address) VALUES (1, 'TrendyToyz, India') ON CONFLICT DO NOTHING;

INSERT INTO public.couriers (name, tracking_url_template, sort_order) VALUES
 ('DTDC', 'https://www.dtdc.in/tracking.asp?awb={AWB}', 1),
 ('Maruti Courier', NULL, 2),
 ('Xpressbees', 'https://www.xpressbees.com/shipment/tracking?awbNo={AWB}', 3),
 ('Delhivery', 'https://www.delhivery.com/track/package/{AWB}', 4),
 ('Fast Track', NULL, 5),
 ('Shadowfax', 'https://tracker.shadowfax.in/#/track/{AWB}', 6),
 ('India Post', 'https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx', 7),
 ('Blue Dart', 'https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo={AWB}', 8),
 ('Ecom Express', 'https://ecomexpress.in/tracking/?awb_field={AWB}', 9),
 ('Amazon Shipping', 'https://track.amazon.in/tracking/{AWB}', 10),
 ('Other', NULL, 11);

INSERT INTO public.categories (id, name, slug, image_url, sort_order) VALUES
 ('11111111-0000-0000-0000-000000000001','Soft Toys','soft-toys','/images/teddy.jpg',1),
 ('11111111-0000-0000-0000-000000000002','Cars & Vehicles','cars-vehicles','/images/car.jpg',2),
 ('11111111-0000-0000-0000-000000000003','Building Blocks','building-blocks','/images/blocks.jpg',3),
 ('11111111-0000-0000-0000-000000000004','Space & Science','space-science','/images/rocket.jpg',4);

INSERT INTO public.products (id, name, slug, category_id, short_description, description, price, mrp, sku, stock, status, is_featured, shipping_enabled, shipping_charge, in_package, age_group, brand, tags) VALUES
 ('22222222-0000-0000-0000-000000000001','Cuddly Brown Teddy Bear (40 cm)','cuddly-brown-teddy-bear','11111111-0000-0000-0000-000000000001','Super soft teddy with a red bow tie.','A huggable, super-soft plush teddy bear with a cute red bow. Made with child-safe materials and stitched eyes.',599,999,'TT-SOFT-001',25,'active',true,true,49,'1 x Teddy Bear','0+ years','TrendyToyz','{teddy,plush,gift}'),
 ('22222222-0000-0000-0000-000000000002','Mini Teddy Pair','mini-teddy-pair','11111111-0000-0000-0000-000000000001','Two tiny teddies for best friends.','A pair of small plush teddies, perfect as gifts and bag charms.',349,499,'TT-SOFT-002',4,'active',false,false,0,'2 x Mini Teddy Bear','3+ years','TrendyToyz','{teddy,plush}'),
 ('22222222-0000-0000-0000-000000000003','Red Racer Pull-Back Car','red-racer-pull-back-car','11111111-0000-0000-0000-000000000002','Pull back and watch it zoom!','A shiny red pull-back sports car with rubber tyres and opening doors.',449,699,'TT-CAR-001',40,'active',true,true,40,'1 x Red Car','3+ years','TrendyToyz','{car,vehicle}'),
 ('22222222-0000-0000-0000-000000000004','City Vehicles Set (3 cars)','city-vehicles-set','11111111-0000-0000-0000-000000000002','Police, taxi and fire truck.','Three die-cast city vehicles for endless pretend play.',799,1199,'TT-CAR-002',15,'active',false,false,0,'1 x Police Car, 1 x Taxi, 1 x Fire Truck','3+ years','TrendyToyz','{car,set}'),
 ('22222222-0000-0000-0000-000000000005','Rainbow Building Blocks (120 pcs)','rainbow-building-blocks','11111111-0000-0000-0000-000000000003','Build anything you imagine.','120 colourful, compatible building bricks in a reusable box.',999,1499,'TT-BLK-001',30,'active',true,true,60,'120 x Building Blocks, 1 x Storage Box','4+ years','TrendyToyz','{blocks,learning}'),
 ('22222222-0000-0000-0000-000000000006','Light-Up Space Rocket','light-up-space-rocket','11111111-0000-0000-0000-000000000004','Rocket with lights and sounds.','Press the button for blast-off lights and sounds. Batteries included.',699,999,'TT-SPC-001',20,'active',true,false,0,'1 x Rocket, 3 x AA Batteries','3+ years','TrendyToyz','{rocket,space}');

INSERT INTO public.product_images (product_id, url, sort_order) VALUES
 ('22222222-0000-0000-0000-000000000001','/images/teddy.jpg',0),
 ('22222222-0000-0000-0000-000000000002','/images/teddy.jpg',0),
 ('22222222-0000-0000-0000-000000000003','/images/car.jpg',0),
 ('22222222-0000-0000-0000-000000000004','/images/car.jpg',0),
 ('22222222-0000-0000-0000-000000000005','/images/blocks.jpg',0),
 ('22222222-0000-0000-0000-000000000006','/images/rocket.jpg',0);

INSERT INTO public.banners (title, subtitle, desktop_image_url, mobile_image_url, link_url, sort_order) VALUES
 ('Toys that make them smile','New arrivals every week','/images/banner.jpg','/images/banner.jpg','/products',1);
