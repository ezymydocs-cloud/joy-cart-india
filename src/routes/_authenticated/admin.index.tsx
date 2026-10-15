import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useOrdersRealtime } from "@/lib/useOrdersRealtime";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { inr, fmtDate, type OrderStatus } from "@/lib/format";
import { StatusBadge } from "@/components/site/OrderTimeline";

export const Route = createFileRoute("/_authenticated/admin/")({ component: Dashboard });

type Stats = {
  total_sales: number; total_orders: number; today_orders: number; pending: number; placed: number; shipped: number; delivered: number; cancelled: number;
  low_stock: { id: string; name: string; stock: number }[]; chart: { day: string; sales: number; orders: number }[];
};

function Dashboard() {
  useOrdersRealtime();
  const stats = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_dashboard_stats");
      if (error) throw error;
      return data as unknown as Stats;
    },
  });
  const recent = useQuery({
    queryKey: ["admin", "recent"],
    queryFn: async () => (await supabase.from("orders").select("id,order_number,customer_name,total,status,created_at").order("created_at", { ascending: false }).limit(8)).data ?? [],
  });
  const s = stats.data;
  const cards = s ? [
    { l: "Total sales", v: inr(s.total_sales) },
    { l: "Today's orders", v: s.today_orders },
    { l: "Pending (to ship)", v: s.pending },
    { l: "New (placed)", v: s.placed },
    { l: "Shipped", v: s.shipped },
    { l: "Delivered", v: s.delivered },
    { l: "Cancelled", v: s.cancelled },
    { l: "All orders", v: s.total_orders },
  ] : [];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl">Dashboard</h1>
      {stats.isLoading ? <div className="h-32 animate-pulse rounded-3xl bg-background" /> : stats.isError ? <p className="text-destructive">Couldn't load stats.</p> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {cards.map((c) => <div key={c.l} className="rounded-2xl bg-background p-4"><div className="text-xs font-bold text-muted-foreground">{c.l}</div><div className="mt-1 font-display text-2xl">{c.v}</div></div>)}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl bg-background p-4 lg:col-span-2">
              <h2 className="mb-3 text-lg">Sales (last 14 days)</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={s!.chart.map((d) => ({ ...d, label: new Date(d.day).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v: number, n) => (n === "sales" ? inr(v) : v)} />
                    <Bar dataKey="sales" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-2xl bg-background p-4">
              <h2 className="mb-3 text-lg">Low stock (≤ 5)</h2>
              {s!.low_stock.length === 0 ? <p className="text-sm text-muted-foreground">All products are well stocked.</p> : (
                <ul className="space-y-2 text-sm">{s!.low_stock.map((p) => <li key={p.id} className="flex justify-between"><Link to="/admin/products/$id" params={{ id: p.id }} className="truncate hover:underline">{p.name}</Link><b className={p.stock === 0 ? "text-destructive" : "text-secondary"}>{p.stock}</b></li>)}</ul>
              )}
            </div>
          </div>
        </>
      )}
      <div className="rounded-2xl bg-background p-4">
        <div className="mb-3 flex justify-between"><h2 className="text-lg">Recent orders</h2><Link to="/admin/orders" className="text-sm font-bold text-secondary">All orders →</Link></div>
        {recent.data?.length === 0 ? <p className="text-sm text-muted-foreground">No orders yet.</p> : (
          <div className="divide-y">{recent.data?.map((o) => (
            <Link key={o.id} to="/admin/orders/$id" params={{ id: o.id }} className="flex items-center justify-between gap-2 py-2.5 text-sm hover:bg-muted">
              <div><b>{o.order_number}</b> · {o.customer_name}<div className="text-xs text-muted-foreground">{fmtDate(o.created_at)}</div></div>
              <div className="text-right"><StatusBadge status={o.status as OrderStatus} /><div className="font-bold">{inr(o.total)}</div></div>
            </Link>
          ))}</div>
        )}
      </div>
    </div>
  );
}
