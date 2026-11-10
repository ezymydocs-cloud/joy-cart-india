import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { ProductListing, type ListingFilters } from "@/components/site/ProductListing";

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
  head: () => ({
    meta: [
      { title: "Shop All Toys & Games | TrendyToyz India" },
      {
        name: "description",
        content:
          "Browse TrendyToyz catalog: soft toys, diecast vehicles, building blocks, and games with advanced filters and fast pan-India delivery.",
      },
      { property: "og:title", content: "Shop All Toys | TrendyToyz" },
      { property: "og:description", content: "Filter toys by category, price, discount, and stock." },
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
