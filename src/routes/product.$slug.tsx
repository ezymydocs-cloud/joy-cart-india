import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Minus,
  Plus,
  ShoppingBag,
  Truck,
  Zap,
  PackageOpen,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Check,
  Share2,
  Gift,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_SELECT, sortedImages, type Product, type ProductVariant } from "@/lib/catalog";
import { resolveImageUrl } from "@/lib/images";
import { discountPct, inr } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  extractProductSeo,
  getCanonicalUrl,
  getProductSchema,
  getProductBreadcrumbSchema,
  toAbsolutePublicImageUrl,
  DEFAULT_OG_IMAGE,
  SITE_URL,
} from "@/lib/seo";

export const Route = createFileRoute("/product/$slug")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("slug", params.slug)
      .maybeSingle();
    return { product: data as unknown as Product | null };
  },
  head: ({ loaderData, params }) => {
    const p = loaderData?.product;
    const seo = extractProductSeo(p);
    const canonical = getCanonicalUrl(`/product/${params.slug}`);

    // Robust image extraction: p is passed to sortedImages(p)
    const imgs = p ? sortedImages(p) : [];
    const rawFirstImg =
      imgs[0]?.url ||
      (Array.isArray(p?.product_images) && p.product_images.length > 0
        ? p.product_images[0]?.url
        : null);

    // Guaranteed absolute public URL (direct Supabase storage CDN)
    const ogImg = toAbsolutePublicImageUrl(rawFirstImg, DEFAULT_OG_IMAGE);

    const productImages =
      imgs.length > 0
        ? imgs.map((im) => toAbsolutePublicImageUrl(im.url))
        : Array.isArray(p?.product_images) && p.product_images.length > 0
        ? p.product_images.map((im: any) => toAbsolutePublicImageUrl(im.url))
        : [ogImg];

    const productSchema = p
      ? getProductSchema({
          name: p.name,
          slug: p.slug,
          price: p.price,
          mrp: p.mrp,
          sku: p.sku,
          brand: p.brand,
          description: seo.description,
          short_description: p.short_description,
          stock: p.stock,
          images: productImages,
        })
      : null;

    const breadcrumbSchema = p
      ? getProductBreadcrumbSchema({
          name: p.name,
          slug: p.slug,
          categoryName: p.categories?.name,
          categorySlug: p.categories?.slug,
        })
      : null;

    const scripts = [];
    if (productSchema) {
      scripts.push({
        type: "application/ld+json",
        children: JSON.stringify(productSchema),
      });
    }
    if (breadcrumbSchema) {
      scripts.push({
        type: "application/ld+json",
        children: JSON.stringify(breadcrumbSchema),
      });
    }

    return {
      meta: [
        { title: seo.title },
        { name: "description", content: seo.description },
        // Open Graph
        { property: "og:type", content: "product" },
        { property: "og:site_name", content: "TrendyToyz" },
        { property: "og:title", content: seo.title },
        { property: "og:description", content: seo.description },
        { property: "og:url", content: canonical },
        { property: "og:image", content: ogImg },
        // Twitter
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: seo.title },
        { name: "twitter:description", content: seo.description },
        { name: "twitter:image", content: ogImg },
      ],
      links: [{ rel: "canonical", href: canonical }],
      scripts,
    };
  },
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
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [bogoModalOpen, setBogoModalOpen] = useState(false);

  useEffect(() => {
    setActive(0);
  }, [selectedVariantId]);

  const loaderData = Route.useLoaderData();
  const { data: p, isLoading, isError, refetch } = useQuery({
    queryKey: ["product", slug],
    initialData: loaderData?.product || undefined,
    staleTime: 1000 * 60 * 5, // 5 mins fresh
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
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

  const variants = Array.isArray(p.variants)
    ? (p.variants as unknown as ProductVariant[]).filter((v) => v.is_active !== false)
    : [];
  const activeVariant =
    variants.find((v) => v.id === selectedVariantId) || (variants.length > 0 ? variants[0] : null);

  // Variant images take precedence, falling back to product images if empty
  const variantImgs = activeVariant?.image_urls && activeVariant.image_urls.length > 0
    ? activeVariant.image_urls.map((u, i) => ({ id: `var_img_${i}`, url: u, sort_order: i }))
    : activeVariant?.image_url
    ? [{ id: "var_main", url: activeVariant.image_url, sort_order: 0 }]
    : [];

  const rawImgs = variantImgs.length > 0 ? variantImgs : sortedImages(p);
  const imgs = rawImgs.map((im) => ({ ...im, url: resolveImageUrl(im.url) }));
  const img = imgs[active]?.url ?? imgs[0]?.url ?? "/images/teddy.jpg";

  const effectivePrice =
    activeVariant && activeVariant.price != null && Number(activeVariant.price) > 0
      ? Number(activeVariant.price)
      : Number(p.price);

  const effectiveMrp =
    activeVariant && activeVariant.mrp != null && Number(activeVariant.mrp) > 0
      ? Number(activeVariant.mrp)
      : p.mrp
      ? Number(p.mrp)
      : undefined;

  const effectiveStock = activeVariant ? Number(activeVariant.stock ?? 0) : Number(p.stock ?? 0);
  const out = effectiveStock <= 0;
  const max = Math.min(99, Math.max(0, effectiveStock));

  const off = discountPct(effectivePrice, effectiveMrp);
  const savings =
    effectiveMrp && Number(effectiveMrp) > Number(effectivePrice)
      ? Number(effectiveMrp) - Number(effectivePrice)
      : 0;
  const shipping = p.shipping_enabled && Number(p.shipping_charge) > 0 ? Number(p.shipping_charge) : 0;
  const packageItems = (p.in_package ?? "")
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);

  const handleAddToCart = () => {
    if (activeBogo && qty === 1) {
      setBogoModalOpen(true);
      return;
    }
    add(p.id, qty, activeVariant?.id, activeVariant?.name);
    setAddedAnimation(true);
    toast.success(`Added ${qty} item(s) to Cart`, {
      description: activeVariant ? `${p.name} (${activeVariant.name})` : p.name,
    });
    setTimeout(() => setAddedAnimation(false), 2000);
  };

  const handleBuyNow = () => {
    if (activeBogo && qty === 1) {
      setBogoModalOpen(true);
      return;
    }
    add(p.id, qty, activeVariant?.id, activeVariant?.name);
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

  const { data: rawOffers = [] } = useQuery({
    queryKey: ["offers", "for-product-page"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from("offers").select("*").eq("is_active", true);
        if (error) return [];
        return data ?? [];
      } catch {
        return [];
      }
    },
    staleTime: 60 * 1000,
  });

  const now = new Date();
  const validOffers = rawOffers.filter((o) => {
    if (!o.is_active) return false;
    const s = new Date(o.start_date);
    if (s > now) return false;
    if (o.end_date && new Date(o.end_date) < now) return false;
    return true;
  });

  // Check if this product has a special offer price configured
  const productCustomOffer = p
    ? validOffers
        .map((o) => {
          const prices = Array.isArray(o.product_prices) ? (o.product_prices as any[]) : [];
          const match = prices.find((item) => item.product_id === p.id);
          if (match) return { offer: o, ...match };
          return null;
        })
        .find(Boolean)
    : null;

  // Check if there is an active BOGO offer
  const activeBogo = validOffers.find((o) => o.discount_type === "bogo");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <span>/</span>
        <Link to="/products" className="hover:text-foreground">Toys</Link>
        {p.categories ? (
          <>
            <span>/</span>
            <Link to="/category/$slug" params={{ slug: p.categories.slug }} className="hover:text-foreground font-semibold text-secondary">
              {p.categories.name}
            </Link>
          </>
        ) : (
          <>
            <span>/</span>
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              📂 Non-Categorised
            </span>
          </>
        )}
      </nav>

      <div className="grid gap-10 md:grid-cols-2">
        {/* Left Column: Image Gallery */}
        <div>
          <button
            type="button"
            onClick={() => setZoom(true)}
            className="group relative flex aspect-square w-full items-center justify-center cursor-zoom-in overflow-hidden rounded-3xl border border-border/80 bg-white p-3 sm:p-5 shadow-xs"
          >
            <img
              src={img}
              alt={`${p.name} - 100% Certified Child-Safe Toy at TrendyToyz`}
              className="size-full object-contain transition-transform duration-500 group-hover:scale-105"
              width={800}
              height={800}
              loading="eager"
              fetchPriority="high"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "/images/teddy.jpg";
              }}
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
                  type="button"
                  key={im.id}
                  onClick={() => setActive(i)}
                  className={`flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 bg-white p-1 transition-all ${
                    i === active ? "border-secondary ring-2 ring-secondary/20" : "border-border/80 hover:border-muted-foreground"
                  }`}
                >
                  <img
                    src={im.url}
                    alt={`${p.name} view ${i + 1}`}
                    className="size-full object-contain"
                    loading="lazy"
                    width={72}
                    height={72}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/images/teddy.jpg";
                    }}
                  />
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
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2.5 py-0.5 text-[11px] font-bold text-secondary uppercase tracking-wider">
                <Sparkles className="size-3" /> 100% Certified Child-Safe
              </span>
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
                {p.short_description.replace(/collecters/gi, "collectors")}
              </p>
            )}

                        {/* Variant Options Selector */}
            {variants.length > 0 && (
              <div className="mt-4 rounded-2xl border bg-muted/20 p-3.5">
                <div className="flex items-center justify-between text-xs mb-2.5">
                  <span className="font-bold text-foreground">Select Variant / Option:</span>
                  {activeVariant && (
                    <span className="text-xs text-muted-foreground">
                      Selected: <strong className="text-secondary font-bold">{activeVariant.name}</strong>
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v) => {
                    const isSelected = activeVariant?.id === v.id;
                    const isOut = Number(v.stock ?? 0) <= 0;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={isOut}
                        onClick={() => setSelectedVariantId(v.id)}
                        className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                          isSelected
                            ? "border-secondary bg-secondary/15 text-secondary ring-2 ring-secondary/20 shadow-xs font-bold"
                            : isOut
                            ? "border-border/50 bg-muted/40 text-muted-foreground/50 line-through cursor-not-allowed"
                            : "border-border/80 bg-background hover:border-secondary/50 text-foreground"
                        }`}
                      >
                        <span>{v.name}</span>
                        <span className="text-[11px] opacity-80">· {inr(v.price)}</span>
                        {isOut && <span className="text-[10px] text-destructive font-medium">(Sold out)</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pricing Section */}
            {productCustomOffer && (
              <div className="mt-5 rounded-2xl border-2 border-secondary/40 bg-gradient-to-r from-secondary/15 via-secondary/5 to-secondary/15 p-3.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-extrabold text-secondary-foreground uppercase">
                    <Sparkles className="size-3" /> {productCustomOffer.offer.badge || "SPECIAL OFFER"}
                  </span>
                  {productCustomOffer.offer.coupon_code && (
                    <span className="font-mono text-xs font-bold text-secondary bg-background px-2 py-0.5 rounded border border-secondary/30">
                      Code: {productCustomOffer.offer.coupon_code}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-baseline gap-2.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-secondary">
                    {inr(productCustomOffer.offer_price)}
                  </span>
                  <span className="text-sm text-muted-foreground line-through">
                    Regular: {inr(p.price)}
                  </span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    Special Offer Active!
                  </span>
                </div>
                <p className="mt-1 text-xs text-foreground/80 font-medium">
                  {productCustomOffer.offer.title}
                </p>
              </div>
            )}

            {activeBogo && !productCustomOffer && (
              <div className="mt-5 rounded-2xl border-2 border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 p-4 text-xs shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Gift className="size-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-foreground text-sm">
                          Buy 1 Get 1 with Option! 🎁
                        </span>
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                          FREE GIFT
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Choose 2nd unit of this toy <b>FREE</b>, OR select <b>ANY store toy up to {inr(Math.floor(effectivePrice * 0.5))}</b> for FREE!
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setBogoModalOpen(true)}
                    className="shrink-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold hover:from-amber-600 hover:to-orange-600 shadow-xs"
                  >
                    Claim BOGO Offer →
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-4 rounded-2xl border bg-card p-4 shadow-xs">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-3xl font-bold text-foreground">
                  {inr(effectivePrice)}
                </span>
                {off > 0 && (
                  <>
                    <span className="text-sm text-muted-foreground line-through">
                      MRP {inr(effectiveMrp)}
                    </span>
                    <span className="rounded-full bg-secondary/15 px-2.5 py-0.5 text-xs font-bold text-secondary">
                      Save {inr(savings)} ({off}% OFF)
                    </span>
                  </>
                )}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {p.cod_enabled
                  ? "Inclusive of all taxes · Cash on Delivery available across India"
                  : "Inclusive of all taxes · Online Payment (UPI / Cards / NetBanking)"}
              </p>
            </div>

            {/* Stock & Shipping Notice */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                  out
                    ? "bg-destructive/10 text-destructive"
                    : effectiveStock <= 5
                    ? "bg-amber-500/10 text-amber-600"
                    : "bg-success/10 text-success"
                }`}
              >
                <span className="size-2 rounded-full bg-current" />
                {out ? "Out of Stock" : effectiveStock <= 5 ? `Only ${effectiveStock} units left in stock!` : "In Stock · Ready to Ship"}
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
                <Zap className="size-4 mr-2 fill-current" /> {p.cod_enabled ? "Buy Now (COD / UPI)" : "Buy Now (UPI / Card)"}
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
            {p.description.replace(/collecters/gi, "collectors")}
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
    
      {/* BOGO with Option Selection Modal */}
      <Dialog open={bogoModalOpen} onOpenChange={setBogoModalOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-6 sm:p-7">
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-bold">
            <Gift className="size-6 text-amber-600" /> Choose Your BOGO Free Gift
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            You are eligible for a <strong>FREE Toy</strong> with your purchase of <strong>{p.name}</strong> ({inr(effectivePrice)})! Please choose how you want your free item:
          </p>

          <div className="mt-5 space-y-3.5">
            {/* Option A: Same Product */}
            <div className="rounded-2xl border-2 border-border/80 bg-card p-4 transition hover:border-secondary hover:shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-secondary/15 px-2.5 py-0.5 text-[11px] font-bold text-secondary uppercase">
                      Option A
                    </span>
                    <h3 className="font-bold text-sm text-foreground">Same Product (2x {p.name})</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Get a second unit of <strong>{p.name}</strong> completely FREE!
                  </p>
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    2nd Toy Price: <span className="line-through text-muted-foreground">{inr(effectivePrice)}</span> FREE (₹0)
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setBogoModalOpen(false);
                    add(p.id, 2, activeVariant?.id, activeVariant?.name);
                    toast.success("BOGO Option A Applied!", {
                      description: `Added 2x ${p.name} to cart. 2nd unit is 100% FREE!`,
                    });
                    nav({ to: "/cart" });
                  }}
                  className="shrink-0 bg-primary font-bold text-xs"
                >
                  Choose Same Toy
                </Button>
              </div>
            </div>

            {/* Option B: Different Product */}
            <div className="rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-card to-orange-500/5 p-4 transition hover:border-amber-500 hover:shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase">
                      Option B
                    </span>
                    <h3 className="font-bold text-sm text-foreground">Different Product (Pick Any Free Toy)</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pick ANY available store toy priced at half (50%) or less: <strong>Up to {inr(Math.floor(effectivePrice * 0.5))}</strong> for FREE!
                  </p>
                  <div className="rounded-xl border border-amber-500/20 bg-background/80 p-2 text-[11px] text-amber-900 dark:text-amber-200">
                    ⚠️ <em>Note: If you select a toy under {inr(Math.floor(effectivePrice * 0.5))} (e.g. ₹200), the remaining balance cannot be carried forward.</em>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setBogoModalOpen(false);
                    nav({
                      to: "/bogo-select",
                      search: {
                        parent: p.id,
                        variantId: activeVariant?.id,
                        variantName: activeVariant?.name,
                      },
                    });
                  }}
                  className="shrink-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-xs hover:from-amber-600 hover:to-orange-600"
                >
                  Select Different Toy →
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-between items-center">
            <span className="text-[11px] text-muted-foreground">BOGO offer applies automatically</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setBogoModalOpen(false);
                add(p.id, qty, activeVariant?.id, activeVariant?.name);
                toast.success(`Added ${qty} item(s) to Cart`, {
                  description: activeVariant ? `${p.name} (${activeVariant.name})` : p.name,
                });
              }}
              className="text-xs text-muted-foreground"
            >
              No thanks, just add 1 item
            </Button>
          </div>
        </DialogContent>
      </Dialog>
</div>
  );
}
