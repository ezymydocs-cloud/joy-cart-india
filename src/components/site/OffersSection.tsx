import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Sparkles,
  Tag,
  Copy,
  Check,
  ArrowRight,
  Clock,
  Flame,
  Gift,
  Truck,
  Percent,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/format";

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
};

// Sensible fallbacks if database table hasn't been created or has no active records
const FALLBACK_OFFERS: StorefrontOffer[] = [
  {
    id: "fb-1",
    title: "Welcome Toy Fest · Flat 10% OFF",
    description: "Enjoy 10% instant discount across all toys, blocks, and plush cuddles.",
    badge: "WELCOME DEAL",
    discount_type: "percentage",
    discount_value: 10,
    coupon_code: "TOYZ10",
    min_order_value: 0,
    start_date: new Date().toISOString(),
    end_date: null,
    image_url: "/images/teddy.jpg",
    link_url: "/products",
    display_location: "all",
    sort_order: 1,
    is_active: true,
  },
  {
    id: "fb-2",
    title: "STEM & Building Blocks Bonanza",
    description: "Flat ₹150 OFF on premium STEM sets and creative puzzles above ₹799.",
    badge: "WEEKEND SPECIAL",
    discount_type: "flat",
    discount_value: 150,
    coupon_code: "BLOCKS150",
    min_order_value: 799,
    start_date: new Date().toISOString(),
    end_date: null,
    image_url: "/images/blocks.jpg",
    link_url: "/products",
    display_location: "homepage",
    sort_order: 2,
    is_active: true,
  },
  {
    id: "fb-3",
    title: "Free Express Pan-India Delivery",
    description: "Fast doorstep delivery across 28+ Indian states on all orders over ₹499.",
    badge: "FREE SHIPPING",
    discount_type: "free_shipping",
    discount_value: 0,
    coupon_code: null,
    min_order_value: 499,
    start_date: new Date().toISOString(),
    end_date: null,
    image_url: "/images/car.jpg",
    link_url: "/products",
    display_location: "all",
    sort_order: 3,
    is_active: true,
  },
];

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
        return (data ?? []) as StorefrontOffer[];
      } catch {
        return null;
      }
    },
    staleTime: 60 * 1000,
  });

  const now = new Date();
  const validOffers = (dbOffers && dbOffers.length > 0 ? dbOffers : FALLBACK_OFFERS).filter((o) => {
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
            <Sparkles className="size-3" /> Special Savings & Discounts
          </span>
          <h2 className="mt-0.5 sm:mt-1 font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Exclusive Deals & Offers
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

          return (
            <div
              key={o.id}
              className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/30 p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-secondary/40 hover:shadow-hover"
            >
              {/* Top Accent Strip */}
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2.5 py-0.5 text-[11px] font-bold text-secondary uppercase tracking-wider">
                  <Flame className="size-3 fill-current text-secondary" />
                  {o.badge || "SPECIAL DEAL"}
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

              {/* Visual image or decorative icon banner */}
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
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-base sm:text-lg font-bold text-foreground leading-snug group-hover:text-secondary transition-colors">
                    {o.title}
                  </h3>
                </div>

                {o.description && (
                  <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {o.description}
                  </p>
                )}

                {/* Discount highlight badge */}
                <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary/5 px-2.5 py-1.5 border border-primary/10">
                  {o.discount_type === "free_shipping" ? (
                    <Truck className="size-4 text-emerald-600" />
                  ) : o.discount_type === "percentage" ? (
                    <Percent className="size-4 text-secondary" />
                  ) : (
                    <Gift className="size-4 text-amber-600" />
                  )}
                  <span className="text-xs font-bold text-foreground">
                    {o.discount_type === "percentage"
                      ? `${o.discount_value}% INSTANT DISCOUNT`
                      : o.discount_type === "flat"
                      ? `${inr(o.discount_value)} FLAT DISCOUNT`
                      : o.discount_type === "free_shipping"
                      ? "FREE EXPRESS DELIVERY"
                      : "BUY 1 GET 1 FREE"}
                  </span>
                </div>
              </div>

              {/* Bottom Actions: Coupon Code & Direct CTA */}
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
                    {o.min_order_value > 0 ? `Min order ${inr(o.min_order_value)}` : "No code needed"}
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
