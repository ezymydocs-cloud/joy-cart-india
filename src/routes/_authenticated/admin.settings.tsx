import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchSettings } from "@/lib/catalog";
import { adminClearAllOrders, adminFixCategorySpellings, getPaymentConfig } from "@/lib/orders.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/settings")({ component: Settings });

function Settings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const payFn = useServerFn(getPaymentConfig);
  const pay = useQuery({ queryKey: ["pay-config"], queryFn: () => payFn() });
  const [f, setF] = useState<Record<string, string | boolean>>({});
  useEffect(() => { if (q.data) setF(q.data as never); }, [q.data]);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((prev) => ({ ...prev, [k]: e.target.value }));
  const clearOrdersFn = useServerFn(adminClearAllOrders);
  const fixCatsFn = useServerFn(adminFixCategorySpellings);
  const [clearingOrders, setClearingOrders] = useState(false);
  const [fixingCats, setFixingCats] = useState(false);
  const [customAnnouncement, setCustomAnnouncement] = useState("");
  const [barEnabled, setBarEnabled] = useState(true);

  useEffect(() => {
    if (q.data) {
      setBarEnabled((q.data as any).announcement_bar_enabled !== false);
      const msgs = (q.data as any).announcement_messages;
      if (Array.isArray(msgs) && msgs.length > 0 && msgs[0]?.text) {
        setCustomAnnouncement(msgs[0].text);
      }
    }
  }, [q.data]);

  const handleClearOrders = async () => {
    if (!window.confirm("Are you sure you want to delete ALL test orders? This will set the store to a fresh zero-order state for launch.")) return;
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
    const { error } = await supabase.from("store_settings").update({
      store_name: String(f.store_name ?? "").trim() || "TrendyToyz",
      store_address: String(f.store_address ?? "").trim(),
      phone: String(f.phone ?? "").trim(),
      email: String(f.email ?? "").trim(),
      instagram: String(f.instagram ?? "").trim(),
      whatsapp: String(f.whatsapp ?? "").trim(),
      admin_notification_email: String(f.admin_notification_email ?? "").trim(),
      razorpay_enabled: !!f.razorpay_enabled,
      announcement_bar_enabled: barEnabled,
      announcement_messages: customAnnouncement.trim() ? [{ text: customAnnouncement.trim() }] : [],
    } as any).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
    qc.invalidateQueries({ queryKey: ["settings"] });
  };
  if (q.isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-background" />;
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl">Settings</h1>
      <div className="space-y-3 rounded-2xl bg-background p-4">
        <div><Label>Store name</Label><Input value={String(f.store_name ?? "")} onChange={set("store_name")} /></div>
        <div><Label>Store address (FROM address on shipping labels)</Label><Textarea rows={3} value={String(f.store_address ?? "")} onChange={set("store_address")} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Phone</Label><Input value={String(f.phone ?? "")} onChange={set("phone")} /></div>
          <div><Label>Email</Label><Input value={String(f.email ?? "")} onChange={set("email")} /></div>
          <div><Label>Instagram URL</Label><Input value={String(f.instagram ?? "")} onChange={set("instagram")} /></div>
          <div><Label>WhatsApp number</Label><Input value={String(f.whatsapp ?? "")} onChange={set("whatsapp")} /></div>
        </div>
        <div><Label>Admin notification email (new orders)</Label><Input value={String(f.admin_notification_email ?? "")} onChange={set("admin_notification_email")} /></div>
      </div>
      <div className="space-y-2 rounded-2xl bg-background p-4">
        <label className="flex items-center justify-between font-bold">Online payments (Razorpay) <Switch checked={!!f.razorpay_enabled} onCheckedChange={(v) => setF({ ...f, razorpay_enabled: v })} /></label>
        <p className={`text-xs ${pay.data?.razorpayConfigured ? "text-success" : "text-destructive"}`}>
          {pay.data?.razorpayConfigured ? "Razorpay keys are set up." : "Razorpay keys are not added yet. Online payment will not work until they are added."}
        </p>
      </div>

      {/* Top Mini Slider / Announcement Bar Settings */}
      <div className="space-y-3 rounded-2xl bg-background p-4 border shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-foreground">Top Announcement Bar (Mini Slider)</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Controls the scrolling notification bar at the very top of the website.</p>
          </div>
          <Switch checked={barEnabled} onCheckedChange={setBarEnabled} />
        </div>

        {barEnabled && (
          <div className="pt-2 border-t space-y-2">
            <Label className="text-xs font-bold">Custom Announcement Message (Optional)</Label>
            <Input
              value={customAnnouncement}
              onChange={(e) => setCustomAnnouncement(e.target.value)}
              placeholder="e.g. Free Delivery on all prepaid orders! or Grand Festive Sale Live!"
              className="text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Leave blank to display standard store highlights (Pan-India delivery, WhatsApp support). Note: No fake coupon codes will be displayed.
            </p>
          </div>
        )}
      </div>

      <Button onClick={save} className="font-bold shadow-sm">Save settings</Button>

      {/* Store Launch Clean-up Tools */}
      <div className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" /> Store Launch Preparation Tools
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Use these controls to clean up test data and set the store to a clean, fresh state before launch.
          </p>
        </div>

        <div className="grid gap-3 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border bg-muted/20">
            <div>
              <p className="text-xs font-bold text-foreground">Clear All Existing Order History</p>
              <p className="text-[11px] text-muted-foreground">Deletes all test orders, order items, timeline entries, and email logs.</p>
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
              <p className="text-[11px] text-muted-foreground">Corrects any 'Puzzel & Blocks' entries to 'Puzzle & Blocks' in Supabase.</p>
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
