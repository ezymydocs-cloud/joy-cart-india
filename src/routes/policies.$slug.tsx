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
      "We ship across India through trusted courier partners. Orders are usually dispatched within 1–3 working days.",
      "Shipping charges, if any, are shown on each product page and in your cart before you pay. Some toys ship free.",
      "Once shipped, you'll receive the courier name and tracking (AWB) number in My Orders and by email.",
    ],
  },
  "cancellation-refund": {
    title: "Cancellation & Refund Policy",
    body: [
      CANCEL_RULE,
      "You can cancel from My Orders while your order is Placed, Accepted or Packed. Prepaid orders cancelled before shipping are refunded to the original payment method within 5–7 working days.",
      "For damaged or wrong items, contact us within 48 hours of delivery at trendytoyz.info@gmail.com or WhatsApp +91 8446418374 with photos.",
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
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl">{p.title}</h1>
      <div className="mt-5 space-y-4 leading-relaxed">{p.body.map((b) => <p key={b}>{b}</p>)}</div>
      <p className="mt-8 text-sm text-muted-foreground">Questions? Email trendytoyz.info@gmail.com or call +91 8446418374.</p>
    </div>
  );
}
