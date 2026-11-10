import { createFileRoute, Link } from "@tanstack/react-router";
import { useCategories } from "@/components/site/ProductListing";
import { formatCategoryName } from "@/lib/format";
import { SafeImage } from "@/components/ui/SafeImage";
import { getCanonicalUrl, DEFAULT_OG_IMAGE, SITE_URL } from "@/lib/seo";

export const Route = createFileRoute("/categories")({
  head: () => {
    const canonical = getCanonicalUrl("/categories");
    const title = "Toy Categories | Browse Toys by Type | TrendyToyz";
    const description =
      "Explore TrendyToyz categories: Die Cast Models, Learning Toys, Musical Toys, Puzzle & Blocks, Role Play Toys, and more 100% child-safe toys.";

    const breadcrumbs = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Categories", item: canonical },
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
        { type: "application/ld+json", children: JSON.stringify(breadcrumbs) },
      ],
    };
  },
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
              <SafeImage
                src={c.image_url}
                categorySlug={c.slug}
                alt={formatCategoryName(c.name)}
                aspectRatioClass="aspect-square"
                containerClassName="w-full rounded-xl bg-white p-2 border"
                className="size-full object-contain transition-transform duration-500 group-hover:scale-108"
                width={300}
                height={300}
              />
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
