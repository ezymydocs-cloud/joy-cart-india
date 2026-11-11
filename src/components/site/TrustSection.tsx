import { Truck, ShieldCheck, Wallet, RotateCcw } from "lucide-react";

export function TrustSection() {
  const features = [
    {
      icon: Truck,
      title: "Pan-India Shipping",
      desc: "Fast & reliable doorstep delivery across 20,000+ pincodes",
    },
    {
      icon: ShieldCheck,
      title: "100% Child Safe",
      desc: "Non-toxic, high-grade materials certified for child play",
    },
    {
      icon: Wallet,
      title: "100% Secure Payments",
      desc: "Instant UPI, Debit/Credit Cards & NetBanking options",
    },
    {
      icon: RotateCcw,
      title: "Same-Day Returns",
      desc: "Return accepted on the delivery day itself (no next-day delays)",
    },
  ];

  return (
    <section className="mt-6 sm:mt-12 rounded-2xl border bg-card p-3 sm:p-6 shadow-xs">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
        {features.map((f, i) => {
          const Icon = f.icon;
          return (
            <div
              key={i}
              className="flex items-center sm:items-start gap-2 sm:gap-3.5 p-2 sm:p-0 rounded-xl bg-muted/25 sm:bg-transparent"
            >
              <div className="grid size-8 sm:size-11 shrink-0 place-items-center rounded-lg sm:rounded-xl bg-secondary/10 text-secondary">
                <Icon className="size-4 sm:size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-[11px] sm:text-sm font-bold text-foreground leading-tight truncate sm:whitespace-normal">
                  {f.title}
                </h4>
                <p className="mt-0.5 text-[9px] sm:text-xs text-muted-foreground leading-snug line-clamp-2">
                  {f.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
