import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_SELECT, type Product } from "@/lib/catalog";
import { ProductCard, ProductGridSkeleton, ErrorBox } from "./ProductCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ListingFilters = { q?: string; category?: string; min?: number; max?: number; sort?: "new" | "price_asc" | "price_desc" | "popular" };

export function useCategories() {
  return useQuery({
    queryKey: ["categories", "public"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

export function ProductListing({ filters, onChange, hideCategory }: { filters: ListingFilters; onChange: (f: ListingFilters) => void; hideCategory?: boolean }) {
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
      qb = s === "price_asc" ? qb.order("price") : s === "price_desc" ? qb.order("price", { ascending: false }) : s === "popular" ? qb.order("is_featured", { ascending: false }).order("created_at", { ascending: false }) : qb.order("created_at", { ascending: false });
      const { data, error } = await qb.limit(200);
      if (error) throw error;
      return data as unknown as Product[];
    },
  });

  const num = (v: string) => (v === "" ? undefined : Math.max(0, Number(v)));

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-3xl bg-navy-soft p-3 md:grid-cols-5">
        <Input className="col-span-2 rounded-full bg-background" placeholder="Search toys…" defaultValue={filters.q ?? ""} onKeyDown={(e) => { if (e.key === "Enter") onChange({ ...filters, q: (e.target as HTMLInputElement).value.trim() || undefined }); }} onBlur={(e) => { const v = e.target.value.trim() || undefined; if (v !== filters.q) onChange({ ...filters, q: v }); }} />
        {!hideCategory && (
          <Select value={filters.category ?? "all"} onValueChange={(v) => onChange({ ...filters, category: v === "all" ? undefined : v })}>
            <SelectTrigger className="rounded-full bg-background"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {cats.data?.map((c) => <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="flex gap-2">
          <Input type="number" min={0} inputMode="numeric" className="rounded-full bg-background" placeholder="Min ₹" defaultValue={filters.min ?? ""} onBlur={(e) => onChange({ ...filters, min: num(e.target.value) })} />
          <Input type="number" min={0} inputMode="numeric" className="rounded-full bg-background" placeholder="Max ₹" defaultValue={filters.max ?? ""} onBlur={(e) => onChange({ ...filters, max: num(e.target.value) })} />
        </div>
        <Select value={filters.sort ?? "new"} onValueChange={(v) => onChange({ ...filters, sort: v as ListingFilters["sort"] })}>
          <SelectTrigger className="rounded-full bg-background"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="new">Newest first</SelectItem>
            <SelectItem value="popular">Popular</SelectItem>
            <SelectItem value="price_asc">Price: Low to High</SelectItem>
            <SelectItem value="price_desc">Price: High to Low</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {q.isLoading || !ready ? (
        <ProductGridSkeleton />
      ) : q.isError ? (
        <ErrorBox message="Couldn't load toys." onRetry={() => q.refetch()} />
      ) : q.data!.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed p-12 text-center">
          <div className="text-5xl">🧸</div>
          <p className="mt-3 font-bold">No toys match your search.</p>
          <p className="text-sm text-muted-foreground">Try a different word or clear the filters.</p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">{q.data!.length} toy{q.data!.length === 1 ? "" : "s"}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-5 lg:grid-cols-4">
            {q.data!.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        </>
      )}
    </div>
  );
}
