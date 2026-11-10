import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { z } from "zod";
import {
  Gift,
  ArrowLeft,
  Search,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  PackageCheck,
  ShoppingBag,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_SELECT, mainImage, type Product } from "@/lib/catalog";
import { inr } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const searchSchema = z.object({
  parent: z.string(),
  variantId: z.string().optional(),
  variantName: z.string().optional(),
});

export const Route = createFileRoute("/bogo-select")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Choose Your FREE BOGO Toy | TrendyToyz" },
      { name: "description", content: "Select your free toy with the Buy 1 Get 1 with Option promotion at TrendyToyz." },
    ],
  }),
  component: BogoSelectPage,
});

function BogoSelectPage() {
  const { parent: parentId, variantId, variantName } = Route.useSearch();
  const nav = useNavigate();
  const { add } = useCart();
  const [q, setQ] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("all");

  // 1. Fetch parent product
  const { data: parent, isLoading: parentLoading } = useQuery({
    queryKey: ["product-parent-bogo", parentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("id", parentId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Product | null;
    },
  });

  // Calculate parent price and max budget (50% of parent product value)
  const parentPrice = useMemo(() => {
    if (!parent) return 0;
    if (variantId && Array.isArray(parent.variants)) {
      const v = parent.variants.find((item) => item.id === variantId);
      if (v && v.price) return Number(v.price);
    }
    return Number(parent.price);
  }, [parent, variantId]);

  const maxBudget = Math.floor(parentPrice * 0.5);

  // 2. Fetch all eligible free products (price <= maxBudget, stock > 0, status active, not the same item)
  const { data: eligibleProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ["bogo-eligible-products", maxBudget, parentId],
    enabled: maxBudget > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("status", "active")
        .gt("stock", 0)
        .neq("id", parentId)
        .lte("price", maxBudget)
        .order("price", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });

  // Unique categories for filter pills
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    eligibleProducts.forEach((p) => {
      if (p.categories?.slug && p.categories?.name) {
        map.set(p.categories.slug, p.categories.name);
      }
    });
    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
  }, [eligibleProducts]);

  // Filtered products based on search and category
  const filteredProducts = useMemo(() => {
    return eligibleProducts.filter((p) => {
      if (selectedCat !== "all" && p.categories?.slug !== selectedCat) return false;
      if (q.trim()) {
        const query = q.toLowerCase();
        return (
          p.name.toLowerCase().includes(query) ||
          p.short_description?.toLowerCase().includes(query) ||
          p.categories?.name.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [eligibleProducts, selectedCat, q]);

  // Handle Option A fallback: Choose same product
  const handleChooseSameProduct = () => {
    if (!parent) return;
    add(parent.id, 2, variantId, variantName);
    toast.success("BOGO Option A Applied!", {
      description: `Added 2x ${parent.name} to cart. 2nd unit is 100% FREE!`,
    });
    nav({ to: "/cart" });
  };

  // Handle Option B selection: Choose different free product
  const handleSelectFreeProduct = (freeProd: Product) => {
    if (!parent) return;

    // Add primary parent product at regular price
    add(parent.id, 1, variantId, variantName);

    // Add selected product as FREE BOGO item
    add(freeProd.id, 1, undefined, undefined, {
      isFreeBogo: true,
      bogoParentId: parent.id,
      bogoParentName: parent.name,
      bogoLimit: maxBudget,
    });

    const unusedBudget = maxBudget - Number(freeProd.price);

    toast.success("FREE BOGO Toy Claimed!", {
      description: `Added ${parent.name} and your FREE ${freeProd.name}!${
        unusedBudget > 0 ? ` (Remaining ${inr(unusedBudget)} balance is forfeited).` : ""
      }`,
    });

    nav({ to: "/cart" });
  };

  if (parentLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-secondary border-t-transparent mx-auto" />
        <p className="mt-4 font-bold text-muted-foreground">Loading BOGO Toy Selection...</p>
      </div>
    );
  }

  if (!parent) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="font-bold text-destructive">Product not found.</p>
        <Button asChild className="mt-4">
          <Link to="/products">Browse All Toys</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Back button */}
      <div className="mb-6 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => nav({ to: "/product/$slug", params: { slug: parent.slug } })}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to {parent.name}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleChooseSameProduct}
          className="border-secondary/40 text-secondary hover:bg-secondary/10 font-bold"
        >
          Want Same Toy Instead? (2x {parent.name})
        </Button>
      </div>

      {/* Main Promotion Header Card */}
      <div className="overflow-hidden rounded-3xl border-2 border-secondary/40 bg-gradient-to-br from-secondary/15 via-background to-secondary/5 p-5 sm:p-7 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-black uppercase tracking-wider text-secondary-foreground shadow-xs">
                <Gift className="size-3.5 fill-current" /> Buy 1 Get 1 with Option
              </span>
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                Option B: Different Product
              </span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              Select Your 100% FREE Toy! 🎁
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
              Choose any toy below priced up to <strong className="text-secondary font-bold">{inr(maxBudget)}</strong> (50% of your purchased toy's value). Your selected toy will be added to your order for <strong className="text-emerald-600 dark:text-emerald-400 font-bold">₹0 (Completely FREE)</strong>!
            </p>
          </div>

          {/* Purchased Item Summary Box */}
          <div className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-xs shrink-0 md:max-w-xs">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white p-1">
              <img
                src={mainImage(parent)}
                alt={parent.name}
                className="size-full object-contain"
                width={64}
                height={64}
              />
            </div>
            <div className="text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Purchased Item
              </span>
              <div className="font-bold text-foreground line-clamp-1">{parent.name}</div>
              {variantName && <div className="text-[11px] text-secondary font-semibold">({variantName})</div>}
              <div className="mt-0.5 font-extrabold text-secondary">{inr(parentPrice)}</div>
            </div>
          </div>
        </div>

        {/* Budget & Carry-forward Warning Note */}
        <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
          <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="font-bold">Important Notice on Budget:</strong> Your allocated free product allowance is <strong>{inr(maxBudget)}</strong>. If you select a toy priced under this limit (for example, a {inr(Math.min(200, maxBudget))} toy), <strong>the remaining balance cannot be carried forward to future orders</strong>.
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative max-w-md flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search among free toys up to ${inr(maxBudget)}...`}
            className="pl-9 rounded-xl"
          />
        </div>

        {/* Categories Pills */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedCat("all")}
            className={`rounded-xl px-3 py-1.5 font-bold transition ${
              selectedCat === "all"
                ? "bg-secondary text-secondary-foreground shadow-xs"
                : "border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            All Eligible ({eligibleProducts.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              onClick={() => setSelectedCat(c.slug)}
              className={`rounded-xl px-3 py-1.5 font-bold transition ${
                selectedCat === c.slug
                  ? "bg-secondary text-secondary-foreground shadow-xs"
                  : "border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      {productsLoading ? (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-2xl bg-muted/60" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="mt-12 rounded-3xl border border-dashed p-12 text-center">
          <div className="text-4xl">🧸</div>
          <h3 className="mt-3 font-bold text-lg">No toys found under {inr(maxBudget)}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Try adjusting your search query or choose Option A to get another unit of your purchased toy!
          </p>
          <Button onClick={handleChooseSameProduct} className="mt-4 gap-2 font-bold" variant="secondary">
            Get 2nd {parent.name} FREE
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:gap-5 lg:grid-cols-4">
          {filteredProducts.map((p) => {
            const utilization = Math.round((Number(p.price) / maxBudget) * 100);
            return (
              <div
                key={p.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border-2 border-border/80 bg-card transition duration-300 hover:-translate-y-1 hover:border-emerald-500/50 hover:shadow-lg"
              >
                {/* Product Image & Badges */}
                <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-white p-2">
                  <img
                    src={mainImage(p)}
                    alt={p.name}
                    className="size-full object-contain p-1 transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                    width={300}
                    height={300}
                  />
                  {/* FREE Badge */}
                  <span className="absolute left-2.5 top-2.5 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-extrabold text-white shadow-xs">
                    100% FREE
                  </span>

                  <span className="absolute bottom-2 right-2 rounded-lg bg-background/90 px-2 py-0.5 text-[10px] font-bold text-muted-foreground backdrop-blur border">
                    Value: {inr(p.price)}
                  </span>
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col p-3.5 sm:p-4 justify-between">
                  <div>
                    <h3 className="line-clamp-2 text-xs sm:text-sm font-bold text-foreground leading-snug group-hover:text-secondary">
                      {p.name}
                    </h3>

                    {/* Price Breakdown */}
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                        FREE
                      </span>
                      <span className="text-xs text-muted-foreground line-through">
                        {inr(p.price)}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Budget Used: {utilization}%</span>
                      <span>Stock: {p.stock}</span>
                    </div>
                  </div>

                  {/* Selection Button */}
                  <Button
                    size="sm"
                    onClick={() => handleSelectFreeProduct(p)}
                    className="mt-3.5 w-full bg-emerald-600 text-white hover:bg-emerald-700 font-bold gap-1.5 shadow-sm"
                  >
                    <Gift className="size-4" /> Select as FREE Toy
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
