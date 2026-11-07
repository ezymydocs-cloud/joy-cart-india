import { Link, useNavigate } from "@tanstack/react-router";
import { ShoppingBag, X, Trash2, ArrowRight, ShieldCheck, Truck } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCartProducts } from "@/lib/useCartProducts";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/format";
import { mainImage } from "@/lib/catalog";

const FREE_SHIPPING_THRESHOLD = 499;

export function CartDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { rows, subtotal, isLoading } = useCartProducts();
  const { setQty, remove } = useCart();
  const nav = useNavigate();

  const freeShippingDiff = FREE_SHIPPING_THRESHOLD - subtotal;
  const progressPct = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));

  const handleCheckout = () => {
    onOpenChange(false);
    nav({ to: "/checkout" });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b px-5 py-4 text-left">
          <SheetTitle className="flex items-center justify-between text-lg font-bold">
            <span className="flex items-center gap-2">
              <ShoppingBag className="size-5 text-secondary" />
              Your Cart ({rows.reduce((s, r) => s + r.line.qty, 0)})
            </span>
          </SheetTitle>
        </SheetHeader>

        {/* Free Shipping Progress Indicator */}
        <div className="border-b bg-muted/40 px-5 py-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Truck className="size-3.5 text-secondary" />
              {freeShippingDiff > 0 ? (
                <>Add <b className="text-secondary">{inr(freeShippingDiff)}</b> more for <b>FREE Delivery</b></>
              ) : (
                <span className="font-bold text-success">You've unlocked FREE Shipping!</span>
              )}
            </span>
            <span className="text-[11px] font-bold text-muted-foreground">{progressPct}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className={`h-full transition-all duration-300 ${freeShippingDiff <= 0 ? "bg-success" : "bg-secondary"}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="size-16 rounded-xl bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-muted" />
                    <div className="h-3 w-1/4 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center py-12">
              <div className="grid size-16 place-items-center rounded-2xl bg-muted text-muted-foreground">
                <ShoppingBag className="size-8" />
              </div>
              <h3 className="mt-4 text-base font-semibold">Your cart is empty</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Explore our trending toys and find the perfect gift!
              </p>
              <Button
                size="sm"
                className="mt-5 bg-secondary text-secondary-foreground hover:bg-secondary/90"
                onClick={() => {
                  onOpenChange(false);
                  nav({ to: "/products" });
                }}
              >
                Browse Toys
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {rows.map(({ line, product }) => {
                const img = mainImage(product);
                return (
                  <div key={product.id} className="flex gap-3.5 py-3.5">
                    <Link
                      to="/product/$slug"
                      params={{ slug: product.slug }}
                      onClick={() => onOpenChange(false)}
                      className="size-18 shrink-0 overflow-hidden rounded-xl border bg-muted"
                    >
                      <img src={img} alt={product.name} className="size-full object-cover" />
                    </Link>

                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            to="/product/$slug"
                            params={{ slug: product.slug }}
                            onClick={() => onOpenChange(false)}
                            className="line-clamp-2 text-xs font-semibold hover:text-secondary"
                          >
                            {product.name}
                          </Link>
                          <button
                            onClick={() => remove(product.id)}
                            className="text-muted-foreground transition hover:text-destructive"
                            aria-label="Remove item"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                        <div className="mt-1 font-semibold text-xs text-primary">
                          {inr(product.price)}
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center rounded-lg border bg-background text-xs">
                          <button
                            onClick={() => setQty(product.id, line.qty - 1)}
                            className="px-2 py-0.5 text-muted-foreground hover:bg-muted"
                            aria-label="Decrease quantity"
                          >
                            -
                          </button>
                          <span className="min-w-6 text-center font-bold">{line.qty}</span>
                          <button
                            onClick={() => setQty(product.id, line.qty + 1)}
                            disabled={line.qty >= product.stock}
                            className="px-2 py-0.5 text-muted-foreground hover:bg-muted disabled:opacity-40"
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-xs font-bold text-foreground">
                          {inr(Number(product.price) * line.qty)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Checkout Summary */}
        {rows.length > 0 && (
          <div className="border-t bg-background p-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-bold text-base text-foreground">{inr(subtotal)}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Shipping & taxes calculated at checkout.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  nav({ to: "/cart" });
                }}
              >
                View Full Cart
              </Button>
              <Button
                size="sm"
                className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-bold"
                onClick={handleCheckout}
              >
                Checkout <ArrowRight className="size-3.5 ml-1" />
              </Button>
            </div>

            <div className="flex items-center justify-center gap-4 pt-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <ShieldCheck className="size-3.5 text-success" /> 100% Child Safe
              </span>
              <span className="flex items-center gap-1">
                <Truck className="size-3.5 text-secondary" /> Fast Dispatch
              </span>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
