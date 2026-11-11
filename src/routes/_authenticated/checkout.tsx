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
import { cancelMyOrder, getPaymentConfig, placeOrder, startOnlinePayment, verifyOnlinePayment } from "@/lib/orders.functions";
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
  const cancelOrder = useServerFn(cancelMyOrder);
  const payCfgFn = useServerFn(getPaymentConfig);
  const [addrId, setAddrId] = useState<string>();
  const [adding, setAdding] = useState(false);
  const [method, setMethod] = useState<"cod" | "razorpay">("razorpay");
  const [busy, setBusy] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const idem = useRef(crypto.randomUUID());
  const prevUserIdRef = useRef<string | undefined>(user?.id);

  // Reset checkout address and idempotency ONLY when the authenticated user genuinely switches
  useEffect(() => {
    if (prevUserIdRef.current && prevUserIdRef.current !== user?.id) {
      setAddrId(undefined);
      idem.current = crypto.randomUUID();
    }
    prevUserIdRef.current = user?.id;
  }, [user?.id]);
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
      const { data, error } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", user!.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
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

  // Keep a valid saved address selected whenever addresses are available
  useEffect(() => {
    if (addrs.data && addrs.data.length > 0) {
      const stillValid = addrs.data.some((a) => a.id === addrId);
      if (!stillValid) {
        const defaultAddr = addrs.data.find((a) => a.is_default) || addrs.data[0];
        setAddrId(defaultAddr.id);
      }
    }
  }, [addrs.data, addrId]);

  if (lines.length === 0 && !busy)
    return <div className="py-20 text-center"><p className="font-bold">Your cart is empty.</p><Button asChild className="mt-4"><Link to="/products">Shop toys</Link></Button></div>;

  const submit = async () => {
    if (busy) return;
    if (!addrId) return toast.error("Please add / select a delivery address");
    if (c.problems.length) return toast.error("Some items don't have enough stock. Please update your cart.");
    setBusy(true);
    setPaymentError(null);
    try {
      const res = await place({
        data: {
          items: c.rows.map((r) => ({
            product_id: r.product.id,
            quantity: r.line.qty,
            variant_id: r.line.variantId,
            variant_name: r.line.variantName,
            is_free: r.line.isFreeBogo || false,
            bogo_parent_id: r.line.bogoParentId,
          })),
          addressId: addrId,
          paymentMethod: method,
          idempotencyKey: idem.current,
          couponCode: coupon?.code,
        },
      });

      if (method === "razorpay") {
        let paid = false;
        let failMessage = "";
        let paymentResponse: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string } | null = null;

        try {
          const cfg = await startPay({ data: { orderId: res.orderId } });
          paymentResponse = await openRazorpay(cfg);

          if (paymentResponse) {
            // User successfully authorized payment on Razorpay. Verify server-side with retry
            let verified = false;
            let lastErr: unknown = null;
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                await verifyPay({ data: { orderId: res.orderId, ...paymentResponse } });
                verified = true;
                break;
              } catch (vErr) {
                lastErr = vErr;
                console.warn(`[Checkout] verifyPay attempt ${attempt} failed:`, vErr);
                if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1500));
              }
            }

            if (verified) {
              paid = true;
              toast.success("Payment verified! Order placed successfully.");
            } else {
              // Gateway received money, but verification endpoint had a transient delay
              console.warn("[Checkout] Verification call timed out, relying on webhook & polling:", lastErr);
              paid = true; // Still treat as paid so order is NOT cancelled
              toast.info("Payment received! Confirming order details...");
            }
          } else {
            failMessage = "Payment window was closed or cancelled. Your cart items are preserved.";
            toast.error(failMessage);
          }
        } catch (e) {
          failMessage = e instanceof Error ? e.message : "Payment failed. Please try again.";
          toast.error(failMessage);
        }

        if (!paid && !paymentResponse) {
          // Only cancel if payment window was explicitly closed WITHOUT paying
          try {
            await cancelOrder({ data: { orderId: res.orderId, reason: "Payment cancelled or dismissed by customer", silent: true } });
          } catch (cancelErr) {
            console.error("Could not cancel unpaid attempt:", cancelErr);
          }
          setPaymentError(failMessage || "Payment was not completed. Click Retry Payment to try again.");
          idem.current = crypto.randomUUID();
          setBusy(false);
          return;
        }
      }

      // ONLY clear cart after payment confirmation
      clear();
      // Redirect to My Orders tab so customer immediately sees their Confirmed/Paid order
      toast.success("Order confirmed!");
      nav({ to: "/orders", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not place order");
      idem.current = crypto.randomUUID();
      c.refetch();
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-5 text-3xl font-bold">Checkout</h1>
      {paymentError && (
        <div className="mb-6 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-destructive flex items-center justify-between gap-4">
          <div>
            <p className="font-bold">Payment Incomplete</p>
            <p className="text-sm">{paymentError}</p>
          </div>
          <Button
            type="button"
            variant="default"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 shrink-0"
            onClick={submit}
            disabled={busy}
          >
            {busy ? "Processing…" : "Retry Payment"}
          </Button>
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-bold">1. Delivery address</h2>
              {!adding && addrs.data && addrs.data.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAdding(true)}
                  className="text-xs font-semibold"
                >
                  + Add new address
                </Button>
              )}
            </div>

            {addrs.isLoading ? (
              <div className="h-24 animate-pulse rounded-2xl bg-muted" />
            ) : (
              <div className="space-y-3">
                {addrs.data?.map((a) => {
                  const isSelected = addrId === a.id;
                  return (
                    <div
                      key={a.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setAddrId(a.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setAddrId(a.id);
                        }
                      }}
                      className={`relative flex cursor-pointer items-start gap-3.5 rounded-2xl border-2 p-4 transition-all ${
                        isSelected
                          ? "border-secondary bg-secondary/10 shadow-sm ring-2 ring-secondary/20"
                          : "border-border/80 bg-card hover:border-secondary/50 hover:bg-muted/30"
                      }`}
                    >
                      <div className="pt-0.5">
                        <div
                          className={`size-5 rounded-full border-2 flex items-center justify-center transition ${
                            isSelected
                              ? "border-secondary bg-secondary text-white"
                              : "border-muted-foreground/40 bg-background"
                          }`}
                        >
                          {isSelected && <div className="size-2 rounded-full bg-white" />}
                        </div>
                      </div>
                      <div className="flex-1 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-foreground">{a.full_name}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="font-medium text-foreground/90">{a.phone}</span>
                          {a.is_default && (
                            <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-bold text-secondary uppercase">
                              Default
                            </span>
                          )}
                          {isSelected && (
                            <span className="ml-auto rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-[11px] font-bold">
                              ✓ Selected for Delivery
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          {addressLines(a).join(", ")}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {adding || !addrs.data?.length ? (
                  <div className="mt-3">
                    <p className="text-xs font-bold text-muted-foreground mb-2">
                      {addrs.data?.length ? "Enter New Delivery Address:" : "Please Add a Delivery Address to Proceed:"}
                    </p>
                    <AddressForm
                      userId={user!.id}
                      makeDefault={!addrs.data?.length}
                      onCancel={addrs.data?.length ? () => setAdding(false) : undefined}
                      onSaved={async (id) => {
                        await addrs.refetch();
                        setAddrId(id);
                        setAdding(false);
                      }}
                    />
                  </div>
                ) : null}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">2. Payment Method</h2>
            <div className="space-y-2.5">
              {codOn && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setMethod("cod")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setMethod("cod");
                    }
                  }}
                  className={`flex cursor-pointer items-center gap-3.5 rounded-2xl border-2 p-4 transition-all ${
                    method === "cod"
                      ? "border-secondary bg-secondary/10 ring-2 ring-secondary/20"
                      : "border-border/80 bg-card hover:border-secondary/50 hover:bg-muted/30"
                  }`}
                >
                  <div
                    className={`size-5 rounded-full border-2 flex items-center justify-center transition ${
                      method === "cod"
                        ? "border-secondary bg-secondary text-white"
                        : "border-muted-foreground/40 bg-background"
                    }`}
                  >
                    {method === "cod" && <div className="size-2 rounded-full bg-white" />}
                  </div>
                  <span className="font-bold text-foreground">Cash on Delivery</span>
                </div>
              )}
              {!razorpayOn && !codOn && (
                <p className="rounded-2xl border border-destructive p-4 text-sm font-bold text-destructive">
                  Online payment is being set up. Please check back soon or WhatsApp us to order.
                </p>
              )}
              {razorpayOn && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setMethod("razorpay")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setMethod("razorpay");
                    }
                  }}
                  className={`flex cursor-pointer items-center gap-3.5 rounded-2xl border-2 p-4 transition-all ${
                    method === "razorpay"
                      ? "border-secondary bg-secondary/10 ring-2 ring-secondary/20"
                      : "border-border/80 bg-card hover:border-secondary/50 hover:bg-muted/30"
                  }`}
                >
                  <div
                    className={`size-5 rounded-full border-2 flex items-center justify-center transition ${
                      method === "razorpay"
                        ? "border-secondary bg-secondary text-white"
                        : "border-muted-foreground/40 bg-background"
                    }`}
                  >
                    {method === "razorpay" && <div className="size-2 rounded-full bg-white" />}
                  </div>
                  <span className="font-bold text-foreground">Pay online (UPI, Cards, Netbanking)</span>
                </div>
              )}
            </div>
          </section>
        </div>
        <aside className="h-fit space-y-4 rounded-2xl bg-navy-soft p-5">
          <h2 className="text-xl">Order summary</h2>
          {c.isLoading ? <div className="h-20 animate-pulse rounded bg-muted" /> : (
            <div className="space-y-2">
              {c.rows.map(({ line, product: p, price, variant }) => {
                const effectiveStock = variant ? variant.stock : p.stock;
                return (
                  <div key={line.variantId ? `${p.id}-${line.variantId}` : p.id} className="flex items-center gap-2 text-sm">
                    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white p-0.5">
                      <img src={mainImage(p)} alt="" className="size-full object-contain" width={40} height={40} />
                    </div>
                    <div className="flex-1 leading-tight">
                      <div className="font-medium">
                        {p.name}{" "}
                        {line.isFreeBogo ? (
                          <span className="text-emerald-600 font-bold">[FREE BOGO GIFT]</span>
                        ) : line.variantName ? (
                          <span className="text-secondary font-semibold">({line.variantName})</span>
                        ) : null}{" "}
                        <span className="text-muted-foreground">× {line.qty}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {p.shipping_enabled && Number(p.shipping_charge) > 0
                          ? `Shipping ${inr(p.shipping_charge)}`
                          : "Free shipping"}
                      </div>
                      {effectiveStock < line.qty && (
                        <div className="text-xs font-bold text-destructive">
                          Only {effectiveStock} in stock
                        </div>
                      )}
                    </div>
                    <span className="font-bold">
                      {line.isFreeBogo ? (
                        <span className="text-emerald-600 font-bold">FREE</span>
                      ) : (
                        inr(price * line.qty)
                      )}
                    </span>
                  </div>
                );
              })}
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
          <Button
            size="lg"
            className="w-full font-bold shadow-sm"
            disabled={busy || c.isLoading || (method === "razorpay" ? !razorpayOn : !codOn) || c.problems.length > 0}
            onClick={submit}
          >
            {busy ? "Placing order…" : `Place Order · ${inr(grand)}`}
          </Button>
          {!addrId && (
            <p className="text-center text-xs text-destructive font-medium">
              * Please select or add a delivery address to place order.
            </p>
          )}
          <p className="text-center text-xs text-muted-foreground">Final prices are confirmed by our system when you place the order.</p>
        </aside>
      </div>
    </div>
  );
}
