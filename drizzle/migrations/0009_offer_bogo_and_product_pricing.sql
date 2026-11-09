ALTER TABLE public.offers 
  ADD COLUMN IF NOT EXISTS bogo_buy_qty integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS bogo_get_qty integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pricing_type text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS pricing_percentage numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_direction text DEFAULT 'decrease',
  ADD COLUMN IF NOT EXISTS product_prices jsonb DEFAULT '[]'::jsonb;
