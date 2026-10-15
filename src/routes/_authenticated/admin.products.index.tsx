import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { mainImage, PRODUCT_SELECT, type Product } from "@/lib/catalog";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/products/")({ component: Products });

function Products() {
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const q = useQuery({
    queryKey: ["admin", "products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Product[];
    },
  });
  const list = (q.data ?? []).filter((p) => !search || `${p.name} ${p.sku ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const ids = [...sel];

  const bulk = async (action: "active" | "draft" | "delete") => {
    if (!ids.length) return;
    if (action === "delete" && !confirm(`Delete ${ids.length} product(s)? Past orders keep their details.`)) return;
    const { error } = action === "delete" ? await supabase.from("products").delete().in("id", ids) : await supabase.from("products").update({ status: action }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success("Done");
    setSel(new Set());
    q.refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl">Products</h1><Button asChild><Link to="/admin/products/$id" params={{ id: "new" }}><Plus /> Add product</Link></Button></div>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-background p-3">
        <Input className="max-w-xs" placeholder="Search name or SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
        {ids.length > 0 && <>
          <span className="text-sm font-bold">{ids.length} selected</span>
          <Button size="sm" variant="success" onClick={() => bulk("active")}>Activate</Button>
          <Button size="sm" variant="outline" onClick={() => bulk("draft")}>Deactivate</Button>
          <Button size="sm" variant="destructive" onClick={() => bulk("delete")}>Delete</Button>
        </>}
      </div>
      {q.isLoading ? <div className="h-40 animate-pulse rounded-2xl bg-background" /> : !list.length ? <div className="rounded-2xl bg-background p-10 text-center text-muted-foreground">No products.</div> : (
        <div className="divide-y overflow-hidden rounded-2xl bg-background">
          <label className="flex items-center gap-3 p-3 text-xs font-bold text-muted-foreground">
            <Checkbox checked={sel.size === list.length} onCheckedChange={(v) => setSel(v ? new Set(list.map((p) => p.id)) : new Set())} /> Select all
          </label>
          {list.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 text-sm">
              <Checkbox checked={sel.has(p.id)} onCheckedChange={(v) => { const n = new Set(sel); if (v) n.add(p.id); else n.delete(p.id); setSel(n); }} />
              <img src={mainImage(p)} alt="" className="size-12 rounded-lg object-cover" />
              <Link to="/admin/products/$id" params={{ id: p.id }} className="min-w-0 flex-1">
                <div className="truncate font-bold">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.sku} · {p.categories?.name ?? "No category"} · Stock <b className={p.stock <= 5 ? "text-destructive" : ""}>{p.stock}</b>{p.is_featured ? " · ⭐" : ""}</div>
              </Link>
              <div className="hidden text-right sm:block"><b>{inr(p.price)}</b>{p.mrp && <div className="text-xs text-muted-foreground line-through">{inr(p.mrp)}</div>}</div>
              <Switch checked={p.status === "active"} onCheckedChange={async (v) => { const { error } = await supabase.from("products").update({ status: v ? "active" : "draft" }).eq("id", p.id); if (error) toast.error(error.message); q.refetch(); }} aria-label="Active" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
