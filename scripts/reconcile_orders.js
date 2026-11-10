#!/usr/bin/env node
/**
 * Standalone Order Reconciliation Script for Trendy Toys
 * Reconciles pending Razorpay orders by checking actual payment status on Razorpay API
 * Usage: node scripts/reconcile_orders.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

// Load .env file
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPaths = [
  path.resolve(__dirname, "../.env"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(process.cwd(), ".env"),
];

for (const p of envPaths) {
  if (fs.existsSync(p)) {
    const lines = fs.readFileSync(p, "utf-8").split("\n");
    for (const l of lines) {
      const match = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || "").trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
    break;
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://hhrgtxpupgzjzstfzclw.supabase.co";
const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const validServiceKey = rawServiceKey && !rawServiceKey.includes("your-supabase") ? rawServiceKey : null;
const SUPABASE_KEY = validServiceKey || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable__But7U88H7fh0FtfqiRCHQ_fMCVUrmM";

const RAZORPAY_KEY_ID = (process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || "").trim();
const RAZORPAY_KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || "").trim();

console.log("=================================================");
console.log("Trendy Toys - Razorpay Order Reconciliation Tool");
console.log("=================================================");
console.log("Supabase URL:", SUPABASE_URL);
console.log("Razorpay Key ID:", RAZORPAY_KEY_ID ? `${RAZORPAY_KEY_ID.substring(0, 8)}...` : "MISSING");
console.log("Razorpay Secret:", RAZORPAY_KEY_SECRET ? "CONFIGURED" : "MISSING");
console.log("=================================================");

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.error("ERROR: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be configured.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");

async function reconcile() {
  console.log("\nSearching for pending Razorpay orders in Supabase...");
  const { data: pendingOrders, error } = await supabase
    .from("orders")
    .select("id,order_number,total,status,payment_status,payment_method,razorpay_order_id,razorpay_payment_id,created_at,customer_name,customer_phone")
    .eq("payment_method", "razorpay")
    .eq("payment_status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to query orders from database:", error.message);
    process.exit(1);
  }

  if (!pendingOrders || pendingOrders.length === 0) {
    console.log("No pending Razorpay orders found! All orders are up to date.");
    process.exit(0);
  }

  console.log(`Found ${pendingOrders.length} pending order(s). Checking Razorpay API...\n`);

  let updatedCount = 0;
  for (const o of pendingOrders) {
    if (!o.razorpay_order_id) {
      console.log(`[-] Order ${o.order_number}: Skipped (no razorpay_order_id recorded)`);
      continue;
    }

    try {
      const res = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(o.razorpay_order_id)}/payments`, {
        headers: { Authorization: `Basic ${auth}` },
      });

      if (!res.ok) {
        console.warn(`[!] Order ${o.order_number} (${o.razorpay_order_id}): Razorpay HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const payments = data.items || [];
      const captured = payments.find((p) => p.status === "captured");

      if (captured) {
        console.log(`[+] Order ${o.order_number}: Payment FOUND & CAPTURED! (Payment ID: ${captured.id}, Amount: ₹${captured.amount / 100})`);
        
        // 1. Try RPC
        const { error: rpcErr } = await supabase.rpc("confirm_order_payment", {
          p_order_id: o.id,
          p_razorpay_order_id: o.razorpay_order_id,
          p_razorpay_payment_id: captured.id,
          p_source: "cli_reconcile_script",
        });

        if (rpcErr) {
          // Direct update fallback
          const { error: updErr } = await supabase
            .from("orders")
            .update({
              payment_status: "paid",
              status: o.status === "cancelled" ? "placed" : o.status,
              razorpay_payment_id: captured.id,
              cancel_reason: null,
              cancelled_by: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", o.id);

          if (updErr) {
            console.error(`    FAILED to update DB for order ${o.order_number}:`, updErr.message);
          } else {
            console.log(`    SUCCESS: Order ${o.order_number} marked as Paid in DB!`);
            updatedCount++;
          }
        } else {
          console.log(`    SUCCESS (via RPC): Order ${o.order_number} marked as Paid!`);
          updatedCount++;
        }
      } else {
        const failed = payments.some((p) => p.status === "failed");
        console.log(`[-] Order ${o.order_number}: No captured payment. (${payments.length} attempt(s), failed=${failed})`);
      }
    } catch (err) {
      console.error(`[!] Error checking order ${o.order_number}:`, err.message);
    }
  }

  console.log(`\n=================================================`);
  console.log(`Reconciliation finished! Updated ${updatedCount} order(s) to Paid.`);
  console.log(`=================================================`);
}

reconcile();
