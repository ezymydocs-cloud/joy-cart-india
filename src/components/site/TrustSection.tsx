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
      title: "COD & Secure Online Pay",
      desc: "Pay via UPI, Cards, NetBanking, or Cash on Delivery",
    },
    {
      icon: RotateCcw,
      title: "Easy Replacement",
      desc: "7-day doorstep replacement guarantee on transit damages",
    },
  ];

  return (
    <section className="mt-12 rounded-2xl border bg-card p-6 shadow-xs">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f, i) => {
          const Icon = f.icon;
          return (
            <div key={i} className="flex items-start gap-3.5">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary/10 text-secondary">
                <Icon className="size-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">{f.title}</h4>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
