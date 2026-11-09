import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartLine = {
  productId: string;
  qty: number;
  variantId?: string;
  variantName?: string;
  isFreeBogo?: boolean;
  bogoParentId?: string;
  bogoParentName?: string;
  bogoLimit?: number;
};

export type BogoCartOptions = {
  isFreeBogo?: boolean;
  bogoParentId?: string;
  bogoParentName?: string;
  bogoLimit?: number;
};

type CartCtx = {
  lines: CartLine[];
  count: number;
  add: (
    productId: string,
    qty?: number,
    variantId?: string,
    variantName?: string,
    bogoOptions?: BogoCartOptions
  ) => void;
  setQty: (productId: string, qty: number, variantId?: string, isFree?: boolean) => void;
  remove: (productId: string, variantId?: string, isFree?: boolean) => void;
  clear: () => void;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "tt_cart_v1";

const isMatch = (l: CartLine, pId: string, vId?: string, isFree?: boolean) =>
  l.productId === pId &&
  (vId ? l.variantId === vId : !l.variantId) &&
  (isFree ? l.isFreeBogo === true : !l.isFreeBogo);

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

  const add = useCallback(
    (
      productId: string,
      qty = 1,
      variantId?: string,
      variantName?: string,
      bogoOptions?: BogoCartOptions
    ) => {
      setLines((ls) => {
        const isFree = bogoOptions?.isFreeBogo ?? false;
        const ex = ls.find((l) => isMatch(l, productId, variantId, isFree));
        if (ex) {
          return ls.map((l) =>
            isMatch(l, productId, variantId, isFree)
              ? { ...l, qty: isFree ? 1 : Math.min(99, l.qty + qty) }
              : l
          );
        }
        return [
          ...ls,
          {
            productId,
            qty,
            variantId,
            variantName,
            isFreeBogo: bogoOptions?.isFreeBogo,
            bogoParentId: bogoOptions?.bogoParentId,
            bogoParentName: bogoOptions?.bogoParentName,
            bogoLimit: bogoOptions?.bogoLimit,
          },
        ];
      });
    },
    []
  );

  const setQty = useCallback((productId: string, qty: number, variantId?: string, isFree?: boolean) => {
    setLines((ls) =>
      qty <= 0
        ? ls.filter((l) => !isMatch(l, productId, variantId, isFree))
        : ls.map((l) => (isMatch(l, productId, variantId, isFree) ? { ...l, qty: Math.min(99, qty) } : l))
    );
  }, []);

  const remove = useCallback((productId: string, variantId?: string, isFree?: boolean) => {
    setLines((ls) => {
      // If removing a parent product that has a linked free gift, also clean up the linked free gift
      return ls.filter((l) => {
        if (isMatch(l, productId, variantId, isFree)) return false;
        if (!isFree && l.bogoParentId === productId) return false;
        return true;
      });
    });
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo(
    () => ({ lines, count: lines.reduce((s, l) => s + l.qty, 0), add, setQty, remove, clear }),
    [lines, add, setQty, remove, clear]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart outside provider");
  return c;
}
