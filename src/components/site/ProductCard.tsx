import { Link } from "@tanstack/react-router";
import { ShoppingBag, Star, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { discountPct, inr } from "@/lib/format";
import { mainImage, sortedImages, type Product } from "@/lib/catalog";
import { resolveImageUrl } from "@/lib/images";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";

export function ProductCard({ p, priority = false }: { p: Product; priority?: boolean }) {
  const { add } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number | null>(null);

  const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
  const off = discountPct(p.price, p.mrp);
  const out = p.stock <= 0;

  // Gather all unique images for this product, resolving to CDN URLs
  const productImgs = sortedImages(p).map((img) => resolveImageUrl(img.url));
  const allImages = productImgs.length > 0 ? productImgs : [resolveImageUrl(mainImage(p))];
  const hasMultipleImages = allImages.length > 1;

  // Desktop hover cycling (~1s interval)
  const handleMouseEnter = () => {
    if (!hasMultipleImages) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % allImages.length);
    }, 1000);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setActiveIdx(0);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Mobile swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || !hasMultipleImages) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        // Swipe left -> next image
        setActiveIdx((prev) => (prev + 1) % allImages.length);
      } else {
        // Swipe right -> previous image
        setActiveIdx((prev) => (prev - 1 + allImages.length) % allImages.length);
      }
    }
    touchStartX.current = null;
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    add(p.id);
    setJustAdded(true);
    toast.success("Added to Cart!", { description: p.name });
    setTimeout(() => setJustAdded(false), 1500);
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card transition-all duration-300 hover:-translate-y-1 hover:border-secondary/40 hover:shadow-hover"
    >
      {/* Product Image & Badges */}
      <Link
        to="/product/$slug"
        params={{ slug: p.slug }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative block aspect-square w-full overflow-hidden bg-white select-none flex items-center justify-center p-2.5"
      >
        {allImages.map((src, i) => (
          <img
            key={src + i}
            src={src}
            alt={`${p.name} - 100% Certified Child-Safe Toy at TrendyToyz (View ${i + 1})`}
            loading={priority && i === 0 ? "eager" : "lazy"}
            decoding="async"
            width={400}
            height={400}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/images/teddy.jpg";
            }}
            className={`absolute inset-0 size-full object-contain p-2 transition-all duration-500 ease-out group-hover:scale-105 ${
              i === activeIdx ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
            }`}
          />
        ))}

        {/* Discount Badge */}
        {off > 0 && (
          <span className="absolute left-2.5 top-2.5 z-20 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-bold text-secondary-foreground shadow-xs">
            {off}% OFF
          </span>
        )}

        {/* Out of stock badge */}
        {out ? (
          <div className="absolute inset-x-0 bottom-0 z-20 bg-primary/90 py-1.5 text-center text-xs font-semibold text-primary-foreground backdrop-blur-xs">
            Currently Out of Stock
          </div>
        ) : hasVariants ? (
          <div className="absolute bottom-2 right-2 z-20 rounded-lg bg-background/90 px-2 py-0.5 text-[10px] font-bold text-foreground shadow-xs backdrop-blur-xs border border-border/50">
            {p.variants!.length} Options
          </div>
        ) : null}

        {/* Image dot indicators */}
        {hasMultipleImages && (
          <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 gap-1 rounded-full bg-background/60 px-1.5 py-0.5 backdrop-blur-xs">
            {allImages.map((_, i) => (
              <span
                key={i}
                className={`size-1.5 rounded-full transition-all duration-300 ${
                  i === activeIdx ? "bg-secondary w-3" : "bg-muted-foreground/50"
                }`}
              />
            ))}
          </div>
        )}
      </Link>

      {/* Product Information */}
      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        {/* Star Rating Mockup */}
        <div className="mb-1.5 flex items-center gap-1 text-[11px] text-amber-500">
          <div className="flex items-center">
            <Star className="size-3 fill-amber-400 text-amber-400" />
            <span className="ml-1 font-bold text-foreground">4.8</span>
          </div>
          <span className="text-muted-foreground">(40+)</span>
        </div>

        <Link
          to="/product/$slug"
          params={{ slug: p.slug }}
          className="line-clamp-2 min-h-10 text-xs sm:text-sm font-semibold text-foreground transition hover:text-secondary leading-snug"
        >
          {p.name}
        </Link>

        {/* Price & Savings */}
        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-base sm:text-lg font-bold text-foreground">
            {inr(p.price)}
          </span>
          {off > 0 && (
            <span className="text-xs text-muted-foreground line-through">
              {inr(p.mrp)}
            </span>
          )}
        </div>

        {/* Action Button */}
        {hasVariants ? (
          <Button
            asChild
            size="sm"
            variant="outline"
            className="mt-3 w-full font-semibold border-secondary/50 text-secondary hover:bg-secondary hover:text-secondary-foreground"
          >
            <Link to="/product/$slug" params={{ slug: p.slug }}>
              Choose Options
            </Link>
          </Button>
        ) : (
          <Button
            size="sm"
            className={`mt-3 w-full font-semibold transition-all ${
              justAdded
                ? "bg-success text-success-foreground"
                : out
                ? "bg-muted text-muted-foreground"
                : "bg-primary text-primary-foreground hover:bg-secondary hover:text-secondary-foreground"
            }`}
            disabled={out}
            onClick={handleAddToCart}
          >
            {justAdded ? (
              <>
                <Check className="size-4 mr-1" /> Added
              </>
            ) : out ? (
              "Sold Out"
            ) : (
              <>
                <ShoppingBag className="size-4 mr-1" /> Add to Cart
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ n = 8 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-5 lg:grid-cols-4">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-2xl border bg-card">
          <div className="aspect-square bg-muted/60" />
          <div className="space-y-2 p-3.5">
            <div className="h-3 w-1/3 rounded bg-muted/60" />
            <div className="h-4 rounded bg-muted/60" />
            <div className="h-4 w-1/2 rounded bg-muted/60" />
            <div className="mt-2 h-8 rounded-xl bg-muted/60" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center">
      <p className="font-semibold text-destructive">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
