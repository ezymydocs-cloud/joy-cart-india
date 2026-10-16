import { createFileRoute, Link } from "@tanstack/react-router";
import { useCategories } from "@/components/site/ProductListing";

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title: "Toy Categories | TrendyToyz" },
      { name: "description", content: "Explore TrendyToyz categories: soft toys, cars, building blocks and more." },
      { property: "og:title", content: "Toy Categories | TrendyToyz" },
      { property: "og:description", content: "Explore all toy categories at TrendyToyz." },
    ],
  }),
  component: Cats,
});

function Cats() {
  const { data, isLoading } = useCategories();
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="mb-5 text-3xl">Categories</h1>
      {isLoading ? <div className="h-40 animate-pulse rounded-2xl bg-muted" /> : !data?.length ? <p className="text-muted-foreground">No categories yet.</p> : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {data.map((c) => (
            <Link key={c.id} to="/category/$slug" params={{ slug: c.slug }} className="overflow-hidden rounded-2xl border p-3 text-center hover:shadow-card">
              <div className="aspect-square overflow-hidden rounded-2xl bg-muted">{c.image_url && <img src={c.image_url} alt={c.name} className="size-full object-cover" loading="lazy" />}</div>
              <div className="mt-2 font-display text-lg">{c.name}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
