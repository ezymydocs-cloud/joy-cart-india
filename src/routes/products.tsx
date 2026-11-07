import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { ProductListing } from "@/components/site/ProductListing";

const search = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  sort: z.enum(["new", "price_asc", "price_desc", "popular"]).optional(),
});

export const Route = createFileRoute("/products")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Shop All Toys | TrendyToyze" },
      { name: "description", content: "Browse all TrendyToyze toys. Search, filter by category and price, and sort." },
      { property: "og:title", content: "Shop All Toys | TrendyToyze" },
      { property: "og:description", content: "Browse all TrendyToyze toys with search, filters and sorting." },
    ],
  }),
  component: Products,
});

function Products() {
  const s = Route.useSearch();
  const nav = useNavigate({ from: "/products" });
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {s.q ? `Search results for "${s.q}"` : "All Toys & Games"}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Explore India's best collection of safe, engaging, and premium toys.
        </p>
      </div>
      <ProductListing key={s.q ?? ""} filters={s} onChange={(f) => nav({ search: f, replace: true })} />
    </div>
  );
}
