import { createFileRoute } from "@tanstack/react-router";
import Razorpay from "razorpay";

export const Route = createFileRoute("/api/create-order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const keyId = process.env["RAZORPAY_KEY_ID"] || process.env["VITE_RAZORPAY_KEY_ID"];
        const secret = process.env["RAZORPAY_KEY_SECRET"];

        if (!keyId || !secret) {
          return new Response(
            JSON.stringify({ error: "Razorpay credentials not configured on server" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }

        let body: { amount?: number; currency?: string; receipt?: string; notes?: Record<string, string> };
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid JSON request body" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        const amountInPaise = Number(body.amount);
        if (!amountInPaise || isNaN(amountInPaise)) {
          return new Response(
            JSON.stringify({ error: "Amount is required and must be a valid number in paise" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Validate minimum amount (100 paise = 1 INR)
        if (amountInPaise < 100) {
          return new Response(
            JSON.stringify({ error: "Minimum amount is 100 paise (₹1.00)" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        try {
          const razorpay = new Razorpay({
            key_id: keyId,
            key_secret: secret,
          });

          const order = await razorpay.orders.create({
            amount: Math.round(amountInPaise),
            currency: body.currency || "INR",
            receipt: body.receipt || `rcpt_${Date.now()}`,
            notes: body.notes || {},
          });

          return new Response(
            JSON.stringify({
              order_id: order.id,
              amount: order.amount,
              currency: order.currency,
              key_id: keyId,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } catch (err: unknown) {
          console.error("Razorpay order creation error:", err);
          const errorObj = err as { statusCode?: number; error?: { description?: string } };
          const status = errorObj.statusCode === 401 ? 401 : 500;
          return new Response(
            JSON.stringify({
              error: errorObj.error?.description || "Failed to create Razorpay order",
            }),
            { status, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
