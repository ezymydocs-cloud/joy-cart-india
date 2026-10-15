import { CANCEL_RULE, addressLines, fmtDate, type Address } from "./format";

type OrderLike = {
  order_number: string;
  created_at: string;
  status: string;
  payment_method: string;
  payment_status: string;
  subtotal: number;
  shipping_total: number;
  total: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  shipping_address: unknown;
  courier_name?: string | null;
  awb_number?: string | null;
};
type ItemLike = { product_name: string; sku: string | null; quantity: number; unit_price: number; shipping_charge: number; line_total: number };
type Settings = { store_name: string; store_address: string; phone: string; email: string } | null | undefined;

// jsPDF's built-in fonts lack the ₹ glyph, so PDFs use "Rs."
const rs = (n: number | string) => `Rs. ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function logo() {
  const res = await fetch("/logo.png");
  const blob = await res.blob();
  return await new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(blob);
  });
}

export async function downloadShippingLabel(o: OrderLike, items: ItemLike[], s: Settings) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "in", format: [4, 6], orientation: "portrait" });
  const a = o.shipping_address as Address;
  const img = await logo();
  doc.addImage(img, "PNG", 0.25, 0.2, 1.6, 0.93);
  doc.setFont("helvetica", "bold").setFontSize(13).text(o.order_number, 3.75, 0.45, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(8).text(fmtDate(o.created_at), 3.75, 0.65, { align: "right" });
  const cod = o.payment_method === "cod" && o.payment_status !== "paid";
  doc.setFillColor(cod ? 229 : 11, cod ? 38 : 42, cod ? 47 : 107);
  doc.roundedRect(2.15, 0.8, 1.6, 0.36, 0.06, 0.06, "F");
  doc.setTextColor(255).setFont("helvetica", "bold").setFontSize(cod ? 10 : 11);
  doc.text(cod ? `COD ${rs(o.total)}` : "PREPAID", 2.95, 1.04, { align: "center" });
  doc.setTextColor(0);

  doc.setLineWidth(0.02).line(0.25, 1.3, 3.75, 1.3);
  doc.setFontSize(9).text("TO:", 0.25, 1.55);
  doc.setFontSize(14).text(a.full_name, 0.25, 1.82);
  doc.setFont("helvetica", "normal").setFontSize(11);
  let y = 2.05;
  for (const line of addressLines(a)) {
    const wrapped = doc.splitTextToSize(line, 3.5) as string[];
    doc.text(wrapped, 0.25, y);
    y += 0.2 * wrapped.length;
  }
  doc.setFont("helvetica", "bold").setFontSize(16).text(`PIN: ${a.pincode}`, 0.25, y + 0.15);
  doc.setFontSize(12).text(`Phone: ${a.phone}`, 0.25, y + 0.42);
  y += 0.6;
  doc.line(0.25, y, 3.75, y);
  y += 0.22;
  doc.setFontSize(9).text("ITEMS:", 0.25, y);
  doc.setFont("helvetica", "normal").setFontSize(8.5);
  y += 0.17;
  for (const it of items.slice(0, 6)) {
    const t = doc.splitTextToSize(`${it.quantity} x ${it.product_name}${it.sku ? ` (${it.sku})` : ""}`, 3.5) as string[];
    doc.text(t, 0.25, y);
    y += 0.15 * t.length;
  }
  if (items.length > 6) doc.text(`+ ${items.length - 6} more item(s)`, 0.25, y);
  if (o.courier_name) doc.setFont("helvetica", "bold").text(`${o.courier_name}  AWB: ${o.awb_number ?? ""}`, 0.25, 4.85);

  doc.setFont("helvetica", "normal").line(0.25, 4.95, 3.75, 4.95);
  doc.setFontSize(8).setFont("helvetica", "bold").text("FROM:", 0.25, 5.13);
  doc.setFont("helvetica", "normal");
  const from = [s?.store_name || "TrendyToyz", ...(doc.splitTextToSize(s?.store_address || "", 3.5) as string[]), `Phone: ${s?.phone || "8446418374"}`];
  doc.text(from.slice(0, 5), 0.25, 5.3);
  doc.save(`label-${o.order_number}.pdf`);
}

export async function downloadInvoice(o: OrderLike, items: ItemLike[], s: Settings) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const a = o.shipping_address as Address;
  const img = await logo();
  doc.addImage(img, "PNG", 15, 12, 50, 29);
  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(11, 42, 107).text("INVOICE", 195, 22, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(40);
  doc.text([`Order: ${o.order_number}`, `Date: ${fmtDate(o.created_at)}`, `Payment: ${o.payment_method === "cod" ? "Cash on Delivery" : "Online"} (${o.payment_status})`], 195, 30, { align: "right" });

  doc.setFont("helvetica", "bold").text("Sold by", 15, 52);
  doc.setFont("helvetica", "normal");
  doc.text([s?.store_name || "TrendyToyz", ...(doc.splitTextToSize(s?.store_address || "", 80) as string[]), `Phone: ${s?.phone || "8446418374"}`, s?.email || "trendytoyz.info@gmail.com"], 15, 58);
  doc.setFont("helvetica", "bold").text("Bill / Ship to", 110, 52);
  doc.setFont("helvetica", "normal").text([a.full_name, ...addressLines(a).flatMap((l) => doc.splitTextToSize(l, 85) as string[]), `Phone: ${a.phone}`, o.customer_email || ""], 110, 58);

  let y = 95;
  doc.setFillColor(11, 42, 107).rect(15, y - 6, 180, 9, "F");
  doc.setTextColor(255).setFont("helvetica", "bold");
  doc.text("Item", 18, y).text("Qty", 120, y, { align: "right" }).text("Price", 145, y, { align: "right" }).text("Shipping", 168, y, { align: "right" }).text("Amount", 192, y, { align: "right" });
  doc.setTextColor(40).setFont("helvetica", "normal");
  y += 9;
  for (const it of items) {
    const name = doc.splitTextToSize(it.product_name + (it.sku ? ` (${it.sku})` : ""), 95) as string[];
    doc.text(name, 18, y);
    doc.text(String(it.quantity), 120, y, { align: "right" });
    doc.text(rs(it.unit_price), 145, y, { align: "right" });
    doc.text(Number(it.shipping_charge) > 0 ? rs(it.shipping_charge) : "-", 168, y, { align: "right" });
    doc.text(rs(it.line_total), 192, y, { align: "right" });
    y += 6 * name.length + 2;
    if (y > 250) { doc.addPage(); y = 20; }
  }
  doc.line(110, y, 195, y);
  y += 7;
  const row = (l: string, v: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal").text(l, 140, y).text(v, 192, y, { align: "right" });
    y += 7;
  };
  row("Subtotal", rs(o.subtotal));
  row("Shipping", Number(o.shipping_total) > 0 ? rs(o.shipping_total) : "Free shipping");
  row("Total", rs(o.total), true);

  y += 6;
  doc.setFillColor(255, 246, 224).rect(15, y - 5, 180, 16, "F");
  doc.setFont("helvetica", "bold").setFontSize(9).text("Cancellation policy:", 18, y + 1);
  doc.setFont("helvetica", "normal").text(doc.splitTextToSize(CANCEL_RULE, 170) as string[], 18, y + 6);
  doc.setFontSize(8).setTextColor(120).text("Thank you for shopping with TrendyToyz! · instagram.com/trendy_toyzz", 105, 285, { align: "center" });
  doc.save(`invoice-${o.order_number}.pdf`);
}
