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
  Layers,
  ArrowRight,
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

export type Offer = {
  id?: string;
  title: string;
  description: string | null;
  badge: string | null;
  discount_type: "percentage" | "flat" | "free_shipping" | "bogo" | string;
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
};

const SQL_SETUP = `-- Run this in your Supabase SQL Editor if the offers table is not yet created:
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

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

  const { data: offers = [], isLoading, error } = useQuery({
    queryKey: ["admin", "offers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Offer[];
    },
  });

  const cats = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
  });

  const prods = useQuery({
    queryKey: ["admin", "product-names"],
    queryFn: async () => (await supabase.from("products").select("id,name,slug").order("name")).data ?? [],
  });

  const openNew = () => {
    setHasNoExpiry(false);
    setEdit({ ...DEFAULT_OFFER, sort_order: (offers.length || 0) + 1 });
  };

  const openEdit = (o: Offer) => {
    setHasNoExpiry(!o.end_date);
    setEdit({
      ...o,
      start_date: o.start_date ? new Date(o.start_date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
      end_date: o.end_date ? new Date(o.end_date).toISOString().slice(0, 16) : null,
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
    });
    toast.info("Created duplicate in editor. Modify and click Save.");
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
      badge: edit.badge?.trim() || "SPECIAL OFFER",
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

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Promotional Offers</h1>
            <span className="rounded-full bg-secondary/15 px-2.5 py-0.5 text-xs font-bold text-secondary">
              {offers.length} configured
            </span>
          </div>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Create, schedule, and showcase seasonal discounts, flash sales, and promo badges on your storefront.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSqlModalOpen(true)} className="gap-1.5">
            <Database className="size-4" /> SQL Setup
          </Button>
          <Button onClick={openNew} className="gap-1.5 shadow-sm">
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
              The <code>public.offers</code> table has not been initialized in Supabase yet. Click "SQL Setup" above to copy and run the 1-click migration in your Supabase SQL Editor.
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
                <h2 className="text-lg font-bold">{edit.id ? "Edit Promotional Offer" : "Create New Promotional Offer"}</h2>
                <p className="text-xs text-muted-foreground">Configure offer headline, discount mechanics, dates, and placement</p>
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
                placeholder="e.g., Weekend Mega Toy Bonanza · Flat 20% OFF"
                className="mt-1 text-base font-medium"
              />
            </div>

            {/* Subtitle / Description */}
            <div className="sm:col-span-2">
              <Label className="font-bold">Description / Terms (Optional)</Label>
              <Textarea
                value={edit.description ?? ""}
                onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                placeholder="e.g., Save extra 20% on all puzzle sets, building blocks, and action toys. Minimum cart value ₹499."
                className="mt-1 text-sm resize-none"
                rows={2}
              />
            </div>

            {/* Badge Text */}
            <div>
              <Label className="font-bold">Promotional Badge Tag</Label>
              <Input
                value={edit.badge ?? ""}
                onChange={(e) => setEdit({ ...edit, badge: e.target.value.toUpperCase() })}
                placeholder="e.g., LIMITED DEAL, FESTIVE SALE, HOT"
                className="mt-1"
              />
              <span className="text-[11px] text-muted-foreground">Displays in a pill highlight above the offer title</span>
            </div>

            {/* Discount Type */}
            <div>
              <Label className="font-bold">Discount Type</Label>
              <Select
                value={edit.discount_type}
                onValueChange={(v) => setEdit({ ...edit, discount_type: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage Discount (% OFF)</SelectItem>
                  <SelectItem value="flat">Flat Discount (₹ Flat OFF)</SelectItem>
                  <SelectItem value="free_shipping">Free Pan-India Delivery</SelectItem>
                  <SelectItem value="bogo">BOGO / Special Bundle Deal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Discount Value */}
            <div>
              <Label className="font-bold">
                {edit.discount_type === "percentage"
                  ? "Discount Percentage (%)"
                  : edit.discount_type === "flat"
                  ? "Flat Discount Amount (₹)"
                  : "Promotional Value (Optional)"}
              </Label>
              <Input
                type="number"
                min={0}
                max={edit.discount_type === "percentage" ? 100 : undefined}
                value={edit.discount_value || ""}
                onChange={(e) => setEdit({ ...edit, discount_value: Number(e.target.value) })}
                placeholder={edit.discount_type === "percentage" ? "15" : "150"}
                className="mt-1"
                disabled={edit.discount_type === "free_shipping"}
              />
            </div>

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
                placeholder="e.g. TOYZ20"
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

            {/* Link URL */}
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
              <Input
                value={edit.link_url ?? ""}
                onChange={(e) => setEdit({ ...edit, link_url: e.target.value })}
                placeholder="Or enter custom URL..."
                className="mt-2 text-xs"
              />
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
              <span className="text-[11px] text-muted-foreground">Lower number appears first (1, 2, 3...)</span>
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

            {/* Active Toggle & Live Preview */}
            <div className="sm:col-span-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl bg-muted/50 p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <Switch
                  checked={edit.is_active}
                  onCheckedChange={(v) => setEdit({ ...edit, is_active: v })}
                />
                <div>
                  <div className="font-bold text-sm">Offer Status: {edit.is_active ? "Active" : "Inactive (Paused)"}</div>
                  <div className="text-xs text-muted-foreground">When active, it will automatically show on the website during the valid date window.</div>
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
              : "Create your first promotional offer to highlight seasonal sales, coupons, and flash discounts on the store."}
          </p>
          <Button onClick={openNew} className="mt-5 gap-1.5">
            <Plus className="size-4" /> Create Offer Now
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredOffers.map((o) => {
            const status = getOfferStatus(o);
            return (
              <div
                key={o.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border bg-card p-5 shadow-xs transition hover:shadow-card"
              >
                <div>
                  {/* Top Row: Badge, Status, and Active Switch */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="rounded-full bg-secondary/15 px-2.5 py-0.5 text-[11px] font-bold text-secondary uppercase tracking-wider">
                      {o.badge || "PROMO"}
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
                      <span className="text-muted-foreground">Discount:</span>
                      <span className="font-bold text-foreground">
                        {o.discount_type === "percentage"
                          ? `${o.discount_value}% OFF`
                          : o.discount_type === "flat"
                          ? `${inr(o.discount_value)} FLAT OFF`
                          : o.discount_type === "free_shipping"
                          ? "FREE SHIPPING"
                          : "SPECIAL BUNDLE"}
                      </span>
                    </div>

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
                          ? new Date(o.end_date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })
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
                    <Button size="sm" variant="ghost" onClick={() => duplicateOffer(o)} className="h-8 gap-1 text-xs" title="Duplicate this offer">
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
              <Database className="size-5 text-secondary" /> Supabase SQL Schema for Offers
            </DialogTitle>
            <DialogDescription>
              Execute this script in your Supabase project dashboard (SQL Editor) to create the <code>public.offers</code> table and enable security policies.
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
