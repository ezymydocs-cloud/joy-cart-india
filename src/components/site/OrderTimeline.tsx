import { Check, X } from "lucide-react";
import { STATUS_FLOW, STATUS_LABEL, fmtDate, type OrderStatus } from "@/lib/format";

type H = { id: string; status: OrderStatus; created_at: string; note: string | null; changed_by_role?: string };

export function OrderTimeline({ status, history }: { status: OrderStatus; history: H[] }) {
  const cancelled = status === "cancelled";
  const reached = new Map<OrderStatus, H>();
  history.forEach((h) => reached.set(h.status, h));
  const steps: OrderStatus[] = cancelled ? [...STATUS_FLOW.filter((s) => reached.has(s)), "cancelled"] : STATUS_FLOW;
  return (
    <ol className="relative space-y-4 border-l-2 border-border pl-6">
      {steps.map((s) => {
        const h = reached.get(s);
        const done = !!h;
        const isCancel = s === "cancelled";
        return (
          <li key={s} className="relative">
            <span className={`absolute -left-[35px] grid size-6 place-items-center rounded-full border ${isCancel ? "border-destructive bg-destructive text-destructive-foreground" : done ? "border-success bg-success text-success-foreground" : "bg-background"}`}>
              {isCancel ? <X className="size-3.5" /> : done ? <Check className="size-3.5" /> : null}
            </span>
            <div className={`font-bold ${done ? "" : "text-muted-foreground"}`}>{STATUS_LABEL[s]}</div>
            {h && <div className="text-xs text-muted-foreground">{fmtDate(h.created_at)}{h.changed_by_role ? ` · by ${h.changed_by_role}` : ""}</div>}
            {h?.note && h.status !== "placed" && <div className="text-sm">{h.note}</div>}
          </li>
        );
      })}
    </ol>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const cls: Record<OrderStatus, string> = {
    placed: "bg-sun-soft text-primary",
    accepted: "bg-navy-soft text-primary",
    packed: "bg-accent text-secondary",
    shipped: "bg-primary text-primary-foreground",
    delivered: "bg-success text-success-foreground",
    cancelled: "bg-destructive text-destructive-foreground",
  };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${cls[status]}`}>{STATUS_LABEL[status]}</span>;
}
