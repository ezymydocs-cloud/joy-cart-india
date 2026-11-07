import { createFileRoute, Link } from "@tanstack/react-router";
import { CustomerOrderView } from "@/components/site/OrderView";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/order-success/$id")({
  head: () => ({
    meta: [
      { title: "Order Confirmed | TrendyToyze" },
      { name: "description", content: "Your TrendyToyze order has been placed." },
      { property: "og:title", content: "Order Confirmed | TrendyToyze" },
      { property: "og:description", content: "Your TrendyToyze order has been placed." },
    ],
  }),
  component: Success,
});

function Success() {
  const { id } = Route.useParams();
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 rounded-2xl border border-secondary/30 bg-secondary/10 p-6 text-center">
        <div className="text-5xl">🎉</div>
        <h1 className="mt-2 text-3xl font-bold text-foreground">Thank you! Your order is placed.</h1>
        <p className="mt-1 text-muted-foreground">A confirmation email is on its way.</p>
      </div>
      <CustomerOrderView id={id} showRule />
      <div className="mt-6 flex gap-2"><Button asChild variant="outline"><Link to="/orders">My orders</Link></Button><Button asChild><Link to="/products">Continue shopping</Link></Button></div>
    </div>
  );
}
