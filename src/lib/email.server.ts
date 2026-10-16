import { CANCEL_RULE, STATUS_LABEL, addressLines, inr, fmtDate, type Address, type OrderStatus } from "./format";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export type EmailTemplate = "order_placed" | "admin_new_order" | "accepted" | "packed" | "shipped" | "delivered" | "cancelled";

const NAVY = "#0B2A6B";
const ORANGE = "#FF8A00";
const YELLOW = "#FFB400";
const RED = "#E5262F";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function loadOrder(admin: Admin, orderId: string) {
  const { data: order, error } = await admin.from("orders").select("*").eq("id", orderId).single();
  if (error || !order) throw new Error("Order not found");
  const { data: items } = await admin.from("order_items").select("*").eq("order_id", orderId);
  const { data: settings } = await admin.from("store_settings").select("*").eq("id", 1).maybeSingle();
  return { order, items: items ?? [], settings };
}

type Loaded = Awaited<ReturnType<typeof loadOrder>>;

function itemsTable(items: Loaded["items"]) {
  const rows = items
    .map(
      (i) => `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #eef0f6">${esc(i.product_name)}<br><span style="color:#6b7394;font-size:12px">Qty ${i.quantity} × ${inr(i.unit_price)}${Number(i.shipping_charge) > 0 ? ` · Shipping ${inr(i.shipping_charge)}` : ""}</span></td>
      <td style="padding:8px 0;border-bottom:1px solid #eef0f6;text-align:right;font-weight:bold">${inr(i.line_total)}</td></tr>`,
    )
    .join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:${NAVY}">${rows}</table>`;
}

function totals(o: Loaded["order"]) {
  const ship = Number(o.shipping_total) > 0 ? inr(o.shipping_total) : "Free shipping";
  return `<table width="100%" style="font-size:14px;color:${NAVY};margin-top:8px">
    <tr><td>Subtotal</td><td style="text-align:right">${inr(o.subtotal)}</td></tr>
    <tr><td>Shipping</td><td style="text-align:right">${ship}</td></tr>
${Number(o.discount) > 0 ? `<tr><td>Coupon${o.coupon_code ? ` (${esc(o.coupon_code)})` : ""}</td><td style="text-align:right">- ${inr(o.discount)}</td></tr>` : ""}
    <tr><td style="font-weight:bold;font-size:16px;padding-top:6px">Total</td><td style="text-align:right;font-weight:bold;font-size:16px;padding-top:6px">${inr(o.total)}</td></tr>
    <tr><td style="color:#6b7394">Payment</td><td style="text-align:right;color:#6b7394">${o.payment_method === "cod" ? "Cash on Delivery" : "Online (Razorpay)"} · ${esc(o.payment_status)}</td></tr>
  </table>`;
}

function addressBlock(o: Loaded["order"]) {
  const a = o.shipping_address as unknown as Address;
  return `<p style="font-size:14px;color:${NAVY};line-height:1.5;margin:0"><b>${esc(a.full_name)}</b><br>${addressLines(a).map(esc).join("<br>")}<br>Phone: ${esc(a.phone)}</p>`;
}

const ruleBox = `<div style="background:#FFF6E0;border-left:4px solid ${ORANGE};padding:12px;border-radius:8px;font-size:13px;color:${NAVY};margin:16px 0"><b>Cancellation policy:</b> ${CANCEL_RULE}</div>`;

function layout(origin: string, title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:20px">
    <div style="text-align:center;padding:12px 0;border-bottom:4px solid ${YELLOW}"><img src="${origin}/logo.png" alt="TrendyToyz" width="200" style="max-width:200px"></div>
    <h1 style="color:${NAVY};font-size:22px;margin:20px 0 8px">${title}</h1>
    ${body}
    <div style="margin-top:28px;padding-top:16px;border-top:1px solid #eef0f6;font-size:12px;color:#6b7394;text-align:center">
      TrendyToyz · trendytoyz.info@gmail.com · +91 8446418374<br>
      <a href="https://instagram.com/trendy_toyzz" style="color:${RED}">@trendy_toyzz</a>
    </div>
  </div></body></html>`;
}

function button(href: string, label: string) {
  return `<p style="margin:20px 0"><a href="${href}" style="background:${NAVY};color:#ffffff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">${label}</a></p>`;
}

export function renderEmail(t: EmailTemplate, d: Loaded, origin: string) {
  const o = d.order;
  const num = esc(o.order_number);
  const hi = `<p style="font-size:15px;color:${NAVY}">Hi ${esc(o.customer_name)},</p>`;
  const orderLink = button(`${origin}/orders/${o.id}`, "View my order");
  switch (t) {
    case "order_placed":
      return {
        subject: `Order confirmed: ${o.order_number} | TrendyToyz`,
        html: layout(origin, `Thank you! Your order ${num} is placed 🎉`,
          `${hi}<p style="color:${NAVY};font-size:14px">Placed on ${fmtDate(o.created_at)}.</p>${itemsTable(d.items)}${totals(o)}<h3 style="color:${NAVY};font-size:15px;margin-top:18px">Delivery address</h3>${addressBlock(o)}${ruleBox}${orderLink}`),
      };
    case "admin_new_order":
      return {
        subject: `New Order Received: ${o.order_number} (${inr(o.total)})`,
        html: layout(origin, `New Order Received: ${num}`,
          `<p style="color:${NAVY};font-size:14px">Customer: <b>${esc(o.customer_name)}</b> · ${esc(o.customer_phone)} · ${esc(o.customer_email)}<br>Placed: ${fmtDate(o.created_at)}</p>${itemsTable(d.items)}${totals(o)}<h3 style="color:${NAVY};font-size:15px;margin-top:18px">Ship to</h3>${addressBlock(o)}${button(`${origin}/admin/orders/${o.id}`, "Open in admin panel")}`),
      };
    case "shipped": {
      const track = o.tracking_url ? button(o.tracking_url, "Track shipment") : "";
      return {
        subject: `Your order ${o.order_number} has shipped 🚚`,
        html: layout(origin, `Your order ${num} is on its way!`,
          `${hi}<div style="background:#F2F5FB;padding:14px;border-radius:10px;color:${NAVY};font-size:14px">Courier: <b>${esc(o.courier_name)}</b><br>AWB / Tracking number: <b>${esc(o.awb_number)}</b></div>${track}${itemsTable(d.items)}${totals(o)}${orderLink}`),
      };
    }
    case "cancelled":
      return {
        subject: `Order ${o.order_number} cancelled`,
        html: layout(origin, `Your order ${num} has been cancelled`,
          `${hi}<p style="color:${NAVY};font-size:14px">Reason: ${esc(o.cancel_reason ?? "—")}</p>${o.payment_status === "refunded" ? `<p style="color:${NAVY};font-size:14px">Your online payment will be refunded to the original payment method.</p>` : ""}${itemsTable(d.items)}${totals(o)}${orderLink}`),
      };
    default: {
      const label = STATUS_LABEL[t as OrderStatus];
      const msg: Record<string, string> = {
        accepted: "Great news! We've accepted your order and are getting it ready.",
        packed: "Your order is packed and will be handed to the courier soon.",
        delivered: "Your order has been delivered. We hope your little ones love it! 🧸",
      };
      return {
        subject: `Order ${o.order_number}: ${label}`,
        html: layout(origin, `Order ${num} is ${label}`, `${hi}<p style="color:${NAVY};font-size:14px">${msg[t] ?? ""}</p>${itemsTable(d.items)}${totals(o)}${t !== "delivered" ? ruleBox : ""}${orderLink}`),
      };
    }
  }
}

async function sendViaResend(to: string, subject: string, html: string) {
  const key = process.env["RESEND_API_KEY"];
  if (!key) throw new Error("Email service not configured (RESEND_API_KEY missing)");
  const from = process.env["RESEND_FROM_EMAIL"] || "TrendyToyz <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, reply_to: "trendytoyz.info@gmail.com" }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

async function deliver(admin: Admin, logId: string, to: string, subject: string, html: string, prevAttempts = 0) {
  let attempts = prevAttempts;
  let lastError: string | null = null;
  for (let i = 0; i < 3; i++) {
    attempts++;
    try {
      await sendViaResend(to, subject, html);
      await admin.from("email_logs").update({ status: "sent", attempts, last_error: null, updated_at: new Date().toISOString() }).eq("id", logId);
      return true;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      if (lastError.includes("not configured")) break;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  await admin.from("email_logs").update({ status: "failed", attempts, last_error: lastError, updated_at: new Date().toISOString() }).eq("id", logId);
  console.error("Email failed", logId, lastError);
  return false;
}

/** Never throws: email problems must not break order flows. */
export async function sendOrderEmails(orderId: string, kind: "placed" | OrderStatus, origin: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const d = await loadOrder(supabaseAdmin, orderId);
    const jobs: { to: string; template: EmailTemplate }[] = [];
    if (kind === "placed") {
      if (d.order.customer_email) jobs.push({ to: d.order.customer_email, template: "order_placed" });
      jobs.push({ to: d.settings?.admin_notification_email || "trendytoyz.info@gmail.com", template: "admin_new_order" });
    } else if (d.order.customer_email) {
      jobs.push({ to: d.order.customer_email, template: kind as EmailTemplate });
    }
    for (const j of jobs) {
      const { subject, html } = renderEmail(j.template, d, origin);
      const { data: log } = await supabaseAdmin
        .from("email_logs")
        .insert({ order_id: orderId, recipient: j.to, template: j.template, subject, status: "pending" })
        .select("id")
        .single();
      if (log) await deliver(supabaseAdmin, log.id, j.to, subject, html);
    }
  } catch (e) {
    console.error("sendOrderEmails error", e);
  }
}

export async function retryEmail(logId: string, origin: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: log } = await supabaseAdmin.from("email_logs").select("*").eq("id", logId).single();
  if (!log || !log.order_id) throw new Error("Email log not found");
  const d = await loadOrder(supabaseAdmin, log.order_id);
  const { subject, html } = renderEmail(log.template as EmailTemplate, d, origin);
  return deliver(supabaseAdmin, log.id, log.recipient, subject, html, log.attempts);
}
