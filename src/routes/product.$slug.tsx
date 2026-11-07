import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Minus,
  Plus,
  ShoppingBag,
  Truck,
  Zap,
  PackageOpen,
  ShieldCheck,
  RotateCcw,
  Star,
  Check,
  Share2,
} from "lucide-react";
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
      { name: "description", content: "See price, details and package contents at TrendyToyz." },
      { property: "og:title", content: "Toy Details | TrendyToyz" },
      { property: "og:description", content: "See price, details and package contents at TrendyToyz." },
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
  const [addedAnimation, setAddedAnimation] = useState(false);

  const { data: p, isLoading, isError, refetch } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Product | null;
    },
  });

  if (isLoading)
    return (
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-2 sm:px-6">
        <div className="aspect-square animate-pulse rounded-3xl bg-muted/60" />
        <div className="space-y-4">
          <div className="h-6 w-1/4 rounded-lg bg-muted/60" />
          <div className="h-10 w-3/4 rounded-lg bg-muted/60" />
          <div className="h-8 w-1/3 rounded-lg bg-muted/60" />
          <div className="h-24 rounded-2xl bg-muted/60" />
          <div className="h-12 rounded-xl bg-muted/60" />
        </div>
      </div>
    );

  if (isError)
    return (
      <div className="mx-auto max-w-md p-12 text-center">
        <p className="font-bold text-destructive">Could not load this toy's details.</p>
        <Button className="mt-4" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );

  if (!p)
    return (
      <div className="mx-auto max-w-md p-16 text-center">
        <div className="text-5xl">🧸</div>
        <h2 className="mt-4 text-xl font-bold">This toy isn't available</h2>
        <p className="mt-1 text-xs text-muted-foreground">It might have been sold out or archived.</p>
        <Button asChild className="mt-5" variant="outline">
          <Link to="/products">Browse all toys</Link>
        </Button>
      </div>
    );

  const imgs = sortedImages(p);
  const img = imgs[active]?.url ?? "/images/teddy.jpg";
  const off = discountPct(p.price, p.mrp);
  const savings = p.mrp && Number(p.mrp) > Number(p.price) ? Number(p.mrp) - Number(p.price) : 0;
  const out = p.stock <= 0;
  const max = Math.min(99, p.stock);
  const shipping = p.shipping_enabled && Number(p.shipping_charge) > 0 ? Number(p.shipping_charge) : 0;
  const packageItems = (p.in_package ?? "")
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);

  const handleAddToCart = () => {
    add(p.id, qty);
    setAddedAnimation(true);
    toast.success(`Added ${qty} item(s) to Cart`, { description: p.name });
    setTimeout(() => setAddedAnimation(false), 2000);
  };

  const handleBuyNow = () => {
    add(p.id, qty);
    nav({ to: "/checkout" });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: p.name,
        text: `Check out ${p.name} on TrendyToyz!`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard!");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <span>/</span>
        <Link to="/products" className="hover:text-foreground">Toys</Link>
        {p.categories && (
          <>
            <span>/</span>
            <Link to="/category/$slug" params={{ slug: p.categories.slug }} className="hover:text-foreground font-semibold text-secondary">
              {p.categories.name}
            </Link>
          </>
        )}
      </nav>

      <div className="grid gap-10 md:grid-cols-2">
        {/* Left Column: Image Gallery */}
        <div>
          <button
            onClick={() => setZoom(true)}
            className="group relative block w-full cursor-zoom-in overflow-hidden rounded-3xl border border-border/80 bg-card shadow-xs"
          >
            <img
              src={img}
              alt={p.name}
              className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105"
              width={800}
              height={800}
            />
            {off > 0 && (
              <span className="absolute left-4 top-4 rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground shadow-sm">
                {off}% OFF
              </span>
            )}
            <span className="absolute bottom-3 right-3 rounded-lg bg-background/80 px-2 py-1 text-[11px] font-medium backdrop-blur">
              Click to Zoom
            </span>
          </button>

          {imgs.length > 1 && (
            <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1">
              {imgs.map((im, i) => (
                <button
                  key={im.id}
                  onClick={() => setActive(i)}
                  className={`h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl border-2 transition-all ${
                    i === active ? "border-secondary ring-2 ring-secondary/20" : "border-border/80 hover:border-muted-foreground"
                  }`}
                >
                  <img src={im.url} alt="" className="size-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}

          {/* Guarantee Badges Under Image */}
          <div className="mt-6 grid grid-cols-3 gap-2 rounded-2xl border bg-muted/40 p-3 text-center text-xs">
            <div className="flex flex-col items-center">
              <ShieldCheck className="size-5 text-secondary" />
              <span className="mt-1 font-bold text-[11px]">100% Safe</span>
              <span className="text-[10px] text-muted-foreground">Certified materials</span>
            </div>
            <div className="flex flex-col items-center border-x">
              <Truck className="size-5 text-secondary" />
              <span className="mt-1 font-bold text-[11px]">Pan-India</span>
              <span className="text-[10px] text-muted-foreground">Fast dispatch</span>
            </div>
            <div className="flex flex-col items-center">
              <RotateCcw className="size-5 text-secondary" />
              <span className="mt-1 font-bold text-[11px]">Same-Day Return</span>
              <span className="text-[10px] text-muted-foreground">On delivery date only</span>
            </div>
          </div>
        </div>

        {/* Right Column: Product Info & Buy Box */}
        <div className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-amber-500">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="size-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <span className="font-bold text-foreground">4.9</span>
                <span className="text-muted-foreground">(128 reviews)</span>
              </div>
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                title="Share toy"
              >
                <Share2 className="size-4" />
                <span>Share</span>
              </button>
            </div>

            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl leading-snug">
              {p.name}
            </h1>

            {p.short_description && (
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {p.short_description}
              </p>
            )}

            {/* Pricing Section */}
            <div className="mt-5 rounded-2xl border bg-card p-4 shadow-xs">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-3xl font-bold text-foreground">
                  {inr(p.price)}
                </span>
                {off > 0 && (
                  <>
                    <span className="text-sm text-muted-foreground line-through">
                      MRP {inr(p.mrp)}
                    </span>
                    <span className="rounded-full bg-secondary/15 px-2.5 py-0.5 text-xs font-bold text-secondary">
                      Save {inr(savings)} ({off}% OFF)
                    </span>
                  </>
                )}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Inclusive of all taxes · Cash on Delivery available across India
              </p>
            </div>

            {/* Stock & Shipping Notice */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                  out
                    ? "bg-destructive/10 text-destructive"
                    : p.stock <= 5
                    ? "bg-amber-500/10 text-amber-600"
                    : "bg-success/10 text-success"
                }`}
              >
                <span className="size-2 rounded-full bg-current" />
                {out ? "Out of Stock" : p.stock <= 5 ? `Only ${p.stock} units left in stock!` : "In Stock · Ready to Ship"}
              </span>

              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium">
                <Truck className="size-3.5 text-secondary" />
                {shipping > 0 ? `Flat shipping: ${inr(shipping)}` : "Free Delivery on this item"}
              </span>
            </div>

            {/* Quantity Selector */}
            {!out && (
              <div className="mt-5 flex items-center gap-3">
                <span className="text-xs font-bold text-foreground">Quantity:</span>
                <div className="flex items-center rounded-xl border bg-background text-sm">
                  <button
                    className="px-3 py-1.5 text-muted-foreground hover:bg-muted rounded-l-xl transition"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-9 text-center font-bold text-foreground">{qty}</span>
                  <button
                    className="px-3 py-1.5 text-muted-foreground hover:bg-muted rounded-r-xl transition"
                    onClick={() => setQty((q) => Math.min(max, q + 1))}
                    aria-label="Increase quantity"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons: Add to Cart & Buy Now */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                size="lg"
                variant="outline"
                className="rounded-xl border-secondary text-secondary hover:bg-secondary/10 font-bold"
                disabled={out}
                onClick={handleAddToCart}
              >
                {addedAnimation ? (
                  <>
                    <Check className="size-4 mr-2" /> Added to Cart!
                  </>
                ) : (
                  <>
                    <ShoppingBag className="size-4 mr-2" /> Add to Cart
                  </>
                )}
              </Button>

              <Button
                size="lg"
                className="rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/90 font-bold shadow-sm"
                disabled={out}
                onClick={handleBuyNow}
              >
                <Zap className="size-4 mr-2 fill-current" /> Buy Now (COD / UPI)
              </Button>
            </div>

            {/* Package Contents */}
            {packageItems.length > 0 && (
              <div className="mt-6 rounded-2xl border bg-muted/30 p-4">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
                  <PackageOpen className="size-4 text-secondary" /> Package Includes
                </h3>
                <ul className="mt-2.5 list-inside list-disc text-xs text-foreground/80 space-y-1">
                  {packageItems.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Specifications Summary */}
            <dl className="mt-5 grid grid-cols-2 gap-2 text-xs rounded-2xl border p-3.5 bg-card">
              {p.age_group && (
                <div>
                  <dt className="text-muted-foreground">Recommended Age</dt>
                  <dd className="font-bold text-foreground mt-0.5">{p.age_group}</dd>
                </div>
              )}
              {p.brand && (
                <div>
                  <dt className="text-muted-foreground">Brand</dt>
                  <dd className="font-bold text-foreground mt-0.5">{p.brand}</dd>
                </div>
              )}
              {p.sku && (
                <div>
                  <dt className="text-muted-foreground">Item SKU</dt>
                  <dd className="font-bold text-foreground mt-0.5">{p.sku}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground">Delivery</dt>
                <dd className="font-bold text-foreground mt-0.5">Dispatched in 24 hrs</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Full Description & Play Guide */}
      {p.description && (
        <section className="mt-14 rounded-3xl border bg-card p-6 sm:p-8 shadow-xs">
          <h2 className="font-display text-xl font-bold tracking-tight text-foreground md:text-2xl">
            Product Description & Features
          </h2>
          <div className="mt-4 whitespace-pre-line text-xs sm:text-sm leading-relaxed text-foreground/80 border-t pt-4">
            {p.description}
          </div>
        </section>
      )}

      {/* Image Zoom Modal */}
      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-w-3xl p-3 rounded-3xl overflow-hidden">
          <DialogTitle className="sr-only">{p.name}</DialogTitle>
          <img src={img} alt={p.name} className="w-full rounded-2xl object-contain max-h-[80vh]" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
