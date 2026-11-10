/**
 * Image resolution and optimization utilities for TrendyToyz
 */

const SUPABASE_STORAGE_BASE = "https://hhrgtxpupgzjzstfzclw.supabase.co/storage/v1/object/public";

export const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  "toy-guns": "/images/blocks.jpg",
  "dolls-doll-sets": "/images/teddy.jpg",
  "soft-toys": "/images/teddy.jpg",
  "cars-vehicles": "/images/car.jpg",
  "die-cast-models": "/images/car.jpg",
  "building-blocks": "/images/blocks.jpg",
  "puzzel-blocks": "/images/blocks.jpg",
  "learning-toys": "/images/rocket.jpg",
  "electronic-toys": "/images/banner.jpg",
  "musical-toys": "/images/banner.jpg",
  "role-play-toys": "/images/teddy.jpg",
  "3d-home-decore": "/images/car.jpg",
};

export const DEFAULT_PRODUCT_FALLBACK = "/images/teddy.jpg";
export const DEFAULT_CATEGORY_FALLBACK = "/images/teddy.jpg";

/**
 * Resolves an image URL:
 * Converts legacy `/api/public/img/$bucket/$path` to direct Supabase Public CDN URL
 * avoiding Node.js server proxy socket closures and latency.
 */
export function resolveImageUrl(
  url?: string | null,
  categorySlug?: string | null
): string {
  if (!url || !url.trim()) {
    if (categorySlug && CATEGORY_FALLBACK_IMAGES[categorySlug]) {
      return CATEGORY_FALLBACK_IMAGES[categorySlug];
    }
    return DEFAULT_PRODUCT_FALLBACK;
  }

  const trimmed = url.trim();

  // If already absolute Supabase storage URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  // Convert `/api/public/img/bucket/path` -> `https://.../storage/v1/object/public/bucket/path`
  if (trimmed.startsWith("/api/public/img/")) {
    const sub = trimmed.replace(/^\/api\/public\/img\//, "");
    return `${SUPABASE_STORAGE_BASE}/${sub}`;
  }

  return trimmed;
}
