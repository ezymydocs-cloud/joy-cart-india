import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_SELECT, sortedImages, type Product } from "@/lib/catalog";
import { slugify } from "@/lib/format";
import { MultiImageUploader, type Img } from "@/components/admin/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/products/$id")({ component: EditProduct });

const blank = {
  name: "", category_id: "", short_description: "", description: "", price: "", mrp: "", sku: "", stock: "0",
  status: "active", is_featured: false, shipping_enabled: false, shipping_charge: "", in_package: "", age_group: "", brand: "", tags: "",
};

function EditProduct() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const nav = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState(blank);
  const [imgs, setImgs] = useState<Img[]>([]);
  const [busy, setBusy] = useState(false);
  const cats = useQuery({ queryKey: ["admin", "categories"], queryFn: async () => (await supabase.from("categories").select("*").order("sort_order")).data ?? [] });
  const prod = useQuery({
    queryKey: ["admin", "product", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).eq("id", id).single();
      if (error) throw error;
      return data as unknown as Product;
    },
  });
  useEffect(() => {
    const p = prod.data;
    if (!p) return;
    setF({
      name: p.name, category_id: p.category_id ?? "", short_description: p.short_description ?? "", description: p.description ?? "",
      price: String(p.price), mrp: p.mrp != null ? String(p.mrp) : "", sku: p.sku ?? "", stock: String(p.stock), status: p.status,
      is_featured: p.is_featured, shipping_enabled: p.shipping_enabled, shipping_charge: Number(p.shipping_charge) ? String(p.shipping_charge) : "",
      in_package: p.in_package ?? "", age_group: p.age_group ?? "", brand: p.brand ?? "", tags: (p.tags ?? []).join(", "),
    });
    setImgs(sortedImages(p).map((i) => ({ url: i.url, storage_path: i.storage_path })));
  }, [prod.data]);

  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const price = Number(f.price), mrp = f.mrp === "" ? null : Number(f.mrp), stock = Number(f.stock);
    const ship = f.shipping_enabled && f.shipping_charge !== "" ? Number(f.shipping_charge) : 0;
    if (f.name.trim().length < 2) return toast.error("Enter product name");
    if (!(price >= 0) || f.price === "") return toast.error("Enter a valid price");
    if (mrp !== null && (!(mrp >= 0) || mrp < price)) return toast.error("MRP must be equal to or more than price");
    if (!Number.isInteger(stock) || stock < 0) return toast.error("Stock must be a whole number ≥ 0");
    if (!(ship >= 0)) return toast.error("Invalid shipping charge");
    setBusy(true);
    const payload = {
      name: f.name.trim(), category_id: f.category_id || null, short_description: f.short_description.trim() || null, description: f.description.trim() || null,
      price, mrp, sku: f.sku.trim() || null, stock, status: f.status, is_featured: f.is_featured,
      shipping_enabled: f.shipping_enabled && ship > 0, shipping_charge: f.shipping_enabled ? ship : 0,
      in_package: f.in_package.trim() || null, age_group: f.age_group.trim() || null, brand: f.brand.trim() || null,
      tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    try {
      let pid = id;
      if (isNew) {
        const slug = `${slugify(payload.name)}-${Math.random().toString(36).slice(2, 6)}`;
        const { data, error } = await supabase.from("products").insert({ ...payload, slug }).select("id").single();
        if (error) throw error;
        pid = data.id;
      } else {
        const { error } = await supabase.from("products").update(payload).eq("id", id);
        if (error) throw error;
        const { error: de } = await supabase.from("product_images").delete().eq("product_id", id);
        if (de) throw de;
      }
      if (imgs.length) {
        const { error } = await supabase.from("product_images").insert(imgs.map((im, i) => ({ product_id: pid, url: im.url, storage_path: im.storage_path ?? null, sort_order: i })));
        if (error) throw error;
      }
      toast.success("Product saved");
      qc.invalidateQueries();
      nav({ to: "/admin/products" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : (err as { message?: string }).message ?? "Save failed";
      toast.error(msg.includes("sku") ? "This SKU is already used by another product" : msg);
    } finally { setBusy(false); }
  };

  const del = async () => {
    if (!confirm("Delete this product? Past orders keep their details.")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries();
    nav({ to: "/admin/products" });
  };

  if (!isNew && prod.isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-background" />;

  return (
    <form onSubmit={save} className="space-y-4">
      <Link to="/admin/products" className="text-sm font-bold text-secondary">← Products</Link>
      <h1 className="text-2xl">{isNew ? "Add product" : "Edit product"}</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="space-y-3 rounded-2xl bg-background p-4">
            <div><Label>Name *</Label><Input value={f.name} onChange={set("name")} required /></div>
            <div><Label>Short description</Label><Input value={f.short_description} onChange={set("short_description")} /></div>
            <div><Label>Full description</Label><Textarea rows={5} value={f.description} onChange={set("description")} /></div>
            <div><Label>In This Package</Label><Textarea rows={3} placeholder={"1 x Teddy Bear\n1 x Red Car\n1 x Rocket"} value={f.in_package} onChange={set("in_package")} /><p className="text-xs text-muted-foreground">One item per line, or separated by commas.</p></div>
          </section>
          <section className="space-y-2 rounded-2xl bg-background p-4">
            <h2 className="text-lg">Images</h2>
            <MultiImageUploader bucket="product-images" value={imgs} onChange={setImgs} />
            <p className="text-xs text-muted-foreground">First image is the main image. Drag to reorder.</p>
          </section>
        </div>
        <div className="space-y-4">
          <section className="space-y-3 rounded-2xl bg-background p-4">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Price (₹) *</Label><Input type="number" min={0} step="0.01" value={f.price} onChange={set("price")} required /></div>
              <div><Label>MRP (₹)</Label><Input type="number" min={0} step="0.01" value={f.mrp} onChange={set("mrp")} /></div>
              <div><Label>SKU</Label><Input value={f.sku} onChange={set("sku")} /></div>
              <div><Label>Stock *</Label><Input type="number" min={0} step={1} value={f.stock} onChange={set("stock")} required /></div>
            </div>
            <div><Label>Category</Label>
              <Select value={f.category_id || "none"} onValueChange={(v) => setF({ ...f, category_id: v === "none" ? "" : v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">No category</SelectItem>{cats.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label>Status</Label>
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="draft">Draft</SelectItem></SelectContent></Select>
            </div>
            <label className="flex items-center justify-between text-sm font-bold">Featured <Switch checked={f.is_featured} onCheckedChange={(v) => setF({ ...f, is_featured: v })} /></label>
          </section>
          <section className="space-y-3 rounded-2xl bg-background p-4">
            <label className="flex items-center justify-between text-sm font-bold">Charge shipping on this product <Switch checked={f.shipping_enabled} onCheckedChange={(v) => setF({ ...f, shipping_enabled: v })} /></label>
            {f.shipping_enabled ? <div><Label>Shipping charge (₹)</Label><Input type="number" min={0} step="0.01" value={f.shipping_charge} onChange={set("shipping_charge")} /><p className="text-xs text-muted-foreground">Empty or 0 = free shipping.</p></div> : <p className="text-xs text-muted-foreground">Free shipping for this product.</p>}
          </section>
          <section className="space-y-3 rounded-2xl bg-background p-4">
            <div><Label>Age group</Label><Input placeholder="3+ years" value={f.age_group} onChange={set("age_group")} /></div>
            <div><Label>Brand</Label><Input value={f.brand} onChange={set("brand")} /></div>
            <div><Label>Tags (comma separated)</Label><Input value={f.tags} onChange={set("tags")} /></div>
          </section>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy} className="flex-1">{busy ? "Saving…" : "Save product"}</Button>
            {!isNew && <Button type="button" variant="destructive" onClick={del}>Delete</Button>}
          </div>
        </div>
      </div>
    </form>
  );
}
