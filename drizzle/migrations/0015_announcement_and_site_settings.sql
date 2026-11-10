-- Migration 0015: Top Announcement Bar & Store Header Settings
-- Allows full admin control of Top Banner (ON/OFF, left/center/right text, icons, colors, schedule, phone)

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS announcement_bar_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS announcement_left_text text DEFAULT 'Pan-India Safe Delivery',
  ADD COLUMN IF NOT EXISTS announcement_left_icon text DEFAULT 'truck',
  ADD COLUMN IF NOT EXISTS announcement_left_link text DEFAULT '',
  ADD COLUMN IF NOT EXISTS announcement_center_messages jsonb DEFAULT '[
    {"id": "msg-1", "text": "100% Child-Safe, Certified & Non-Toxic Premium Toys for Kids", "icon": "shield", "link": ""},
    {"id": "msg-2", "text": "Fast Pan-India Delivery · Same-Day Return Policy on Delivery Date", "icon": "truck", "link": ""}
  ]'::jsonb,
  ADD COLUMN IF NOT EXISTS announcement_right_text text DEFAULT 'Support: +91 8446418374',
  ADD COLUMN IF NOT EXISTS announcement_right_icon text DEFAULT 'phone',
  ADD COLUMN IF NOT EXISTS announcement_right_link text DEFAULT 'https://wa.me/918446418374',
  ADD COLUMN IF NOT EXISTS announcement_bg_color text DEFAULT '#0f172a',
  ADD COLUMN IF NOT EXISTS announcement_text_color text DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS announcement_support_phone text DEFAULT '+91 8446418374',
  ADD COLUMN IF NOT EXISTS favicon_url text;

-- Ensure default row id = 1 exists with defaults
INSERT INTO public.store_settings (id, store_name, announcement_bar_enabled)
VALUES (1, 'TrendyToyz', true)
ON CONFLICT (id) DO UPDATE
SET updated_at = now();
