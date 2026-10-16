import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Refreshes admin order data whenever any order row changes. */
export function useOrdersRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel(`admin-orders-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["admin"] });
        qc.invalidateQueries({ queryKey: ["order"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);
}
