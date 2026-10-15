import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_SELECT, type Product } from "./catalog";
import { useCart } from "./cart";
import { computeShipping } from "./format";

/** Joins cart lines with live product data (prices always fresh from the database). */
export function useCartProducts() {
  const { lines } = useCart();
  const ids = lines.map((l) => l.productId).sort();
  const q = useQuery({
    queryKey: ["cart-products", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).in("id", ids);
      if (error) throw error;
      return data as unknown as Product[];
    },
  });
  const rows = lines
    .map((l) => ({ line: l, product: q.data?.find((p) => p.id === l.productId) }))
    .filter((r): r is { line: typeof r.line; product: Product } => !!r.product && r.product.status === "active");
  const subtotal = rows.reduce((s, r) => s + Number(r.product.price) * r.line.qty, 0);
  const shipping = computeShipping(rows.map((r) => r.product));
  const problems = rows.filter((r) => r.product.stock < r.line.qty);
  const missing = q.data ? lines.filter((l) => !rows.some((r) => r.line.productId === l.productId)) : [];
  return { ...q, isLoading: ids.length > 0 && q.isLoading, rows, subtotal, shipping, total: subtotal + shipping, problems, missing };
}
