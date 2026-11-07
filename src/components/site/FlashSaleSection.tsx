import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Zap, Clock, ArrowRight, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_SELECT, mainImage, type Product } from "@/lib/catalog";
import { inr, discountPct } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";

export function FlashSaleSection() {
  const { add } = useCart();
  // Simulated countdown for deal of the day
  const [timeLeft, setTimeLeft] = useState({ hours: 7, minutes: 28, seconds: 45 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 12, minutes: 0, seconds: 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: dealProducts } = useQuery({
    queryKey: ["products", "flash-sale"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("status", "active")
        .order("is_featured", { ascending: false })
        .limit(2);
      if (error) throw error;
      return data as unknown as Product[];
    },
  });

  if (!dealProducts || dealProducts.length === 0) return null;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <section className="mt-14 rounded-3xl border border-secondary/20 bg-gradient-to-r from-secondary/5 via-card to-secondary/10 p-6 md:p-8 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-secondary-foreground uppercase tracking-wide">
              <Zap className="size-3.5 fill-current" /> Flash Deals
            </span>
            <span className="text-xs font-semibold text-muted-foreground">Limited Stock Available</span>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Deal of the Day
          </h2>
        </div>

        {/* Live Countdown Box */}
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
      </div>

      {/* Featured Deals Grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {dealProducts.map((p, idx) => {
          const off = discountPct(p.price, p.mrp);
          const img = mainImage(p);
          const claimedPercent = idx === 0 ? 82 : 67;

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
                <img src={img} alt={p.name} className="size-full object-cover transition-transform duration-300 hover:scale-105" />
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
                    className="line-clamp-2 text-sm font-bold text-foreground hover:text-secondary"
                  >
                    {p.name}
                  </Link>

                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-lg font-bold text-primary">{inr(p.price)}</span>
                    {off > 0 && (
                      <span className="text-xs text-muted-foreground line-through">{inr(p.mrp)}</span>
                    )}
                  </div>

                  {/* Stock Claimed Progress Bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
                      <span>Claimed: {claimedPercent}%</span>
                      <span className="text-destructive font-semibold">Almost gone!</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full bg-secondary transition-all"
                        style={{ width: `${claimedPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold"
                    onClick={() => {
                      add(p.id);
                      toast.success("Added deal to cart!", { description: p.name });
                    }}
                  >
                    <ShoppingBag className="size-4 mr-1.5" /> Grab Deal
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/product/$slug" params={{ slug: p.slug }}>
                      Details
                    </Link>
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
