import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchSettings } from "@/lib/catalog";
import { getPaymentConfig } from "@/lib/orders.functions";
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
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
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
    }).eq("id", 1);
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
      <Button onClick={save}>Save settings</Button>
    </div>
  );
}
