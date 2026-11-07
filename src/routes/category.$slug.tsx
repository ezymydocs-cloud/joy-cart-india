import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ProductListing, useCategories, type ListingFilters } from "@/components/site/ProductListing";

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
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <p className="font-bold">Category not found.</p>
        <Link to="/categories" className="text-secondary">See all categories</Link>
      </div>
    );
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="mb-4 text-3xl">{cat?.name ?? "…"}</h1>
      <ProductListing hideCategory filters={{ ...f, category: slug }} onChange={(n) => setF({ ...n, category: undefined })} />
    </div>
  );
}
