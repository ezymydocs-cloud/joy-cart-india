import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Minus, Plus, ShoppingBag, Truck, Zap, PackageOpen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_SELECT, sortedImages, type Product } from "@/lib/catalog";
import { discountPct, inr } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/product/$slug")({
  head: () => ({
    meta: [
      { title: "Toy Details | TrendyToyz" },
      { name: "description", content: "See price, details and what's in the package at TrendyToyz." },
      { property: "og:title", content: "Toy Details | TrendyToyz" },
      { property: "og:description", content: "See price, details and what's in the package at TrendyToyz." },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const nav = useNavigate();
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  const { data: p, isLoading, isError, refetch } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).eq("slug", slug).maybeSingle();
      if (error) throw error;
      return data as unknown as Product | null;
    },
  });

  if (isLoading) return <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-2"><div className="aspect-square animate-pulse rounded-2xl bg-muted" /><div className="h-64 animate-pulse rounded-2xl bg-muted" /></div>;
  if (isError) return <div className="p-10 text-center"><p className="font-bold">Couldn't load this toy.</p><Button className="mt-3" onClick={() => refetch()}>Try again</Button></div>;
  if (!p) return <div className="p-16 text-center"><p className="font-bold">This toy isn't available.</p><Link to="/products" className="text-secondary">Browse all toys</Link></div>;

  const imgs = sortedImages(p);
  const img = imgs[active]?.url ?? "/images/teddy.jpg";
  const off = discountPct(p.price, p.mrp);
  const out = p.stock <= 0;
  const max = Math.min(99, p.stock);
  const shipping = p.shipping_enabled && Number(p.shipping_charge) > 0 ? Number(p.shipping_charge) : 0;
  const packageItems = (p.in_package ?? "").split(/\n|,/).map((s) => s.trim()).filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <button onClick={() => setZoom(true)} className="block w-full cursor-zoom-in overflow-hidden rounded-2xl border bg-muted">
            <img src={img} alt={p.name} className="aspect-square w-full object-cover" width={800} height={800} />
          </button>
          {imgs.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {imgs.map((im, i) => (
                <button key={im.id} onClick={() => setActive(i)} className={`size-16 shrink-0 overflow-hidden rounded-xl border ${i === active ? "border-secondary" : ""}`}>
                  <img src={im.url} alt="" className="size-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          {p.categories && <Link to="/category/$slug" params={{ slug: p.categories.slug }} className="text-sm font-bold text-secondary">{p.categories.name}</Link>}
          <h1 className="mt-1 text-3xl leading-tight">{p.name}</h1>
          {p.short_description && <p className="mt-2 text-muted-foreground">{p.short_description}</p>}
          <div className="mt-4 flex items-baseline gap-3">
            <span className="font-display text-3xl text-primary">{inr(p.price)}</span>
            {off > 0 && <><span className="text-muted-foreground line-through">MRP {inr(p.mrp)}</span><span className="rounded-full bg-destructive px-2 py-0.5 text-sm font-bold text-destructive-foreground">{off}% OFF</span></>}
          </div>
          <p className={`mt-2 text-sm font-bold ${out ? "text-destructive" : p.stock <= 5 ? "text-secondary" : "text-success"}`}>
            {out ? "Out of stock" : p.stock <= 5 ? `Hurry! Only ${p.stock} left` : "In stock"}
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-navy-soft p-3 text-sm font-bold">
            <Truck className="size-5 text-secondary" />
            {shipping > 0 ? `Shipping charge: ${inr(shipping)}` : "Free shipping on this toy"}
          </div>
          {!out && (
            <div className="mt-5 flex items-center gap-3">
              <div className="flex items-center rounded-full border">
                <button className="p-2.5" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease"><Minus className="size-4" /></button>
                <span className="w-8 text-center font-bold">{qty}</span>
                <button className="p-2.5" onClick={() => setQty((q) => Math.min(max, q + 1))} aria-label="Increase"><Plus className="size-4" /></button>
              </div>
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button size="lg" variant="sun" disabled={out} onClick={() => { add(p.id, qty); toast.success("Added to cart"); }}><ShoppingBag /> Add to cart</Button>
            <Button size="lg" disabled={out} onClick={() => { add(p.id, qty); nav({ to: "/cart" }); }}><Zap /> Buy now</Button>
          </div>
          {packageItems.length > 0 && (
            <div className="mt-6 rounded-2xl border border-dashed border-secondary/50 bg-sun-soft p-4">
              <h2 className="flex items-center gap-2 text-lg"><PackageOpen className="size-5 text-secondary" /> In This Package</h2>
              <ul className="mt-2 list-inside list-disc text-sm">{packageItems.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          )}
          <dl className="mt-5 grid grid-cols-2 gap-2 text-sm">
            {p.age_group && <><dt className="text-muted-foreground">Age</dt><dd className="font-bold">{p.age_group}</dd></>}
            {p.brand && <><dt className="text-muted-foreground">Brand</dt><dd className="font-bold">{p.brand}</dd></>}
            {p.sku && <><dt className="text-muted-foreground">SKU</dt><dd className="font-bold">{p.sku}</dd></>}
          </dl>
        </div>
      </div>
      {p.description && (
        <section className="mt-10">
          <h2 className="text-2xl">Description</h2>
          <p className="mt-2 whitespace-pre-line leading-relaxed">{p.description}</p>
        </section>
      )}
      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">{p.name}</DialogTitle>
          <img src={img} alt={p.name} className="w-full rounded-xl" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
