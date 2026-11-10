import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Sparkles,
  Copy,
  Check,
  ArrowRight,
  Clock,
  Flame,
  Gift,
  Truck,
  Percent,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/format";

type OfferProductPrice = {
  product_id: string;
  product_name: string;
  product_slug?: string;
  image_url?: string | null;
  original_price: number;
  offer_price: number;
};

type StorefrontOffer = {
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

export function OffersSection() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const { data: dbOffers = [] } = useQuery({
    queryKey: ["offers", "homepage"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("offers")
          .select("*")
          .eq("is_active", true)
          .in("display_location", ["all", "homepage"])
          .order("sort_order", { ascending: true });
        if (error) return null;
        return (data ?? []).map((row) => ({
          ...row,
          product_prices: Array.isArray(row.product_prices)
            ? (row.product_prices as unknown as OfferProductPrice[])
            : [],
        })) as StorefrontOffer[];
      } catch {
        return null;
      }
    },
    staleTime: 60 * 1000,
  });

  const now = new Date();
  const validOffers = (dbOffers ?? []).filter((o) => {
    if (!o.is_active) return false;
    const start = new Date(o.start_date);
    if (start > now) return false;
    if (o.end_date && new Date(o.end_date) < now) return false;
    return true;
  });

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Coupon code "${code}" copied! Apply it during checkout.`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  if (!validOffers.length) return null;

  return (
    <section className="mt-8 sm:mt-14">
      <div className="mb-4 sm:mb-6 flex items-end justify-between">
        <div>
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-secondary inline-flex items-center gap-1">
            <Sparkles className="size-3" /> Special Savings & BOGO Deals
          </span>
          <h2 className="mt-0.5 sm:mt-1 font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Featured Deals & Buy 1 Get 1 Offers
          </h2>
        </div>
        <Link
          to="/offers"
          className="inline-flex items-center gap-1 text-xs font-bold text-secondary transition hover:gap-1.5"
        >
          View all offers <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {validOffers.slice(0, 3).map((o) => {
          const timeLeft = getTimeRemaining(o.end_date);
          const isCopied = copiedCode === o.coupon_code;
          const isBogo = o.discount_type === "bogo";
          const productsWithPrices = o.product_prices || [];

          return (
            <div
              key={o.id}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border ${
                isBogo ? "border-amber-500/40 bg-gradient-to-br from-card via-amber-500/5 to-card" : "border-border/80 bg-card"
              } p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-secondary/40 hover:shadow-hover`}
            >
              {/* Top Accent Strip */}
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                    isBogo
                      ? "bg-amber-500 text-white shadow-xs"
                      : "bg-secondary/15 text-secondary"
                  }`}
                >
                  {isBogo ? <Gift className="size-3" /> : <Flame className="size-3 fill-current text-secondary" />}
                  {o.badge || (isBogo ? "BUY 1 GET 1 FREE" : "SPECIAL DEAL")}
                </span>

                {timeLeft ? (
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                    <Clock className="size-3" />
                    {timeLeft.days > 0 ? `${timeLeft.days}d ` : ""}
                    {timeLeft.hours}h {timeLeft.minutes}m left
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-muted-foreground">Ongoing Offer</span>
                )}
              </div>

              {/* Visual image */}
              {o.image_url ? (
                <div className="mt-3.5 aspect-[16/8] w-full overflow-hidden rounded-2xl bg-muted shadow-xs">
                  <img
                    src={o.image_url}
                    alt={o.title}
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              ) : null}

              {/* Title & Description */}
              <div className="mt-4 flex-1">
                <h3 className="font-display text-base sm:text-lg font-bold text-foreground leading-snug group-hover:text-secondary transition-colors">
                  {o.title}
                </h3>

                {o.description && (
                  <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {o.description}
                  </p>
                )}

                {/* Discount highlight badge */}
                <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary/5 px-2.5 py-1.5 border border-primary/10">
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
                      ? `BUY ${o.bogo_buy_qty || 1} GET ${o.bogo_get_qty || 1} FREE`
                      : o.discount_type === "percentage"
                      ? `${o.discount_value}% INSTANT DISCOUNT`
                      : o.discount_type === "flat"
                      ? `${inr(o.discount_value)} FLAT DISCOUNT`
                      : "FREE EXPRESS DELIVERY"}
                  </span>
                </div>

                {/* Custom Offer Product Prices Preview */}
                {productsWithPrices.length > 0 && (
                  <div className="mt-3 space-y-1.5 rounded-xl bg-muted/40 p-2.5 border">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Featured Offer Products:
                    </span>
                    <div className="space-y-1">
                      {productsWithPrices.slice(0, 2).map((pp) => (
                        <div key={pp.product_id} className="flex items-center justify-between text-xs">
                          <span className="truncate max-w-[170px] text-foreground font-medium">
                            {pp.product_name}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-bold text-secondary">{inr(pp.offer_price)}</span>
                            <span className="text-[10px] text-muted-foreground line-through">
                              {inr(pp.original_price)}
                            </span>
                          </div>
                        </div>
                      ))}
                      {productsWithPrices.length > 2 && (
                        <span className="text-[10px] font-semibold text-secondary block pt-0.5">
                          +{productsWithPrices.length - 2} more toys on special price
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="mt-5 pt-3.5 border-t flex items-center justify-between gap-2">
                {o.coupon_code ? (
                  <button
                    onClick={() => handleCopy(o.coupon_code!)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-secondary/60 bg-secondary/10 px-3 py-1.5 font-mono text-xs font-bold text-secondary transition hover:bg-secondary hover:text-secondary-foreground"
                    title="Click to copy coupon code"
                  >
                    <span>{o.coupon_code}</span>
                    {isCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  </button>
                ) : (
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {o.min_order_value > 0 ? `Min order ${inr(o.min_order_value)}` : "Applied at checkout"}
                  </span>
                )}

                <Link
                  to={o.link_url && o.link_url.startsWith("/") ? o.link_url : "/products"}
                  className="inline-flex items-center gap-1 rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-xs transition hover:bg-primary/90 hover:gap-1.5"
                >
                  Shop Now <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
