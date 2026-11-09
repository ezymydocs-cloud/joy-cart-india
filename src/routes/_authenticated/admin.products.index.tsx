import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Filter, Layers, Tag, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { mainImage, PRODUCT_SELECT, type Product } from "@/lib/catalog";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/products/")({
  component: Products,
});

function Products() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sel, setSel] = useState<Set<string>>(new Set());

  const q = useQuery({
    queryKey: ["admin", "products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as Product[]) ?? [];
    },
  });

  const cats = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async () =>
      (await supabase.from("categories").select("id,name").order("sort_order")).data ?? [],
  });

  // Filter products by search text and category filter
  const list = (q.data ?? []).filter((p) => {
    // 1. Text filter
    if (search.trim()) {
      const match = `${p.name} ${p.sku ?? ""}`.toLowerCase().includes(search.toLowerCase());
      if (!match) return false;
    }

    // 2. Category filter
    if (categoryFilter === "uncategorized") {
      if (p.category_id != null && p.category_id !== "") return false;
    } else if (categoryFilter !== "all") {
      if (p.category_id !== categoryFilter) return false;
    }

    return true;
  });

  const ids = [...sel];

  const bulk = async (action: "active" | "draft" | "delete") => {
    if (!ids.length) return;
    if (action === "delete" && !confirm(`Delete ${ids.length} product(s)? Past orders keep their details.`))
      return;
    const { error } =
      action === "delete"
        ? await supabase.from("products").delete().in("id", ids)
        : await supabase.from("products").update({ status: action }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success("Action completed");
    setSel(new Set());
    q.refetch();
  };

  const uncategorizedCount = (q.data ?? []).filter((p) => !p.category_id).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products Catalog</h1>
          <p className="text-xs text-muted-foreground">
            Manage your store's toy collection, variants, stock, and categories.
          </p>
        </div>
        <Button asChild className="font-bold gap-1.5 shadow-sm">
          <Link to="/admin/products/$id" params={{ id: "new" }}>
            <Plus className="size-4" /> Add Product
          </Link>
        </Button>
      </div>

      {/* Filter and Bulk Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-8 h-9 text-xs"
              placeholder="Search name or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Category Filter Dropdown */}
          <div className="w-56">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">📁 All Categories ({q.data?.length ?? 0})</SelectItem>
                <SelectItem value="uncategorized" className="font-semibold text-amber-600">
                  📂 Non-Categorised ({uncategorizedCount})
                </SelectItem>
                {cats.data?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bulk Action Buttons */}
        {ids.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">{ids.length} selected</span>
            <Button size="sm" variant="default" onClick={() => bulk("active")} className="h-8 text-xs font-semibold">
              Activate
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk("draft")} className="h-8 text-xs font-semibold">
              Deactivate
            </Button>
            <Button size="sm" variant="destructive" onClick={() => bulk("delete")} className="h-8 text-xs font-semibold">
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Product List */}
      {q.isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-background" />
      ) : !list.length ? (
        <div className="rounded-2xl bg-background p-12 text-center text-muted-foreground">
          <Package className="mx-auto size-12 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-semibold">No products found</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {search || categoryFilter !== "all"
              ? "Try adjusting your search query or category filter."
              : "Click 'Add Product' above to create your first toy listing."}
          </p>
        </div>
      ) : (
        <div className="divide-y overflow-hidden rounded-2xl bg-background shadow-xs">
          {/* Header Row */}
          <div className="flex items-center gap-3 bg-muted/40 p-3 text-xs font-bold text-muted-foreground">
            <Checkbox
              checked={sel.size === list.length && list.length > 0}
              onCheckedChange={(v) =>
                setSel(v ? new Set(list.map((p) => p.id)) : new Set())
              }
            />
            <span className="min-w-0 flex-1">Toy Details & Category</span>
            <span className="hidden w-28 text-right sm:block">Selling Price</span>
            <span className="w-16 text-center">Status</span>
          </div>

          {/* Product Rows */}
          {list.map((p) => {
            const hasCat = Boolean(p.category_id && p.categories?.name);
            const variantCount = Array.isArray(p.variants) ? p.variants.length : 0;

            return (
              <div
                key={p.id}
                className="flex items-center gap-3 p-3 text-sm transition hover:bg-muted/30"
              >
                <Checkbox
                  checked={sel.has(p.id)}
                  onCheckedChange={(v) => {
                    const n = new Set(sel);
                    if (v) n.add(p.id);
                    else n.delete(p.id);
                    setSel(n);
                  }}
                />

                <img
                  src={mainImage(p)}
                  alt=""
                  className="size-12 rounded-xl object-cover shrink-0 bg-muted"
                />

                <Link to="/admin/products/$id" params={{ id: p.id }} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-bold text-foreground hover:text-secondary transition">
                      {p.name}
                    </span>
                    {p.is_featured && <span title="Featured">⭐</span>}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                    {/* Category Badge or Non-Categorised Badge */}
                    {hasCat ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        <Tag className="size-3" /> {p.categories?.name}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400 border border-amber-500/30">
                        <AlertCircle className="size-3" /> Non-Categorised
                      </span>
                    )}

                    {/* Variants Pill if product has variants */}
                    {variantCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/15 px-2 py-0.5 text-[11px] font-bold text-purple-700 dark:text-purple-300 border border-purple-500/20">
                        <Layers className="size-3" /> {variantCount} Variants
                      </span>
                    )}

                    {/* Stock & SKU */}
                    <span className="text-muted-foreground">
                      · Stock:{" "}
                      <b className={p.stock <= 5 ? "text-destructive" : "text-foreground"}>
                        {p.stock}
                      </b>
                    </span>
                    {p.sku && <span className="text-muted-foreground font-mono">· {p.sku}</span>}
                  </div>
                </Link>

                <div className="hidden text-right sm:block w-28 shrink-0">
                  <b className="text-foreground">{inr(p.price)}</b>
                  {p.mrp && (
                    <div className="text-xs text-muted-foreground line-through">
                      {inr(p.mrp)}
                    </div>
                  )}
                </div>

                <div className="w-16 flex justify-center shrink-0">
                  <Switch
                    checked={p.status === "active"}
                    onCheckedChange={async (v) => {
                      const { error } = await supabase
                        .from("products")
                        .update({ status: v ? "active" : "draft" })
                        .eq("id", p.id);
                      if (error) toast.error(error.message);
                      q.refetch();
                    }}
                    aria-label="Active Status"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
