import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  BadgePercent,
  Calendar,
  Clock,
  Copy,
  ExternalLink,
  Flame,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Database,
  Gift,
  Percent,
  ArrowDown,
  ArrowUp,
  Package,
  Layers,
  X,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/format";
import { SingleImageUploader } from "@/components/admin/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/offers")({
  head: () => ({ meta: [{ title: "Offers & Promotions | TrendyToyz Admin" }] }),
  component: OffersAdmin,
});

export type OfferProductPrice = {
  product_id: string;
  product_name: string;
  product_slug?: string;
  image_url?: string | null;
  original_price: number;
  offer_price: number;
  adjustment_type: "manual" | "percentage";
  adjustment_value?: number;
};

export type Offer = {
  id?: string;
  title: string;
  description: string | null;
  badge: string | null;
  discount_type: "bogo" | "percentage" | "flat" | "free_shipping" | string;
  discount_value: number;
  coupon_code: string | null;
  min_order_value: number;
  start_date: string;
  end_date: string | null;
  image_url: string | null;
  link_url: string | null;
  display_location: "all" | "homepage" | "announcement" | "popup" | string;
  sort_order: number;
  is_active: boolean;
  bogo_buy_qty?: number;
  bogo_get_qty?: number;
  pricing_type?: "manual" | "percentage" | string;
  pricing_percentage?: number;
  pricing_direction?: "decrease" | "increase" | string;
  product_prices?: OfferProductPrice[];
  created_at?: string;
};

const DEFAULT_OFFER: Offer = {
  title: "",
  description: "",
  badge: "SPECIAL OFFER",
  discount_type: "percentage",
  discount_value: 15,
  coupon_code: "",
  min_order_value: 0,
  start_date: new Date().toISOString().slice(0, 16),
  end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  image_url: null,
  link_url: "/products",
  display_location: "all",
  sort_order: 1,
  is_active: true,
  bogo_buy_qty: 1,
  bogo_get_qty: 1,
  pricing_type: "manual",
  pricing_percentage: 15,
  pricing_direction: "decrease",
  product_prices: [],
};

const SQL_SETUP = `-- Run this in your Supabase SQL Editor if table or columns are missing:
CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  badge text DEFAULT 'SPECIAL OFFER',
  discount_type text NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'flat', 'bogo', 'free_shipping')),
  discount_value numeric NOT NULL DEFAULT 0,
  coupon_code text,
  min_order_value numeric NOT NULL DEFAULT 0,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz,
  image_url text,
  link_url text DEFAULT '/products',
  display_location text NOT NULL DEFAULT 'all' CHECK (display_location IN ('all', 'homepage', 'announcement', 'popup')),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  bogo_buy_qty integer DEFAULT 1,
  bogo_get_qty integer DEFAULT 1,
  pricing_type text DEFAULT 'manual',
  pricing_percentage numeric DEFAULT 0,
  pricing_direction text DEFAULT 'decrease',
  product_prices jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.offers 
  ADD COLUMN IF NOT EXISTS bogo_buy_qty integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS bogo_get_qty integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pricing_type text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS pricing_percentage numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_direction text DEFAULT 'decrease',
  ADD COLUMN IF NOT EXISTS product_prices jsonb DEFAULT '[]'::jsonb;

GRANT SELECT ON public.offers TO anon, authenticated;
GRANT ALL ON public.offers TO service_role;
GRANT INSERT, UPDATE, DELETE, SELECT ON public.offers TO authenticated;

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'offers' AND policyname = 'public offers') THEN
    CREATE POLICY "public offers" ON public.offers FOR SELECT TO anon, authenticated USING (is_active OR public.is_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'offers' AND policyname = 'admin manage offers') THEN
    CREATE POLICY "admin manage offers" ON public.offers FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;`;

function OffersAdmin() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "active" | "scheduled" | "expired" | "paused">("all");
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState<Offer | null>(null);
  const [hasNoExpiry, setHasNoExpiry] = useState(false);
  const [sqlModalOpen, setSqlModalOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const { data: offers = [], isLoading, error } = useQuery({
    queryKey: ["admin", "offers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        product_prices: Array.isArray(row.product_prices)
          ? (row.product_prices as unknown as OfferProductPrice[])
          : [],
      })) as Offer[];
    },
  });

  const cats = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
  });

  const prods = useQuery({
    queryKey: ["admin", "products-for-offers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id,name,slug,price,mrp,stock,product_images(url)")
        .eq("status", "active")
        .order("name");
      return (data ?? []).map((p) => {
        const firstImg = Array.isArray(p.product_images) && p.product_images[0] ? p.product_images[0].url : null;
        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: Number(p.price),
          mrp: Number(p.mrp || p.price),
          stock: p.stock,
          image_url: firstImg,
        };
      });
    },
  });

  const openNew = (discountType: string = "percentage") => {
    setHasNoExpiry(false);
    const isBogo = discountType === "bogo";
    setEdit({
      ...DEFAULT_OFFER,
      discount_type: discountType,
      badge: isBogo ? "BUY 1 GET 1 FREE" : "SPECIAL OFFER",
      title: isBogo ? "Buy 1 Get 1 Free Mega Toy Special" : "",
      sort_order: (offers.length || 0) + 1,
      product_prices: [],
    });
  };

  const openEdit = (o: Offer) => {
    setHasNoExpiry(!o.end_date);
    setEdit({
      ...o,
      start_date: o.start_date ? new Date(o.start_date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
      end_date: o.end_date ? new Date(o.end_date).toISOString().slice(0, 16) : null,
      bogo_buy_qty: o.bogo_buy_qty || 1,
      bogo_get_qty: o.bogo_get_qty || 1,
      pricing_type: o.pricing_type || "manual",
      pricing_percentage: o.pricing_percentage ?? 15,
      pricing_direction: o.pricing_direction || "decrease",
      product_prices: o.product_prices || [],
    });
  };

  const duplicateOffer = (o: Offer) => {
    const { id: _id, created_at: _c, ...rest } = o;
    setHasNoExpiry(!o.end_date);
    setEdit({
      ...rest,
      title: `${o.title} (Copy)`,
      sort_order: (offers.length || 0) + 1,
      start_date: new Date().toISOString().slice(0, 16),
      end_date: o.end_date ? new Date(o.end_date).toISOString().slice(0, 16) : null,
      product_prices: [...(o.product_prices || [])],
    });
    toast.info("Created duplicate in editor. Modify and click Save.");
  };

  // Bulk calculate offer prices for products based on Percentage increase/decrease
  const applyPercentageToProducts = (direction: "decrease" | "increase", pct: number) => {
    if (!edit) return;
    const currentProducts = edit.product_prices || [];
    if (currentProducts.length === 0) {
      toast.error("Please add products to the offer first before applying percentage.");
      return;
    }
    const updated = currentProducts.map((p) => {
      let calcPrice = p.original_price;
      if (direction === "decrease") {
        // Discount / Ghatana: e.g. 20% off
        calcPrice = Math.max(1, Math.round(p.original_price * (1 - pct / 100)));
      } else {
        // Markup / Badana: e.g. 10% increase
        calcPrice = Math.round(p.original_price * (1 + pct / 100));
      }
      return {
        ...p,
        offer_price: calcPrice,
        adjustment_type: "percentage" as const,
        adjustment_value: direction === "decrease" ? -pct : pct,
      };
    });

    setEdit({
      ...edit,
      pricing_type: "percentage",
      pricing_direction: direction,
      pricing_percentage: pct,
      product_prices: updated,
    });
    toast.success(
      `Applied ${pct}% ${direction === "decrease" ? "discount (Ghataya)" : "markup (Badhaya)"} to ${updated.length} products!`
    );
  };

  // Add a product to the offer's pricing list
  const addProductToOffer = (p: { id: string; name: string; slug: string; price: number; image_url: string | null }) => {
    if (!edit) return;
    const existing = (edit.product_prices || []).some((item) => item.product_id === p.id);
    if (existing) {
      toast.info(`${p.name} is already added to this offer.`);
      return;
    }

    let initialOfferPrice = p.price;
    const direction = edit.pricing_direction || "decrease";
    const pct = Number(edit.pricing_percentage || 0);

    if (edit.pricing_type === "percentage" && pct > 0) {
      if (direction === "decrease") {
        initialOfferPrice = Math.max(1, Math.round(p.price * (1 - pct / 100)));
      } else {
        initialOfferPrice = Math.round(p.price * (1 + pct / 100));
      }
    }

    const newEntry: OfferProductPrice = {
      product_id: p.id,
      product_name: p.name,
      product_slug: p.slug,
      image_url: p.image_url,
      original_price: p.price,
      offer_price: initialOfferPrice,
      adjustment_type: (edit.pricing_type as "manual" | "percentage") || "manual",
      adjustment_value: edit.pricing_type === "percentage" ? (direction === "decrease" ? -pct : pct) : 0,
    };

    setEdit({
      ...edit,
      product_prices: [...(edit.product_prices || []), newEntry],
    });
    toast.success(`Added "${p.name}" to offer!`);
  };

  // Remove product from offer
  const removeProductFromOffer = (productId: string) => {
    if (!edit) return;
    setEdit({
      ...edit,
      product_prices: (edit.product_prices || []).filter((p) => p.product_id !== productId),
    });
  };

  // Update specific product's offer price manually
  const updateProductOfferPrice = (productId: string, newOfferPrice: number) => {
    if (!edit) return;
    const updated = (edit.product_prices || []).map((p) => {
      if (p.product_id === productId) {
        return {
          ...p,
          offer_price: Math.max(1, newOfferPrice),
          adjustment_type: "manual" as const,
        };
      }
      return p;
    });
    setEdit({ ...edit, product_prices: updated });
  };

  const save = async () => {
    if (!edit) return;
    const title = edit.title.trim();
    if (!title) return toast.error("Please enter an offer title");

    if (edit.discount_type === "percentage" && (edit.discount_value <= 0 || edit.discount_value > 100)) {
      return toast.error("Percentage discount must be between 1% and 100%");
    }
    if (edit.discount_type === "flat" && edit.discount_value <= 0) {
      return toast.error("Flat discount must be greater than ₹0");
    }

    const payload = {
      title,
      description: edit.description?.trim() || null,
      badge: edit.badge?.trim() || (edit.discount_type === "bogo" ? "BUY 1 GET 1 FREE" : "SPECIAL OFFER"),
      discount_type: edit.discount_type,
      discount_value: Number(edit.discount_value || 0),
      coupon_code: edit.coupon_code?.trim() ? edit.coupon_code.trim().toUpperCase() : null,
      min_order_value: Number(edit.min_order_value || 0),
      start_date: edit.start_date ? new Date(edit.start_date).toISOString() : new Date().toISOString(),
      end_date: hasNoExpiry || !edit.end_date ? null : new Date(edit.end_date).toISOString(),
      image_url: edit.image_url || null,
      link_url: edit.link_url?.trim() || "/products",
      display_location: edit.display_location,
      sort_order: Number(edit.sort_order || 0),
      is_active: edit.is_active,
      bogo_buy_qty: Number(edit.bogo_buy_qty || 1),
      bogo_get_qty: Number(edit.bogo_get_qty || 1),
      pricing_type: edit.pricing_type || "manual",
      pricing_percentage: Number(edit.pricing_percentage || 0),
      pricing_direction: edit.pricing_direction || "decrease",
      product_prices: edit.product_prices || [],
      updated_at: new Date().toISOString(),
    };

    try {
      if (edit.id) {
        const { error } = await supabase.from("offers").update(payload).eq("id", edit.id);
        if (error) throw error;
        toast.success("Offer updated successfully!");
      } else {
        const { error } = await supabase.from("offers").insert(payload);
        if (error) throw error;
        toast.success("Offer created successfully!");
      }
      setEdit(null);
      qc.invalidateQueries({ queryKey: ["admin", "offers"] });
      qc.invalidateQueries({ queryKey: ["offers"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save offer");
    }
  };

  const toggleActive = async (o: Offer) => {
    if (!o.id) return;
    const next = !o.is_active;
    const { error } = await supabase.from("offers").update({ is_active: next }).eq("id", o.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(next ? "Offer activated" : "Offer paused");
      qc.invalidateQueries({ queryKey: ["admin", "offers"] });
      qc.invalidateQueries({ queryKey: ["offers"] });
    }
  };

  const removeOffer = async (o: Offer) => {
    if (!o.id) return;
    if (!confirm(`Are you sure you want to delete "${o.title}"?`)) return;
    const { error } = await supabase.from("offers").delete().eq("id", o.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Offer deleted");
      qc.invalidateQueries({ queryKey: ["admin", "offers"] });
      qc.invalidateQueries({ queryKey: ["offers"] });
    }
  };

  const now = new Date();
  const getOfferStatus = (o: Offer) => {
    if (!o.is_active) return { label: "Paused", variant: "bg-muted text-muted-foreground" };
    const start = new Date(o.start_date);
    if (start > now) return { label: "Scheduled", variant: "bg-blue-500/10 text-blue-600 dark:text-blue-400" };
    if (o.end_date && new Date(o.end_date) < now) return { label: "Expired", variant: "bg-destructive/10 text-destructive" };
    return { label: "Live Active", variant: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
  };

  const filteredOffers = offers.filter((o) => {
    const s = getOfferStatus(o).label.toLowerCase();
    if (filter === "active" && s !== "live active") return false;
    if (filter === "scheduled" && s !== "scheduled") return false;
    if (filter === "expired" && s !== "expired") return false;
    if (filter === "paused" && s !== "paused") return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = o.title.toLowerCase().includes(q);
      const matchDesc = o.description?.toLowerCase().includes(q);
      const matchCode = o.coupon_code?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchCode) return false;
    }
    return true;
  });

  const availableProducts = (prods.data ?? []).filter((p) => {
    if (!productSearch.trim()) return true;
    return p.name.toLowerCase().includes(productSearch.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Promotional Offers & BOGO</h1>
            <span className="rounded-full bg-secondary/15 px-2.5 py-0.5 text-xs font-bold text-secondary">
              {offers.length} active/configured
            </span>
          </div>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Manage Buy 1 Get 1 (BOGO) offers, custom product pricing (Manual & Percentage adjustments), and storefront banners.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSqlModalOpen(true)} className="gap-1.5">
            <Database className="size-4" /> SQL Setup
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openNew("bogo")}
            className="gap-1.5 font-bold shadow-xs bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600"
          >
            <Gift className="size-4" /> + New BOGO Offer
          </Button>
          <Button onClick={() => openNew("percentage")} className="gap-1.5 shadow-sm">
            <Plus className="size-4" /> Create Offer
          </Button>
        </div>
      </div>

      {/* Database Setup Notice if table doesn't exist */}
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="size-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">Database setup needed for Offers</p>
            <p className="text-xs opacity-90 mt-0.5">
              The <code>public.offers</code> table or its columns have not been initialized in Supabase yet. Click "SQL Setup" above to copy and run the 1-click migration in your Supabase SQL Editor.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setSqlModalOpen(true)} className="shrink-0 bg-background text-foreground">
            View SQL
          </Button>
        </div>
      )}

      {/* Offer Editor Card (When adding or editing) */}
      {edit && (
        <div className="rounded-3xl border bg-card p-5 sm:p-7 shadow-card animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between border-b pb-4 mb-5">
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-secondary/15 text-secondary">
                <Sparkles className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold">
                  {edit.id ? "Edit Promotional Offer" : "Create New Promotional Offer"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Configure offer headline, BOGO mechanics, product pricing rules, and display dates
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEdit(null)}>
              Cancel
            </Button>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {/* Title */}
            <div className="sm:col-span-2">
              <Label className="font-bold">Offer Title / Headline *</Label>
              <Input
                value={edit.title}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                placeholder="e.g., Buy 1 Get 1 Free Mega Toy Bonanza · Weekend Special"
                className="mt-1 text-base font-medium"
              />
            </div>

            {/* Subtitle / Description */}
            <div className="sm:col-span-2">
              <Label className="font-bold">Description / Terms (Optional)</Label>
              <Textarea
                value={edit.description ?? ""}
                onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                placeholder="e.g., Buy any eligible toy and get the 2nd toy free! Discount automatically applies at checkout."
                className="mt-1 text-sm resize-none"
                rows={2}
              />
            </div>

            {/* Discount Type */}
            <div>
              <Label className="font-bold flex items-center gap-2">
                <span>Offer Type</span>
                {edit.discount_type === "bogo" && (
                  <span className="rounded bg-amber-500/10 px-1.5 py-0.2 text-[10px] font-bold text-amber-600">
                    BOGO ACTIVE
                  </span>
                )}
              </Label>
              <Select
                value={edit.discount_type}
                onValueChange={(v) => {
                  const isBogo = v === "bogo";
                  setEdit({
                    ...edit,
                    discount_type: v,
                    badge: isBogo ? "BUY 1 GET 1 FREE" : edit.badge,
                  });
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bogo">🎁 Buy 1 Get 1 (BOGO) Offer System</SelectItem>
                  <SelectItem value="percentage">🏷️ Percentage Discount (% OFF)</SelectItem>
                  <SelectItem value="flat">💵 Flat Discount (₹ Flat OFF)</SelectItem>
                  <SelectItem value="free_shipping">🚚 Free Pan-India Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Badge Text */}
            <div>
              <Label className="font-bold">Promotional Badge Tag</Label>
              <Input
                value={edit.badge ?? ""}
                onChange={(e) => setEdit({ ...edit, badge: e.target.value.toUpperCase() })}
                placeholder="e.g., BUY 1 GET 1 FREE, MEGA DEAL, LIMITED"
                className="mt-1"
              />
              <span className="text-[11px] text-muted-foreground">Displays in a pill highlight above the offer title</span>
            </div>

            {/* BOGO Rules Configuration (If BOGO is selected) */}
            {edit.discount_type === "bogo" && (
              <div className="sm:col-span-2 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Gift className="size-4 text-amber-600" />
                  <span className="font-bold text-sm text-foreground">Buy X Get Y (BOGO) Mechanics</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs font-semibold">Buy Quantity (Customer Buys)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={edit.bogo_buy_qty ?? 1}
                        onChange={(e) => setEdit({ ...edit, bogo_buy_qty: Math.max(1, Number(e.target.value)) })}
                        className="w-24 font-bold text-center"
                      />
                      <span className="text-xs text-muted-foreground">Items</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Get Quantity Free (Customer Gets Free)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={edit.bogo_get_qty ?? 1}
                        onChange={(e) => setEdit({ ...edit, bogo_get_qty: Math.max(1, Number(e.target.value)) })}
                        className="w-24 font-bold text-center text-emerald-600"
                      />
                      <span className="text-xs text-muted-foreground">Free Item(s)</span>
                    </div>
                  </div>
                </div>

                {/* Quick Presets for BOGO */}
                <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-amber-500/20 text-xs">
                  <span className="text-muted-foreground text-[11px] font-semibold">Quick Presets:</span>
                  <button
                    type="button"
                    onClick={() => setEdit({ ...edit, bogo_buy_qty: 1, bogo_get_qty: 1, badge: "BUY 1 GET 1 FREE" })}
                    className="rounded-lg bg-card px-2.5 py-1 text-[11px] font-bold border hover:border-amber-500"
                  >
                    Buy 1 Get 1 FREE
                  </button>
                  <button
                    type="button"
                    onClick={() => setEdit({ ...edit, bogo_buy_qty: 2, bogo_get_qty: 1, badge: "BUY 2 GET 1 FREE" })}
                    className="rounded-lg bg-card px-2.5 py-1 text-[11px] font-bold border hover:border-amber-500"
                  >
                    Buy 2 Get 1 FREE
                  </button>
                  <button
                    type="button"
                    onClick={() => setEdit({ ...edit, bogo_buy_qty: 3, bogo_get_qty: 1, badge: "BUY 3 GET 1 FREE" })}
                    className="rounded-lg bg-card px-2.5 py-1 text-[11px] font-bold border hover:border-amber-500"
                  >
                    Buy 3 Get 1 FREE
                  </button>
                </div>
              </div>
            )}

            {/* Discount Value (For percentage or flat) */}
            {edit.discount_type !== "bogo" && edit.discount_type !== "free_shipping" && (
              <div>
                <Label className="font-bold">
                  {edit.discount_type === "percentage" ? "Discount Percentage (%)" : "Flat Discount Amount (₹)"}
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={edit.discount_type === "percentage" ? 100 : undefined}
                  value={edit.discount_value || ""}
                  onChange={(e) => setEdit({ ...edit, discount_value: Number(e.target.value) })}
                  placeholder={edit.discount_type === "percentage" ? "15" : "150"}
                  className="mt-1"
                />
              </div>
            )}

            {/* Min Order Value */}
            <div>
              <Label className="font-bold">Minimum Order Amount (₹)</Label>
              <Input
                type="number"
                min={0}
                value={edit.min_order_value || ""}
                onChange={(e) => setEdit({ ...edit, min_order_value: Number(e.target.value) })}
                placeholder="0 (Applicable on any order)"
                className="mt-1"
              />
            </div>

            {/* Coupon Code */}
            <div>
              <Label className="font-bold">Promo / Coupon Code (Optional)</Label>
              <Input
                value={edit.coupon_code ?? ""}
                onChange={(e) => setEdit({ ...edit, coupon_code: e.target.value.toUpperCase() })}
                placeholder={edit.discount_type === "bogo" ? "e.g. BOGOFREE" : "e.g. TOYZ20"}
                className="mt-1 font-mono uppercase"
              />
              <span className="text-[11px] text-muted-foreground">Customers can click to copy this code on the website</span>
            </div>

            {/* Website Placement */}
            <div>
              <Label className="font-bold">Website Display Placement</Label>
              <Select
                value={edit.display_location}
                onValueChange={(v) => setEdit({ ...edit, display_location: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everywhere (Homepage, Announcement Bar & Offers)</SelectItem>
                  <SelectItem value="homepage">Homepage Offers Section Only</SelectItem>
                  <SelectItem value="announcement">Top Rotating Announcement Bar Only</SelectItem>
                  <SelectItem value="popup">Floating Promo Badge / Pill</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div>
              <Label className="font-bold">Start Date & Time</Label>
              <Input
                type="datetime-local"
                value={edit.start_date}
                onChange={(e) => setEdit({ ...edit, start_date: e.target.value })}
                className="mt-1"
              />
            </div>

            {/* End Date */}
            <div>
              <div className="flex items-center justify-between">
                <Label className="font-bold">End Date & Time</Label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasNoExpiry}
                    onChange={(e) => setHasNoExpiry(e.target.checked)}
                    className="rounded border"
                  />
                  Never expires / Ongoing
                </label>
              </div>
              <Input
                type="datetime-local"
                disabled={hasNoExpiry}
                value={hasNoExpiry ? "" : (edit.end_date ?? "")}
                onChange={(e) => setEdit({ ...edit, end_date: e.target.value })}
                className="mt-1"
              />
            </div>

            {/* Target Link */}
            <div>
              <Label className="font-bold">Target Link</Label>
              <Select
                value={edit.link_url || "/products"}
                onValueChange={(v) => setEdit({ ...edit, link_url: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="/products">All Products (/products)</SelectItem>
                  <SelectItem value="/categories">Categories (/categories)</SelectItem>
                  {cats.data?.map((c) => (
                    <SelectItem key={c.id} value={`/category/${c.slug}`}>
                      Category: {c.name}
                    </SelectItem>
                  ))}
                  {prods.data?.map((p) => (
                    <SelectItem key={p.id} value={`/product/${p.slug}`}>
                      Product: {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort Order */}
            <div>
              <Label className="font-bold">Display Priority / Sort Order</Label>
              <Input
                type="number"
                value={edit.sort_order}
                onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })}
                className="mt-1"
              />
            </div>

            {/* Image / Banner Upload */}
            <div className="sm:col-span-2">
              <SingleImageUploader
                bucket="banners"
                label="Offer Card Image / Graphic (Optional)"
                value={edit.image_url}
                onChange={(u) => setEdit({ ...edit, image_url: u })}
              />
            </div>

            {/* ============================================================== */}
            {/* OFFER PRODUCT PRICING SECTION - FOR EVERY OFFER                */}
            {/* ============================================================== */}
            <div className="sm:col-span-2 rounded-3xl border-2 border-primary/20 bg-muted/30 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Package className="size-5 text-primary" />
                    <h3 className="text-base font-bold text-foreground">
                      Offer Product Pricing & Custom Prices
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Set custom prices for specific products under this offer. Choose <b>Manual Pricing</b> or <b>Percentage (Ghatana / Badhana)</b>.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                    {(edit.product_prices || []).length} products configured
                  </span>
                </div>
              </div>

              {/* Pricing Method Controls: Percentage vs Manual */}
              <div className="rounded-2xl bg-card p-4 border shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3">
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Pricing Adjustment Method
                    </Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={edit.pricing_type === "percentage" ? "default" : "outline"}
                        onClick={() => setEdit({ ...edit, pricing_type: "percentage" })}
                        className="gap-1.5 text-xs font-bold"
                      >
                        <Percent className="size-3.5" /> Percentage Option (Ghatana / Badhana)
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={edit.pricing_type === "manual" ? "default" : "outline"}
                        onClick={() => setEdit({ ...edit, pricing_type: "manual" })}
                        className="gap-1.5 text-xs font-bold"
                      >
                        <Edit2 className="size-3.5" /> Manual Option (Set Exact ₹ Price)
                      </Button>
                    </div>
                  </div>

                  {/* Percentage bulk controls */}
                  {edit.pricing_type === "percentage" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
                        <button
                          type="button"
                          onClick={() => setEdit({ ...edit, pricing_direction: "decrease" })}
                          className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                            edit.pricing_direction === "decrease"
                              ? "bg-destructive text-destructive-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <ArrowDown className="size-3" /> Ghatana (Discount -%)
                        </button>
                        <button
                          type="button"
                          onClick={() => setEdit({ ...edit, pricing_direction: "increase" })}
                          className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                            edit.pricing_direction === "increase"
                              ? "bg-secondary text-secondary-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <ArrowUp className="size-3" /> Badhana (Markup +%)
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={1}
                          max={99}
                          value={edit.pricing_percentage ?? 15}
                          onChange={(e) => setEdit({ ...edit, pricing_percentage: Number(e.target.value) })}
                          className="w-16 h-8 text-center font-bold text-xs"
                        />
                        <span className="text-xs font-bold">%</span>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          applyPercentageToProducts(
                            (edit.pricing_direction as "decrease" | "increase") || "decrease",
                            Number(edit.pricing_percentage || 15)
                          )
                        }
                        className="h-8 text-xs font-bold gap-1"
                      >
                        Apply to All
                      </Button>
                    </div>
                  )}
                </div>

                {/* Quick percentage chips if percentage mode */}
                {edit.pricing_type === "percentage" && (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground text-[11px]">Quick Discounts:</span>
                    {[10, 15, 20, 25, 30, 40, 50].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => applyPercentageToProducts("decrease", p)}
                        className="rounded-lg bg-muted px-2 py-0.5 text-[11px] font-semibold hover:bg-secondary/20 hover:text-secondary"
                      >
                        -{p}% Off
                      </button>
                    ))}
                    <span className="text-muted-foreground text-[11px] ml-2">Quick Markups:</span>
                    {[5, 10, 15, 20].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => applyPercentageToProducts("increase", p)}
                        className="rounded-lg bg-muted px-2 py-0.5 text-[11px] font-semibold hover:bg-primary/20"
                      >
                        +{p}%
                      </button>
                    ))}
                  </div>
                )}

                {/* Search & Add Products */}
                <div>
                  <Label className="text-xs font-bold text-foreground">Add Products to this Offer:</Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Search active toys by name to add to this offer..."
                      className="pl-9 text-xs"
                    />
                  </div>

                  {/* Product Search Results Dropdown/Chips */}
                  {productSearch.trim() && (
                    <div className="mt-2 max-h-48 overflow-y-auto divide-y rounded-xl border bg-background shadow-md">
                      {availableProducts.slice(0, 8).map((p) => {
                        const isAdded = (edit.product_prices || []).some((item) => item.product_id === p.id);
                        return (
                          <div
                            key={p.id}
                            className="flex items-center justify-between p-2.5 text-xs hover:bg-muted/50 transition"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {p.image_url ? (
                                <img src={p.image_url} alt="" className="size-8 rounded-lg object-cover shrink-0" />
                              ) : (
                                <div className="grid size-8 place-items-center rounded-lg bg-muted text-xs">🧸</div>
                              )}
                              <div className="min-w-0">
                                <div className="font-semibold text-foreground truncate">{p.name}</div>
                                <div className="text-[11px] text-muted-foreground">
                                  Current: {inr(p.price)} · Stock: {p.stock}
                                </div>
                              </div>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant={isAdded ? "secondary" : "outline"}
                              disabled={isAdded}
                              onClick={() => addProductToOffer(p)}
                              className="h-7 text-xs font-bold shrink-0"
                            >
                              {isAdded ? "Added" : "+ Add to Offer"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Configured Products List / Table */}
                {(edit.product_prices || []).length > 0 ? (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs font-bold text-muted-foreground border-b pb-1">
                      <span>Configured Products ({edit.product_prices?.length})</span>
                      <button
                        type="button"
                        onClick={() => setEdit({ ...edit, product_prices: [] })}
                        className="text-[11px] text-destructive hover:underline"
                      >
                        Remove All Products
                      </button>
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                      {edit.product_prices?.map((item) => {
                        const diff = item.offer_price - item.original_price;
                        const pctSaved = Math.round(((item.original_price - item.offer_price) / item.original_price) * 100);

                        return (
                          <div
                            key={item.product_id}
                            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border bg-muted/40 p-2.5 text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              {item.image_url ? (
                                <img src={item.image_url} alt="" className="size-10 rounded-lg object-cover shrink-0" />
                              ) : (
                                <div className="grid size-10 place-items-center rounded-lg bg-muted text-xs shrink-0">🧸</div>
                              )}
                              <div className="min-w-0">
                                <span className="font-semibold text-foreground line-clamp-1">{item.product_name}</span>
                                <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                                  <span>Regular: {inr(item.original_price)}</span>
                                  {diff !== 0 && (
                                    <span
                                      className={`font-bold ${
                                        diff < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"
                                      }`}
                                    >
                                      {diff < 0 ? `Save ${inr(Math.abs(diff))} (${pctSaved}%)` : `+${inr(diff)} markup`}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Offer Price Input */}
                            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                              <div className="flex items-center gap-1.5">
                                <Label className="text-[11px] text-muted-foreground whitespace-nowrap">
                                  Offer Price (₹):
                                </Label>
                                <Input
                                  type="number"
                                  min={1}
                                  value={item.offer_price}
                                  onChange={(e) =>
                                    updateProductOfferPrice(item.product_id, Number(e.target.value))
                                  }
                                  className="w-24 h-8 text-xs font-bold text-secondary"
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => removeProductFromOffer(item.product_id)}
                                className="text-destructive hover:bg-destructive/10 rounded-md p-1.5 transition"
                                title="Remove from offer"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                    No individual products selected yet. Search above to add specific toys and customize their offer price.
                  </div>
                )}
              </div>
            </div>

            {/* Active Toggle & Save Action */}
            <div className="sm:col-span-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl bg-muted/50 p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <Switch
                  checked={edit.is_active}
                  onCheckedChange={(v) => setEdit({ ...edit, is_active: v })}
                />
                <div>
                  <div className="font-bold text-sm">
                    Offer Status: {edit.is_active ? "Active" : "Inactive (Paused)"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    When active, BOGO and custom offer prices will be live on the store during the valid date window.
                  </div>
                </div>
              </label>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button onClick={save} className="flex-1 sm:flex-none font-bold gap-2">
                  <CheckCircle2 className="size-4" /> Save Offer
                </Button>
                <Button variant="outline" onClick={() => setEdit(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Status Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "active", "scheduled", "expired", "paused"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition capitalize ${
                filter === tab
                  ? "bg-foreground text-background shadow-xs"
                  : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {tab === "all" ? `All Offers (${offers.length})` : tab}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search offers by title or code…"
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Offers Cards Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-card border" />
          ))}
        </div>
      ) : filteredOffers.length === 0 ? (
        <div className="rounded-3xl border border-dashed bg-card p-12 text-center">
          <BadgePercent className="mx-auto size-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-bold">No promotional offers found</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
            {search || filter !== "all"
              ? "No offers match your current filter criteria."
              : "Create your first promotional offer or Buy 1 Get 1 special to highlight deals on the storefront."}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={() => openNew("bogo")} variant="secondary" className="gap-1.5 font-bold">
              <Gift className="size-4" /> Create BOGO Offer
            </Button>
            <Button onClick={() => openNew("percentage")} className="gap-1.5">
              <Plus className="size-4" /> Create Standard Offer
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredOffers.map((o) => {
            const status = getOfferStatus(o);
            const isBogo = o.discount_type === "bogo";
            const productsCount = (o.product_prices || []).length;

            return (
              <div
                key={o.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border bg-card p-5 shadow-xs transition hover:shadow-card"
              >
                <div>
                  {/* Top Row: Badge, Status, and Active Switch */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                        isBogo
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          : "bg-secondary/15 text-secondary"
                      }`}
                    >
                      {o.badge || (isBogo ? "BUY 1 GET 1 FREE" : "PROMO")}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${status.variant}`}>
                        {status.label}
                      </span>
                      <Switch
                        checked={o.is_active}
                        onCheckedChange={() => toggleActive(o)}
                        aria-label="Toggle active"
                      />
                    </div>
                  </div>

                  {/* Offer Image if available */}
                  {o.image_url && (
                    <div className="mb-3 aspect-[21/9] w-full overflow-hidden rounded-xl bg-muted">
                      <img src={o.image_url} alt="" className="size-full object-cover transition group-hover:scale-105" />
                    </div>
                  )}

                  {/* Title & Description */}
                  <h3 className="font-bold text-base text-foreground leading-snug line-clamp-2">
                    {o.title}
                  </h3>
                  {o.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {o.description}
                    </p>
                  )}

                  {/* Mechanics Details */}
                  <div className="mt-4 space-y-2 rounded-2xl bg-muted/40 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Type:</span>
                      <span className="font-bold text-foreground">
                        {isBogo
                          ? `Buy ${o.bogo_buy_qty || 1} Get ${o.bogo_get_qty || 1} Free`
                          : o.discount_type === "percentage"
                          ? `${o.discount_value}% OFF`
                          : o.discount_type === "flat"
                          ? `${inr(o.discount_value)} FLAT OFF`
                          : "FREE DELIVERY"}
                      </span>
                    </div>

                    {/* Products pricing summary badge */}
                    {productsCount > 0 && (
                      <div className="flex items-center justify-between text-secondary">
                        <span className="text-muted-foreground">Pricing:</span>
                        <span className="font-semibold text-secondary">
                          {productsCount} custom priced {productsCount === 1 ? "toy" : "toys"}
                        </span>
                      </div>
                    )}

                    {o.coupon_code && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Promo Code:</span>
                        <span className="font-mono font-bold text-secondary bg-secondary/10 px-1.5 py-0.5 rounded">
                          {o.coupon_code}
                        </span>
                      </div>
                    )}

                    {Number(o.min_order_value) > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Min Order:</span>
                        <span className="font-semibold text-foreground">{inr(o.min_order_value)}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] pt-1 border-t text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {new Date(o.start_date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                        {" → "}
                        {o.end_date
                          ? new Date(o.end_date).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Ongoing"}
                      </span>
                      <span className="capitalize font-medium">{o.display_location}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Row Actions */}
                <div className="mt-4 pt-3 border-t flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" onClick={() => openEdit(o)} className="h-8 gap-1 text-xs">
                      <Edit2 className="size-3" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => duplicateOffer(o)}
                      className="h-8 gap-1 text-xs"
                      title="Duplicate this offer"
                    >
                      <Copy className="size-3" />
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeOffer(o)}
                    className="h-8 text-xs text-destructive hover:bg-destructive/10"
                    title="Delete offer"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Supabase SQL Setup Dialog */}
      <Dialog open={sqlModalOpen} onOpenChange={setSqlModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="size-5 text-secondary" /> Supabase SQL Schema for Offers & BOGO
            </DialogTitle>
            <DialogDescription>
              Execute this script in your Supabase project dashboard (SQL Editor) to add BOGO and custom pricing columns to <code>public.offers</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="relative mt-2">
            <pre className="max-h-72 overflow-y-auto rounded-xl bg-slate-950 p-4 font-mono text-xs text-emerald-400">
              {SQL_SETUP}
            </pre>
            <Button
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(SQL_SETUP);
                toast.success("SQL copied to clipboard!");
              }}
              className="absolute right-3 top-3 gap-1.5 font-bold shadow-md"
            >
              <Copy className="size-3.5" /> Copy SQL
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
