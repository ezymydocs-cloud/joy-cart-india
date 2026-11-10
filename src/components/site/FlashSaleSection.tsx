import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Zap, Clock, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchSettings, PRODUCT_SELECT, mainImage, type Product } from "@/lib/catalog";
import { inr, discountPct } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";

export function FlashSaleSection() {
  const { add } = useCart();

  // 1. Fetch store settings to check if admin enabled flash deals
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  const isEnabled = !!(settings as any)?.flash_deals_enabled;
  const productIds: string[] = Array.isArray((settings as any)?.flash_deals_product_ids)
    ? (settings as any).flash_deals_product_ids
    : [];
  const customDiscounts: any[] = Array.isArray((settings as any)?.flash_deals_custom_discounts)
    ? (settings as any).flash_deals_custom_discounts
    : [];
  const endTimeStr: string | null = (settings as any)?.flash_deals_end_time ?? null;
  const title: string = (settings as any)?.flash_deals_title || "Deal of the Day";
  const subtitle: string = (settings as any)?.flash_deals_subtitle || "Limited Stock Available";

  // 2. Fetch the specific products chosen by the admin
  const { data: dealProducts = [] } = useQuery({
    queryKey: ["products", "flash-sale", productIds],
    enabled: isEnabled && productIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .in("id", productIds)
        .eq("status", "active");
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });

  // 3. Real Countdown timer
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(
    null
  );

  useEffect(() => {
    if (!endTimeStr) return;

    const updateTimer = () => {
      const diff = new Date(endTimeStr).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }
      const totalSeconds = Math.floor(diff / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      setTimeLeft({ hours, minutes, seconds });
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [endTimeStr]);

  // If disabled by admin, or no products selected, or time expired -> RENDER NOTHING!
  if (!isEnabled || dealProducts.length === 0 || (endTimeStr && !timeLeft)) {
    return null;
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <section className="mt-14 rounded-3xl border border-secondary/20 bg-gradient-to-r from-secondary/5 via-card to-secondary/10 p-6 md:p-8 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-secondary-foreground uppercase tracking-wide">
              <Zap className="size-3.5 fill-current" /> Flash Deals
            </span>
            <span className="text-xs font-semibold text-muted-foreground">{subtitle}</span>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            {title}
          </h2>
        </div>

        {/* Real Countdown Box */}
        {timeLeft && (
          <div className="flex items-center gap-2 rounded-2xl border bg-background/80 px-4 py-2.5 backdrop-blur shadow-xs">
            <Clock className="size-4 text-secondary shrink-0" />
            <span className="text-xs font-medium text-muted-foreground mr-1">Ends in:</span>
            <div className="flex items-center gap-1 font-mono font-bold text-sm text-foreground">
              <span className="rounded bg-muted px-1.5 py-0.5">{pad(timeLeft.hours)}</span>
              <span>:</span>
              <span className="rounded bg-muted px-1.5 py-0.5">{pad(timeLeft.minutes)}</span>
              <span>:</span>
              <span className="rounded bg-muted px-1.5 py-0.5">{pad(timeLeft.seconds)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Real Deals Grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {dealProducts.map((p) => {
          const custom = customDiscounts.find((c) => c.product_id === p.id);
          const effectivePrice = custom?.deal_price ? Number(custom.deal_price) : Number(p.price);
          const off = discountPct(effectivePrice, p.mrp || p.price);
          const img = mainImage(p);

          return (
            <div
              key={p.id}
              className="flex flex-col sm:flex-row gap-4 overflow-hidden rounded-2xl border bg-card p-4 transition-all duration-300 hover:shadow-hover"
            >
              <Link
                to="/product/$slug"
                params={{ slug: p.slug }}
                className="relative aspect-square w-full sm:w-40 shrink-0 overflow-hidden rounded-xl bg-muted"
              >
                <img
                  src={img}
                  alt={p.name}
                  className="size-full object-cover transition-transform duration-300 hover:scale-105"
                />
                {off > 0 && (
                  <span className="absolute left-2.5 top-2.5 rounded-full bg-destructive px-2 py-0.5 text-[11px] font-bold text-destructive-foreground">
                    {off}% OFF
                  </span>
                )}
              </Link>

              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <Link
                    to="/product/$slug"
                    params={{ slug: p.slug }}
                    className="font-bold text-sm sm:text-base text-foreground transition hover:text-secondary line-clamp-2"
                  >
                    {p.name}
                  </Link>

                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-xl font-extrabold text-secondary">
                      {inr(effectivePrice)}
                    </span>
                    {(p.mrp || (custom?.deal_price && Number(p.price) > effectivePrice)) && (
                      <span className="text-xs text-muted-foreground line-through">
                        {inr(p.mrp || p.price)}
                      </span>
                    )}
                  </div>

                  <div className="mt-1 text-xs text-muted-foreground">
                    Stock available: <strong className="text-foreground">{p.stock} units</strong>
                  </div>
                </div>

                <div className="mt-4">
                  <Button
                    size="sm"
                    className="w-full font-bold gap-1.5"
                    disabled={p.stock <= 0}
                    onClick={() => {
                      add(p.id);
                      toast.success("Added to Cart!", { description: p.name });
                    }}
                  >
                    <ShoppingBag className="size-4 mr-1" />
                    {p.stock <= 0 ? "Sold Out" : "Grab This Deal"}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
