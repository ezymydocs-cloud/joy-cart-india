import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { ProductListing, useCategories, type ListingFilters } from "@/components/site/ProductListing";
import { formatCategoryName } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import {
  extractCategorySeo,
  getCanonicalUrl,
  getCategorySchema,
  getCategoryBreadcrumbSchema,
  toAbsolutePublicImageUrl,
  DEFAULT_OG_IMAGE,
  SITE_URL,
} from "@/lib/seo";

export const Route = createFileRoute("/category/$slug")({
  beforeLoad: ({ params }) => {
    // 301-equivalent client/SSR redirect from legacy puzzel-blocks to puzzle-blocks
    if (params.slug === "puzzel-blocks") {
      throw redirect({
        to: "/category/$slug",
        params: { slug: "puzzle-blocks" },
        statusCode: 301,
      });
    }
  },
  loader: async ({ params }) => {
    const cleanSlug = params.slug === "puzzel-blocks" ? "puzzle-blocks" : params.slug;
    const { data } = await supabase
      .from("categories")
      .select("id, name, slug, image_url, is_active")
      .eq("slug", cleanSlug)
      .maybeSingle();
    return { category: data };
  },
  head: ({ loaderData, params }) => {
    const slug = params.slug === "puzzel-blocks" ? "puzzle-blocks" : params.slug;
    const cat = loaderData?.category;
    const seo = extractCategorySeo(cat || { name: formatCategoryName(slug.replace(/-/g, " ")), slug });
    const canonical = getCanonicalUrl(`/category/${slug}`);
    const catName = cat?.name ? formatCategoryName(cat.name) : formatCategoryName(slug.replace(/-/g, " "));

    const ogImage = toAbsolutePublicImageUrl(cat?.image_url, DEFAULT_OG_IMAGE);

    const collectionSchema = getCategorySchema({
      name: catName,
      slug,
      description: seo.richText,
      image_url: ogImage,
    });
    const breadcrumbSchema = getCategoryBreadcrumbSchema({
      name: catName,
      slug,
    });

    return {
      meta: [
        { title: seo.title },
        { name: "description", content: seo.description },
        // Open Graph
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "TrendyToyz" },
        { property: "og:title", content: seo.title },
        { property: "og:description", content: seo.description },
        { property: "og:url", content: canonical },
        { property: "og:image", content: ogImage },
        // Twitter
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: seo.title },
        { name: "twitter:description", content: seo.description },
        { name: "twitter:image", content: ogImage },
      ],
      links: [{ rel: "canonical", href: canonical }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(collectionSchema),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify(breadcrumbSchema),
        },
      ],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const loaderData = Route.useLoaderData();
  const cats = useCategories();
  const cleanSlug = slug === "puzzel-blocks" ? "puzzle-blocks" : slug;

  // Use loaded category or query list match
  const cat = loaderData?.category || cats.data?.find((c) => c.slug === cleanSlug);
  const [f, setF] = useState<ListingFilters>({});

  const seo = extractCategorySeo(cat || { name: cleanSlug.replace(/-/g, " "), slug: cleanSlug });
  const catDisplayName = cat?.name ? formatCategoryName(cat.name) : formatCategoryName(cleanSlug.replace(/-/g, " "));

  if (cats.data && !cat && !loaderData?.category) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <div className="text-5xl">🧸</div>
        <h2 className="mt-3 text-lg font-bold">Category not found</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          The category you requested does not exist or has been removed.
        </p>
        <Link to="/categories" className="mt-4 inline-block text-xs font-bold text-secondary">
          ← View all categories
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <span>/</span>
        <Link to="/categories" className="hover:text-foreground">Categories</Link>
        <span>/</span>
        <span className="font-semibold text-secondary">{catDisplayName}</span>
      </nav>

      <div className="mb-6">
        <Link to="/categories" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
          ← Back to all categories
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {catDisplayName} Toys
        </h1>
        {seo.richText && (
          <p className="mt-2.5 max-w-4xl text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {seo.richText}
          </p>
        )}
      </div>

      <ProductListing
        hideCategory
        filters={{ ...f, category: cleanSlug }}
        onChange={(n) => setF({ ...n, category: undefined })}
      />
    </div>
  );
}
