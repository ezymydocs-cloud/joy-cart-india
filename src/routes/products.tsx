import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { ProductListing, type ListingFilters } from "@/components/site/ProductListing";
import { getCanonicalUrl, DEFAULT_OG_IMAGE, SITE_URL } from "@/lib/seo";

const search = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  categories: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  sort: z.enum(["new", "price_asc", "price_desc", "popular", "discount"]).optional(),
  discount: z.number().optional(),
  in_stock: z.boolean().optional(),
  page: z.number().int().min(1).optional(),
});

export const Route = createFileRoute("/products")({
  validateSearch: search,
  head: () => {
    // Canonical points strictly to clean base URL /products, ignoring sort/filter query params
    const canonical = getCanonicalUrl("/products");
    const title = "All Toys & Games Collection | Buy Online India | TrendyToyz";
    const description =
      "Browse our complete catalog of 100% certified child-safe toys, diecast cars, building blocks, and games. Fast pan-India delivery & best prices.";

    const collectionSchema = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "All Toys & Games Collection",
      url: canonical,
      description,
    };

    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Toys", item: canonical },
      ],
    };

    return {
      meta: [
        { title },
        { name: "description", content: description },
        // Open Graph
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "TrendyToyz" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: canonical },
        { property: "og:image", content: DEFAULT_OG_IMAGE },
        // Twitter
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: DEFAULT_OG_IMAGE },
      ],
      links: [{ rel: "canonical", href: canonical }],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(collectionSchema) },
        { type: "application/ld+json", children: JSON.stringify(breadcrumbSchema) },
      ],
    };
  },
  component: Products,
});

function Products() {
  const s = Route.useSearch();
  const nav = useNavigate({ from: "/products" });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
          {s.q ? `Search results for "${s.q}"` : "All Toys & Games"}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Explore India's best collection of safe, engaging, and premium toys.
        </p>
      </div>

      <ProductListing
        key={s.q ?? ""}
        filters={s as ListingFilters}
        onChange={(newFilters) => {
          nav({ search: newFilters as any, replace: true });
        }}
      />
    </div>
  );
}
