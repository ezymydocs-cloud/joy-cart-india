import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendOrderEmails, retryEmail } from "./email.server";

function origin() {
  const o = getRequestHeader("origin");
  if (o) return o;
  const ref = getRequestHeader("referer");
  if (ref) try { return new URL(ref).origin; } catch { /* ignore */ }
  return process.env["SITE_URL"] || "";
}

function dbError(e: { message?: string } | null) {
  return new Error(e?.message?.replace(/^.*?ERROR:\s*/, "") || "Something went wrong");
}

async function createRazorpayOrder(orderId: string, orderNumber: string, total: number) {
  const keyId = (process.env["RAZORPAY_KEY_ID"] || process.env["VITE_RAZORPAY_KEY_ID"])?.trim();
  const secret = process.env["RAZORPAY_KEY_SECRET"]?.trim();
  if (!keyId || !secret) throw new Error("Razorpay keys (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are missing in Vercel Environment Variables");

  const auth = typeof Buffer !== "undefined"
    ? Buffer.from(`${keyId}:${secret}`).toString("base64")
    : btoa(`${keyId}:${secret}`);

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: Math.round(total * 100), currency: "INR", receipt: orderNumber }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("Razorpay order creation failed:", res.status, errorBody);
    let errorDetail = "";
    try {
      const parsed = JSON.parse(errorBody);
      errorDetail = parsed?.error?.description || parsed?.error?.code || "";
    } catch {}
    throw new Error(
      errorDetail
        ? `Razorpay error: ${errorDetail}`
        : `Razorpay error (${res.status}): Please check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Vercel`
    );
  }
  const rp = (await res.json()) as { id: string; amount: number };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    await supabaseAdmin.from("orders").update({ razorpay_order_id: rp.id }).eq("id", orderId);
  } catch (dbErr) {
    console.warn("Could not save razorpay_order_id to DB:", dbErr);
  }
  return { keyId, razorpayOrderId: rp.id, amount: rp.amount };
}

export const getPaymentConfig = createServerFn({ method: "GET" }).handler(async () => {
  const keyId = process.env["RAZORPAY_KEY_ID"] || process.env["VITE_RAZORPAY_KEY_ID"];
  return { razorpayConfigured: !!(keyId && process.env["RAZORPAY_KEY_SECRET"]) };
});

export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        items: z.array(z.object({ product_id: z.string().uuid(), quantity: z.number().int().min(1).max(99) })).min(1).max(50),
        addressId: z.string().uuid(),
        paymentMethod: z.enum(["cod", "razorpay"]),
        idempotencyKey: z.string().min(8).max(100),
        couponCode: z.string().trim().max(30).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const keyId = process.env["RAZORPAY_KEY_ID"] || process.env["VITE_RAZORPAY_KEY_ID"];
    if (data.paymentMethod === "razorpay" && !(keyId && process.env["RAZORPAY_KEY_SECRET"])) {
      throw new Error("Online payment is not available right now. Please try again later.");
    }
    const { data: res, error } = await context.supabase.rpc("place_order", {
      p_items: data.items,
      p_address_id: data.addressId,
      p_payment_method: data.paymentMethod,
      p_idempotency_key: data.idempotencyKey,
      p_coupon_code: data.couponCode || undefined,
    });
    if (error) throw dbError(error);
    const r = res as { order_id: string; order_number: string; duplicate: boolean };
    if (!r.duplicate && data.paymentMethod === "cod") await sendOrderEmails(r.order_id, "placed", origin());
    return { orderId: r.order_id, orderNumber: r.order_number };
  });

export const startOnlinePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: o, error } = await context.supabase.from("orders").select("id,order_number,total,payment_method,payment_status,status,customer_name,customer_email,customer_phone").eq("id", data.orderId).single();
    if (error || !o) throw new Error("Order not found");
    if (o.payment_method !== "razorpay" || o.payment_status === "paid" || o.status === "cancelled") throw new Error("This order does not need payment");
    const rp = await createRazorpayOrder(o.id, o.order_number, Number(o.total));
    return { ...rp, orderNumber: o.order_number, name: o.customer_name, email: o.customer_email, phone: o.customer_phone };
  });

export const verifyOnlinePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ orderId: z.string().uuid(), razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: o } = await context.supabase.from("orders").select("id,razorpay_order_id").eq("id", data.orderId).single();
    if (!o || o.razorpay_order_id !== data.razorpay_order_id) throw new Error("Payment does not match this order");
    const secret = process.env["RAZORPAY_KEY_SECRET"];
    if (!secret) throw new Error("Online payment is not configured");
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${data.razorpay_order_id}|${data.razorpay_payment_id}`));
    const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
    if (hex !== data.razorpay_signature) throw new Error("Payment verification failed");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("orders").update({ payment_status: "paid", razorpay_payment_id: data.razorpay_payment_id }).eq("id", o.id);
    await sendOrderEmails(o.id, "placed", origin());
    return { ok: true };
  });

export const cancelMyOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid(), reason: z.string().max(300).optional(), silent: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("cancel_my_order", { p_order_id: data.orderId, p_reason: data.reason ?? "" });
    if (error) throw dbError(error);
    if (!data.silent) {
      await sendOrderEmails(data.orderId, "cancelled", origin());
    }
    return { ok: true };
  });

export const adminUpdateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        orderId: z.string().uuid(),
        status: z.enum(["accepted", "packed", "shipped", "delivered", "cancelled"]),
        note: z.string().max(500).optional(),
        courierId: z.string().uuid().optional(),
        awb: z.string().max(100).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_update_order_status", {
      p_order_id: data.orderId,
      p_status: data.status,
      p_note: data.note ?? undefined,
      p_courier_id: data.courierId ?? undefined,
      p_awb: data.awb ?? undefined,
    });
    if (error) throw dbError(error);
    await sendOrderEmails(data.orderId, data.status, origin());
    return { ok: true };
  });

export const adminRetryEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ logId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Not authorized");
    const ok = await retryEmail(data.logId, origin());
    return { ok };
  });

export const adminClearAllOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Not authorized");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Select all orders to delete cleanly (cascade cleans order_items, order_timeline, email_logs)
    const { data: existingOrders, error: fetchErr } = await supabaseAdmin.from("orders").select("id");
    if (fetchErr) throw fetchErr;

    if (existingOrders && existingOrders.length > 0) {
      const ids = existingOrders.map((o) => o.id);
      const { error: delErr } = await supabaseAdmin.from("orders").delete().in("id", ids);
      if (delErr) throw delErr;
    }
    return { ok: true, deletedCount: existingOrders?.length || 0 };
  });

export const adminFixCategorySpellings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Not authorized");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cats } = await supabaseAdmin.from("categories").select("id,name,slug");
    let fixed = 0;
    if (cats) {
      for (const c of cats) {
        if (/puzzel/i.test(c.name)) {
          const newName = c.name.replace(/puzzel/gi, "Puzzle");
          await supabaseAdmin.from("categories").update({ name: newName }).eq("id", c.id);
          fixed++;
        }
      }
    }
    return { ok: true, fixed };
  });
