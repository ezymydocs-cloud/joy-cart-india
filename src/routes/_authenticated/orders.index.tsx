import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { inr, fmtDate, type OrderStatus } from "@/lib/format";
import { StatusBadge } from "@/components/site/OrderTimeline";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/orders/")({
  head: () => ({
    meta: [
      { title: "My Orders | TrendyToyz" },
      { name: "description", content: "See your TrendyToyz orders and tracking." },
      { property: "og:title", content: "My Orders | TrendyToyz" },
      { property: "og:description", content: "See your TrendyToyz orders and tracking." },
    ],
  }),
  component: MyOrders,
});

function MyOrders() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("id,order_number,status,total,created_at,courier_name,awb_number,order_items(count)").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-5 text-3xl">My orders</h1>
      {q.isLoading ? <div className="h-32 animate-pulse rounded-2xl bg-muted" /> : q.isError ? <p className="text-destructive">Couldn't load orders.</p> : !q.data?.length ? (
        <div className="rounded-2xl border border-dashed p-12 text-center"><div className="text-5xl">📦</div><p className="mt-3 font-bold">No orders yet</p><Button asChild className="mt-4"><Link to="/products">Start shopping</Link></Button></div>
      ) : (
        <div className="space-y-3">
          {q.data.map((o) => (
            <Link key={o.id} to="/orders/$id" params={{ id: o.id }} className="flex items-center justify-between gap-3 rounded-2xl border p-4 hover:shadow-card">
              <div>
                <div className="font-display text-lg">{o.order_number}</div>
                <div className="text-xs text-muted-foreground">{fmtDate(o.created_at)} · {(o.order_items as unknown as { count: number }[])[0]?.count ?? 0} item(s)</div>
                {o.awb_number && <div className="text-xs">{o.courier_name} · AWB {o.awb_number}</div>}
              </div>
              <div className="text-right">
                <StatusBadge status={o.status as OrderStatus} />
                <div className="mt-1 font-bold">{inr(o.total)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
