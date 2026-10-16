
CREATE POLICY "admin manage store images" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id IN ('product-images','banners','categories') AND public.is_admin())
  WITH CHECK (bucket_id IN ('product-images','banners','categories') AND public.is_admin());
