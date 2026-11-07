import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Flame, Award } from "lucide-react";

export function PromoBannerGrid() {
  const promos = [
    {
      badge: "Budget Friendly",
      badgeIcon: Flame,
      title: "Toys Under ₹499",
      subtitle: "Affordable happiness for every little explorer",
      cta: "Explore Deals",
      link: "/products?max=499",
      gradient: "from-amber-500/15 via-orange-500/10 to-transparent",
      borderColor: "border-orange-200/60 dark:border-orange-950/60",
      accentBg: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
      image: "/images/car.jpg",
    },
    {
      badge: "Parent's Choice",
      badgeIcon: Award,
      title: "STEM & Learning",
      subtitle: "Boost creativity, logic & motor skills",
      cta: "Shop Learning",
      link: "/products",
      gradient: "from-blue-500/15 via-indigo-500/10 to-transparent",
      borderColor: "border-blue-200/60 dark:border-blue-950/60",
      accentBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      image: "/images/blocks.jpg",
    },
    {
      badge: "Trending Now",
      badgeIcon: Sparkles,
      title: "New Arrivals",
      subtitle: "Latest launches and viral toy trends in India",
      cta: "See New Toys",
      link: "/products?sort=new",
      gradient: "from-emerald-500/15 via-teal-500/10 to-transparent",
      borderColor: "border-emerald-200/60 dark:border-emerald-950/60",
      accentBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      image: "/images/teddy.jpg",
    },
  ];

  return (
    <section className="mt-14">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-5">
        {promos.map((item, idx) => {
          const BadgeIcon = item.badgeIcon;
          return (
            <Link
              key={idx}
              to={item.link}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border ${item.borderColor} bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-hover`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} pointer-events-none`} />

              <div className="relative z-10">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${item.accentBg}`}>
                  <BadgeIcon className="size-3.5" />
                  {item.badge}
                </span>

                <h3 className="mt-3 text-xl font-bold tracking-tight text-foreground group-hover:text-secondary transition-colors">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                  {item.subtitle}
                </p>
              </div>

              <div className="relative z-10 mt-6 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-secondary group-hover:gap-2 transition-all">
                  {item.cta}
                  <ArrowRight className="size-3.5" />
                </span>

                <div className="size-16 shrink-0 overflow-hidden rounded-xl border bg-muted shadow-sm transition-transform duration-300 group-hover:scale-105">
                  <img src={item.image} alt={item.title} className="size-full object-cover" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
