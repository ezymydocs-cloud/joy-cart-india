import { createFileRoute, Link } from "@tanstack/react-router";
import { useCategories } from "@/components/site/ProductListing";
import { formatCategoryName } from "@/lib/format";

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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Shop by Category
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Find toys categorized by age, play type, learning interest, and theme.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-2xl bg-muted/60" />
          ))}
        </div>
      ) : !data?.length ? (
        <p className="text-muted-foreground">No categories available right now.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 md:gap-6">
          {data.map((c) => (
            <Link
              key={c.id}
              to="/category/$slug"
              params={{ slug: c.slug }}
              className="group flex flex-col items-center overflow-hidden rounded-2xl border bg-card p-4 text-center transition-all duration-300 hover:-translate-y-1 hover:border-secondary/40 hover:shadow-hover"
            >
              <div className="aspect-square w-full overflow-hidden rounded-xl bg-muted/60">
                {c.image_url ? (
                  <img
                    src={c.image_url}
                    alt={c.name}
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-108"
                    loading="lazy"
                  />
                ) : (
                  <div className="grid size-full place-items-center text-4xl">🧸</div>
                )}
              </div>
              <div className="mt-3.5 font-display text-base font-bold text-foreground group-hover:text-secondary transition-colors">
                {formatCategoryName(c.name)}
              </div>
              <span className="mt-1 text-xs text-muted-foreground">Browse collection →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
