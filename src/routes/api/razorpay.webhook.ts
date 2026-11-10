import { createFileRoute } from "@tanstack/react-router";
import crypto from "crypto";

export const Route = createFileRoute("/api/razorpay/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookSecret = process.env["RAZORPAY_WEBHOOK_SECRET"] || process.env["RAZORPAY_KEY_SECRET"];
        if (!webhookSecret) {
          console.error("[Razorpay Webhook] Missing RAZORPAY_WEBHOOK_SECRET or RAZORPAY_KEY_SECRET");
          return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const signature = request.headers.get("x-razorpay-signature");
        if (!signature) {
          console.warn("[Razorpay Webhook] Missing x-razorpay-signature header");
          return new Response(JSON.stringify({ error: "Missing signature" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        let rawBody = "";
        try {
          rawBody = await request.text();
        } catch {
          return new Response(JSON.stringify({ error: "Failed to read request body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Verify webhook signature
        const expectedSignature = crypto
          .createHmac("sha256", webhookSecret)
          .update(rawBody)
          .digest("hex");

        const isMatch =
          expectedSignature.length === signature.length &&
          crypto.timingSafeEqual(Buffer.from(expectedSignature, "utf-8"), Buffer.from(signature, "utf-8"));

        if (!isMatch) {
          console.warn("[Razorpay Webhook] Invalid webhook signature");
          return new Response(JSON.stringify({ error: "Invalid signature" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        let payload: {
          event?: string;
          payload?: {
            payment?: { entity?: { id: string; order_id: string; status: string; amount: number; method: string } };
            order?: { entity?: { id: string; status: string; amount: number; amount_paid: number } };
          };
        };

        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const event = payload.event;
        console.log(`[Razorpay Webhook] Received verified event: ${event}`);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (event === "payment.captured" || event === "order.paid") {
          const paymentEntity = payload.payload?.payment?.entity;
          const orderEntity = payload.payload?.order?.entity;
          const rzpOrderId = paymentEntity?.order_id || orderEntity?.id;
          const rzpPaymentId = paymentEntity?.id || "webhook_captured";

          if (!rzpOrderId) {
            console.warn("[Razorpay Webhook] Event missing razorpay order_id");
            return new Response(JSON.stringify({ error: "Missing order_id" }), { status: 400 });
          }

          // Match order STRICTLY by razorpay_order_id (NEVER by phone or email)
          const { data: order, error: findErr } = await supabaseAdmin
            .from("orders")
            .select("id,order_number,status,payment_status,total,user_id")
            .eq("razorpay_order_id", rzpOrderId)
            .maybeSingle();

          if (findErr || !order) {
            console.warn(`[Razorpay Webhook] No order found with razorpay_order_id: ${rzpOrderId}`);
            return new Response(JSON.stringify({ ok: true, note: "Order not found or not yet mapped" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Idempotent: If already marked paid, return success immediately
          if (order.payment_status === "paid") {
            console.log(`[Razorpay Webhook] Order ${order.order_number} is already paid. Skipping.`);
            return new Response(JSON.stringify({ ok: true, duplicate: true }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Confirm payment atomically
          const { error: confirmErr } = await supabaseAdmin.rpc("confirm_order_payment", {
            p_order_id: order.id,
            p_razorpay_order_id: rzpOrderId,
            p_razorpay_payment_id: rzpPaymentId,
            p_source: "webhook",
          });

          if (confirmErr) {
            console.error(`[Razorpay Webhook] Error confirming order payment:`, confirmErr);
            // Fallback direct update
            await supabaseAdmin
              .from("orders")
              .update({
                payment_status: "paid",
                status: order.status === "cancelled" ? "placed" : order.status,
                razorpay_payment_id: rzpPaymentId,
                cancel_reason: null,
                cancelled_by: null,
              })
              .eq("id", order.id);
          }

          console.log(`[Razorpay Webhook] Order ${order.order_number} marked paid successfully.`);
        } else if (event === "payment.failed") {
          const paymentEntity = payload.payload?.payment?.entity;
          const rzpOrderId = paymentEntity?.order_id;

          if (rzpOrderId) {
            const { data: order } = await supabaseAdmin
              .from("orders")
              .select("id,payment_status,order_number")
              .eq("razorpay_order_id", rzpOrderId)
              .maybeSingle();

            // NEVER overwrite a paid order to failed!
            if (order && order.payment_status !== "paid") {
              await supabaseAdmin
                .from("orders")
                .update({ payment_status: "failed" })
                .eq("id", order.id);
              console.log(`[Razorpay Webhook] Order ${order.order_number} marked payment_status='failed'.`);
            }
          }
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
