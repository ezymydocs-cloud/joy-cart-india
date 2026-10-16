import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { inr, fmtDate } from "@/lib/format";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/customers")({ component: Customers });

function Customers() {
  const [s, setS] = useState("");
  const q = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_customers");
      if (error) throw error;
      return data;
    },
  });
  const list = (q.data ?? []).filter((c) => !s || `${c.full_name} ${c.email} ${c.phone}`.toLowerCase().includes(s.toLowerCase()));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Customers</h1>
      <Input className="max-w-xs bg-background" placeholder="Search name, email, phone" value={s} onChange={(e) => setS(e.target.value)} />
      {q.isLoading ? <div className="h-32 animate-pulse rounded-2xl bg-background" /> : q.isError ? <p className="text-destructive">Couldn't load customers.</p> : (
        <div className="divide-y rounded-2xl bg-background">
          {list.length === 0 && <p className="p-6 text-center text-muted-foreground">No customers.</p>}
          {list.map((c) => (
            <div key={c.id} className="grid grid-cols-2 gap-2 p-3 text-sm md:grid-cols-4">
              <div><b>{c.full_name || "—"}</b><div className="text-xs text-muted-foreground">Joined {fmtDate(c.created_at)}</div></div>
              <div className="break-all text-xs md:text-sm">{c.email}<div>{c.phone}</div></div>
              <div><span className="text-muted-foreground">Orders:</span> <b>{c.order_count}</b></div>
              <div><span className="text-muted-foreground">Spent:</span> <b>{inr(c.total_spent)}</b></div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Total spent excludes cancelled orders.</p>
    </div>
  );
}
