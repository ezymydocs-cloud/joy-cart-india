import { inr } from "@/lib/format";

export function Totals({ subtotal, shipping, total, discount = 0, coupon }: { subtotal: number; shipping: number; total: number; discount?: number; coupon?: string | null }) {
  return (
    <div className="space-y-1.5 text-sm">
      <div className="flex justify-between"><span>Subtotal</span><span className="font-bold">{inr(subtotal)}</span></div>
      <div className="flex justify-between"><span>Shipping</span><span className={`font-bold ${shipping === 0 ? "text-success" : ""}`}>{shipping > 0 ? inr(shipping) : "Free shipping"}</span></div>
      {discount > 0 && <div className="flex justify-between text-success"><span>Coupon{coupon ? ` (${coupon})` : ""}</span><span className="font-bold">− {inr(discount)}</span></div>}
      <div className="flex justify-between border-t pt-2 text-lg"><span className="font-display">Total</span><span className="font-display text-primary">{inr(total)}</span></div>
    </div>
  );
}

export function CancelRuleNote() {
  return (
    <div className="rounded-2xl border-l-4 border-secondary bg-sun-soft p-3 text-sm">
      <b>Cancellation policy:</b> Order can be cancelled only before it is shipped. Once shipped and tracking is generated, cancellation is not possible.
    </div>
  );
}
