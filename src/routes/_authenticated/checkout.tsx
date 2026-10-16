import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { useCartProducts } from "@/lib/useCartProducts";
import { fetchSettings, mainImage } from "@/lib/catalog";
import { addressLines, inr } from "@/lib/format";
import { getPaymentConfig, placeOrder, startOnlinePayment, verifyOnlinePayment } from "@/lib/orders.functions";
import { openRazorpay } from "@/lib/razorpay";
import { AddressForm, type AddressRow } from "@/components/site/AddressForm";
import { Totals, CancelRuleNote } from "@/components/site/Summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout | TrendyToyz" },
      { name: "description", content: "Choose your address and payment to place your TrendyToyz order." },
      { property: "og:title", content: "Checkout | TrendyToyz" },
      { property: "og:description", content: "Place your TrendyToyz order." },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { lines, clear } = useCart();
  const c = useCartProducts();
  const place = useServerFn(placeOrder);
  const startPay = useServerFn(startOnlinePayment);
  const verifyPay = useServerFn(verifyOnlinePayment);
  const payCfgFn = useServerFn(getPaymentConfig);
  const [addrId, setAddrId] = useState<string>();
  const [adding, setAdding] = useState(false);
  const [method, setMethod] = useState<"cod" | "razorpay">("razorpay");
  const [busy, setBusy] = useState(false);
  const idem = useRef(crypto.randomUUID());
  const [codeInput, setCodeInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [checking, setChecking] = useState(false);
  const cartKey = c.rows.map((r) => `${r.product.id}:${r.line.qty}`).join(",");
  const applyCoupon = async (code: string, silent = false) => {
    if (!code.trim()) return;
    setChecking(true);
    const { data, error } = await supabase.rpc("check_coupon", { p_code: code.trim(), p_items: c.rows.map((r) => ({ product_id: r.product.id, quantity: r.line.qty })) });
    setChecking(false);
    if (error) { setCoupon(null); if (!silent) toast.error(error.message); else toast.warning(`Coupon removed: ${error.message}`); return; }
    const d = data as { code: string; discount: number };
    setCoupon({ code: d.code, discount: Number(d.discount) });
    if (!silent) toast.success(`Coupon ${d.code} applied`);
  };
  useEffect(() => {
    if (coupon && cartKey) void applyCoupon(coupon.code, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey]);
  const discount = coupon?.discount ?? 0;
  const grand = Math.max(0, c.total - discount);

  const addrs = useQuery({
    queryKey: ["addresses", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("addresses").select("*").order("is_default", { ascending: false }).order("created_at");
      if (error) throw error;
      return data as AddressRow[];
    },
  });
  const settings = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const payCfg = useQuery({ queryKey: ["pay-config"], queryFn: () => payCfgFn() });
  const razorpayOn = !!settings.data?.razorpay_enabled && !!payCfg.data?.razorpayConfigured;

  const codOn = c.rows.length > 0 && c.rows.every((r) => !!r.product.cod_enabled);
  useEffect(() => {
    if (method === "cod" && !codOn) setMethod("razorpay");
    if (method === "razorpay" && !razorpayOn && codOn) setMethod("cod");
  }, [codOn, razorpayOn, method]);
  useEffect(() => {
    if (!addrId && addrs.data?.length) setAddrId(addrs.data[0].id);
  }, [addrs.data, addrId]);

  if (lines.length === 0 && !busy)
    return <div className="py-20 text-center"><p className="font-bold">Your cart is empty.</p><Button asChild className="mt-4"><Link to="/products">Shop toys</Link></Button></div>;

  const submit = async () => {
    if (busy) return;
    if (!addrId) return toast.error("Please add / select a delivery address");
    if (c.problems.length) return toast.error("Some items don't have enough stock. Please update your cart.");
    setBusy(true);
    try {
      const res = await place({
        data: { items: c.rows.map((r) => ({ product_id: r.product.id, quantity: r.line.qty })), addressId: addrId, paymentMethod: method, idempotencyKey: idem.current, couponCode: coupon?.code },
      });
      clear();
      if (method === "razorpay") {
        try {
          const cfg = await startPay({ data: { orderId: res.orderId } });
          const r = await openRazorpay(cfg);
          if (r) {
            await verifyPay({ data: { orderId: res.orderId, ...r } });
            toast.success("Payment successful");
          } else toast.warning("Payment not completed. You can pay from the order page.");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Payment failed");
        }
      }
      nav({ to: "/order-success/$id", params: { id: res.orderId }, replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not place order");
      idem.current = crypto.randomUUID();
      c.refetch();
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-5 text-3xl">Checkout</h1>
      <div className="grid gap-6 md:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-xl">1. Delivery address</h2>
            {addrs.isLoading ? <div className="h-24 animate-pulse rounded-2xl bg-muted" /> : (
              <div className="space-y-2">
                {addrs.data?.map((a) => (
                  <label key={a.id} className={`flex cursor-pointer gap-3 rounded-2xl border p-4 ${addrId === a.id ? "border-secondary bg-sun-soft" : ""}`}>
                    <input type="radio" name="addr" checked={addrId === a.id} onChange={() => setAddrId(a.id)} className="mt-1 accent-secondary" />
                    <div className="text-sm">
                      <div className="font-bold">{a.full_name} · {a.phone}</div>
                      <div className="text-muted-foreground">{addressLines(a).join(", ")}</div>
                    </div>
                  </label>
                ))}
                {adding || !addrs.data?.length ? (
                  <AddressForm userId={user!.id} makeDefault={!addrs.data?.length} onCancel={addrs.data?.length ? () => setAdding(false) : undefined} onSaved={async (id) => { await addrs.refetch(); setAddrId(id); setAdding(false); }} />
                ) : (
                  <Button variant="outline" onClick={() => setAdding(true)}>+ Add new address</Button>
                )}
              </div>
            )}
          </section>
          <section>
            <h2 className="mb-3 text-xl">2. Payment</h2>
            <div className="space-y-2">
              {codOn && <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 ${method === "cod" ? "border-secondary bg-sun-soft" : ""}`}>
                <input type="radio" checked={method === "cod"} onChange={() => setMethod("cod")} className="accent-secondary" />
                <span className="font-bold">Cash on Delivery</span>
              </label>}
              {!razorpayOn && !codOn && <p className="rounded-2xl border border-destructive p-4 text-sm font-bold text-destructive">Online payment is being set up. Please check back soon or WhatsApp us to order.</p>}
              {razorpayOn && (
                <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 ${method === "razorpay" ? "border-secondary bg-sun-soft" : ""}`}>
                  <input type="radio" checked={method === "razorpay"} onChange={() => setMethod("razorpay")} className="accent-secondary" />
                  <span className="font-bold">Pay online (UPI, Cards, Netbanking)</span>
                </label>
              )}
            </div>
          </section>
        </div>
        <aside className="h-fit space-y-4 rounded-2xl bg-navy-soft p-5">
          <h2 className="text-xl">Order summary</h2>
          {c.isLoading ? <div className="h-20 animate-pulse rounded bg-muted" /> : (
            <div className="space-y-2">
              {c.rows.map(({ line, product: p }) => (
                <div key={p.id} className="flex items-center gap-2 text-sm">
                  <img src={mainImage(p)} alt="" className="size-10 rounded-lg object-cover" />
                  <div className="flex-1 leading-tight">{p.name} <span className="text-muted-foreground">× {line.qty}</span>
                    <div className="text-xs text-muted-foreground">{p.shipping_enabled && Number(p.shipping_charge) > 0 ? `Shipping ${inr(p.shipping_charge)}` : "Free shipping"}</div>
                    {p.stock < line.qty && <div className="text-xs font-bold text-destructive">Only {p.stock} in stock</div>}
                  </div>
                  <span className="font-bold">{inr(Number(p.price) * line.qty)}</span>
                </div>
              ))}
            </div>
          )}
          <div>
            {coupon ? (
              <div className="flex items-center justify-between rounded-2xl border border-dashed border-success bg-background p-3 text-sm">
                <span><b className="font-mono">{coupon.code}</b> applied · you save {inr(discount)}</span>
                <button className="text-xs font-bold text-destructive" onClick={() => { setCoupon(null); setCodeInput(""); }}>Remove</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input placeholder="Coupon code" value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && applyCoupon(codeInput)} />
                <Button variant="outline" disabled={checking || !codeInput.trim()} onClick={() => applyCoupon(codeInput)}>{checking ? "…" : "Apply"}</Button>
              </div>
            )}
          </div>
          <Totals subtotal={c.subtotal} shipping={c.shipping} total={grand} discount={discount} coupon={coupon?.code} />
          <CancelRuleNote />
          <Button size="lg" className="w-full" disabled={busy || c.isLoading || (method === "razorpay" ? !razorpayOn : !codOn) || !addrId || c.problems.length > 0} onClick={submit}>
            {busy ? "Placing order…" : `Place Order · ${inr(grand)}`}
          </Button>
          <p className="text-center text-xs text-muted-foreground">Final prices are confirmed by our system when you place the order.</p>
        </aside>
      </div>
    </div>
  );
}
