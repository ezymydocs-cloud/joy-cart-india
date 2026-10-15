import { supabase } from "@/integrations/supabase/client";

export type ProductImage = { id: string; url: string; sort_order: number; storage_path?: string | null };
export type Product = {
  id: string;
  name: string;
  slug: string;
  category_id: string | null;
  short_description: string | null;
  description: string | null;
  price: number;
  mrp: number | null;
  sku: string | null;
  stock: number;
  status: string;
  is_featured: boolean;
  shipping_enabled: boolean;
  shipping_charge: number;
  in_package: string | null;
  age_group: string | null;
  brand: string | null;
  tags: string[];
  created_at: string;
  product_images: ProductImage[];
  categories?: { name: string; slug: string } | null;
};

export const PRODUCT_SELECT = "*, product_images(id,url,sort_order,storage_path), categories(name,slug)";

export const mainImage = (p: { product_images?: ProductImage[] }) =>
  [...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? "/images/teddy.jpg";

export const sortedImages = (p: { product_images?: ProductImage[] }) => [...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);

export async function fetchSettings() {
  const { data, error } = await supabase.from("store_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw error;
  return data;
}

export const STORAGE_BUCKETS = ["product-images", "banners", "categories"] as const;
export type Bucket = (typeof STORAGE_BUCKETS)[number];

/** Uploads a device file and returns the app URL that serves it. */
export async function uploadImage(bucket: Bucket, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed");
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5 MB");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return { path, url: `/api/public/img/${bucket}/${path}` };
}
