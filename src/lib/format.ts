export const CANCEL_RULE =
  "Order can be cancelled only before it is shipped. Once shipped and tracking is generated, cancellation is not possible.";

export const BRAND = {
  name: "TrendyToyz",
  email: "trendytoyz.info@gmail.com",
  phone: "+91 8446418374",
  phoneRaw: "8446418374",
  whatsapp: "https://wa.me/918446418374",
  instagram: "https://instagram.com/trendy_toyzz",
  instagramHandle: "trendy_toyzz",
};

export type OrderStatus = "placed" | "accepted" | "packed" | "shipped" | "delivered" | "cancelled";

export const STATUS_FLOW: OrderStatus[] = ["placed", "accepted", "packed", "shipped", "delivered"];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Placed",
  accepted: "Accepted",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Mirrors the database rule in admin_update_order_status. */
export function allowedNextStatuses(s: OrderStatus): OrderStatus[] {
  switch (s) {
    case "placed":
      return ["accepted", "cancelled"];
    case "accepted":
      return ["packed", "cancelled"];
    case "packed":
      return ["shipped", "cancelled"];
    case "shipped":
      return ["delivered"];
    default:
      return [];
  }
}

export function canCustomerCancel(s: OrderStatus) {
  return s === "placed" || s === "accepted" || s === "packed";
}

/** Shipping = sum of each product line's flat charge when enabled and > 0. */
export function computeShipping(items: { shipping_enabled: boolean; shipping_charge: number | null }[]) {
  return items.reduce(
    (sum, i) => sum + (i.shipping_enabled && Number(i.shipping_charge) > 0 ? Number(i.shipping_charge) : 0),
    0,
  );
}

const inrFmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 0 });
export const inr = (n: number | string | null | undefined) => inrFmt.format(Number(n ?? 0));

export const discountPct = (price: number, mrp?: number | null) =>
  mrp && Number(mrp) > Number(price) ? Math.round(((Number(mrp) - Number(price)) / Number(mrp)) * 100) : 0;

export const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

export const PHONE_RE = /^[6-9]\d{9}$/;
export const PINCODE_RE = /^[1-9]\d{5}$/;

export function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export type Address = {
  full_name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
};

export const addressLines = (a: Address) =>
  [a.line1, a.line2, a.landmark ? `Near ${a.landmark}` : null, `${a.city}, ${a.state} - ${a.pincode}`].filter(Boolean) as string[];
