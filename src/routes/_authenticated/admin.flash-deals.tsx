import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Zap,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShoppingBag,
  Eye,
  EyeOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchSettings, PRODUCT_SELECT, mainImage, type Product } from "@/lib/catalog";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/flash-deals")({
  component: AdminFlashDeals,
});

type FlashDealProductConfig = {
  product_id: string;
  deal_price?: number;
  discount_pct?: number;
};

function AdminFlashDeals() {
  const qc = useQueryClient();
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  const { data: allProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ["admin", "products-for-flash"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });

  const [enabled, setEnabled] = useState(false);
  const [title, setTitle] = useState("Deal of the Day");
  const [subtitle, setSubtitle] = useState("Limited Stock Available");
  const [endTime, setEndTime] = useState("");
  const [dealProducts, setDealProducts] = useState<FlashDealProductConfig[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setEnabled(!!(settings as any).flash_deals_enabled);
      setTitle((settings as any).flash_deals_title || "Deal of the Day");
      setSubtitle((settings as any).flash_deals_subtitle || "Limited Stock Available");

      const rawEnd = (settings as any).flash_deals_end_time;
      if (rawEnd) {
        try {
          const d = new Date(rawEnd);
          setEndTime(d.toISOString().slice(0, 16));
        } catch {
          setEndTime("");
        }
      } else {
        // Default 24 hours from now
        setEndTime(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
      }

      const rawCustom = (settings as any).flash_deals_custom_discounts;
      if (Array.isArray(rawCustom)) {
        setDealProducts(rawCustom);
      } else {
        const rawIds = (settings as any).flash_deals_product_ids;
        if (Array.isArray(rawIds)) {
          setDealProducts(rawIds.map((id: string) => ({ product_id: id })));
        } else {
          setDealProducts([]);
        }
      }
    }
  }, [settings]);

  const handleAddProduct = () => {
    if (!selectedProductId) return;
    if (dealProducts.some((p) => p.product_id === selectedProductId)) {
      toast.error("This toy is already added to flash deals.");
      return;
    }
    const found = allProducts.find((p) => p.id === selectedProductId);
    const regularPrice = found ? Number(found.price) : 0;
    const defaultDealPrice = regularPrice > 0 ? Math.round(regularPrice * 0.8) : 0;

    setDealProducts([
      ...dealProducts,
      { product_id: selectedProductId, deal_price: defaultDealPrice },
    ]);
    setSelectedProductId("");
  };

  const handleRemoveProduct = (prodId: string) => {
    setDealProducts(dealProducts.filter((p) => p.product_id !== prodId));
  };

  const handleUpdatePrice = (prodId: string, dealPrice: number) => {
    setDealProducts(
      dealProducts.map((p) => (p.product_id === prodId ? { ...p, deal_price: dealPrice } : p))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const productIds = dealProducts.map((p) => p.product_id);
      const isoEnd = endTime ? new Date(endTime).toISOString() : null;

      const { error } = await supabase
        .from("store_settings")
        .update({
          flash_deals_enabled: enabled,
          flash_deals_title: title.trim() || "Deal of the Day",
          flash_deals_subtitle: subtitle.trim() || "Limited Stock Available",
          flash_deals_end_time: isoEnd,
          flash_deals_product_ids: productIds,
          flash_deals_custom_discounts: dealProducts,
        } as any)
        .eq("id", 1);

      if (error) throw error;

      toast.success(
        enabled
          ? `Flash Deals activated with ${dealProducts.length} product(s)!`
          : "Flash Deals disabled. Hidden from customer storefront."
      );
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["products", "flash-sale"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save flash deals");
    } finally {
      setSaving(false);
    }
  };

  if (settingsLoading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-card" />;
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-amber-500/15 text-amber-600">
              <Zap className="size-5 fill-current" />
            </span>
            <h1 className="font-display text-2xl font-bold tracking-tight">Flash Deals Manager</h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Control the "Deal of the Day" and Flash Sale section on your homepage. When disabled, no fake deals will appear.
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} className="font-bold gap-2 shadow-sm">
          <CheckCircle2 className="size-4" /> {saving ? "Saving..." : "Save Flash Deals"}
        </Button>
      </div>

      {/* Master Toggle Banner */}
      <div
        className={`rounded-3xl border-2 p-5 transition-all ${
          enabled
            ? "border-amber-500/50 bg-gradient-to-r from-amber-500/15 via-background to-orange-500/10"
            : "border-border/80 bg-muted/30"
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`grid size-10 place-items-center rounded-2xl ${
                enabled ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              {enabled ? <Eye className="size-5" /> : <EyeOff className="size-5" />}
            </div>
            <div>
              <h2 className="font-bold text-base text-foreground">
                Flash Deals Live Status: {enabled ? "ACTIVE (Visible on Storefront)" : "DISABLED (Hidden)"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {enabled
                  ? "Customers can see the countdown and selected flash deals on the homepage."
                  : "The Flash Deals section is 100% hidden from customers. No fake deals or countdowns are shown."}
              </p>
            </div>
          </div>

          <Switch checked={enabled} onCheckedChange={setEnabled} className="scale-125" />
        </div>
      </div>

      {/* Flash Deals Settings Form */}
      <div className="rounded-3xl border bg-card p-6 shadow-sm space-y-5">
        <h3 className="font-bold text-base text-foreground flex items-center gap-2 border-b pb-3">
          <Clock className="size-4 text-secondary" /> Deal Headline & Countdown Timer
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="font-bold text-xs">Section Headline</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Deal of the Day, Mega Flash Sale"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="font-bold text-xs">Sub-badge / Tagline</Label>
            <Input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="e.g. Limited Stock Available, 24 Hours Only"
              className="mt-1"
            />
          </div>

          <div className="sm:col-span-2">
            <Label className="font-bold text-xs">Countdown Ends At (Target Date & Time)</Label>
            <Input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="mt-1 max-w-sm"
            />
            <span className="text-[11px] text-muted-foreground mt-1 block">
              The live countdown on the homepage will tick down in real-time until this exact moment.
            </span>
          </div>
        </div>
      </div>

      {/* Product Selection Section */}
      <div className="rounded-3xl border bg-card p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
          <div>
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <ShoppingBag className="size-4 text-secondary" /> Selected Flash Deal Toys ({dealProducts.length})
            </h3>
            <p className="text-xs text-muted-foreground">
              Add the specific toys you want to feature in the Flash Deals section.
            </p>
          </div>
        </div>

        {/* Add Product Dropdown */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full sm:flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-secondary"
          >
            <option value="">-- Choose a toy to add to Flash Deals --</option>
            {allProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · Current Price: {inr(p.price)} (Stock: {p.stock})
              </option>
            ))}
          </select>

          <Button
            type="button"
            onClick={handleAddProduct}
            disabled={!selectedProductId}
            className="w-full sm:w-auto font-bold gap-1.5"
          >
            <Plus className="size-4" /> Add to Flash Deals
          </Button>
        </div>

        {/* Selected Products List */}
        {dealProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
            <Zap className="size-8 mx-auto opacity-30 mb-2" />
            <p className="font-bold text-sm">No toys selected for Flash Deals yet.</p>
            <p className="text-xs mt-0.5">Select toys from the dropdown above to feature them with special deal prices.</p>
          </div>
        ) : (
          <div className="divide-y rounded-2xl border bg-background overflow-hidden">
            {dealProducts.map((deal) => {
              const product = allProducts.find((p) => p.id === deal.product_id);
              if (!product) return null;

              const regPrice = Number(product.price);
              const activeDealPrice = deal.deal_price ?? Math.round(regPrice * 0.8);
              const offPct =
                regPrice > activeDealPrice
                  ? Math.round(((regPrice - activeDealPrice) / regPrice) * 100)
                  : 0;

              return (
                <div key={deal.product_id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={mainImage(product)}
                      alt={product.name}
                      className="size-14 rounded-xl object-cover border"
                    />
                    <div>
                      <h4 className="font-bold text-sm text-foreground">{product.name}</h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>Original Price: <strong className="line-through">{inr(regPrice)}</strong></span>
                        <span>·</span>
                        <span>Stock: {product.stock} units</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-bold whitespace-nowrap">Deal Price (₹):</Label>
                      <Input
                        type="number"
                        min={1}
                        value={deal.deal_price ?? activeDealPrice}
                        onChange={(e) =>
                          handleUpdatePrice(deal.product_id, Math.max(1, Number(e.target.value)))
                        }
                        className="w-24 text-center font-bold text-secondary"
                      />
                    </div>

                    {offPct > 0 && (
                      <span className="rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-bold text-destructive whitespace-nowrap">
                        {offPct}% OFF
                      </span>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveProduct(deal.product_id)}
                      className="text-muted-foreground hover:text-destructive p-2"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Save Floating Bar */}
      <div className="flex justify-end gap-3 pt-2">
        <Button onClick={handleSave} disabled={saving} size="lg" className="font-bold gap-2 px-8 shadow-sm">
          <CheckCircle2 className="size-5" /> {saving ? "Saving..." : "Save & Publish Flash Deals"}
        </Button>
      </div>
    </div>
  );
}
