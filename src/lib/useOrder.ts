import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useOrder(id: string) {
  return useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const [o, items, hist] = await Promise.all([
        supabase.from("orders").select("*").eq("id", id).maybeSingle(),
        supabase.from("order_items").select("*").eq("order_id", id),
        supabase.from("order_status_history").select("*").eq("order_id", id).order("created_at"),
      ]);
      if (o.error) throw o.error;
      return { order: o.data, items: items.data ?? [], history: hist.data ?? [] };
    },
    // Auto-poll every 2 seconds if payment is pending (for 10 minutes from placement)
    refetchInterval: (query) => {
      const o = query.state.data?.order;
      if (!o) return false;
      if (o.payment_method === "razorpay" && o.payment_status === "pending" && o.status !== "cancelled") {
        const diffMs = Date.now() - new Date(o.created_at).getTime();
        return diffMs < 1000 * 60 * 10 ? 2000 : false;
      }
      return false;
    },
  });
}
