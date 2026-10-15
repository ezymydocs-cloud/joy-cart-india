import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, FileDown } from "lucide-react";
import { addressLines, canCustomerCancel, inr, fmtDate, type Address, type OrderStatus } from "@/lib/format";
import { cancelMyOrder, startOnlinePayment, verifyOnlinePayment } from "@/lib/orders.functions";
import { openRazorpay } from "@/lib/razorpay";
import { downloadInvoice } from "@/lib/pdf";
import { fetchSettings } from "@/lib/catalog";
import { useOrder } from "@/lib/useOrder";
import { OrderTimeline, StatusBadge } from "./OrderTimeline";
import { Totals, CancelRuleNote } from "./Summary";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function CustomerOrderView({ id, showRule }: { id: string; showRule?: boolean }) {
  const q = useOrder(id);
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const cancel = useServerFn(cancelMyOrder);
  const startPay = useServerFn(startOnlinePayment);
  const verifyPay = useServerFn(verifyOnlinePayment);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (q.isLoading) return <div className="h-64 animate-pulse rounded-3xl bg-muted" />;
  if (q.isError) return <div className="text-center"><p className="font-bold">Couldn't load order.</p><Button className="mt-2" onClick={() => q.refetch()}>Retry</Button></div>;
  if (!q.data?.order) return <p className="text-center font-bold">Order not found.</p>;
  const { order: o, items, history } = q.data;
  const status = o.status as OrderStatus;
  const a = o.shipping_address as unknown as Address;

  const doCancel = async () => {
    setBusy(true);
    try {
      await cancel({ data: { orderId: o.id, reason } });
      toast.success("Order cancelled");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["order", id] });
      qc.invalidateQueries({ queryKey: ["my-orders"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel");
      q.refetch();
    } finally { setBusy(false); }
  };

  const pay = async () => {
    setBusy(true);
    try {
      const cfg = await startPay({ data: { orderId: o.id } });
      const r = await openRazorpay(cfg);
      if (r) { await verifyPay({ data: { orderId: o.id, ...r } }); toast.success("Payment successful"); q.refetch(); }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Payment failed"); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl">Order {o.order_number}</h1>
          <p className="text-sm text-muted-foreground">Placed {fmtDate(o.created_at)}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      {status === "shipped" || status === "delivered" ? (
        <div className="rounded-3xl bg-primary p-4 text-primary-foreground">
          <div className="text-sm opacity-80">Shipped via</div>
          <div className="font-display text-xl">{o.courier_name}</div>
          <div className="mt-1 flex items-center gap-2 text-sm">AWB: <b>{o.awb_number}</b>
            <button aria-label="Copy AWB" onClick={() => { navigator.clipboard.writeText(o.awb_number ?? ""); toast.success("AWB copied"); }}><Copy className="size-4" /></button>
          </div>
          {o.tracking_url ? (
            <Button asChild variant="sun" className="mt-3"><a href={o.tracking_url} target="_blank" rel="noreferrer"><ExternalLink /> Track Shipment</a></Button>
          ) : (
            <Button variant="sun" className="mt-3" onClick={() => { navigator.clipboard.writeText(o.awb_number ?? ""); toast.success("AWB copied. Use it on the courier's website."); }}><Copy /> Copy AWB to track</Button>
          )}
        </div>
      ) : null}

      {o.payment_method === "razorpay" && o.payment_status === "pending" && status !== "cancelled" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-3xl border-2 border-secondary p-4">
          <span className="font-bold">Online payment pending</span>
          <Button variant="sun" disabled={busy} onClick={pay}>Pay {inr(o.total)} now</Button>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-3xl border-2 p-5">
          <h2 className="mb-4 text-lg">Order status</h2>
          <OrderTimeline status={status} history={history as never} />
          {status === "cancelled" && o.cancel_reason && <p className="mt-3 text-sm"><b>Reason:</b> {o.cancel_reason}</p>}
        </div>
        <div className="space-y-4 rounded-3xl border-2 p-5">
          <h2 className="text-lg">Items</h2>
          {items.map((i) => (
            <div key={i.id} className="flex gap-3 text-sm">
              {i.image_url && <img src={i.image_url} alt="" className="size-12 rounded-lg object-cover" />}
              <div className="flex-1">{i.product_name}<div className="text-xs text-muted-foreground">{i.quantity} × {inr(i.unit_price)}{Number(i.shipping_charge) > 0 ? ` · Shipping ${inr(i.shipping_charge)}` : ""}</div></div>
              <b>{inr(i.line_total)}</b>
            </div>
          ))}
          <Totals subtotal={Number(o.subtotal)} shipping={Number(o.shipping_total)} total={Number(o.total)} />
          <div className="text-sm"><b>Payment:</b> {o.payment_method === "cod" ? "Cash on Delivery" : "Online"} · <span className="capitalize">{o.payment_status}</span></div>
          <div className="text-sm"><b>Deliver to:</b> {a.full_name}, {addressLines(a).join(", ")} · {a.phone}</div>
        </div>
      </div>

      {(showRule || canCustomerCancel(status)) && <CancelRuleNote />}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => downloadInvoice(o as never, items as never, settings.data as never)}><FileDown /> Download invoice</Button>
        {canCustomerCancel(status) && <Button variant="destructive" onClick={() => setOpen(true)}>Cancel order</Button>}
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel order {o.order_number}?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); doCancel(); }}>{busy ? "Cancelling…" : "Yes, cancel"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
