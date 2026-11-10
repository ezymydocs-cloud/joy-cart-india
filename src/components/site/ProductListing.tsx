import { useQuery } from "@tanstack/react-query";
import {
  Search,
  SlidersHorizontal,
  X,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Check,
  Package,
  Percent,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_SELECT, type Product } from "@/lib/catalog";
import { formatCategoryName, inr } from "@/lib/format";
import { ProductCard, ProductGridSkeleton, ErrorBox } from "./ProductCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export type ListingFilters = {
  q?: string;
  category?: string;
  categories?: string; // Comma-separated category slugs for multi-select
  min?: number;
  max?: number;
  sort?: "new" | "price_asc" | "price_desc" | "popular" | "discount";
  discount?: number; // 10, 20, 30, 50
  in_stock?: boolean;
  page?: number;
};

const PAGE_SIZE = 16;

const PRICE_PRESETS = [
  { label: "Under ₹500", min: 0, max: 500 },
  { label: "₹500 - ₹1,000", min: 500, max: 1000 },
  { label: "₹1,000 - ₹2,000", min: 1000, max: 2000 },
  { label: "Above ₹2,000", min: 2000, max: undefined },
];

const DISCOUNT_PRESETS = [
  { label: "All Discounts", value: undefined },
  { label: "10% or more", value: 10 },
  { label: "20% or more", value: 20 },
  { label: "30% or more", value: 30 },
  { label: "50% or more", value: 50 },
];

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
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Local draft states for mobile drawer
  const [draftMin, setDraftMin] = useState<string>(filters.min != null ? String(filters.min) : "");
  const [draftMax, setDraftMax] = useState<string>(filters.max != null ? String(filters.max) : "");

  const page = Math.max(1, filters.page ?? 1);

  // Parse multi-select categories
  const selectedCatSlugs = new Set<string>();
  if (filters.category) selectedCatSlugs.add(filters.category);
  if (filters.categories) {
    filters.categories.split(",").forEach((s) => s.trim() && selectedCatSlugs.add(s.trim()));
  }

  // Map slugs to category IDs for Supabase query
  const matchingCatIds = cats.data
    ?.filter((c) => selectedCatSlugs.has(c.slug))
    .map((c) => c.id);

  const ready = !selectedCatSlugs.size || !!cats.data;

  // Server-side filtered query with count & pagination
  const q = useQuery({
    queryKey: ["products", "catalog", filters, matchingCatIds, page],
    enabled: ready,
    queryFn: async () => {
      let qb = supabase
        .from("products")
        .select(PRODUCT_SELECT, { count: "exact" })
        .eq("status", "active");

      // Category filter (multi-select)
      if (matchingCatIds && matchingCatIds.length > 0) {
        qb = qb.in("category_id", matchingCatIds);
      }

      // Keyword search
      if (filters.q) {
        qb = qb.ilike("name", `%${filters.q.replace(/[%_]/g, "")}%`);
      }

      // Price range
      if (filters.min != null) qb = qb.gte("price", filters.min);
      if (filters.max != null) qb = qb.lte("price", filters.max);

      // In-stock only
      if (filters.in_stock) {
        qb = qb.gt("stock", 0);
      }

      // Sorting
      const s = filters.sort ?? "new";
      if (s === "price_asc") {
        qb = qb.order("price", { ascending: true });
      } else if (s === "price_desc") {
        qb = qb.order("price", { ascending: false });
      } else if (s === "popular") {
        qb = qb.order("is_featured", { ascending: false }).order("created_at", { ascending: false });
      } else {
        qb = qb.order("created_at", { ascending: false });
      }

      // Pagination
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count, error } = await qb.range(from, to);

      if (error) throw error;

      let items = (data as unknown as Product[]) || [];

      // Client post-filter for discount % if specified
      if (filters.discount != null && filters.discount > 0) {
        items = items.filter((p) => {
          if (!p.mrp || Number(p.mrp) <= Number(p.price)) return false;
          const disc = Math.round(((Number(p.mrp) - Number(p.price)) / Number(p.mrp)) * 100);
          return disc >= filters.discount!;
        });
      }

      return { items, totalCount: count ?? items.length };
    },
  });

  const products = q.data?.items || [];
  const totalCount = q.data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const num = (v: string) => (v === "" ? undefined : Math.max(0, Number(v)));

  // Toggle category in multi-select
  const handleToggleCategory = (slug: string) => {
    const next = new Set(selectedCatSlugs);
    if (next.has(slug)) {
      next.delete(slug);
    } else {
      next.add(slug);
    }
    const catArray = Array.from(next);
    onChange({
      ...filters,
      page: 1,
      category: catArray.length === 1 ? catArray[0] : undefined,
      categories: catArray.length > 1 ? catArray.join(",") : undefined,
    });
  };

  const clearAllFilters = () => {
    onChange({
      sort: filters.sort,
      category: hideCategory ? filters.category : undefined,
      page: 1,
    });
    setDraftMin("");
    setDraftMax("");
  };

  const hasActiveFilters = Boolean(
    filters.q ||
      selectedCatSlugs.size > 0 ||
      filters.min != null ||
      filters.max != null ||
      filters.discount != null ||
      filters.in_stock
  );

  const activeFilterCount =
    (filters.q ? 1 : 0) +
    selectedCatSlugs.size +
    (filters.min != null || filters.max != null ? 1 : 0) +
    (filters.discount != null ? 1 : 0) +
    (filters.in_stock ? 1 : 0);

  // Common filter panel content (used in both desktop sidebar and mobile drawer)
  const FilterControls = () => (
    <div className="space-y-6">
      {/* 1. Price Range */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-foreground">
          <span>Price (₹)</span>
          {(filters.min != null || filters.max != null) && (
            <button
              onClick={() => {
                onChange({ ...filters, min: undefined, max: undefined, page: 1 });
                setDraftMin("");
                setDraftMax("");
              }}
              className="text-[11px] font-semibold text-secondary hover:underline"
            >
              Reset
            </button>
          )}
        </div>

        {/* Input Boxes */}
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="Min ₹"
            value={draftMin}
            onChange={(e) => setDraftMin(e.target.value)}
            onBlur={() => onChange({ ...filters, min: num(draftMin), page: 1 })}
            onKeyDown={(e) => e.key === "Enter" && onChange({ ...filters, min: num(draftMin), page: 1 })}
            className="h-8 text-xs bg-background rounded-lg"
          />
          <span className="text-muted-foreground text-xs font-bold">to</span>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="Max ₹"
            value={draftMax}
            onChange={(e) => setDraftMax(e.target.value)}
            onBlur={() => onChange({ ...filters, max: num(draftMax), page: 1 })}
            onKeyDown={(e) => e.key === "Enter" && onChange({ ...filters, max: num(draftMax), page: 1 })}
            className="h-8 text-xs bg-background rounded-lg"
          />
        </div>

        {/* Quick Price Pills */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {PRICE_PRESETS.map((p) => {
            const active = filters.min === p.min && filters.max === p.max;
            return (
              <button
                type="button"
                key={p.label}
                onClick={() => {
                  if (active) {
                    onChange({ ...filters, min: undefined, max: undefined, page: 1 });
                    setDraftMin("");
                    setDraftMax("");
                  } else {
                    onChange({ ...filters, min: p.min, max: p.max, page: 1 });
                    setDraftMin(String(p.min));
                    setDraftMax(p.max != null ? String(p.max) : "");
                  }
                }}
                className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                  active
                    ? "border-secondary bg-secondary text-secondary-foreground shadow-xs"
                    : "border-border/80 bg-background text-muted-foreground hover:border-secondary/40 hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Categories Multi-Select (if not on dedicated category page) */}
      {!hideCategory && cats.data && cats.data.length > 0 && (
        <div className="space-y-3 border-t pt-5">
          <div className="flex items-center justify-between text-xs font-bold text-foreground">
            <span>Categories</span>
            {selectedCatSlugs.size > 0 && (
              <button
                onClick={() =>
                  onChange({ ...filters, category: undefined, categories: undefined, page: 1 })
                }
                className="text-[11px] font-semibold text-secondary hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {cats.data.map((c) => {
              const checked = selectedCatSlugs.has(c.slug);
              return (
                <label
                  key={c.id}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs transition ${
                    checked ? "bg-secondary/15 font-bold text-secondary-foreground" : "hover:bg-muted/50 text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleCategory(c.slug)}
                      className="size-3.5 accent-secondary rounded"
                    />
                    <span>{formatCategoryName(c.name)}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Discount Percentage */}
      <div className="space-y-2.5 border-t pt-5">
        <div className="flex items-center justify-between text-xs font-bold text-foreground">
          <span>Discount</span>
          {filters.discount != null && (
            <button
              onClick={() => onChange({ ...filters, discount: undefined, page: 1 })}
              className="text-[11px] font-semibold text-secondary hover:underline"
            >
              Reset
            </button>
          )}
        </div>

        <div className="space-y-1">
          {DISCOUNT_PRESETS.map((d) => {
            const active = filters.discount === d.value;
            return (
              <label
                key={d.label}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition ${
                  active ? "bg-secondary/15 font-bold text-secondary-foreground" : "hover:bg-muted/50 text-muted-foreground"
                }`}
              >
                <input
                  type="radio"
                  name="discount_filter"
                  checked={active}
                  onChange={() => onChange({ ...filters, discount: d.value, page: 1 })}
                  className="size-3.5 accent-secondary"
                />
                <span>{d.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 4. In Stock Only Toggle */}
      <div className="flex items-center justify-between border-t pt-5 text-xs">
        <div>
          <span className="font-bold text-foreground">In Stock Only</span>
          <p className="text-[10px] text-muted-foreground">Hide sold-out toys</p>
        </div>
        <Switch
          checked={!!filters.in_stock}
          onCheckedChange={(val) => onChange({ ...filters, in_stock: val || undefined, page: 1 })}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Top Search, Sort, and Mobile Filter Trigger Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border bg-card p-3 sm:p-4 shadow-xs">
        {/* Keyword Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="rounded-xl pl-9 bg-background text-xs sm:text-sm h-10"
            placeholder="Search toy name or keyword…"
            defaultValue={filters.q ?? ""}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onChange({
                  ...filters,
                  q: (e.target as HTMLInputElement).value.trim() || undefined,
                  page: 1,
                });
              }
            }}
            onBlur={(e) => {
              const v = e.target.value.trim() || undefined;
              if (v !== filters.q) onChange({ ...filters, q: v, page: 1 });
            }}
          />
          {filters.q && (
            <button
              onClick={() => onChange({ ...filters, q: undefined, page: 1 })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Right Controls: Sort & Mobile Filter Button */}
        <div className="flex items-center gap-2.5">
          {/* Mobile Filter Button (visible on mobile/tablet) */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMobileFilterOpen(true)}
            className="lg:hidden h-10 gap-1.5 rounded-xl font-bold text-xs border-secondary/40 text-foreground"
          >
            <SlidersHorizontal className="size-3.5 text-secondary" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="grid size-5 place-items-center rounded-full bg-secondary text-[10px] font-black text-secondary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="hidden sm:inline text-xs text-muted-foreground font-medium">Sort:</span>
            <Select
              value={filters.sort ?? "new"}
              onValueChange={(v) => onChange({ ...filters, sort: v as ListingFilters["sort"], page: 1 })}
            >
              <SelectTrigger className="h-10 w-[160px] sm:w-[180px] rounded-xl bg-background text-xs">
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
        </div>
      </div>

      {/* Active Filter Chips Strip */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/20 px-3 py-2 text-xs">
          <span className="font-bold text-muted-foreground text-[11px] uppercase tracking-wider mr-1">
            Active Filters ({activeFilterCount}):
          </span>

          {filters.q && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2.5 py-0.5 font-bold text-secondary text-xs shadow-xs">
              "{filters.q}"
              <button
                onClick={() => onChange({ ...filters, q: undefined, page: 1 })}
                className="hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          {Array.from(selectedCatSlugs).map((slug) => {
            const catName = cats.data?.find((c) => c.slug === slug)?.name;
            return (
              <span
                key={slug}
                className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2.5 py-0.5 font-bold text-secondary text-xs shadow-xs"
              >
                {catName ? formatCategoryName(catName) : slug}
                <button onClick={() => handleToggleCategory(slug)} className="hover:text-foreground">
                  <X className="size-3" />
                </button>
              </span>
            );
          })}

          {(filters.min != null || filters.max != null) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2.5 py-0.5 font-bold text-secondary text-xs shadow-xs">
              Price: {filters.min != null ? `₹${filters.min}` : "₹0"} –{" "}
              {filters.max != null ? `₹${filters.max}` : "Any"}
              <button
                onClick={() => {
                  onChange({ ...filters, min: undefined, max: undefined, page: 1 });
                  setDraftMin("");
                  setDraftMax("");
                }}
                className="hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          {filters.discount != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2.5 py-0.5 font-bold text-secondary text-xs shadow-xs">
              {filters.discount}%+ Off
              <button
                onClick={() => onChange({ ...filters, discount: undefined, page: 1 })}
                className="hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          {filters.in_stock && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 font-bold text-emerald-600 dark:text-emerald-400 text-xs shadow-xs">
              In Stock Only
              <button
                onClick={() => onChange({ ...filters, in_stock: undefined, page: 1 })}
                className="hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          <button
            onClick={clearAllFilters}
            className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-destructive hover:underline"
          >
            <RotateCcw className="size-3" /> Clear all
          </button>
        </div>
      )}

      {/* Main Layout: Left Sidebar Filter (Desktop) + Right Products Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">
        {/* Left Sidebar Filter (Desktop Only) */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 rounded-2xl border bg-card p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-display font-bold text-sm text-foreground flex items-center gap-1.5">
                <SlidersHorizontal className="size-4 text-secondary" /> Filters
              </h3>
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs font-bold text-muted-foreground hover:text-destructive"
                >
                  Reset All
                </button>
              )}
            </div>
            <FilterControls />
          </div>
        </aside>

        {/* Right Content Area: Products Grid & Pagination */}
        <div className="space-y-6">
          {/* Header Count */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing <b className="text-foreground">{products.length}</b> of{" "}
              <b className="text-foreground">{totalCount}</b> toy{totalCount === 1 ? "" : "s"}
            </span>
            {totalPages > 1 && (
              <span>
                Page <b className="text-foreground">{page}</b> of {totalPages}
              </span>
            )}
          </div>

          {/* Loading Skeleton */}
          {q.isLoading || !ready ? (
            <ProductGridSkeleton n={8} />
          ) : q.isError ? (
            <ErrorBox message="Could not load the catalog. Please try again." onRetry={() => q.refetch()} />
          ) : products.length === 0 ? (
            /* Empty State */
            <div className="rounded-3xl border border-dashed bg-card/60 p-12 text-center shadow-xs">
              <div className="text-5xl">🧸</div>
              <h3 className="mt-4 text-base font-bold text-foreground">No matching toys found</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                We couldn't find any toys matching your active filters. Try clearing some filters or searching with a different term.
              </p>
              <Button size="sm" variant="secondary" className="mt-5 rounded-xl font-bold" onClick={clearAllFilters}>
                Clear all filters
              </Button>
            </div>
          ) : (
            <>
              {/* Product Cards Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-5 lg:grid-cols-3 xl:grid-cols-4">
                {products.map((p) => (
                  <ProductCard key={p.id} p={p} />
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => {
                      onChange({ ...filters, page: page - 1 });
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="gap-1 text-xs font-bold"
                  >
                    <ChevronLeft className="size-4" /> Previous
                  </Button>

                  <div className="flex items-center gap-1 px-2">
                    {Array.from({ length: totalPages }).map((_, i) => {
                      const pNum = i + 1;
                      // Display first, last, and pages around current
                      if (
                        pNum === 1 ||
                        pNum === totalPages ||
                        (pNum >= page - 1 && pNum <= page + 1)
                      ) {
                        return (
                          <Button
                            key={pNum}
                            variant={pNum === page ? "default" : "ghost"}
                            size="sm"
                            onClick={() => {
                              onChange({ ...filters, page: pNum });
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className={`size-8 p-0 text-xs font-bold ${
                              pNum === page ? "bg-primary text-primary-foreground" : ""
                            }`}
                          >
                            {pNum}
                          </Button>
                        );
                      }
                      if (pNum === page - 2 || pNum === page + 2) {
                        return (
                          <span key={pNum} className="px-1 text-xs text-muted-foreground">
                            …
                          </span>
                        );
                      }
                      return null;
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => {
                      onChange({ ...filters, page: page + 1 });
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="gap-1 text-xs font-bold"
                  >
                    Next <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile Filters Bottom-Sheet Dialog */}
      <Dialog open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 rounded-3xl overflow-hidden">
          <DialogHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-secondary" /> Filters & Preferences
              </DialogTitle>
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs font-bold text-destructive hover:underline mr-4"
                >
                  Reset All
                </button>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-5">
            <FilterControls />
          </div>

          <DialogFooter className="p-4 border-t bg-muted/20 flex flex-row items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllFilters}
              className="flex-1 text-xs font-bold"
            >
              Reset
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => setMobileFilterOpen(false)}
              className="flex-1 text-xs font-bold bg-primary"
            >
              Apply Filters ({totalCount})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
