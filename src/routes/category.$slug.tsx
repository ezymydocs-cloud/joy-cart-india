import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ProductListing, useCategories, type ListingFilters } from "@/components/site/ProductListing";
import { formatCategoryName } from "@/lib/format";

export const Route = createFileRoute("/category/$slug")({
  head: () => ({
    meta: [
      { title: "Shop by Category | TrendyToyz" },
      { name: "description", content: "Browse toys in this TrendyToyz category." },
      { property: "og:title", content: "Shop by Category | TrendyToyz" },
      { property: "og:description", content: "Browse toys in this TrendyToyz category." },
    ],
  }),
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const cats = useCategories();
  const cat = cats.data?.find((c) => c.slug === slug);
  const [f, setF] = useState<ListingFilters>({});

  if (cats.data && !cat)
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <div className="text-5xl">🧸</div>
        <h2 className="mt-3 text-lg font-bold">Category not found</h2>
        <p className="mt-1 text-xs text-muted-foreground">The category you requested does not exist or has been removed.</p>
        <Link to="/categories" className="mt-4 inline-block text-xs font-bold text-secondary">
          ← View all categories
        </Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <Link to="/categories" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
          ← Back to all categories
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {cat ? formatCategoryName(cat.name) : "Loading category…"}
        </h1>
      </div>
      <ProductListing hideCategory filters={{ ...f, category: slug }} onChange={(n) => setF({ ...n, category: undefined })} />
    </div>
  );
}
