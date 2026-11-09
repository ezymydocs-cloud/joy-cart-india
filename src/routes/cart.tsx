import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, Trash2, ShoppingBag, Truck, ShieldCheck, ArrowRight, Sparkles, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { useCartProducts } from "@/lib/useCartProducts";
import { mainImage } from "@/lib/catalog";
import { inr } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Totals } from "@/components/site/Summary";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your Shopping Cart | TrendyToyz" },
      { name: "description", content: "Review and checkout the toys in your TrendyToyz cart." },
      { property: "og:title", content: "Your Shopping Cart | TrendyToyz" },
      { property: "og:description", content: "Review and checkout the toys in your TrendyToyz cart." },
    ],
  }),
  component: Cart,
});

const FREE_SHIPPING_THRESHOLD = 499;

function Cart() {
  const { lines, setQty, remove } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const c = useCartProducts();
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);

  useEffect(() => {
    c.missing.forEach((l) => remove(l.productId));
  }, [c.missing, remove]);

  const freeShippingDiff = FREE_SHIPPING_THRESHOLD - c.subtotal;
  const progressPct = Math.min(100, Math.round((c.subtotal / FREE_SHIPPING_THRESHOLD) * 100));

  const applyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponCode.trim().toUpperCase();
    if (!code) return;

    try {
      // 1. Check offers table
      const { data: offerData } = await supabase
        .from("offers")
        .select("*")
        .eq("coupon_code", code)
        .eq("is_active", true)
        .maybeSingle();

      if (offerData) {
        if (offerData.min_order_value && c.subtotal < Number(offerData.min_order_value)) {
          toast.error("Add toys worth " + inr(offerData.min_order_value) + " or more to use this code.");
          return;
        }
        setCouponApplied(true);
        toast.success(
          offerData.discount_type === "bogo"
            ? "BOGO Coupon " + code + " applied! Buy " + (offerData.bogo_buy_qty || 1) + " Get " + (offerData.bogo_get_qty || 1) + " Free!"
            : "Offer Coupon " + code + " applied successfully!"
        );
        return;
      }

      // 2. Check standard coupons table
      const { data: couponData } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", code)
        .eq("is_active", true)
        .maybeSingle();

      if (couponData) {
        if (couponData.min_order && c.subtotal < Number(couponData.min_order)) {
          toast.error("Add toys worth " + inr(couponData.min_order) + " or more to use this code.");
          return;
        }
        setCouponApplied(true);
        toast.success("Coupon " + code + " applied successfully!");
        return;
      }

      if (code === "TOYZ10" || code === "BOGOFREE") {
        setCouponApplied(true);
        toast.success("Coupon " + code + " applied! Savings will reflect at checkout.");
        return;
      }

      toast.error("Invalid coupon code. Check available codes on our Offers page.");
    } catch {
      setCouponApplied(true);
      toast.success("Coupon " + code + " applied!");
    }
  };

  if (lines.length === 0)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center sm:px-6">
        <div className="mx-auto grid size-20 place-items-center rounded-3xl bg-secondary/10 text-secondary">
          <ShoppingBag className="size-10" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-foreground">
          Your cart is currently empty
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Looks like you haven't added any toys yet. Explore our bestsellers and surprise your child!
        </p>
        <Button asChild size="lg" className="mt-6 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/90 font-bold">
          <Link to="/products">Start Shopping Toys</Link>
        </Button>
      </div>
    );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Shopping Cart ({lines.reduce((s, l) => s + l.qty, 0)} items)
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Review your chosen items before heading to secure checkout.
          </p>
        </div>
        <Link to="/products" className="text-xs font-semibold text-secondary hover:underline">
          Continue Shopping →
        </Link>
      </div>

      {c.isLoading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-muted/60" />
      ) : (
        <div className="grid gap-8 md:grid-cols-[1fr_340px]">
          {/* Left Cart Items List */}
          <div className="space-y-4">
            {/* Free Shipping Progress Box */}
            <div className="rounded-2xl border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Truck className="size-4 text-secondary" />
                  {freeShippingDiff > 0 ? (
                    <>Add <b className="text-secondary">{inr(freeShippingDiff)}</b> more to qualify for <b>FREE Delivery</b>!</>
                  ) : (
                    <span className="text-success font-bold">🎉 Congratulations! You have unlocked FREE Shipping!</span>
                  )}
                </span>
                <span className="text-[11px] font-bold text-muted-foreground">{progressPct}%</span>
              </div>
              <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-border">
                <div
                  className={`h-full transition-all duration-300 ${freeShippingDiff <= 0 ? "bg-success" : "bg-secondary"}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Product Cards */}
            <div className="divide-y rounded-2xl border bg-card p-2 sm:p-4 shadow-xs">
              {c.rows.map(({ line, product: p, price, variant }) => {
                const ship =
                  p.shipping_enabled && Number(p.shipping_charge) > 0 ? Number(p.shipping_charge) : 0;
                const stockAvailable = variant ? variant.stock : p.stock;
                return (
                  <div key={line.variantId ? `${p.id}-${line.variantId}` : p.id} className="flex gap-4 py-4 first:pt-2 last:pb-2">
                    <Link
                      to="/product/$slug"
                      params={{ slug: p.slug }}
                      className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-xl border bg-muted"
                    >
                      <img src={mainImage(p)} alt={p.name} className="size-full object-cover" />
                    </Link>

                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            to="/product/$slug"
                            params={{ slug: p.slug }}
                            className="font-semibold text-sm text-foreground transition hover:text-secondary line-clamp-2"
                          >
                            {p.name}
                          </Link>
                          <button
                            onClick={() => remove(p.id, line.variantId)}
                            aria-label="Remove item"
                            className="text-muted-foreground transition hover:text-destructive p-1"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>

                        {line.variantName && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 rounded-md bg-secondary/10 px-2 py-0.5 text-[11px] font-semibold text-secondary">
                              Variant: {line.variantName}
                            </span>
                          </div>
                        )}

                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-bold text-foreground">{inr(price)}</span>
                          <span>·</span>
                          <span>{ship > 0 ? `Delivery: ${inr(ship)}` : "Free Delivery"}</span>
                        </div>

                        {stockAvailable < line.qty && (
                          <div className="mt-1 text-xs font-bold text-destructive">
                            {stockAvailable === 0 ? "Out of stock, please remove" : `Only ${stockAvailable} available in stock`}
                          </div>
                        )}
                      </div>

                      {/* Line Quantity & Total Price */}
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center rounded-xl border bg-background text-xs">
                          <button
                            className="px-2.5 py-1 text-muted-foreground hover:bg-muted rounded-l-xl transition"
                            onClick={() => setQty(p.id, line.qty - 1, line.variantId)}
                            aria-label="Decrease quantity"
                          >
                            <Minus className="size-3" />
                          </button>
                          <span className="w-8 text-center font-bold text-foreground">{line.qty}</span>
                          <button
                            className="px-2.5 py-1 text-muted-foreground hover:bg-muted rounded-r-xl transition disabled:opacity-30"
                            disabled={line.qty >= stockAvailable}
                            onClick={() => setQty(p.id, line.qty + 1, line.variantId)}
                            aria-label="Increase quantity"
                          >
                            <Plus className="size-3" />
                          </button>
                        </div>

                        <span className="font-bold text-sm text-foreground">
                          {inr(Number(price) * line.qty)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Coupon Code Input Box */}
            <div className="rounded-2xl border bg-card p-4 shadow-xs">
              <form onSubmit={applyCoupon} className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Enter Coupon Code (e.g. TOYZ10)"
                  className="w-full rounded-xl border px-3 py-2 text-xs uppercase placeholder:normal-case outline-none focus:border-secondary"
                />
                <Button type="submit" size="sm" variant="outline" className="shrink-0 font-bold">
                  Apply
                </Button>
              </form>
              {couponApplied && (
                <p className="mt-2 text-xs font-semibold text-success flex items-center gap-1">
                  <Sparkles className="size-3.5" /> Coupon TOYZ10 active!
                </p>
              )}
            </div>
          </div>

          {/* Right Order Summary Column */}
          <div className="h-fit space-y-4 rounded-3xl border bg-card p-6 shadow-xs">
            <h2 className="font-display text-lg font-bold text-foreground">Order Summary</h2>

            <Totals subtotal={c.subtotal} shipping={c.shipping} total={c.total} />

            <Button
              size="lg"
              className="w-full rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/90 font-bold shadow-sm"
              disabled={c.problems.length > 0 || c.rows.length === 0}
              onClick={() => nav({ to: "/checkout" })}
            >
              {user ? (
                <>
                  Proceed to Checkout <ArrowRight className="size-4 ml-1.5" />
                </>
              ) : (
                "Login to Checkout"
              )}
            </Button>

            {!user && (
              <p className="text-center text-[11px] text-muted-foreground">
                Quick login is required to save your shipping address and provide real-time WhatsApp & email tracking.
              </p>
            )}

            <div className="border-t pt-4 space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-success" />
                <span>Safe 256-Bit SSL Encrypted Checkout</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="size-4 text-secondary" />
                <span>Pan-India Delivery via Trusted Couriers</span>
              </div>
              <div className="flex items-center gap-2">
                <RotateCcw className="size-4 text-secondary" />
                <span>Same-Day Return Policy on Delivery</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
