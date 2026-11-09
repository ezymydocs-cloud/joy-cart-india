import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_SELECT, type Product, type ProductVariant } from "./catalog";
import { useCart, type CartLine } from "./cart";
import { computeShipping } from "./format";

export type CartRow = {
  line: CartLine;
  product: Product;
  price: number;
  variant?: ProductVariant | null;
};

/** Joins cart lines with live product data (prices always fresh from the database). */
export function useCartProducts() {
  const { lines } = useCart();
  const ids = Array.from(new Set(lines.map((l) => l.productId))).sort();
  const q = useQuery({
    queryKey: ["cart-products", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).in("id", ids);
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });

  const rows: CartRow[] = lines
    .map((l) => {
      const product = q.data?.find((p) => p.id === l.productId);
      if (!product || product.status !== "active") return null;

      let variant: ProductVariant | null = null;
      let price = Number(product.price);

      if (l.variantId && Array.isArray(product.variants)) {
        variant = product.variants.find((v) => v.id === l.variantId) || null;
        if (variant && variant.price != null && Number(variant.price) > 0) {
          price = Number(variant.price);
        }
      }

      return { line: l, product, price, variant };
    })
    .filter((r): r is CartRow => r !== null);

  const subtotal = rows.reduce((s, r) => s + r.price * r.line.qty, 0);
  const shipping = computeShipping(rows.map((r) => r.product));
  const problems = rows.filter((r) => {
    const stockAvailable = r.variant ? r.variant.stock : r.product.stock;
    return stockAvailable < r.line.qty;
  });
  const missing = q.data ? lines.filter((l) => !rows.some((r) => r.line.productId === l.productId)) : [];

  return {
    ...q,
    isLoading: ids.length > 0 && q.isLoading,
    rows,
    subtotal,
    shipping,
    total: subtotal + shipping,
    problems,
    missing,
  };
}
