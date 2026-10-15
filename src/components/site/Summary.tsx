import { inr } from "@/lib/format";

export function Totals({ subtotal, shipping, total }: { subtotal: number; shipping: number; total: number }) {
  return (
    <div className="space-y-1.5 text-sm">
      <div className="flex justify-between"><span>Subtotal</span><span className="font-bold">{inr(subtotal)}</span></div>
      <div className="flex justify-between"><span>Shipping</span><span className={`font-bold ${shipping === 0 ? "text-success" : ""}`}>{shipping > 0 ? inr(shipping) : "Free shipping"}</span></div>
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
