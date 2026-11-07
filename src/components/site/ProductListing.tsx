import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, X, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_SELECT, type Product } from "@/lib/catalog";
import { ProductCard, ProductGridSkeleton, ErrorBox } from "./ProductCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export type ListingFilters = {
  q?: string;
  category?: string;
  min?: number;
  max?: number;
  sort?: "new" | "price_asc" | "price_desc" | "popular";
};

export function useCategories() {
  return useQuery({
    queryKey: ["categories", "public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

export function ProductListing({
  filters,
  onChange,
  hideCategory,
}: {
  filters: ListingFilters;
  onChange: (f: ListingFilters) => void;
  hideCategory?: boolean;
}) {
  const cats = useCategories();
  const catId = filters.category ? cats.data?.find((c) => c.slug === filters.category)?.id : undefined;
  const ready = !filters.category || !!cats.data;

  const q = useQuery({
    queryKey: ["products", filters, catId],
    enabled: ready,
    queryFn: async () => {
      let qb = supabase.from("products").select(PRODUCT_SELECT).eq("status", "active");
      if (filters.category) qb = qb.eq("category_id", catId ?? "00000000-0000-0000-0000-000000000000");
      if (filters.q) qb = qb.ilike("name", `%${filters.q.replace(/[%_]/g, "")}%`);
      if (filters.min != null) qb = qb.gte("price", filters.min);
      if (filters.max != null) qb = qb.lte("price", filters.max);
      const s = filters.sort ?? "new";
      qb =
        s === "price_asc"
          ? qb.order("price")
          : s === "price_desc"
          ? qb.order("price", { ascending: false })
          : s === "popular"
          ? qb.order("is_featured", { ascending: false }).order("created_at", { ascending: false })
          : qb.order("created_at", { ascending: false });
      const { data, error } = await qb.limit(200);
      if (error) throw error;
      return data as unknown as Product[];
    },
  });

  const num = (v: string) => (v === "" ? undefined : Math.max(0, Number(v)));

  const hasActiveFilters = Boolean(
    filters.q || (filters.category && !hideCategory) || filters.min != null || filters.max != null
  );

  const clearAllFilters = () => {
    onChange({
      sort: filters.sort,
      category: hideCategory ? filters.category : undefined,
    });
  };

  const selectedCategoryName = cats.data?.find((c) => c.slug === filters.category)?.name;

  return (
    <div className="space-y-6">
      {/* Modern Filter Bar */}
      <div className="rounded-2xl border bg-card p-4 shadow-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
          {/* Keyword Search Input */}
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              className="rounded-xl pl-9 bg-background"
              placeholder="Filter by toy name or keyword…"
              defaultValue={filters.q ?? ""}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onChange({
                    ...filters,
                    q: (e.target as HTMLInputElement).value.trim() || undefined,
                  });
                }
              }}
              onBlur={(e) => {
                const v = e.target.value.trim() || undefined;
                if (v !== filters.q) onChange({ ...filters, q: v });
              }}
            />
          </div>

          {/* Category Dropdown */}
          {!hideCategory && (
            <Select
              value={filters.category ?? "all"}
              onValueChange={(v) => onChange({ ...filters, category: v === "all" ? undefined : v })}
            >
              <SelectTrigger className="rounded-xl bg-background">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {cats.data?.map((c) => (
                  <SelectItem key={c.id} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Price Range Filter */}
          <div className="flex gap-2">
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              className="rounded-xl bg-background text-xs"
              placeholder="Min ₹"
              defaultValue={filters.min ?? ""}
              onBlur={(e) => onChange({ ...filters, min: num(e.target.value) })}
            />
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              className="rounded-xl bg-background text-xs"
              placeholder="Max ₹"
              defaultValue={filters.max ?? ""}
              onBlur={(e) => onChange({ ...filters, max: num(e.target.value) })}
            />
          </div>

          {/* Sort By Dropdown */}
          <Select
            value={filters.sort ?? "new"}
            onValueChange={(v) => onChange({ ...filters, sort: v as ListingFilters["sort"] })}
          >
            <SelectTrigger className="rounded-xl bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">✨ Newest First</SelectItem>
              <SelectItem value="popular">🔥 Most Popular</SelectItem>
              <SelectItem value="price_asc">Price: Low to High</SelectItem>
              <SelectItem value="price_desc">Price: High to Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="mt-3.5 flex flex-wrap items-center gap-2 pt-3 border-t">
            <span className="text-xs font-semibold text-muted-foreground">Active filters:</span>
            {filters.q && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2.5 py-0.5 text-xs font-semibold text-secondary">
                "{filters.q}"
                <button
                  onClick={() => onChange({ ...filters, q: undefined })}
                  className="hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </span>
            )}
            {filters.category && !hideCategory && selectedCategoryName && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2.5 py-0.5 text-xs font-semibold text-secondary">
                {selectedCategoryName}
                <button
                  onClick={() => onChange({ ...filters, category: undefined })}
                  className="hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </span>
            )}
            {filters.min != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2.5 py-0.5 text-xs font-semibold text-secondary">
                Min ₹{filters.min}
                <button
                  onClick={() => onChange({ ...filters, min: undefined })}
                  className="hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </span>
            )}
            {filters.max != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2.5 py-0.5 text-xs font-semibold text-secondary">
                Max ₹{filters.max}
                <button
                  onClick={() => onChange({ ...filters, max: undefined })}
                  className="hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </span>
            )}
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 text-xs font-bold text-destructive hover:underline ml-auto"
            >
              <RotateCcw className="size-3" /> Reset all
            </button>
          </div>
        )}
      </div>

      {/* Product Grid / States */}
      {q.isLoading || !ready ? (
        <ProductGridSkeleton n={8} />
      ) : q.isError ? (
        <ErrorBox message="Could not load the catalog. Please try again." onRetry={() => q.refetch()} />
      ) : q.data!.length === 0 ? (
        <div className="rounded-3xl border border-dashed bg-card/60 p-12 text-center shadow-xs">
          <div className="text-5xl">🧸</div>
          <h3 className="mt-4 text-base font-bold text-foreground">No matching toys found</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Try adjusting your search terms or clearing price filters.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-5 rounded-xl"
            onClick={clearAllFilters}
          >
            Clear all filters
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing <b className="text-foreground">{q.data!.length}</b> toy
              {q.data!.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-5 lg:grid-cols-4">
            {q.data!.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
