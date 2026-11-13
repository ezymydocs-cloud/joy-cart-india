import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Sparkles,
  Truck,
  Phone,
  Flame,
  ShieldCheck,
  Gift,
  Heart,
  Zap,
  Upload,
  Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchSettings } from "@/lib/catalog";
import { adminClearAllOrders, adminFixCategorySpellings, getPaymentConfig } from "@/lib/orders.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPhone } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/settings")({ component: Settings });

interface CenterMsg {
  id: string;
  text: string;
  icon: string;
  link?: string;
  code?: string;
  start_date?: string;
  end_date?: string;
}

const AVAILABLE_ICONS = [
  { value: "truck", label: "Delivery Truck (Truck)", icon: Truck },
  { value: "shield", label: "Child Safe (Shield)", icon: ShieldCheck },
  { value: "phone", label: "Phone Support (Phone)", icon: Phone },
  { value: "sparkles", label: "Sparkles (Stars)", icon: Sparkles },
  { value: "flame", label: "Trending / Hot Deal (Flame)", icon: Flame },
  { value: "gift", label: "Free Gift / BOGO (Gift)", icon: Gift },
  { value: "heart", label: "Customer Favorite (Heart)", icon: Heart },
  { value: "zap", label: "Flash Sale (Zap)", icon: Zap },
];

function Settings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const payFn = useServerFn(getPaymentConfig);
  const pay = useQuery({ queryKey: ["pay-config"], queryFn: () => payFn() });
  const [f, setF] = useState<Record<string, any>>({});

  const clearOrdersFn = useServerFn(adminClearAllOrders);
  const fixCatsFn = useServerFn(adminFixCategorySpellings);
  const [clearingOrders, setClearingOrders] = useState(false);
  const [fixingCats, setFixingCats] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  // Announcement Bar State
  const [barEnabled, setBarEnabled] = useState(true);
  const [leftText, setLeftText] = useState("Pan-India Safe Delivery");
  const [leftIcon, setLeftIcon] = useState("truck");
  const [leftLink, setLeftLink] = useState("");

  const [rightText, setRightText] = useState("Support: +91 8446418374");
  const [rightIcon, setRightIcon] = useState("phone");
  const [rightLink, setRightLink] = useState("https://wa.me/918446418374");
  const [supportPhone, setSupportPhone] = useState("+91 8446418374");

  const [bgColor, setBgColor] = useState("#0f172a");
  const [textColor, setTextColor] = useState("#ffffff");
  const [centerMessages, setCenterMessages] = useState<CenterMsg[]>([]);

  // Favicon State
  const [faviconUrl, setFaviconUrl] = useState<string>("/favicon.ico");

  // First Order Promo & Card Settings
  const [foEnabled, setFoEnabled] = useState(true);
  const [foCouponRequired, setFoCouponRequired] = useState(true);
  const [foCouponCode, setFoCouponCode] = useState("TRENDY20");
  const [foDiscountPercent, setFoDiscountPercent] = useState(20);

  useEffect(() => {
    if (q.data) {
      const s = q.data as any;
      setF(s);
      setBarEnabled(s.announcement_bar_enabled !== false);
      setLeftText(s.announcement_left_text ?? "Pan-India Safe Delivery");
      setLeftIcon(s.announcement_left_icon ?? "truck");
      setLeftLink(s.announcement_left_link ?? "");

      setRightText(s.announcement_right_text ? s.announcement_right_text.replace(/\+\+91/g, "+91") : "Support: +91 8446418374");
      setRightIcon(s.announcement_right_icon ?? "phone");
      setRightLink(s.announcement_right_link ?? "https://wa.me/918446418374");
      setSupportPhone(formatPhone(s.announcement_support_phone || s.phone || "8446418374"));

      setBgColor(s.announcement_bg_color || "#0f172a");
      setTextColor(s.announcement_text_color || "#ffffff");

      if (s.favicon_url) setFaviconUrl(s.favicon_url);

      setFoEnabled(s.first_order_discount_enabled !== false);
      setFoCouponRequired(s.first_order_coupon_required !== false);
      setFoCouponCode(s.first_order_coupon_code ?? "TRENDY20");
      setFoDiscountPercent(Number(s.first_order_discount_percent) || 20);

      const msgs = Array.isArray(s.announcement_center_messages)
        ? s.announcement_center_messages
        : Array.isArray(s.announcement_messages)
        ? s.announcement_messages
        : [];

      if (msgs.length > 0) {
        setCenterMessages(
          msgs.map((m: any, idx: number) => ({
            id: m.id || `msg-${idx}-${Date.now()}`,
            text: m.text || "",
            icon: m.icon || "sparkles",
            link: m.link || "",
            code: m.code || "",
            start_date: m.start_date || "",
            end_date: m.end_date || "",
          }))
        );
      } else {
        setCenterMessages([
          {
            id: "msg-1",
            text: "100% Child-Safe, Certified & Non-Toxic Premium Toys for Kids",
            icon: "shield",
            link: "",
          },
          {
            id: "msg-2",
            text: "Fast Pan-India Delivery · Same-Day Return Policy on Delivery Date",
            icon: "truck",
            link: "",
          },
        ]);
      }
    }
  }, [q.data]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  // Add new center message
  const handleAddMessage = () => {
    setCenterMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        text: "Grand Sale Live! Extra Discounts on Prepaid Orders",
        icon: "sparkles",
        link: "",
      },
    ]);
  };

  const handleUpdateMessage = (id: string, updates: Partial<CenterMsg>) => {
    setCenterMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  };

  const handleRemoveMessage = (id: string) => {
    setCenterMessages((prev) => prev.filter((m) => m.id !== id));
  };

  // Upload custom favicon
  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      return toast.error("Favicon image must be under 2MB");
    }

    setUploadingFavicon(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const filePath = `favicons/favicon-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from("banners").upload(filePath, file, {
        upsert: true,
      });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: pubData } = supabase.storage.from("banners").getPublicUrl(filePath);
      if (pubData?.publicUrl) {
        setFaviconUrl(pubData.publicUrl);
        toast.success("Favicon uploaded successfully!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Favicon upload failed");
    } finally {
      setUploadingFavicon(false);
    }
  };

  const handleClearOrders = async () => {
    if (!window.confirm("Are you sure you want to delete ALL test orders? This will set the store to a fresh zero-order state for launch."))
      return;
    setClearingOrders(true);
    try {
      const res = await clearOrdersFn();
      toast.success(`Cleared ${res.deletedCount} order(s). Store is fresh!`);
      qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clear orders");
    } finally {
      setClearingOrders(false);
    }
  };

  const handleFixCategories = async () => {
    setFixingCats(true);
    try {
      const res = await fixCatsFn();
      toast.success(`Updated ${res.fixed} category name(s) to 'Puzzle & Blocks'!`);
      qc.invalidateQueries({ queryKey: ["categories"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update category");
    } finally {
      setFixingCats(false);
    }
  };

  const save = async () => {
    const cleanPhone = formatPhone(supportPhone || String(f.phone ?? ""));

    const { error } = await supabase
      .from("store_settings")
      .update({
        store_name: String(f.store_name ?? "").trim() || "TrendyToyz",
        store_address: String(f.store_address ?? "").trim(),
        phone: String(f.phone ?? "").trim(),
        email: String(f.email ?? "").trim(),
        instagram: String(f.instagram ?? "").trim(),
        whatsapp: String(f.whatsapp ?? "").trim(),
        admin_notification_email: String(f.admin_notification_email ?? "").trim(),
        razorpay_enabled: !!f.razorpay_enabled,

        // Top Announcement Bar Settings
        announcement_bar_enabled: barEnabled,
        announcement_left_text: leftText.trim(),
        announcement_left_icon: leftIcon,
        announcement_left_link: leftLink.trim(),

        announcement_right_text: rightText.replace(/\+\+91/g, "+91").replace(/\+\+/g, "+").trim(),
        announcement_right_icon: rightIcon,
        announcement_right_link: rightLink.trim(),
        announcement_support_phone: cleanPhone,

        announcement_bg_color: bgColor,
        announcement_text_color: textColor,

        announcement_center_messages: centerMessages.filter((m) => m.text.trim()),
        announcement_messages: centerMessages.filter((m) => m.text.trim()),

        favicon_url: faviconUrl,

        // First Order Promo & Card Settings
        first_order_discount_enabled: foEnabled,
        first_order_coupon_required: foCouponRequired,
        first_order_coupon_code: foCouponCode.trim().toUpperCase() || "TRENDY20",
        first_order_discount_percent: Number(foDiscountPercent) || 20,
      } as any)
      .eq("id", 1);

    if (error) return toast.error(error.message);
    toast.success("Settings saved successfully! Website updated.");
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  if (q.isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-background" />;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Store Settings</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure announcement bar, general settings, payments, and site identity.
          </p>
        </div>
        <Button onClick={save} className="font-bold shadow-sm">
          Save Settings
        </Button>
      </div>

      {/* SECTION 1: TOP ANNOUNCEMENT BAR & MINI SLIDER */}
      <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Sparkles className="size-4 text-secondary" /> Top Announcement Bar (Header Mini Banner)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Control the notification bar at the very top of TrendyToyz.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">{barEnabled ? "Enabled" : "Disabled"}</span>
            <Switch checked={barEnabled} onCheckedChange={setBarEnabled} />
          </div>
        </div>

        {barEnabled && (
          <div className="space-y-6">
            {/* Visual Preview */}
            <div>
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Live Preview
              </Label>
              <div
                style={{ backgroundColor: bgColor, color: textColor }}
                className="mt-1.5 flex items-center justify-between rounded-xl px-4 py-2 text-xs shadow-xs font-medium"
              >
                <div className="flex items-center gap-1.5 opacity-90">
                  <span>{leftText}</span>
                </div>
                <div className="flex items-center gap-1.5 font-bold">
                  <span>{centerMessages[0]?.text || "Your announcement message"}</span>
                </div>
                <div className="flex items-center gap-1.5 opacity-90">
                  <span>{rightText}</span>
                </div>
              </div>
            </div>

            {/* Colors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border bg-muted/20 p-4">
              <div>
                <Label className="text-xs font-bold">Bar Background Color</Label>
                <div className="mt-1.5 flex items-center gap-3">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="size-9 cursor-pointer rounded-lg border p-1"
                  />
                  <Input
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="font-mono text-xs uppercase"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs font-bold">Text Color</Label>
                <div className="mt-1.5 flex items-center gap-3">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="size-9 cursor-pointer rounded-lg border p-1"
                  />
                  <Input
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="font-mono text-xs uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Left Item Settings */}
            <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
              <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                Left Section (Desktop)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-xs">Left Text</Label>
                  <Input
                    value={leftText}
                    onChange={(e) => setLeftText(e.target.value)}
                    placeholder="e.g. Pan-India Safe Delivery"
                    className="text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Left Icon</Label>
                  <Select value={leftIcon} onValueChange={setLeftIcon}>
                    <SelectTrigger className="text-xs mt-1">
                      <SelectValue placeholder="Icon" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_ICONS.map((i) => (
                        <SelectItem key={i.value} value={i.value} className="text-xs">
                          {i.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Optional Link</Label>
                <Input
                  value={leftLink}
                  onChange={(e) => setLeftLink(e.target.value)}
                  placeholder="e.g. /policies/shipping or https://..."
                  className="text-xs mt-1"
                />
              </div>
            </div>

            {/* Center Rotating Messages */}
            <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                    Center Messages (Auto-Rotating Slider)
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Messages cycle smoothly every 4.5 seconds. You can schedule them with start/end dates.
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={handleAddMessage} className="text-xs font-bold gap-1">
                  <Plus className="size-3.5" /> Add Message
                </Button>
              </div>

              <div className="space-y-3 pt-1">
                {centerMessages.map((m, idx) => (
                  <div key={m.id} className="rounded-xl border bg-background p-3.5 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-secondary">Message #{idx + 1}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveMessage(m.id)}
                        className="size-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="sm:col-span-2">
                        <Label className="text-[11px]">Message Text</Label>
                        <Input
                          value={m.text}
                          onChange={(e) => handleUpdateMessage(m.id, { text: e.target.value })}
                          placeholder="e.g. 100% Child-Safe, Certified & Non-Toxic Premium Toys for Kids"
                          className="text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px]">Icon</Label>
                        <Select
                          value={m.icon}
                          onValueChange={(val) => handleUpdateMessage(m.id, { icon: val })}
                        >
                          <SelectTrigger className="text-xs mt-1">
                            <SelectValue placeholder="Icon" />
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_ICONS.map((i) => (
                              <SelectItem key={i.value} value={i.value} className="text-xs">
                                {i.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <Label className="text-[11px]">Coupon Code (Optional)</Label>
                        <Input
                          value={m.code || ""}
                          onChange={(e) => handleUpdateMessage(m.id, { code: e.target.value.toUpperCase() })}
                          placeholder="e.g. TOY10 (Clickable)"
                          className="text-xs font-mono uppercase mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px]">Start Date (Optional)</Label>
                        <Input
                          type="datetime-local"
                          value={m.start_date || ""}
                          onChange={(e) => handleUpdateMessage(m.id, { start_date: e.target.value })}
                          className="text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px]">End Date (Optional)</Label>
                        <Input
                          type="datetime-local"
                          value={m.end_date || ""}
                          onChange={(e) => handleUpdateMessage(m.id, { end_date: e.target.value })}
                          className="text-xs mt-1"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Item Settings & Support Phone */}
            <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
              <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                Right Section (Support & WhatsApp)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Support Phone Number (Fixes ++91)</Label>
                  <Input
                    value={supportPhone}
                    onChange={(e) => {
                      const clean = formatPhone(e.target.value);
                      setSupportPhone(clean);
                      setRightText(`Support: ${clean}`);
                    }}
                    placeholder="+91 8446418374"
                    className="text-xs mt-1 font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Automatically cleaned to standard format (no duplicate ++91).
                  </p>
                </div>
                <div>
                  <Label className="text-xs">Display Text</Label>
                  <Input
                    value={rightText}
                    onChange={(e) => setRightText(e.target.value)}
                    placeholder="Support: +91 8446418374"
                    className="text-xs mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">WhatsApp / Chat Link</Label>
                  <Input
                    value={rightLink}
                    onChange={(e) => setRightLink(e.target.value)}
                    placeholder="https://wa.me/918446418374"
                    className="text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Right Icon</Label>
                  <Select value={rightIcon} onValueChange={setRightIcon}>
                    <SelectTrigger className="text-xs mt-1">
                      <SelectValue placeholder="Icon" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_ICONS.map((i) => (
                        <SelectItem key={i.value} value={i.value} className="text-xs">
                          {i.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: FAVICON & SITE IDENTITY (TASK 2) */}
      <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            🧸 Site Favicon & Google Logo
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Google search results display your favicon next to the website title. Use square, 48x48 or higher ratio icons.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl border bg-muted/20">
          <div className="flex flex-col items-center gap-2">
            <div className="size-16 rounded-2xl border bg-white p-2 shadow-xs flex items-center justify-center overflow-hidden">
              <img
                src={faviconUrl}
                alt="TrendyToyz Favicon"
                className="size-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/favicon.ico";
                }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">Current Favicon</span>
          </div>

          <div className="flex-1 space-y-2 text-center sm:text-left">
            <Label className="text-xs font-bold">Upload Custom Favicon (PNG, ICO, SVG)</Label>
            <p className="text-[11px] text-muted-foreground">
              Google recommends a square image with dimensions that are a multiple of 48 (e.g. 48x48, 96x96, 192x192).
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90 transition">
                  <Upload className="size-3.5" />
                  {uploadingFavicon ? "Uploading…" : "Choose Favicon File"}
                </span>
                <input
                  type="file"
                  accept="image/png,image/x-icon,image/svg+xml,image/jpeg"
                  className="hidden"
                  onChange={handleFaviconUpload}
                  disabled={uploadingFavicon}
                />
              </label>
              {faviconUrl !== "/favicon.ico" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFaviconUrl("/favicon.ico")}
                  className="text-xs"
                >
                  Reset to Default
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2.5: FIRST ORDER 20% DISCOUNT & PROMO CARD SETTINGS */}
      <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="size-5 text-secondary" />
            <h2 className="text-base font-bold text-foreground">First Order 20% Discount & Promo Card Settings</h2>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
            <Switch checked={foEnabled} onCheckedChange={setFoEnabled} />
            <span>{foEnabled ? "Offer Active" : "Offer Paused"}</span>
          </label>
        </div>

        <p className="text-xs text-muted-foreground">
          Manage the 20% first-order discount system and configure coupon code requirements for printed promo cards.
        </p>

        {/* Promo Card Callout */}
        <div className="rounded-xl border border-secondary/30 bg-secondary/10 p-3.5 text-xs text-foreground flex items-start gap-2.5">
          <Sparkles className="size-4 text-secondary shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Printed Advertisement Cards ({foCouponCode})</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Keep <b>Require Coupon Code ON</b> so customers who received your printed card must type in <b>{foCouponCode}</b> at cart/checkout to activate their 20% discount. You can turn this OFF anytime to auto-apply without a code.
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          {/* Coupon Code Requirement Toggle */}
          <div className="flex items-center justify-between rounded-xl border p-3.5 bg-background/50">
            <div className="space-y-0.5 pr-4">
              <Label className="text-sm font-bold text-foreground cursor-pointer">
                Require Coupon Code to Apply Offer
              </Label>
              <p className="text-xs text-muted-foreground">
                {foCouponRequired
                  ? `Active (Mandatory): Customers must enter coupon code "${foCouponCode}" at checkout to get the discount.`
                  : "Inactive (Auto-Apply): 20% discount is automatically applied to all verified first-time buyers."}
              </p>
            </div>
            <Switch checked={foCouponRequired} onCheckedChange={setFoCouponRequired} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>First Order Coupon Code</Label>
              <Input
                value={foCouponCode}
                onChange={(e) => setFoCouponCode(e.target.value.toUpperCase())}
                placeholder="TRENDY20"
                className="mt-1 font-mono uppercase font-bold"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Code printed on advertisement cards (e.g. TRENDY20).</p>
            </div>

            <div>
              <Label>Discount Percentage (%)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={foDiscountPercent}
                onChange={(e) => setFoDiscountPercent(Number(e.target.value))}
                className="mt-1 font-bold"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Default is 20% off product subtotal.</p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: STORE GENERAL SETTINGS */}
      <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-foreground">General Store Info</h2>
        <div className="space-y-3">
          <div>
            <Label>Store Name</Label>
            <Input value={String(f.store_name ?? "")} onChange={set("store_name")} className="mt-1" />
          </div>
          <div>
            <Label>Store Address (Printed on shipping invoices)</Label>
            <Textarea rows={3} value={String(f.store_address ?? "")} onChange={set("store_address")} className="mt-1" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Contact Phone</Label>
              <Input value={String(f.phone ?? "")} onChange={set("phone")} className="mt-1" />
            </div>
            <div>
              <Label>Support Email</Label>
              <Input value={String(f.email ?? "")} onChange={set("email")} className="mt-1" />
            </div>
            <div>
              <Label>Instagram Profile URL</Label>
              <Input value={String(f.instagram ?? "")} onChange={set("instagram")} className="mt-1" />
            </div>
            <div>
              <Label>WhatsApp Number</Label>
              <Input value={String(f.whatsapp ?? "")} onChange={set("whatsapp")} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>Admin Notification Email (New order alerts)</Label>
            <Input value={String(f.admin_notification_email ?? "")} onChange={set("admin_notification_email")} className="mt-1" />
          </div>
        </div>
      </div>

      {/* SECTION 4: PAYMENT SETTINGS */}
      <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-3">
        <label className="flex items-center justify-between font-bold text-sm">
          <span>Online Payments (Razorpay Gateway)</span>
          <Switch
            checked={!!f.razorpay_enabled}
            onCheckedChange={(v) => setF({ ...f, razorpay_enabled: v })}
          />
        </label>
        <p className={`text-xs ${pay.data?.razorpayConfigured ? "text-success font-semibold" : "text-destructive"}`}>
          {pay.data?.razorpayConfigured
            ? "✓ Razorpay API keys are configured and active."
            : "⚠ Razorpay keys are missing. Online payments will be disabled until configured."}
        </p>
      </div>

      {/* SAVE BUTTON */}
      <div className="flex justify-end pt-2">
        <Button onClick={save} className="font-bold shadow-md px-6 py-2.5 text-sm">
          Save All Settings
        </Button>
      </div>

      {/* SECTION 5: CLEAN-UP TOOLS */}
      <div className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" /> Store Launch Preparation Tools
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Use these controls to clean up test data before public launch.
          </p>
        </div>

        <div className="grid gap-3 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border bg-muted/20">
            <div>
              <p className="text-xs font-bold text-foreground">Clear All Existing Order History</p>
              <p className="text-[11px] text-muted-foreground">
                Deletes all test orders and email logs to give a fresh start.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              disabled={clearingOrders}
              onClick={handleClearOrders}
              className="font-bold shrink-0"
            >
              <Trash2 className="size-3.5 mr-1.5" />
              {clearingOrders ? "Clearing..." : "Clear All Orders"}
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border bg-muted/20">
            <div>
              <p className="text-xs font-bold text-foreground">Fix Category Spelling in Database</p>
              <p className="text-[11px] text-muted-foreground">
                Corrects any 'Puzzel & Blocks' entries to 'Puzzle & Blocks' in Supabase.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={fixingCats}
              onClick={handleFixCategories}
              className="font-bold shrink-0"
            >
              <CheckCircle2 className="size-3.5 mr-1.5 text-secondary" />
              {fixingCats ? "Updating..." : "Fix 'Puzzle & Blocks'"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
