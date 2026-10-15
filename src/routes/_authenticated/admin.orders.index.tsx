import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { inr, fmtDate, STATUS_LABEL, type OrderStatus } from "@/lib/format";
import { StatusBadge } from "@/components/site/OrderTimeline";
import { useOrdersRealtime } from "@/lib/useOrdersRealtime";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/orders/")({ component: Orders });

function Orders() {
  useOrdersRealtime();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [pay, setPay] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const q = useQuery({
    queryKey: ["admin", "orders", search, status, pay, from, to],
    queryFn: async () => {
      let qb = supabase.from("orders").select("id,order_number,customer_name,customer_phone,total,status,payment_method,payment_status,created_at").order("created_at", { ascending: false }).limit(300);
      if (status !== "all") qb = qb.eq("status", status as OrderStatus);
      if (pay !== "all") qb = qb.eq("payment_method", pay);
      if (from) qb = qb.gte("created_at", new Date(from + "T00:00:00+05:30").toISOString());
      if (to) qb = qb.lte("created_at", new Date(to + "T23:59:59+05:30").toISOString());
      const s = search.trim().replace(/[,()%]/g, "");
      if (s) qb = qb.or(`order_number.ilike.%${s}%,customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%`);
      const { data, error } = await qb;
      if (error) throw error;
      return data;
    },
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl">Orders</h1><Button size="sm" variant="outline" onClick={() => q.refetch()}><RefreshCw className={q.isFetching ? "animate-spin" : ""} /> Refresh</Button></div>
      <div className="grid gap-2 rounded-2xl bg-background p-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input placeholder="Order no., name or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
        <Select value={pay} onValueChange={setPay}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All payments</SelectItem><SelectItem value="cod">COD</SelectItem><SelectItem value="razorpay">Online</SelectItem></SelectContent></Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
      </div>
      {q.isLoading ? <div className="h-40 animate-pulse rounded-2xl bg-background" /> : q.isError ? <p className="text-destructive">Couldn't load orders.</p> : !q.data?.length ? <div className="rounded-2xl bg-background p-10 text-center text-muted-foreground">No orders found.</div> : (
        <div className="overflow-hidden rounded-2xl bg-background">
          <div className="divide-y">
            {q.data.map((o) => (
              <Link key={o.id} to="/admin/orders/$id" params={{ id: o.id }} className="grid grid-cols-2 gap-2 p-3 text-sm hover:bg-muted md:grid-cols-6 md:items-center">
                <div className="font-bold">{o.order_number}</div>
                <div className="text-right md:order-last"><StatusBadge status={o.status as OrderStatus} /></div>
                <div className="md:col-span-2">{o.customer_name}<div className="text-xs text-muted-foreground">{o.customer_phone}</div></div>
                <div className="text-xs text-muted-foreground">{fmtDate(o.created_at)}</div>
                <div className="text-right md:text-left"><b>{inr(o.total)}</b><div className="text-xs uppercase text-muted-foreground">{o.payment_method} · {o.payment_status}</div></div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
