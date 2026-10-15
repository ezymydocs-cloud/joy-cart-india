import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { FileDown, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrder } from "@/lib/useOrder";
import { fetchSettings } from "@/lib/catalog";
import { addressLines, fmtDate, inr, type Address, type OrderStatus } from "@/lib/format";
import { adminRetryEmail, adminUpdateOrderStatus } from "@/lib/orders.functions";
import { downloadInvoice, downloadShippingLabel } from "@/lib/pdf";
import { OrderTimeline, StatusBadge } from "@/components/site/OrderTimeline";
import { Totals } from "@/components/site/Summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/orders/$id")({ component: AdminOrder });

function AdminOrder() {
  const { id } = Route.useParams();
  const q = useOrder(id);
  const qc = useQueryClient();
  const update = useServerFn(adminUpdateOrderStatus);
  const retry = useServerFn(adminRetryEmail);
  const settings = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const couriers = useQuery({ queryKey: ["couriers", "active"], queryFn: async () => (await supabase.from("couriers").select("*").eq("is_active", true).order("sort_order")).data ?? [] });
  const emails = useQuery({ queryKey: ["admin", "emails", id], queryFn: async () => (await supabase.from("email_logs").select("*").eq("order_id", id).order("created_at")).data ?? [] });
  const [busy, setBusy] = useState(false);
  const [dlg, setDlg] = useState<"cancel" | "ship" | null>(null);
  const [reason, setReason] = useState("");
  const [courierId, setCourierId] = useState("");
  const [awb, setAwb] = useState("");

  if (q.isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-background" />;
  if (!q.data?.order) return <p>Order not found.</p>;
  const { order: o, items, history } = q.data;
  const status = o.status as OrderStatus;
  const a = o.shipping_address as unknown as Address;

  const act = async (s: "accepted" | "packed" | "shipped" | "delivered" | "cancelled", extra: { note?: string; courierId?: string; awb?: string } = {}) => {
    if (busy) return;
    setBusy(true);
    try {
      await update({ data: { orderId: o.id, status: s, ...extra } });
      toast.success(`Order marked ${s}`);
      setDlg(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: ["order", id] });
      qc.invalidateQueries({ queryKey: ["admin"] });
    }
  };

  return (
    <div className="space-y-4">
      <Link to="/admin/orders" className="text-sm font-bold text-secondary">← Orders</Link>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-background p-4">
        <div><h1 className="text-2xl">{o.order_number}</h1><div className="text-sm text-muted-foreground">{fmtDate(o.created_at)}</div></div>
        <StatusBadge status={status} />
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl bg-background p-4">
        {status === "placed" && <><Button variant="success" disabled={busy} onClick={() => act("accepted")}>ACCEPT</Button><Button variant="destructive" disabled={busy} onClick={() => setDlg("cancel")}>CANCEL</Button></>}
        {status === "accepted" && <><Button disabled={busy} onClick={() => act("packed")}>PACKED</Button><Button variant="outline" disabled={busy} onClick={() => setDlg("cancel")}>Cancel order</Button></>}
        {status === "packed" && <><Button disabled={busy} onClick={() => { setCourierId(""); setAwb(""); setDlg("ship"); }}>SHIPPED</Button><Button variant="outline" disabled={busy} onClick={() => setDlg("cancel")}>Cancel order</Button></>}
        {status === "shipped" && <Button variant="success" disabled={busy} onClick={() => act("delivered")}>Mark DELIVERED</Button>}
        {["packed", "shipped", "delivered"].includes(status) && <Button variant="sun" onClick={() => downloadShippingLabel(o as never, items as never, settings.data as never)}><Printer /> Download Shipping Label</Button>}
        <Button variant="outline" onClick={() => downloadInvoice(o as never, items as never, settings.data as never)}><FileDown /> Invoice</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl bg-background p-4">
            <h2 className="mb-3 text-lg">Items</h2>
            {items.map((i) => (
              <div key={i.id} className="flex gap-3 border-b py-2 text-sm last:border-0">
                {i.image_url && <img src={i.image_url} alt="" className="size-12 rounded-lg object-cover" />}
                <div className="flex-1">{i.product_name}<div className="text-xs text-muted-foreground">{i.sku} · {i.quantity} × {inr(i.unit_price)} · Shipping {Number(i.shipping_charge) > 0 ? inr(i.shipping_charge) : "free"}</div></div>
                <b>{inr(i.line_total)}</b>
              </div>
            ))}
            <div className="mt-3"><Totals subtotal={Number(o.subtotal)} shipping={Number(o.shipping_total)} total={Number(o.total)} /></div>
            <div className="mt-2 text-sm"><b>Payment:</b> {o.payment_method === "cod" ? "Cash on Delivery" : "Online (Razorpay)"} · <span className="font-bold uppercase">{o.payment_status}</span>{o.razorpay_payment_id && ` · ${o.razorpay_payment_id}`}</div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-background p-4 text-sm">
              <h2 className="mb-2 text-lg">Customer</h2>
              <div className="font-bold">{o.customer_name}</div>
              <div>{o.customer_phone}</div>
              <div className="break-all">{o.customer_email}</div>
            </div>
            <div className="rounded-2xl bg-background p-4 text-sm">
              <h2 className="mb-2 text-lg">Ship to</h2>
              <div className="font-bold">{a.full_name} · {a.phone}</div>
              {addressLines(a).map((l) => <div key={l}>{l}</div>)}
            </div>
          </div>
          {o.awb_number && <div className="rounded-2xl bg-background p-4 text-sm"><b>Courier:</b> {o.courier_name} · <b>AWB:</b> {o.awb_number} {o.tracking_url && <a className="ml-2 text-secondary underline" href={o.tracking_url} target="_blank" rel="noreferrer">Track</a>}</div>}
          {o.cancel_reason && <div className="rounded-2xl bg-background p-4 text-sm"><b>Cancelled by {o.cancelled_by}:</b> {o.cancel_reason}</div>}
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl bg-background p-4"><h2 className="mb-3 text-lg">Status history</h2><OrderTimeline status={status} history={history as never} /></div>
          <div className="rounded-2xl bg-background p-4">
            <h2 className="mb-2 text-lg">Emails</h2>
            {!emails.data?.length ? <p className="text-sm text-muted-foreground">No emails yet.</p> : emails.data.map((e) => (
              <div key={e.id} className="border-b py-2 text-xs last:border-0">
                <div className="flex justify-between gap-2"><span className="font-bold">{e.template.replace(/_/g, " ")}</span><span className={e.status === "sent" ? "text-success" : e.status === "failed" ? "text-destructive" : ""}>{e.status} ({e.attempts})</span></div>
                <div className="truncate text-muted-foreground">{e.recipient}</div>
                {e.last_error && <div className="text-destructive">{e.last_error.slice(0, 120)}</div>}
                {e.status !== "sent" && <button className="mt-1 font-bold text-secondary" onClick={async () => { try { const r = await retry({ data: { logId: e.id } }); toast[r.ok ? "success" : "error"](r.ok ? "Email sent" : "Still failing"); } catch (err) { toast.error(err instanceof Error ? err.message : "Retry failed"); } emails.refetch(); }}>Retry</button>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={dlg === "cancel"} onOpenChange={(v) => !v && setDlg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancel order {o.order_number}</DialogTitle></DialogHeader>
          <Label>Reason (shared with customer)</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          <DialogFooter><Button variant="destructive" disabled={busy || reason.trim().length < 3} onClick={() => act("cancelled", { note: reason.trim() })}>{busy ? "Cancelling…" : "Confirm cancel"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={dlg === "ship"} onOpenChange={(v) => !v && setDlg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark as shipped</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Courier</Label>
              <Select value={courierId} onValueChange={setCourierId}><SelectTrigger><SelectValue placeholder="Select courier" /></SelectTrigger>
                <SelectContent>{couriers.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label>AWB / Tracking number</Label><Input value={awb} onChange={(e) => setAwb(e.target.value)} maxLength={100} /></div>
            {(!courierId || !awb.trim()) && <p className="text-xs text-muted-foreground">Both courier and AWB number are required.</p>}
          </div>
          <DialogFooter><Button disabled={busy || !courierId || !awb.trim()} onClick={() => act("shipped", { courierId, awb: awb.trim() })}>{busy ? "Saving…" : "Submit"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
