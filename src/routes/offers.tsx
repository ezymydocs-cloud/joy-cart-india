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
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/offers")({
  head: () => ({
    meta: [
      { title: "Special Offers & Discount Coupons | TrendyToyz" },
      {
        name: "description",
        content:
          "Save big on child-safe toys, educational games, and plushies. View live coupons, flash sale discounts, and promotional offers at TrendyToyz.",
      },
    ],
  }),
  component: OffersPage,
});

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
};

const FALLBACK_OFFERS: PublicOffer[] = [
  {
    id: "f-1",
    title: "Welcome Toy Fest · Flat 10% OFF",
    description: "Get 10% instant discount across all categories on your very first order.",
    badge: "WELCOME OFFER",
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
    id: "f-2",
    title: "Mega Block & STEM Set Bonanza",
    description: "Flat ₹150 OFF on creative block sets and brain puzzles for orders above ₹799.",
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
    id: "f-3",
    title: "Free Express Pan-India Delivery",
    description: "Free door-step delivery across all Indian pincodes on orders over ₹499.",
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

function OffersPage() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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
        return (data ?? []) as PublicOffer[];
      } catch {
        return null;
      }
    },
  });

  const now = new Date();
  const activeOffers = (dbOffers && dbOffers.length > 0 ? dbOffers : FALLBACK_OFFERS).filter((o) => {
    if (!o.is_active) return false;
    const start = new Date(o.start_date);
    if (start > now) return false;
    if (o.end_date && new Date(o.end_date) < now) return false;
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
          Active Offers & Coupon Codes
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-xs sm:text-sm text-primary-foreground/80 leading-relaxed">
          Grab verified promo codes, seasonal discounts, and free shipping deals on child-safe toys and games.
        </p>
      </div>

      {/* Offers Grid */}
      <div className="mt-8 sm:mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {activeOffers.map((o) => {
          const timeLeft = getTimeRemaining(o.end_date);
          const isCopied = copiedCode === o.coupon_code;

          return (
            <div
              key={o.id}
              className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border/80 bg-card p-6 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-secondary/50 hover:shadow-hover"
            >
              <div>
                {/* Header row */}
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2.5 py-0.5 text-xs font-bold text-secondary uppercase tracking-wider">
                    <Flame className="size-3.5 fill-current text-secondary" />
                    {o.badge || "SPECIAL OFFER"}
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
                      ? `${inr(o.discount_value)} FLAT OFF`
                      : o.discount_type === "free_shipping"
                      ? "FREE EXPRESS SHIPPING"
                      : "SPECIAL BUNDLE DEAL"}
                  </span>
                </div>
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

      {/* How to Redeem Help Section */}
      <div className="mt-14 rounded-3xl border bg-muted/40 p-6 sm:p-10">
        <h3 className="font-display text-lg sm:text-xl font-bold text-foreground">
          How to Redeem Your Offers & Coupons
        </h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs sm:text-sm">
          <div className="rounded-2xl bg-card p-4 border">
            <span className="font-bold text-secondary">Step 1</span>
            <p className="mt-1 font-semibold text-foreground">Copy Promo Code</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Click the copy button on any coupon above to copy the code to your clipboard.
            </p>
          </div>
          <div className="rounded-2xl bg-card p-4 border">
            <span className="font-bold text-secondary">Step 2</span>
            <p className="mt-1 font-semibold text-foreground">Add Toys to Cart</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Browse categories and add your favorite toys meeting the minimum order amount.
            </p>
          </div>
          <div className="rounded-2xl bg-card p-4 border">
            <span className="font-bold text-secondary">Step 3</span>
            <p className="mt-1 font-semibold text-foreground">Apply & Enjoy Savings</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Paste the code during checkout. The discount will instantly reflect on your total!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
