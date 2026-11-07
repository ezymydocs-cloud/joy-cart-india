import { createFileRoute } from "@tanstack/react-router";
import crypto from "crypto";

export const Route = createFileRoute("/api/verify-payment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["RAZORPAY_KEY_SECRET"];

        if (!secret) {
          return new Response(
            JSON.stringify({ success: false, error: "Razorpay secret not configured on server" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }

        let body: {
          razorpay_order_id?: string;
          razorpay_payment_id?: string;
          razorpay_signature?: string;
          order_id?: string;
        };

        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ success: false, error: "Invalid JSON request body" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        const razorpayOrderId = body.razorpay_order_id || body.order_id;
        const razorpayPaymentId = body.razorpay_payment_id;
        const razorpaySignature = body.razorpay_signature;

        // Missing fields validation
        if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Missing required fields: razorpay_order_id, razorpay_payment_id, and razorpay_signature are required",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        try {
          // HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
          const dataToSign = `${razorpayOrderId}|${razorpayPaymentId}`;
          const generatedSignature = crypto
            .createHmac("sha256", secret)
            .update(dataToSign)
            .digest("hex");

          // Timing-safe comparison to prevent timing attacks
          const isMatch =
            generatedSignature.length === razorpaySignature.length &&
            crypto.timingSafeEqual(
              Buffer.from(generatedSignature, "utf-8"),
              Buffer.from(razorpaySignature, "utf-8")
            );

          if (!isMatch) {
            console.warn(`[Razorpay] Signature mismatch for order: ${razorpayOrderId}`);
            return new Response(
              JSON.stringify({
                success: false,
                error: "Invalid payment signature: Signature mismatch",
              }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: "Payment verified successfully",
              order_id: razorpayOrderId,
              payment_id: razorpayPaymentId,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } catch (err: unknown) {
          console.error("Signature verification error:", err);
          return new Response(
            JSON.stringify({
              success: false,
              error: "An error occurred while verifying the payment signature",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
