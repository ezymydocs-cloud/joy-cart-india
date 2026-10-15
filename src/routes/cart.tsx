import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { useCartProducts } from "@/lib/useCartProducts";
import { mainImage } from "@/lib/catalog";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Totals } from "@/components/site/Summary";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your Cart | TrendyToyz" },
      { name: "description", content: "Review the toys in your TrendyToyz cart." },
      { property: "og:title", content: "Your Cart | TrendyToyz" },
      { property: "og:description", content: "Review the toys in your TrendyToyz cart." },
    ],
  }),
  component: Cart,
});

function Cart() {
  const { lines, setQty, remove } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const c = useCartProducts();
  useEffect(() => { c.missing.forEach((l) => remove(l.productId)); }, [c.missing, remove]);

  if (lines.length === 0)
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="text-6xl">🛍️</div>
        <h1 className="mt-4 text-2xl">Your cart is empty</h1>
        <Button asChild className="mt-5"><Link to="/products">Start shopping</Link></Button>
      </div>
    );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-5 text-3xl">Your cart</h1>
      {c.isLoading ? <div className="h-40 animate-pulse rounded-3xl bg-muted" /> : (
        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {c.rows.map(({ line, product: p }) => {
              const ship = p.shipping_enabled && Number(p.shipping_charge) > 0 ? Number(p.shipping_charge) : 0;
              return (
                <div key={p.id} className="flex gap-3 rounded-3xl border-2 p-3">
                  <img src={mainImage(p)} alt={p.name} className="size-20 rounded-2xl object-cover" />
                  <div className="flex-1">
                    <Link to="/product/$slug" params={{ slug: p.slug }} className="font-bold leading-tight">{p.name}</Link>
                    <div className="text-sm text-muted-foreground">{inr(p.price)} each · {ship > 0 ? `Shipping ${inr(ship)}` : "Free shipping"}</div>
                    {p.stock < line.qty && <div className="text-sm font-bold text-destructive">{p.stock === 0 ? "Out of stock, please remove" : `Only ${p.stock} available`}</div>}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center rounded-full border-2">
                        <button className="p-1.5" onClick={() => setQty(p.id, line.qty - 1)} aria-label="Decrease"><Minus className="size-4" /></button>
                        <span className="w-7 text-center text-sm font-bold">{line.qty}</span>
                        <button className="p-1.5" disabled={line.qty >= p.stock} onClick={() => setQty(p.id, line.qty + 1)} aria-label="Increase"><Plus className="size-4" /></button>
                      </div>
                      <span className="font-bold">{inr(Number(p.price) * line.qty)}</span>
                      <button onClick={() => remove(p.id)} aria-label="Remove" className="text-muted-foreground hover:text-destructive"><Trash2 className="size-5" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="h-fit space-y-4 rounded-3xl bg-navy-soft p-5">
            <Totals subtotal={c.subtotal} shipping={c.shipping} total={c.total} />
            <Button size="lg" className="w-full" disabled={c.problems.length > 0 || c.rows.length === 0} onClick={() => nav({ to: "/checkout" })}>
              {user ? "Proceed to checkout" : "Login to checkout"}
            </Button>
            {!user && <p className="text-center text-xs text-muted-foreground">Login is required so we can save your details and show order tracking.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
