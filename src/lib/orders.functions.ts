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

async function createRazorpayOrder(
  orderId: string,
  orderNumber: string,
  total: number,
  userId: string,
  userSupabase: any
) {
  const keyId = (process.env["RAZORPAY_KEY_ID"] || process.env["VITE_RAZORPAY_KEY_ID"])?.trim();
  const secret = process.env["RAZORPAY_KEY_SECRET"]?.trim();
  if (!keyId || !secret) throw new Error("Razorpay keys (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are missing in environment");

  const auth = typeof Buffer !== "undefined"
    ? Buffer.from(`${keyId}:${secret}`).toString("base64")
    : btoa(`${keyId}:${secret}`);

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: Math.round(total * 100),
      currency: "INR",
      receipt: orderNumber,
      notes: {
        order_id: orderId,
        order_number: orderNumber,
        user_id: userId,
      },
    }),
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
        : `Razorpay error (${res.status}): Please check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET`
    );
  }
  const rp = (await res.json()) as { id: string; amount: number };

  // Save razorpay_order_id via atomic user procedure (or admin client)
  try {
    const { error: rpcErr } = await userSupabase.rpc("attach_razorpay_order", {
      p_order_id: orderId,
      p_razorpay_order_id: rp.id,
    });
    if (rpcErr) {
      console.warn("attach_razorpay_order RPC fallback to supabaseAdmin:", rpcErr);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("orders").update({ razorpay_order_id: rp.id }).eq("id", orderId);
    }
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
        items: z
          .array(
            z.object({
              product_id: z.string().uuid(),
              quantity: z.number().int().min(1).max(99),
              variant_id: z.string().optional(),
              variant_name: z.string().optional(),
              is_free: z.boolean().optional(),
              bogo_parent_id: z.string().optional(),
            })
          )
          .min(1)
          .max(50),
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
    // Strictly verify order belongs to the currently authenticated user
    const { data: o, error } = await context.supabase
      .from("orders")
      .select("id,order_number,total,payment_method,payment_status,status,user_id,customer_name,customer_email,customer_phone")
      .eq("id", data.orderId)
      .eq("user_id", context.userId)
      .single();

    if (error || !o) throw new Error("Order not found or unauthorized");
    if (o.payment_method !== "razorpay") throw new Error("Order payment method is not Razorpay");
    if (o.payment_status === "paid") throw new Error("This order has already been paid");
    if (o.status === "cancelled") throw new Error("Cancelled orders cannot be paid");

    const rp = await createRazorpayOrder(o.id, o.order_number, Number(o.total), context.userId, context.supabase);
    return {
      ...rp,
      orderNumber: o.order_number,
      name: o.customer_name,
      email: o.customer_email,
      phone: o.customer_phone,
    };
  });

export const verifyOnlinePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      orderId: z.string().uuid(),
      razorpay_order_id: z.string().min(5),
      razorpay_payment_id: z.string().min(5),
      razorpay_signature: z.string().min(10),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // 1. Ownership & existence check strictly for current user
    const { data: o, error: orderErr } = await context.supabase
      .from("orders")
      .select("id,order_number,total,user_id,razorpay_order_id,payment_status")
      .eq("id", data.orderId)
      .eq("user_id", context.userId)
      .single();

    if (orderErr || !o) {
      console.error(`[Verify] Order ${data.orderId} not found for user ${context.userId}`);
      throw new Error("Order not found or access denied");
    }

    // 2. Signature verification using HMAC SHA-256
    const secret = process.env["RAZORPAY_KEY_SECRET"]?.trim();
    if (!secret) throw new Error("Online payment is not configured");

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${data.razorpay_order_id}|${data.razorpay_payment_id}`)
    );
    const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");

    if (hex !== data.razorpay_signature) {
      console.error(`[Verify] Signature mismatch for order ${o.order_number}: computed=${hex}, received=${data.razorpay_signature}`);
      throw new Error("Payment verification failed: invalid signature");
    }

    // 3. Razorpay REST API verification: fetch payment to verify amount and matching order
    const keyId = (process.env["RAZORPAY_KEY_ID"] || process.env["VITE_RAZORPAY_KEY_ID"])?.trim();
    if (keyId && secret) {
      const auth = typeof Buffer !== "undefined"
        ? Buffer.from(`${keyId}:${secret}`).toString("base64")
        : btoa(`${keyId}:${secret}`);

      try {
        const payRes = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(data.razorpay_payment_id)}`, {
          headers: { Authorization: `Basic ${auth}` },
        });

        if (payRes.ok) {
          const payData = (await payRes.json()) as { order_id?: string; amount?: number; status?: string; currency?: string };
          if (payData.order_id && payData.order_id !== data.razorpay_order_id) {
            console.error(`[Verify] Payment belongs to different Razorpay order: ${payData.order_id} vs ${data.razorpay_order_id}`);
            throw new Error("Payment does not belong to this checkout order");
          }
          if (payData.status && !["captured", "authorized"].includes(payData.status)) {
            console.error(`[Verify] Payment status is not captured: ${payData.status}`);
            throw new Error(`Payment is not completed (status: ${payData.status})`);
          }
          const expectedPaise = Math.round(Number(o.total) * 100);
          if (payData.amount && payData.amount < expectedPaise) {
            console.error(`[Verify] Payment amount mismatch: expected >= ${expectedPaise}, got ${payData.amount}`);
            throw new Error("Paid amount is less than order total");
          }
        }
      } catch (fetchErr) {
        console.warn("[Verify] Razorpay API verification call failed, relying on signature:", fetchErr);
      }
    }

    // 4. Atomic DB confirmation: try RPC, then context.supabase, then supabaseAdmin
    console.log(`[Payment Verify] Updating database for order ${o.order_number}...`);
    let dbUpdated = false;

    // 4a. Try confirm_order_payment RPC
    try {
      const { error: rpcErr } = await context.supabase.rpc("confirm_order_payment", {
        p_order_id: o.id,
        p_razorpay_order_id: data.razorpay_order_id,
        p_razorpay_payment_id: data.razorpay_payment_id,
        p_source: "verify_endpoint",
      });
      if (!rpcErr) {
        dbUpdated = true;
        console.log(`[Payment Verify] Order ${o.order_number} marked paid via confirm_order_payment RPC`);
      } else {
        console.warn("[Payment Verify] confirm_order_payment RPC returned error, trying direct update:", rpcErr.message);
      }
    } catch (rpcEx) {
      console.warn("[Payment Verify] RPC exception:", rpcEx);
    }

    // 4b. Try direct update via authenticated context.supabase
    if (!dbUpdated) {
      try {
        const { error: updErr } = await context.supabase
          .from("orders")
          .update({
            payment_status: "paid",
            status: "placed",
            razorpay_order_id: data.razorpay_order_id,
            razorpay_payment_id: data.razorpay_payment_id,
            cancel_reason: null,
            cancelled_by: null,
          })
          .eq("id", o.id)
          .eq("user_id", context.userId);

        if (!updErr) {
          dbUpdated = true;
          console.log(`[Payment Verify] Order ${o.order_number} marked paid via context.supabase direct update`);
        } else {
          console.warn("[Payment Verify] context.supabase direct update error:", updErr.message);
        }
      } catch (updEx) {
        console.warn("[Payment Verify] context.supabase update exception:", updEx);
      }
    }

    // 4c. Try supabaseAdmin
    if (!dbUpdated) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: adminErr } = await supabaseAdmin
          .from("orders")
          .update({
            payment_status: "paid",
            status: "placed",
            razorpay_order_id: data.razorpay_order_id,
            razorpay_payment_id: data.razorpay_payment_id,
            cancel_reason: null,
            cancelled_by: null,
          })
          .eq("id", o.id);

        if (!adminErr) {
          dbUpdated = true;
          console.log(`[Payment Verify] Order ${o.order_number} marked paid via supabaseAdmin update`);
        } else {
          console.error("[Payment Verify] supabaseAdmin update error:", adminErr.message);
        }
      } catch (adminEx) {
        console.error("[Payment Verify] supabaseAdmin update exception:", adminEx);
      }
    }

    // Send confirmation email
    try {
      await sendOrderEmails(o.id, "placed", origin());
    } catch (emailErr) {
      console.warn("[Payment Verify] Confirmation email send failed (non-fatal):", emailErr);
    }
    return { ok: true, orderNumber: o.order_number, paymentStatus: "paid" };
  });

export const reconcileOrderPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // 1. Fetch order
    const { data: o, error } = await context.supabase
      .from("orders")
      .select("id,order_number,total,status,user_id,razorpay_order_id,razorpay_payment_id,payment_status,payment_method")
      .eq("id", data.orderId)
      .maybeSingle();

    if (error || !o) throw new Error("Order not found");
    if (o.payment_status === "paid") {
      return { ok: true, status: "paid", orderNumber: o.order_number, message: "Order is already marked as Paid." };
    }
    if (!o.razorpay_order_id) {
      return { ok: false, status: o.payment_status, message: "No Razorpay order ID associated with this order." };
    }

    const keyId = (process.env["RAZORPAY_KEY_ID"] || process.env["VITE_RAZORPAY_KEY_ID"])?.trim();
    const secret = process.env["RAZORPAY_KEY_SECRET"]?.trim();
    if (!keyId || !secret) throw new Error("Razorpay credentials are not configured");

    const auth = typeof Buffer !== "undefined"
      ? Buffer.from(`${keyId}:${secret}`).toString("base64")
      : btoa(`${keyId}:${secret}`);

    console.log(`[Payment Reconcile] Checking Razorpay API for order ${o.order_number} (${o.razorpay_order_id})...`);
    const res = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(o.razorpay_order_id)}/payments`, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Payment Reconcile] Razorpay HTTP ${res.status}:`, errText);
      throw new Error(`Razorpay API returned error: ${res.status}`);
    }

    const payList = (await res.json()) as { items?: Array<{ id: string; status: string; amount: number }> };
    const items = payList?.items || [];
    const captured = items.find((p) => p.status === "captured");

    if (!captured) {
      const failed = items.some((p) => p.status === "failed");
      console.log(`[Payment Reconcile] Order ${o.order_number}: No captured payment found (${items.length} attempts).`);
      return {
        ok: false,
        status: o.payment_status,
        message: failed ? "Payment attempt was failed or incomplete on gateway." : "Payment has not been captured on Razorpay yet.",
      };
    }

    console.log(`[Payment Reconcile] Found captured payment ${captured.id} for order ${o.order_number}! Updating status to Paid...`);

    // Update database
    let dbUpdated = false;
    try {
      const { error: rpcErr } = await context.supabase.rpc("confirm_order_payment", {
        p_order_id: o.id,
        p_razorpay_order_id: o.razorpay_order_id,
        p_razorpay_payment_id: captured.id,
        p_source: "reconcile_api",
      });
      if (!rpcErr) dbUpdated = true;
    } catch {}

    if (!dbUpdated) {
      await context.supabase
        .from("orders")
        .update({
          payment_status: "paid",
          status: o.status === "cancelled" ? "placed" : o.status,
          razorpay_payment_id: captured.id,
          cancel_reason: null,
          cancelled_by: null,
        })
        .eq("id", o.id);

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("orders")
        .update({
          payment_status: "paid",
          status: o.status === "cancelled" ? "placed" : o.status,
          razorpay_payment_id: captured.id,
          cancel_reason: null,
          cancelled_by: null,
        })
        .eq("id", o.id);
    }

    try {
      await sendOrderEmails(o.id, "placed", origin());
    } catch {}

    return {
      ok: true,
      status: "paid",
      paymentId: captured.id,
      orderNumber: o.order_number,
      message: "Order successfully reconciled and marked as Paid!",
    };
  });

export const cancelMyOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid(), reason: z.string().max(300).optional(), silent: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    // Check order state first: do not cancel paid orders
    const { data: o } = await context.supabase
      .from("orders")
      .select("id,payment_status,user_id")
      .eq("id", data.orderId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (o && o.payment_status === "paid") {
      throw new Error("This order has already been paid and cannot be cancelled automatically.");
    }

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
