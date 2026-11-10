ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS flash_deals_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flash_deals_title text DEFAULT 'Deal of the Day',
  ADD COLUMN IF NOT EXISTS flash_deals_subtitle text DEFAULT 'Limited Stock Available',
  ADD COLUMN IF NOT EXISTS flash_deals_end_time timestamptz,
  ADD COLUMN IF NOT EXISTS flash_deals_product_ids jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS flash_deals_custom_discounts jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS announcement_bar_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS announcement_messages jsonb DEFAULT '[]'::jsonb;
