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
      const { data, error } = await supabase
        .from("orders")
        .select("id,order_number,status,payment_status,payment_method,total,created_at,courier_name,awb_number,order_items(count)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    // Auto-poll every 2.5 seconds if there are recent pending Razorpay orders (up to 10 mins old)
    refetchInterval: (query) => {
      const orders = query.state.data;
      if (!orders || !Array.isArray(orders)) return false;
      const hasRecentPending = orders.some((o: any) => {
        if (o.payment_method !== "razorpay" || o.payment_status !== "pending") return false;
        const diffMs = Date.now() - new Date(o.created_at).getTime();
        return diffMs < 1000 * 60 * 10;
      });
      return hasRecentPending ? 2500 : false;
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-5 text-3xl font-bold">My orders</h1>
      {q.isLoading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      ) : q.isError ? (
        <p className="text-destructive">Couldn't load orders.</p>
      ) : !q.data?.length ? (
        <div className="rounded-2xl border border-dashed p-12 text-center">
          <div className="text-5xl">📦</div>
          <p className="mt-3 font-bold">No orders yet</p>
          <Button asChild className="mt-4">
            <Link to="/products">Start shopping</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {q.data.map((o) => (
            <Link
              key={o.id}
              to="/orders/$id"
              params={{ id: o.id }}
              className="flex items-center justify-between gap-3 rounded-2xl border p-4 transition hover:shadow-card bg-card"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg font-bold">{o.order_number}</span>
                  {o.payment_method === "razorpay" && o.payment_status === "paid" && (
                    <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      Paid
                    </span>
                  )}
                  {o.payment_method === "razorpay" && o.payment_status === "pending" && (
                    <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 animate-pulse">
                      Payment Pending
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {fmtDate(o.created_at)} · {(o.order_items as unknown as { count: number }[])[0]?.count ?? 0} item(s)
                </div>
                {o.awb_number && (
                  <div className="mt-1 text-xs">
                    {o.courier_name} · AWB {o.awb_number}
                  </div>
                )}
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
