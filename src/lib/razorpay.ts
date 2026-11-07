import { toast } from "sonner";

export type RzpResp = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type VerifyPaymentResponse = {
  success: boolean;
  message?: string;
  error?: string;
  order_id?: string;
  payment_id?: string;
};

declare global {
  interface Window {
    Razorpay?: new (o: Record<string, unknown>) => {
      open: () => void;
      on: (e: string, cb: (res?: unknown) => void) => void;
    };
  }
}

/**
 * Dynamically loads the Razorpay checkout script if not already present.
 */
export function loadRazorpayScript(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if (window.Razorpay) return resolve();

    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Could not load Razorpay script")));
      return;
    }

    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Razorpay payment window. Please check your internet connection."));
    document.body.appendChild(s);
  });
}

/**
 * Standard Razorpay modal launcher used by the checkout page.
 */
export async function openRazorpay(cfg: {
  keyId?: string;
  razorpayOrderId: string;
  amount: number;
  orderNumber: string;
  name: string;
  email: string | null;
  phone: string;
}): Promise<RzpResp | null> {
  await loadRazorpayScript();

  const key =
    cfg.keyId ||
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_RAZORPAY_KEY_ID) ||
    "";

  return new Promise<RzpResp | null>((resolve) => {
    if (!window.Razorpay) {
      toast.error("Razorpay SDK could not be loaded");
      return resolve(null);
    }

    const rz = new window.Razorpay({
      key,
      amount: cfg.amount,
      currency: "INR",
      name: "TrendyToyz",
      description: `Order ${cfg.orderNumber}`,
      image: typeof window !== "undefined" ? `${window.location.origin}/logo.svg` : "/logo.svg",
      order_id: cfg.razorpayOrderId,
      prefill: {
        name: cfg.name,
        email: cfg.email ?? "",
        contact: cfg.phone,
      },
      theme: { color: "#0f172a" },
      handler: (r: unknown) => {
        resolve(r as RzpResp);
      },
      modal: {
        ondismiss: () => {
          toast.info("Payment cancelled by user");
          resolve(null);
        },
      },
    });

    rz.on("payment.failed", (response: unknown) => {
      const err = (response as { error?: { description?: string; reason?: string } })?.error;
      const message = err?.description || err?.reason || "Payment transaction failed";
      toast.error(message);
      console.error("[Razorpay] Payment failed:", response);
      resolve(null);
    });

    rz.open();
  });
}

/**
 * End-to-end Standard Checkout flow:
 * 1. Calls /api/create-order
 * 2. Launches Razorpay Modal
 * 3. Sends received signature to /api/verify-payment
 */
export async function payWithRazorpayStandard(options: {
  amountInPaise: number;
  currency?: string;
  receipt?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: Record<string, string>;
  onSuccess?: (verifyResult: VerifyPaymentResponse) => void;
  onError?: (error: Error) => void;
}): Promise<VerifyPaymentResponse | null> {
  try {
    // Step 1: Create Order on backend
    const orderRes = await fetch("/api/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: options.amountInPaise,
        currency: options.currency || "INR",
        receipt: options.receipt || `rcpt_${Date.now()}`,
        notes: options.notes,
      }),
    });

    if (!orderRes.ok) {
      const errData = await orderRes.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to create order (${orderRes.status})`);
    }

    const orderData = (await orderRes.json()) as {
      order_id: string;
      amount: number;
      currency: string;
      key_id: string;
    };

    // Step 2: Open Razorpay Checkout Modal
    await loadRazorpayScript();

    const paymentResponse = await new Promise<RzpResp | null>((resolve) => {
      if (!window.Razorpay) {
        throw new Error("Razorpay SDK is not available");
      }

      const rz = new window.Razorpay({
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "TrendyToyz",
        description: `Payment for ${options.receipt || "TrendyToyz Order"}`,
        image: typeof window !== "undefined" ? `${window.location.origin}/logo.svg` : "/logo.svg",
        order_id: orderData.order_id,
        prefill: {
          name: options.customerName || "",
          email: options.customerEmail || "",
          contact: options.customerPhone || "",
        },
        theme: { color: "#0f172a" },
        handler: (res: unknown) => {
          resolve(res as RzpResp);
        },
        modal: {
          ondismiss: () => {
            toast.info("Payment window closed");
            resolve(null);
          },
        },
      });

      rz.on("payment.failed", (res: unknown) => {
        const err = (res as { error?: { description?: string; reason?: string } })?.error;
        toast.error(err?.description || "Payment failed");
        resolve(null);
      });

      rz.open();
    });

    if (!paymentResponse) {
      return null;
    }

    // Step 3: Verify Signature on backend
    const verifyRes = await fetch("/api/verify-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        razorpay_order_id: paymentResponse.razorpay_order_id,
        razorpay_payment_id: paymentResponse.razorpay_payment_id,
        razorpay_signature: paymentResponse.razorpay_signature,
      }),
    });

    const verifyData = (await verifyRes.json()) as VerifyPaymentResponse;

    if (!verifyRes.ok || !verifyData.success) {
      throw new Error(verifyData.error || "Payment signature verification failed");
    }

    toast.success("Payment verified successfully!");
    options.onSuccess?.(verifyData);
    return verifyData;
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    toast.error(error.message);
    options.onError?.(error);
    return null;
  }
}
