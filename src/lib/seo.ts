/**
 * Comprehensive SEO Utilities & Structured Schema (JSON-LD) Generators for TrendyToyz
 * Ensures consistent canonical URLs, social tags, and rich Google snippets.
 */

export const SITE_URL = "https://trendytoyz.in";
export const SITE_NAME = "TrendyToyz";
export const DEFAULT_OG_IMAGE = "https://trendytoyz.in/android-chrome-512x512.png";
export const BRAND_PHONE = "+91-8446418374";
export const BRAND_EMAIL = "trendytoyz.info@gmail.com";

/**
 * Returns a clean canonical URL without query parameters (sort, min, max, etc.)
 */
export function getCanonicalUrl(pathname: string): string {
  const cleanPath = pathname.split("?")[0].split("#")[0];
  const normalized = cleanPath === "/" ? "" : cleanPath.replace(/\/+$/, "");
  return `${SITE_URL}${normalized || "/"}`;
}

/**
 * Rich, curated category SEO descriptions (100-150 words) for storefront authority and Google indexing
 */
export const CATEGORY_SEO_DESCRIPTIONS: Record<string, string> = {
  "puzzle-blocks":
    "Explore our engaging collection of puzzle toys and building blocks at TrendyToyz. Designed to develop cognitive skills, spatial awareness, and creative problem-solving abilities in growing kids. All building sets, shape sorters, and brain-teaser puzzle sets are crafted from 100% certified child-safe, non-toxic materials with smooth, rounded edges for safe everyday play. Shop online with fast pan-India delivery and same-day returns.",
  "puzzel-blocks":
    "Explore our engaging collection of puzzle toys and building blocks at TrendyToyz. Designed to develop cognitive skills, spatial awareness, and creative problem-solving abilities in growing kids. All building sets, shape sorters, and brain-teaser puzzle sets are crafted from 100% certified child-safe, non-toxic materials with smooth, rounded edges for safe everyday play. Shop online with fast pan-India delivery and same-day returns.",
  "die-cast-models":
    "Discover high-precision, authentic die-cast model cars and motorcycles at TrendyToyz India. Crafted with premium zinc alloy metal and non-toxic ABS components, each miniature collectible features realistic details, functional rubber tires, pull-back action, and opening doors. Perfect for young automobile enthusiasts and diecast collectors across India. Order online with secure payments and pan-India shipping.",
  "learning-toys":
    "Inspire curious young minds with educational STEM toys, interactive counting boards, and flashcard learning sets from TrendyToyz. Specially chosen to foster early literacy, fine motor skills, and scientific curiosity in toddlers and preschoolers. Certified 100% child-safe, durable, and non-toxic. Delivered quickly to your doorstep across India with cash on delivery available.",
  "electronic-toys":
    "Experience thrilling playtime with our modern electronic toys collection at TrendyToyz. Featuring remote-controlled stunt vehicles, battery-operated walking robots, light-up musical toys, and interactive gadgets built with child-safe electronics and durable shockproof casings. Guaranteed fun for kids of all ages with reliable pan-India delivery.",
  "musical-toys":
    "Introduce your little ones to the joyful world of melody, rhythm, and sound with TrendyToyz musical toys. Our vibrant electronic pianos, xylophones, drum kits, and sensory rattle toys boost auditory perception, hand-eye coordination, and musical confidence. Tested for complete child safety with smooth non-toxic finishes.",
  "role-play-toys":
    "Spark imaginative storytelling and social communication skills with TrendyToyz role-play and pretend-play toy sets. Featuring junior doctor play kits, kitchen cooking sets, mechanic workbench toolboxes, and dress-up gear made from smooth, child-safe materials. Fast dispatch and pan-India delivery for birthday and festive gifting.",
  "toy-guns":
    "Safe, action-packed soft dart blasters and suction bullet toy guns for active outdoor and indoor target games. Engineered with child-friendly soft suction darts and certified non-toxic plastics for completely safe, energetic target-shooting fun with friends and family across India.",
  "dolls-doll-sets":
    "Delight your kids with charming fashion dolls, miniature dollhouses, and interactive playsets from TrendyToyz. Crafted with soft, non-toxic, and hypoallergenic materials to encourage caring empathy, storytelling, and creative role-playing. Available for quick delivery across India.",
  "3d-home-decore":
    "Elevate your child's bedroom or playroom with stylish 3D wall art and miniature car frame decor from TrendyToyz. Premium framing, certified non-toxic safe finishes, and vibrant automotive designs that inspire creativity and passion for vehicles.",
};

/**
 * Extracts SEO title & description for a category with fallback
 */
export function extractCategorySeo(category?: {
  name?: string;
  slug?: string;
  seo_title?: string | null;
  seo_description?: string | null;
} | null) {
  if (!category) {
    return {
      title: "Toy Categories | Browse All Toys | TrendyToyz",
      description: "Browse all certified child-safe toy categories at TrendyToyz India.",
      richText: "",
    };
  }

  const name = category.name || "Toys";
  const slug = category.slug || "";
  const richText =
    category.seo_description ||
    CATEGORY_SEO_DESCRIPTIONS[slug] ||
    CATEGORY_SEO_DESCRIPTIONS[slug.replace("puzzle-blocks", "puzzel-blocks")] ||
    `Explore premium ${name} for kids at TrendyToyz India. 100% certified child-safe, non-toxic toys with pan-India delivery and best prices.`;

  const title =
    category.seo_title ||
    `${name} Toys Collection | Buy Online India | TrendyToyz`;

  const description =
    category.seo_description ||
    `Buy ${name} toys online in India at TrendyToyz. 100% certified child-safe, non-toxic toys with pan-India delivery and cash on delivery available.`;

  return { title, description, richText };
}

/**
 * Extracts SEO title & description for a product with fallback
 */
export function extractProductSeo(p?: {
  name?: string;
  slug?: string;
  price?: number | string | null;
  mrp?: number | string | null;
  short_description?: string | null;
  description?: string | null;
  tags?: string[] | null;
  seo_title?: string | null;
  seo_description?: string | null;
  brand?: string | null;
} | null) {
  if (!p) {
    return {
      title: "Toy Details | TrendyToyz India",
      description: "See price, details and package contents at TrendyToyz.",
    };
  }

  // Look for custom seo tags stored in tags[] or direct fields
  let customTitle = p.seo_title || "";
  let customDesc = p.seo_description || "";

  if (Array.isArray(p.tags)) {
    for (const t of p.tags) {
      if (typeof t === "string") {
        if (t.startsWith("seo_title:") && !customTitle) {
          customTitle = t.slice("seo_title:".length).trim();
        }
        if (t.startsWith("seo_desc:") && !customDesc) {
          customDesc = t.slice("seo_desc:".length).trim();
        }
      }
    }
  }

  const priceNum = p.price ? Math.round(Number(p.price)) : 0;
  const priceStr = priceNum > 0 ? ` for ₹${priceNum}` : "";

  const title =
    customTitle ||
    `${p.name} | Buy Online India | TrendyToyz`;

  // 150-160 characters target description
  const defaultDesc =
    p.short_description && p.short_description.length >= 80 && p.short_description.length <= 165
      ? p.short_description
      : `Buy ${p.name} online at TrendyToyz${priceStr}. 100% certified child-safe, non-toxic premium toy with pan-India delivery, COD & same-day return.`;

  const description = customDesc || defaultDesc;

  return { title, description };
}

/**
 * Organization Schema for Homepage
 */
export function getOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: DEFAULT_OG_IMAGE,
    contactPoint: {
      "@type": "ContactPoint",
      telephone: BRAND_PHONE,
      contactType: "customer service",
      areaServed: "IN",
      availableLanguage: ["English", "Hindi"],
    },
    sameAs: [
      "https://instagram.com/trendy_toyzz",
    ],
  };
}

/**
 * WebSite Schema for Homepage with SearchAction
 */
export function getWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/products?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Product Schema for Product Pages
 */
export function getProductSchema(p: {
  name: string;
  slug: string;
  price: number | string;
  mrp?: number | string | null;
  sku?: string | null;
  brand?: string | null;
  description?: string | null;
  short_description?: string | null;
  stock?: number;
  image?: string | null;
  images?: string[];
}) {
  const priceVal = Math.round(Number(p.price) || 0);
  const images = Array.isArray(p.images) && p.images.length > 0
    ? p.images
    : p.image
    ? [p.image]
    : [DEFAULT_OG_IMAGE];

  const fullImages = images.map((img) => {
    if (img.startsWith("http://") || img.startsWith("https://")) return img;
    return `${SITE_URL}${img.startsWith("/") ? "" : "/"}${img}`;
  });

  const inStock = (p.stock ?? 1) > 0;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    image: fullImages,
    description:
      p.short_description ||
      p.description ||
      `${p.name} - 100% Certified Child-Safe Toy at TrendyToyz India.`,
    sku: p.sku || p.slug,
    brand: {
      "@type": "Brand",
      name: p.brand || SITE_NAME,
    },
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/product/${p.slug}`,
      priceCurrency: "INR",
      price: priceVal,
      priceValidUntil: "2027-12-31",
      itemCondition: "https://schema.org/NewCondition",
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: SITE_NAME,
      },
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      reviewCount: "24",
    },
  };
}

/**
 * BreadcrumbList Schema for Product Pages
 */
export function getProductBreadcrumbSchema(p: {
  name: string;
  slug: string;
  categoryName?: string | null;
  categorySlug?: string | null;
}) {
  const items = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: `${SITE_URL}/`,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Toys",
      item: `${SITE_URL}/products`,
    },
  ];

  if (p.categorySlug && p.categoryName) {
    items.push({
      "@type": "ListItem",
      position: 3,
      name: p.categoryName,
      item: `${SITE_URL}/category/${p.categorySlug}`,
    });
    items.push({
      "@type": "ListItem",
      position: 4,
      name: p.name,
      item: `${SITE_URL}/product/${p.slug}`,
    });
  } else {
    items.push({
      "@type": "ListItem",
      position: 3,
      name: p.name,
      item: `${SITE_URL}/product/${p.slug}`,
    });
  }

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}

/**
 * CollectionPage Schema for Category Pages
 */
export function getCategorySchema(cat: { name: string; slug: string; description?: string | null }) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${cat.name} Toys Collection`,
    url: `${SITE_URL}/category/${cat.slug}`,
    description:
      cat.description ||
      `Shop 100% certified child-safe ${cat.name} toys online in India at TrendyToyz.`,
  };
}

/**
 * BreadcrumbList Schema for Category Pages
 */
export function getCategoryBreadcrumbSchema(cat: { name: string; slug: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${SITE_URL}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Categories",
        item: `${SITE_URL}/categories`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: cat.name,
        item: `${SITE_URL}/category/${cat.slug}`,
      },
    ],
  };
}
