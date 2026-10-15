import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartLine = { productId: string; qty: number };
type CartCtx = {
  lines: CartLine[];
  count: number;
  add: (productId: string, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
};
const Ctx = createContext<CartCtx | null>(null);
const KEY = "tt_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLines((JSON.parse(raw) as CartLine[]).filter((l) => l.productId && l.qty > 0));
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(lines));
  }, [lines, loaded]);

  const add = useCallback((productId: string, qty = 1) => {
    setLines((ls) => {
      const ex = ls.find((l) => l.productId === productId);
      if (ex) return ls.map((l) => (l.productId === productId ? { ...l, qty: Math.min(99, l.qty + qty) } : l));
      return [...ls, { productId, qty }];
    });
  }, []);
  const setQty = useCallback((productId: string, qty: number) => {
    setLines((ls) => (qty <= 0 ? ls.filter((l) => l.productId !== productId) : ls.map((l) => (l.productId === productId ? { ...l, qty: Math.min(99, qty) } : l))));
  }, []);
  const remove = useCallback((productId: string) => setLines((ls) => ls.filter((l) => l.productId !== productId)), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo(() => ({ lines, count: lines.reduce((s, l) => s + l.qty, 0), add, setQty, remove, clear }), [lines, add, setQty, remove, clear]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart outside provider");
  return c;
}
