CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  badge text DEFAULT 'SPECIAL OFFER',
  discount_type text NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'flat', 'bogo', 'free_shipping')),
  discount_value numeric NOT NULL DEFAULT 0,
  coupon_code text,
  min_order_value numeric NOT NULL DEFAULT 0,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz,
  image_url text,
  link_url text DEFAULT '/products',
  display_location text NOT NULL DEFAULT 'all' CHECK (display_location IN ('all', 'homepage', 'announcement', 'popup')),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.offers TO anon, authenticated;
GRANT ALL ON public.offers TO service_role;
GRANT INSERT, UPDATE, DELETE, SELECT ON public.offers TO authenticated;

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'offers' AND policyname = 'public offers'
  ) THEN
    CREATE POLICY "public offers" ON public.offers FOR SELECT TO anon, authenticated USING (is_active OR public.is_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'offers' AND policyname = 'admin manage offers'
  ) THEN
    CREATE POLICY "admin manage offers" ON public.offers FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;

INSERT INTO public.offers (title, description, badge, discount_type, discount_value, coupon_code, min_order_value, link_url, display_location, sort_order, is_active)
VALUES 
  ('Welcome Toy Fest', 'Get 10% instant discount on your order across all collections', 'WELCOME OFFER', 'percentage', 10, 'TOYZ10', 0, '/products', 'all', 1, true),
  ('Mega Block & Puzzle Bonanza', 'Flat ₹150 OFF on premium STEM sets and building blocks on orders above ₹799', 'WEEKEND DEAL', 'flat', 150, 'BLOCKS150', 799, '/category/puzzle-and-blocks', 'homepage', 2, true),
  ('Free Pan-India Delivery', 'Free fast express shipping on all prepaid & COD toy orders above ₹499', 'FREE SHIPPING', 'free_shipping', 0, NULL, 499, '/products', 'all', 3, true)
ON CONFLICT DO NOTHING;
