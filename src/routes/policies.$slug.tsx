import { createFileRoute, notFound } from "@tanstack/react-router";
import { CANCEL_RULE } from "@/lib/format";

const POLICIES: Record<string, { title: string; body: string[] }> = {
  privacy: {
    title: "Privacy Policy",
    body: [
      "TrendyToyz collects your name, phone number, email and delivery address only to process and deliver your orders and to contact you about them.",
      "We never sell your personal data. Payment details for online payments are handled securely by our payment partner and are not stored by us.",
      "To ask for your data to be updated or deleted, email trendytoyz.info@gmail.com.",
    ],
  },
  terms: {
    title: "Terms & Conditions",
    body: [
      "By placing an order on TrendyToyz you agree to these terms. Prices are in Indian Rupees (INR) and include applicable taxes unless stated otherwise.",
      "Product images are for illustration; colours may vary slightly. Stock is limited and orders are confirmed subject to availability.",
      "An account and login are required to place an order.",
    ],
  },
  shipping: {
    title: "Shipping Policy",
    body: [
      "We ship across India through trusted courier partners. Orders are usually dispatched within 1–2 working days.",
      "Shipping charges, if any, are shown on each product page and in your cart before you pay. Some toys ship free.",
      "Once shipped, you'll receive the courier name and tracking (AWB) number in My Orders and by email.",
    ],
  },
  "cancellation-refund": {
    title: "Cancellation, Return & Refund Policy",
    body: [
      CANCEL_RULE,
      "You can cancel from My Orders while your order is Placed, Accepted or Packed. Prepaid orders cancelled before shipping are refunded to the original payment method within 5–7 working days.",
      "Same-Day Return Policy: Returns or damage claims are strictly accepted on the SAME DAY of delivery only. Any return or replacement request received the next day or later cannot be accepted.",
      "To initiate a same-day return, contact us immediately on the delivery date via WhatsApp at +91 8446418374 or email trendytoyz.info@gmail.com with package photos or unboxing video.",
    ],
  },
};

export const Route = createFileRoute("/policies/$slug")({
  loader: ({ params }) => {
    const p = POLICIES[params.slug];
    if (!p) throw notFound();
    return p;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? "Policy"} | TrendyToyz` },
      { name: "description", content: `${loaderData?.title ?? "Policy"} for TrendyToyz.` },
      { property: "og:title", content: `${loaderData?.title ?? "Policy"} | TrendyToyz` },
      { property: "og:description", content: `${loaderData?.title ?? "Policy"} for TrendyToyz.` },
    ],
  }),
  component: Policy,
});

function Policy() {
  const p = Route.useLoaderData();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">{p.title}</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-foreground/80 rounded-2xl border bg-card p-6 shadow-xs">
        {p.body.map((b) => <p key={b}>{b}</p>)}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">Questions or assistance? Contact trendytoyz.info@gmail.com or call/WhatsApp +91 8446418374.</p>
    </div>
  );
}
