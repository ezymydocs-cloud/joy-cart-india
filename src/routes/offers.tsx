import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Sparkles,
  Copy,
  Check,
  ArrowRight,
  Flame,
  Clock,
  Tag,
  ShieldCheck,
  Gift,
  Truck,
  Percent,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/offers")({
  head: () => ({
    meta: [
      { title: "Special Offers & Buy 1 Get 1 Deals | TrendyToyz" },
      {
        name: "description",
        content:
          "Save big on child-safe toys, educational games, and plushies. View live coupons, Buy 1 Get 1 Free deals, and promotional offers at TrendyToyz.",
      },
    ],
  }),
  component: OffersPage,
});

type OfferProductPrice = {
  product_id: string;
  product_name: string;
  product_slug?: string;
  image_url?: string | null;
  original_price: number;
  offer_price: number;
};

type PublicOffer = {
  id: string;
  title: string;
  description: string | null;
  badge: string | null;
  discount_type: string;
  discount_value: number;
  coupon_code: string | null;
  min_order_value: number;
  start_date: string;
  end_date: string | null;
  image_url: string | null;
  link_url: string | null;
  display_location: string;
  sort_order: number;
  is_active: boolean;
  bogo_buy_qty?: number;
  bogo_get_qty?: number;
  bogo_mode?: string;
  bogo_choice_max_percent?: number;
  product_prices?: OfferProductPrice[];
};

function getTimeRemaining(endDateStr: string | null) {
  if (!endDateStr) return null;
  const total = new Date(endDateStr).getTime() - Date.now();
  if (total <= 0) return null;
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  return { days, hours, minutes };
}

function OffersPage() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "bogo" | "discount" | "shipping">("all");

  const { data: dbOffers = [] } = useQuery({
    queryKey: ["offers", "public-page"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("offers")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true });
        if (error) return null;
        return (data ?? []).map((row) => ({
          ...row,
          product_prices: Array.isArray(row.product_prices)
            ? (row.product_prices as unknown as OfferProductPrice[])
            : [],
        })) as PublicOffer[];
      } catch {
        return null;
      }
    },
  });

  const now = new Date();
  const rawOffers = dbOffers ?? [];
  const activeOffers = rawOffers
    .filter((o) => {
      if (!o.is_active) return false;
      const start = new Date(o.start_date);
      if (start > now) return false;
      if (o.end_date && new Date(o.end_date) < now) return false;
      return true;
    })
    .filter((o) => {
      if (activeTab === "bogo") return o.discount_type === "bogo";
      if (activeTab === "discount") return o.discount_type === "percentage" || o.discount_type === "flat";
      if (activeTab === "shipping") return o.discount_type === "free_shipping";
      return true;
    });

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Coupon code "${code}" copied to clipboard! Apply it at checkout.`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Hero Header */}
      <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-primary via-primary/95 to-slate-900 p-8 sm:p-12 text-center text-primary-foreground shadow-card">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-secondary">
          <Sparkles className="size-3.5" /> TrendyToyz Deals & Promotions
        </span>
        <h1 className="mt-3 font-display text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
          Active Offers, BOGO & Coupon Codes
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-xs sm:text-sm text-primary-foreground/80 leading-relaxed">
          Grab verified promo codes, Buy 1 Get 1 Free offers, seasonal toy discounts, and free shipping across India.
        </p>

        {/* Filter Pills */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => setActiveTab("all")}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              activeTab === "all"
                ? "bg-secondary text-secondary-foreground"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            All Offers
          </button>
          <button
            onClick={() => setActiveTab("bogo")}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition flex items-center gap-1 ${
              activeTab === "bogo"
                ? "bg-amber-500 text-white"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <Gift className="size-3" /> Buy 1 Get 1 (BOGO)
          </button>
          <button
            onClick={() => setActiveTab("discount")}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition flex items-center gap-1 ${
              activeTab === "discount"
                ? "bg-secondary text-secondary-foreground"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <Percent className="size-3" /> Discounts (% & Flat)
          </button>
          <button
            onClick={() => setActiveTab("shipping")}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition flex items-center gap-1 ${
              activeTab === "shipping"
                ? "bg-secondary text-secondary-foreground"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <Truck className="size-3" /> Free Shipping
          </button>
        </div>
      </div>

      {/* Offers Grid */}
      {activeOffers.length === 0 ? (
        <div className="mt-8 sm:mt-12 rounded-3xl border border-dashed bg-card p-12 text-center max-w-lg mx-auto">
          <div className="text-5xl">🎁</div>
          <h3 className="mt-4 font-bold text-lg text-foreground">No Active Promotional Offers</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            There are currently no active offers or coupon codes. Check back later or browse all toys!
          </p>
          <Button asChild className="mt-5 font-bold" variant="outline">
            <Link to="/products">Browse All Toys</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 sm:mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {activeOffers.map((o) => {
          const timeLeft = getTimeRemaining(o.end_date);
          const isCopied = copiedCode === o.coupon_code;
          const isBogo = o.discount_type === "bogo";
          const productsWithPrices = o.product_prices || [];

          return (
            <div
              key={o.id}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border ${
                isBogo ? "border-amber-500/40 bg-gradient-to-br from-card via-amber-500/5 to-card" : "border-border/80 bg-card"
              } p-6 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-secondary/50 hover:shadow-hover`}
            >
              <div>
                {/* Header row */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                      isBogo
                        ? "bg-amber-500 text-white shadow-xs"
                        : "bg-secondary/15 text-secondary"
                    }`}
                  >
                    {isBogo ? <Gift className="size-3" /> : <Flame className="size-3.5 fill-current text-secondary" />}
                    {o.badge || (isBogo ? "BUY 1 GET 1 FREE" : "SPECIAL OFFER")}
                  </span>

                  {timeLeft ? (
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full">
                      <Clock className="size-3" />
                      {timeLeft.days > 0 ? `${timeLeft.days}d ` : ""}
                      {timeLeft.hours}h {timeLeft.minutes}m left
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-muted-foreground">Ongoing</span>
                  )}
                </div>

                {/* Optional Image */}
                {o.image_url && (
                  <div className="mt-4 aspect-[16/8] w-full overflow-hidden rounded-2xl bg-muted shadow-xs">
                    <img
                      src={o.image_url}
                      alt={o.title}
                      className="size-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  </div>
                )}

                {/* Title & Description */}
                <h2 className="mt-4 font-display text-lg sm:text-xl font-bold text-foreground group-hover:text-secondary transition-colors">
                  {o.title}
                </h2>
                {o.description && (
                  <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {o.description}
                  </p>
                )}

                {/* Discount highlight badge */}
                <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary/5 px-3 py-2 border border-primary/10">
                  {isBogo ? (
                    <Gift className="size-4 text-amber-600" />
                  ) : o.discount_type === "free_shipping" ? (
                    <Truck className="size-4 text-emerald-600" />
                  ) : o.discount_type === "percentage" ? (
                    <Percent className="size-4 text-secondary" />
                  ) : (
                    <Tag className="size-4 text-amber-600" />
                  )}
                  <span className="text-xs font-bold text-foreground">
                    {isBogo
                      ? o.bogo_mode === "with_option"
                        ? "BUY 1 GET 1 WITH OPTION (SAME OR 50% TOY FREE)"
                        : `BUY ${o.bogo_buy_qty || 1} GET ${o.bogo_get_qty || 1} FREE`
                      : o.discount_type === "percentage"
                      ? `${o.discount_value}% INSTANT DISCOUNT`
                      : o.discount_type === "flat"
                      ? `${inr(o.discount_value)} FLAT OFF`
                      : "FREE EXPRESS SHIPPING"}
                  </span>
                </div>

                {/* Custom Offer Product Prices Section */}
                {productsWithPrices.length > 0 && (
                  <div className="mt-4 space-y-2 rounded-2xl bg-muted/40 p-3 border">
                    <div className="flex items-center justify-between text-xs font-bold text-foreground">
                      <span className="flex items-center gap-1 text-secondary">
                        <Package className="size-3.5" /> Eligible Toys & Special Prices:
                      </span>
                      <span className="text-[11px] text-muted-foreground font-normal">
                        {productsWithPrices.length} toys
                      </span>
                    </div>

                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                      {productsWithPrices.map((pp) => (
                        <div
                          key={pp.product_id}
                          className="flex items-center justify-between gap-2 rounded-lg bg-card p-2 text-xs border"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {pp.image_url ? (
                              <img src={pp.image_url} alt="" className="size-7 rounded object-cover shrink-0" />
                            ) : (
                              <span className="text-xs shrink-0">🧸</span>
                            )}
                            <span className="truncate text-foreground font-medium">{pp.product_name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-bold text-secondary">{inr(pp.offer_price)}</span>
                            <span className="text-[10px] text-muted-foreground line-through">
                              {inr(pp.original_price)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="mt-6 pt-4 border-t flex items-center justify-between gap-3">
                {o.coupon_code ? (
                  <button
                    onClick={() => handleCopy(o.coupon_code!)}
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-secondary/60 bg-secondary/10 px-3.5 py-2 font-mono text-xs font-bold text-secondary transition hover:bg-secondary hover:text-secondary-foreground cursor-pointer"
                    title="Click to copy coupon code"
                  >
                    <span>{o.coupon_code}</span>
                    {isCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  </button>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">
                    {o.min_order_value > 0 ? `Min order ${inr(o.min_order_value)}` : "Applied automatically"}
                  </span>
                )}

                <Button asChild size="sm" className="font-bold gap-1 rounded-full px-4 shadow-sm">
                  <Link to={o.link_url && o.link_url.startsWith("/") ? o.link_url : "/products"}>
                    Shop Offer <ArrowRight className="size-3" />
                  </Link>
                </Button>
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* How to Redeem Help Section */}
      <div className="mt-14 rounded-3xl border bg-muted/40 p-6 sm:p-10">
        <h3 className="font-display text-lg sm:text-xl font-bold text-foreground">
          How to Redeem Buy 1 Get 1 & Discount Offers
        </h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs sm:text-sm">
          <div className="rounded-2xl bg-card p-4 border">
            <span className="font-bold text-secondary">Step 1: Choose Your Offer</span>
            <p className="mt-1 font-semibold text-foreground">Copy Code or Note Deal</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Click the copy button on the promo code or check the BOGO qualification rules above.
            </p>
          </div>
          <div className="rounded-2xl bg-card p-4 border">
            <span className="font-bold text-secondary">Step 2: Add Toys to Cart</span>
            <p className="mt-1 font-semibold text-foreground">Select Eligible Toys</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              For BOGO offers, add at least 2 toys to your cart. For discount offers, meet the minimum cart value.
            </p>
          </div>
          <div className="rounded-2xl bg-card p-4 border">
            <span className="font-bold text-secondary">Step 3: Instant Savings</span>
            <p className="mt-1 font-semibold text-foreground">Apply at Checkout</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Paste the code during checkout or enjoy the automatic promotional prices on eligible items!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
