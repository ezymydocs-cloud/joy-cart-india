import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { discountPct, inr } from "@/lib/format";
import { mainImage, type Product } from "@/lib/catalog";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";

export function ProductCard({ p }: { p: Product }) {
  const { add } = useCart();
  const off = discountPct(p.price, p.mrp);
  const out = p.stock <= 0;
  return (
    <div className="group flex flex-col overflow-hidden rounded-3xl border-2 bg-card transition-shadow hover:shadow-card">
      <Link to="/product/$slug" params={{ slug: p.slug }} className="relative block aspect-square overflow-hidden bg-muted">
        <img src={mainImage(p)} alt={p.name} loading="lazy" width={400} height={400} className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
        {off > 0 && <span className="absolute left-3 top-3 rounded-full bg-destructive px-2.5 py-1 text-xs font-extrabold text-destructive-foreground">{off}% OFF</span>}
        {out && <span className="absolute inset-x-0 bottom-0 bg-primary/85 py-1.5 text-center text-xs font-bold text-primary-foreground">Out of stock</span>}
      </Link>
      <div className="flex flex-1 flex-col p-3">
        <Link to="/product/$slug" params={{ slug: p.slug }} className="line-clamp-2 min-h-10 text-sm font-bold leading-tight hover:text-secondary">{p.name}</Link>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-display text-lg text-primary">{inr(p.price)}</span>
          {off > 0 && <span className="text-xs text-muted-foreground line-through">{inr(p.mrp)}</span>}
        </div>
        <Button
          size="sm"
          variant="sun"
          className="mt-3"
          disabled={out}
          onClick={() => {
            add(p.id);
            toast.success("Added to cart", { description: p.name });
          }}
        >
          <ShoppingBag /> {out ? "Sold out" : "Add to cart"}
        </Button>
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ n = 8 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-5 lg:grid-cols-4">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-3xl border-2">
          <div className="aspect-square bg-muted" />
          <div className="space-y-2 p-3">
            <div className="h-4 rounded bg-muted" />
            <div className="h-4 w-1/2 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-3xl border-2 border-destructive/30 bg-destructive/5 p-6 text-center">
      <p className="font-bold text-destructive">{message}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>Try again</Button>}
    </div>
  );
}
