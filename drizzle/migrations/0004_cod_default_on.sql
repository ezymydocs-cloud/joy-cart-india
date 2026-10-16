ALTER TABLE public.products ALTER COLUMN cod_enabled SET DEFAULT true;
UPDATE public.products SET cod_enabled = true WHERE cod_enabled = false;
COMMENT ON COLUMN public.products.cod_enabled IS 'Per-product Cash on Delivery toggle; defaults to enabled.';