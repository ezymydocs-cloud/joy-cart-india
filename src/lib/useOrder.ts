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
  });
}
