import { inr } from "@/lib/format";

export function Totals({
  subtotal,
  shipping,
  total,
  discount = 0,
  coupon,
  firstOrderDiscount = 0,
}: {
  subtotal: number;
  shipping: number;
  total: number;
  discount?: number;
  coupon?: string | null;
  firstOrderDiscount?: number;
}) {
  return (
    <div className="space-y-1.5 text-sm">
      <div className="flex justify-between">
        <span>Subtotal</span>
        <span className="font-bold">{inr(subtotal)}</span>
      </div>
      <div className="flex justify-between">
        <span>Shipping</span>
        <span className={`font-bold ${shipping === 0 ? "text-success" : ""}`}>
          {shipping > 0 ? inr(shipping) : "Free shipping"}
        </span>
      </div>
      {firstOrderDiscount > 0 && (
        <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
          <span>First Order Discount (20%)</span>
          <span className="font-bold">− {inr(firstOrderDiscount)}</span>
        </div>
      )}
      {discount > 0 && (
        <div className="flex justify-between text-success">
          <span>Coupon{coupon ? ` (${coupon})` : ""}</span>
          <span className="font-bold">− {inr(discount)}</span>
        </div>
      )}
      <div className="flex justify-between border-t pt-2 text-lg">
        <span className="font-display">Total</span>
        <span className="font-display text-primary">{inr(total)}</span>
      </div>
    </div>
  );
}

export function CancelRuleNote() {
  return (
    <div className="space-y-2">
      <div className="rounded-xl border-l-4 border-amber-500 bg-amber-500/10 p-3 text-xs sm:text-sm text-foreground">
        <b>Cancellation policy:</b> Order can be cancelled only before it is shipped. Once shipped and tracking is generated, cancellation is not possible.
      </div>
      <div className="rounded-xl border-l-4 border-secondary bg-secondary/10 p-3 text-xs sm:text-sm text-foreground">
        <b>Same-Day Return policy:</b> In case of damaged or defective toys, return/replacement must be requested on the <b>same day of delivery</b>. Next-day requests cannot be accepted.
      </div>
    </div>
  );
}
