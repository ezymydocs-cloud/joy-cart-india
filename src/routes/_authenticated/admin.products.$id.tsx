import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Layers,
  Plus,
  Trash2,
  Sparkles,
  ArrowLeft,
  Package,
  Tag,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_SELECT, sortedImages, type Product, type ProductVariant } from "@/lib/catalog";
import { slugify, inr } from "@/lib/format";
import { MultiImageUploader, type Img } from "@/components/admin/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/products/$id")({
  component: EditProduct,
});

const blank = {
  name: "",
  category_id: "",
  short_description: "",
  description: "",
  price: "",
  mrp: "",
  sku: "",
  stock: "0",
  status: "active",
  is_featured: false,
  shipping_enabled: false,
  cod_enabled: false,
  shipping_charge: "",
  in_package: "",
  age_group: "",
  brand: "",
  tags: "",
};

function EditProduct() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const nav = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState(blank);
  const [imgs, setImgs] = useState<Img[]>([]);
  const [busy, setBusy] = useState(false);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [hasVariants, setHasVariants] = useState(false);

  const cats = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async () =>
      (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
  });

  const prod = useQuery({
    queryKey: ["admin", "product", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as Product;
    },
  });

  useEffect(() => {
    const p = prod.data;
    if (!p) return;
    setF({
      name: p.name,
      category_id: p.category_id ?? "",
      short_description: p.short_description ?? "",
      description: p.description ?? "",
      price: String(p.price),
      mrp: p.mrp != null ? String(p.mrp) : "",
      sku: p.sku ?? "",
      stock: String(p.stock),
      status: p.status,
      is_featured: p.is_featured,
      shipping_enabled: p.shipping_enabled,
      cod_enabled: !!p.cod_enabled,
      shipping_charge: Number(p.shipping_charge) ? String(p.shipping_charge) : "",
      in_package: p.in_package ?? "",
      age_group: p.age_group ?? "",
      brand: p.brand ?? "",
      tags: (p.tags ?? []).join(", "),
    });
    setImgs(sortedImages(p).map((i) => ({ url: i.url, storage_path: i.storage_path })));

    const pVariants = Array.isArray(p.variants) ? (p.variants as ProductVariant[]) : [];
    setVariants(pVariants);
    setHasVariants(pVariants.length > 0);
  }, [prod.data]);

  const set = (k: keyof typeof blank) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setF({ ...f, [k]: e.target.value });

  // Add a blank variant
  const addVariant = (presetName: string = "") => {
    const newVar: ProductVariant = {
      id: `var_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: presetName || "",
      sku: f.sku ? `${f.sku}-V${variants.length + 1}` : "",
      price: f.price ? Number(f.price) : null,
      mrp: f.mrp ? Number(f.mrp) : null,
      stock: 10,
      is_active: true,
    };
    setVariants((prev) => [...prev, newVar]);
    setHasVariants(true);
  };

  const updateVariant = (idx: number, updates: Partial<ProductVariant>) => {
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, ...updates } : v)));
  };

  const removeVariant = (idx: number) => {
    const next = variants.filter((_, i) => i !== idx);
    setVariants(next);
    if (next.length === 0) setHasVariants(false);
  };

  const applyVariantPresets = (type: "color" | "size" | "pack") => {
    setHasVariants(true);
    let names: string[] = [];
    if (type === "color") names = ["Red", "Blue", "Green", "Yellow"];
    if (type === "size") names = ["Small", "Medium", "Large"];
    if (type === "pack") names = ["Single Pack", "Pack of 2", "Pack of 3"];

    const basePrice = f.price ? Number(f.price) : null;
    const baseMrp = f.mrp ? Number(f.mrp) : null;

    const newVars: ProductVariant[] = names.map((name, i) => ({
      id: `var_${Date.now()}_${i}`,
      name,
      sku: f.sku ? `${f.sku}-${name.slice(0, 3).toUpperCase()}` : "",
      price: basePrice,
      mrp: baseMrp,
      stock: 10,
      is_active: true,
    }));

    setVariants(newVars);
    toast.success(`Added ${names.length} ${type} variants!`);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const price = Number(f.price);
    const mrp = f.mrp === "" ? null : Number(f.mrp);
    let stock = Number(f.stock);
    const ship = f.shipping_enabled && f.shipping_charge !== "" ? Number(f.shipping_charge) : 0;

    if (f.name.trim().length < 2) return toast.error("Enter product name");
    if (!(price >= 0) || f.price === "") return toast.error("Enter a valid price");
    if (mrp !== null && (!(mrp >= 0) || mrp < price))
      return toast.error("MRP must be equal to or more than price");
    if (!Number.isInteger(stock) || stock < 0)
      return toast.error("Stock must be a whole number ≥ 0");
    if (!(ship >= 0)) return toast.error("Invalid shipping charge");

    // Clean valid variants
    const validVariants = hasVariants
      ? variants
          .filter((v) => v.name.trim().length > 0)
          .map((v) => ({
            ...v,
            name: v.name.trim(),
            sku: v.sku?.trim() || null,
            price: v.price != null && Number(v.price) > 0 ? Number(v.price) : null,
            mrp: v.mrp != null && Number(v.mrp) > 0 ? Number(v.mrp) : null,
            stock: Math.max(0, Number(v.stock || 0)),
            is_active: v.is_active !== false,
          }))
      : [];

    // If variants are enabled, base stock can sum variant stocks if needed
    if (hasVariants && validVariants.length > 0) {
      const sumVariantStock = validVariants.reduce((acc, v) => acc + v.stock, 0);
      if (stock === 0 && sumVariantStock > 0) {
        stock = sumVariantStock;
      }
    }

    setBusy(true);
    const payload = {
      name: f.name.trim(),
      category_id: f.category_id && f.category_id !== "none" ? f.category_id : null,
      short_description: f.short_description.trim() || null,
      description: f.description.trim() || null,
      price,
      mrp,
      sku: f.sku.trim() || null,
      stock,
      status: f.status,
      is_featured: f.is_featured,
      cod_enabled: f.cod_enabled,
      shipping_enabled: f.shipping_enabled && ship > 0,
      shipping_charge: f.shipping_enabled ? ship : 0,
      in_package: f.in_package.trim() || null,
      age_group: f.age_group.trim() || null,
      brand: f.brand.trim() || null,
      tags: f.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      variants: validVariants,
    };

    try {
      let pid = id;
      if (isNew) {
        const slug = `${slugify(payload.name)}-${Math.random().toString(36).slice(2, 6)}`;
        const { data, error } = await supabase
          .from("products")
          .insert({ ...payload, slug })
          .select("id")
          .single();
        if (error) throw error;
        pid = data.id;
      } else {
        const { error } = await supabase.from("products").update(payload).eq("id", id);
        if (error) throw error;
        const { error: de } = await supabase.from("product_images").delete().eq("product_id", id);
        if (de) throw de;
      }

      if (imgs.length) {
        const { error } = await supabase.from("product_images").insert(
          imgs.map((im, i) => ({
            product_id: pid,
            url: im.url,
            storage_path: im.storage_path ?? null,
            sort_order: i,
          }))
        );
        if (error) throw error;
      }

      toast.success("Product saved successfully!");
      qc.invalidateQueries();
      nav({ to: "/admin/products" });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : (err as { message?: string }).message ?? "Save failed";
      toast.error(msg.includes("sku") ? "This SKU is already used by another product" : msg);
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!confirm("Delete this product? Past orders keep their details.")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries();
    nav({ to: "/admin/products" });
  };

  if (!isNew && prod.isLoading)
    return <div className="h-64 animate-pulse rounded-2xl bg-background" />;

  return (
    <form onSubmit={save} className="space-y-4">
      <Link to="/admin/products" className="inline-flex items-center gap-1 text-sm font-bold text-secondary">
        <ArrowLeft className="size-4" /> Back to Products
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{isNew ? "Add New Product" : "Edit Product"}</h1>
        <div className="flex gap-2">
          {!isNew && (
            <Button type="button" variant="destructive" size="sm" onClick={del}>
              Delete
            </Button>
          )}
          <Button type="submit" disabled={busy} className="font-bold">
            {busy ? "Saving…" : "Save Product"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left 2 Columns: Basic Info, Descriptions, Images & VARIANTS */}
        <div className="space-y-4 lg:col-span-2">
          {/* General Information */}
          <section className="space-y-3 rounded-2xl bg-background p-5 shadow-xs">
            <h2 className="text-base font-bold text-foreground">General Information</h2>
            <div>
              <Label className="font-bold">Product Name *</Label>
              <Input
                value={f.name}
                onChange={set("name")}
                placeholder="e.g. Remote Control Stunt Flip Car"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label className="font-bold">Short Description (Summary)</Label>
              <Input
                value={f.short_description}
                onChange={set("short_description")}
                placeholder="High-speed 360-degree tumbling stunt car for kids"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="font-bold">Full Detailed Description</Label>
              <Textarea
                rows={5}
                value={f.description}
                onChange={set("description")}
                placeholder="Describe features, safety certifications, charging, and materials..."
                className="mt-1"
              />
            </div>
            <div>
              <Label className="font-bold">In This Package (Box Contents)</Label>
              <Textarea
                rows={3}
                placeholder={"1 x Stunt Car\n1 x Remote Controller\n1 x USB Charging Cable\n1 x User Manual"}
                value={f.in_package}
                onChange={set("in_package")}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-0.5">
                One item per line, or separated by commas.
              </p>
            </div>
          </section>

          {/* ============================================================== */}
          {/* PRODUCT VARIANTS SECTION                                       */}
          {/* ============================================================== */}
          <section className="space-y-4 rounded-2xl border-2 border-secondary/30 bg-background p-5 shadow-xs">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Layers className="size-5 text-secondary" />
                  <h2 className="text-base font-bold text-foreground">Product Variants</h2>
                  {hasVariants && (
                    <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-[11px] font-bold text-secondary">
                      {variants.length} active
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Offer different sizes, colors, packs, or styles for this product with custom prices and stock.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold">
                  <Switch
                    checked={hasVariants}
                    onCheckedChange={(v) => {
                      setHasVariants(v);
                      if (v && variants.length === 0) addVariant();
                    }}
                  />
                  <span>Enable Variants</span>
                </label>
                {hasVariants && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => addVariant()}
                    className="h-8 gap-1 text-xs font-bold bg-secondary text-secondary-foreground hover:bg-secondary/90"
                  >
                    <Plus className="size-3.5" /> Add Variant
                  </Button>
                )}
              </div>
            </div>

            {hasVariants ? (
              <div className="space-y-3">
                {/* Quick Preset Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground text-[11px] font-semibold">Quick Options:</span>
                  <button
                    type="button"
                    onClick={() => applyVariantPresets("color")}
                    className="rounded-lg bg-muted px-2.5 py-1 text-[11px] font-bold hover:bg-secondary/20 hover:text-secondary transition"
                  >
                    🎨 Colors (Red, Blue, Green, Yellow)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyVariantPresets("size")}
                    className="rounded-lg bg-muted px-2.5 py-1 text-[11px] font-bold hover:bg-secondary/20 hover:text-secondary transition"
                  >
                    📏 Sizes (Small, Medium, Large)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyVariantPresets("pack")}
                    className="rounded-lg bg-muted px-2.5 py-1 text-[11px] font-bold hover:bg-secondary/20 hover:text-secondary transition"
                  >
                    📦 Packs (Single, Pack of 2, Pack of 3)
                  </button>
                </div>

                {/* Variants List / Table */}
                <div className="space-y-2.5">
                  {variants.map((v, idx) => (
                    <div
                      key={v.id || idx}
                      className="grid gap-2.5 rounded-xl border bg-muted/30 p-3 sm:grid-cols-12 items-center"
                    >
                      {/* Variant Name */}
                      <div className="sm:col-span-4">
                        <Label className="text-[11px] font-bold text-muted-foreground">
                          Variant Name / Option *
                        </Label>
                        <Input
                          value={v.name}
                          onChange={(e) => updateVariant(idx, { name: e.target.value })}
                          placeholder="e.g. Red, Blue, 12-Inch"
                          className="mt-1 h-8 text-xs font-semibold"
                          required
                        />
                      </div>

                      {/* Variant Price */}
                      <div className="sm:col-span-2">
                        <Label className="text-[11px] font-bold text-muted-foreground">
                          Price (₹)
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={v.price ?? ""}
                          onChange={(e) =>
                            updateVariant(idx, {
                              price: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          placeholder={f.price || "Default"}
                          className="mt-1 h-8 text-xs font-bold text-secondary"
                        />
                      </div>

                      {/* Variant MRP */}
                      <div className="sm:col-span-2">
                        <Label className="text-[11px] font-bold text-muted-foreground">MRP (₹)</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={v.mrp ?? ""}
                          onChange={(e) =>
                            updateVariant(idx, {
                              mrp: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          placeholder={f.mrp || "Default"}
                          className="mt-1 h-8 text-xs"
                        />
                      </div>

                      {/* Variant Stock */}
                      <div className="sm:col-span-2">
                        <Label className="text-[11px] font-bold text-muted-foreground">Stock *</Label>
                        <Input
                          type="number"
                          min={0}
                          value={v.stock}
                          onChange={(e) => updateVariant(idx, { stock: Number(e.target.value) })}
                          className="mt-1 h-8 text-xs font-bold"
                          required
                        />
                      </div>

                      {/* Variant SKU & Delete */}
                      <div className="sm:col-span-2 flex items-center justify-end gap-1.5 pt-4 sm:pt-0">
                        <Input
                          value={v.sku ?? ""}
                          onChange={(e) => updateVariant(idx, { sku: e.target.value })}
                          placeholder="SKU (opt)"
                          className="h-8 text-[11px] font-mono uppercase"
                          title="Variant SKU"
                        />
                        <button
                          type="button"
                          onClick={() => removeVariant(idx)}
                          className="rounded-md p-1.5 text-destructive hover:bg-destructive/10 transition shrink-0"
                          title="Remove variant"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span>
                    Total variant stock: <b>{variants.reduce((acc, v) => acc + (v.stock || 0), 0)}</b> units
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addVariant()}
                    className="h-7 text-xs text-secondary hover:underline"
                  >
                    + Add another variant
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                This product currently has no variants. Enable variants if you want to sell different colors, sizes, or bundle quantities under this single product listing.
              </div>
            )}
          </section>

          {/* Product Images */}
          <section className="space-y-2 rounded-2xl bg-background p-5 shadow-xs">
            <h2 className="text-base font-bold text-foreground">Product Images</h2>
            <MultiImageUploader bucket="product-images" value={imgs} onChange={setImgs} />
            <p className="text-xs text-muted-foreground">
              First image is the primary display image. Drag and drop to reorder.
            </p>
          </section>
        </div>

        {/* Right Column: Pricing, Category, Status & Shipping */}
        <div className="space-y-4">
          <section className="space-y-3 rounded-2xl bg-background p-5 shadow-xs">
            <h2 className="text-base font-bold text-foreground">Pricing & Inventory</h2>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <Label className="font-bold">Selling Price (₹) *</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={f.price}
                  onChange={set("price")}
                  required
                  className="mt-1 font-bold text-secondary"
                />
              </div>
              <div>
                <Label className="font-bold">MRP (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={f.mrp}
                  onChange={set("mrp")}
                  placeholder="Optional"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="font-bold">Base SKU</Label>
                <Input
                  value={f.sku}
                  onChange={set("sku")}
                  placeholder="e.g. TOY-001"
                  className="mt-1 font-mono uppercase"
                />
              </div>
              <div>
                <Label className="font-bold">Total Stock *</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={f.stock}
                  onChange={set("stock")}
                  required
                  className="mt-1 font-bold"
                />
              </div>
            </div>

            {/* Category Selection with Explicit Non-Categorised Option */}
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between mb-1">
                <Label className="font-bold">Category Selection</Label>
                <Link
                  to="/admin/categories"
                  className="text-[11px] font-semibold text-secondary hover:underline"
                >
                  Manage Categories →
                </Link>
              </div>
              <Select
                value={f.category_id || "none"}
                onValueChange={(v) => setF({ ...f, category_id: v === "none" ? "" : v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="font-bold text-amber-600 dark:text-amber-400">
                    📂 Non-Categorised / Uncategorized
                  </SelectItem>
                  {cats.data?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Assign to a category, or select <b>Non-Categorised</b> if this toy doesn't belong to any specific category.
              </p>
            </div>

            {/* Status */}
            <div>
              <Label className="font-bold">Publishing Status</Label>
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active (Visible in Store)</SelectItem>
                  <SelectItem value="draft">Draft (Hidden)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-center justify-between text-sm font-bold pt-1">
              <span>Featured Toy</span>
              <Switch checked={f.is_featured} onCheckedChange={(v) => setF({ ...f, is_featured: v })} />
            </label>
          </section>

          {/* Payment & Shipping Settings */}
          <section className="space-y-3 rounded-2xl bg-background p-5 shadow-xs">
            <h2 className="text-base font-bold text-foreground">Delivery & Payment</h2>
            <label className="flex items-center justify-between text-sm font-bold">
              <span>Allow Cash on Delivery</span>
              <Switch checked={f.cod_enabled} onCheckedChange={(v) => setF({ ...f, cod_enabled: v })} />
            </label>
            <p className="-mt-1 text-xs text-muted-foreground">
              Turn off if customers must pay online only.
            </p>

            <label className="flex items-center justify-between text-sm font-bold pt-2 border-t">
              <span>Charge Shipping</span>
              <Switch
                checked={f.shipping_enabled}
                onCheckedChange={(v) => setF({ ...f, shipping_enabled: v })}
              />
            </label>
            {f.shipping_enabled ? (
              <div>
                <Label>Shipping Charge (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={f.shipping_charge}
                  onChange={set("shipping_charge")}
                  placeholder="e.g. 50"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-0.5">Empty or 0 = Free shipping.</p>
              </div>
            ) : (
              <p className="text-xs text-emerald-600 font-semibold">Free shipping for this toy.</p>
            )}
          </section>

          {/* Additional Toy Metadata */}
          <section className="space-y-3 rounded-2xl bg-background p-5 shadow-xs">
            <h2 className="text-base font-bold text-foreground">Specifications</h2>
            <div>
              <Label>Age Group</Label>
              <Input
                placeholder="e.g. 3+ years, 5–8 years"
                value={f.age_group}
                onChange={set("age_group")}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Brand / Manufacturer</Label>
              <Input
                placeholder="e.g. TrendyToyz"
                value={f.brand}
                onChange={set("brand")}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Tags (Comma separated)</Label>
              <Input
                placeholder="educational, car, puzzle, remote"
                value={f.tags}
                onChange={set("tags")}
                className="mt-1"
              />
            </div>
          </section>

          <div className="flex gap-2">
            <Button type="submit" disabled={busy} className="flex-1 font-bold">
              {busy ? "Saving…" : "Save Product"}
            </Button>
            {!isNew && (
              <Button type="button" variant="destructive" onClick={del}>
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
