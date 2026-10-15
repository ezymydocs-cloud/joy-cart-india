import { createFileRoute, Link } from "@tanstack/react-router";
import { CustomerOrderView } from "@/components/site/OrderView";

export const Route = createFileRoute("/_authenticated/orders/$id")({
  head: () => ({
    meta: [
      { title: "Order Details | TrendyToyz" },
      { name: "description", content: "Track your TrendyToyz order." },
      { property: "og:title", content: "Order Details | TrendyToyz" },
      { property: "og:description", content: "Track your TrendyToyz order." },
    ],
  }),
  component: () => {
    const { id } = Route.useParams();
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <Link to="/orders" className="text-sm text-secondary">← All orders</Link>
        <div className="mt-3"><CustomerOrderView id={id} /></div>
      </div>
    );
  },
});
