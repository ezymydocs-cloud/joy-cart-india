type RzpResp = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
declare global {
  interface Window { Razorpay?: new (o: Record<string, unknown>) => { open: () => void; on: (e: string, cb: () => void) => void } }
}

function loadScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load payment window"));
    document.body.appendChild(s);
  });
}

export async function openRazorpay(cfg: { keyId: string; razorpayOrderId: string; amount: number; orderNumber: string; name: string; email: string | null; phone: string }) {
  await loadScript();
  return new Promise<RzpResp | null>((resolve) => {
    const rz = new window.Razorpay!({
      key: cfg.keyId,
      amount: cfg.amount,
      currency: "INR",
      name: "TrendyToyz",
      description: `Order ${cfg.orderNumber}`,
      image: `${window.location.origin}/icon-192.png`,
      order_id: cfg.razorpayOrderId,
      prefill: { name: cfg.name, email: cfg.email ?? "", contact: cfg.phone },
      theme: { color: "#0B2A6B" },
      handler: (r: RzpResp) => resolve(r),
      modal: { ondismiss: () => resolve(null) },
    });
    rz.on("payment.failed", () => resolve(null));
    rz.open();
  });
}
