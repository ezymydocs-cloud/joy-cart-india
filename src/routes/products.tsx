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
      { title: "Shop All Toys | TrendyToyz" },
      { name: "description", content: "Browse all TrendyToyz toys. Search, filter by category and price, and sort." },
      { property: "og:title", content: "Shop All Toys | TrendyToyz" },
      { property: "og:description", content: "Browse all TrendyToyz toys with search, filters and sorting." },
    ],
  }),
  component: Products,
});

function Products() {
  const s = Route.useSearch();
  const nav = useNavigate({ from: "/products" });
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="mb-4 text-3xl">{s.q ? `Results for "${s.q}"` : "All toys"}</h1>
      <ProductListing key={s.q ?? ""} filters={s} onChange={(f) => nav({ search: f, replace: true })} />
    </div>
  );
}
