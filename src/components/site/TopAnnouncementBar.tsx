import { useState, useEffect } from "react";
import { Sparkles, Truck, Phone, Copy, Check, Flame } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/format";

type AnnouncementMessage = {
  icon: typeof Sparkles;
  text: string;
  code?: string | null;
  link?: string | null;
};

const DEFAULT_MESSAGES: AnnouncementMessage[] = [
  {
    icon: Sparkles,
    text: "Festive Toy Sale! Get 10% OFF on your order with coupon",
    code: "TOYZ10",
  },
  {
    icon: Truck,
    text: "Fast Pan-India Delivery · Same-Day Return Policy on Delivery",
  },
  {
    icon: Phone,
    text: `Support Available Mon–Sat · Call / WhatsApp ${BRAND.phone}`,
    link: BRAND.whatsapp,
  },
];

export function TopAnnouncementBar() {
  const [current, setCurrent] = useState(0);
  const [copied, setCopied] = useState(false);

  const { data: activeOffers = [] } = useQuery({
    queryKey: ["offers", "announcements"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("offers")
          .select("title,coupon_code,link_url,start_date,end_date,is_active")
          .eq("is_active", true)
          .in("display_location", ["all", "announcement"])
          .order("sort_order", { ascending: true });
        if (error) return [];
        return data ?? [];
      } catch {
        return [];
      }
    },
    staleTime: 60 * 1000,
  });

  const now = new Date();
  const validOfferMessages: AnnouncementMessage[] = activeOffers
    .filter((o) => {
      if (!o.is_active) return false;
      const start = new Date(o.start_date);
      if (start > now) return false;
      if (o.end_date && new Date(o.end_date) < now) return false;
      return true;
    })
    .map((o) => ({
      icon: Flame,
      text: o.title,
      code: o.coupon_code,
      link: o.link_url,
    }));

  const allMessages = validOfferMessages.length > 0
    ? [...validOfferMessages, ...DEFAULT_MESSAGES.slice(1)]
    : DEFAULT_MESSAGES;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % allMessages.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [allMessages.length]);

  const activeMsg = allMessages[current % allMessages.length] || allMessages[0];
  const Icon = activeMsg.icon;

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success(`Coupon code "${code}" copied to clipboard!`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative z-50 bg-primary px-3 py-2 text-primary-foreground">
      <div className="mx-auto flex max-w-7xl items-center justify-between text-xs">
        {/* Left helper on desktop */}
        <div className="hidden items-center gap-2 text-primary-foreground/75 md:flex">
          <Truck className="size-3.5 text-secondary" />
          <span>Pan-India Safe Delivery</span>
        </div>

        {/* Center rotating promo message */}
        <div className="flex flex-1 items-center justify-center gap-2 text-center font-medium transition-all duration-300">
          <Icon className="size-3.5 shrink-0 text-secondary" />
          <span className="line-clamp-1">{activeMsg.text}</span>
          {activeMsg.code && (
            <button
              onClick={() => handleCopyCode(activeMsg.code!)}
              className="inline-flex items-center gap-1 rounded bg-secondary/20 px-1.5 py-0.5 text-[11px] font-bold text-secondary transition hover:bg-secondary hover:text-secondary-foreground cursor-pointer"
              title="Click to copy coupon code"
            >
              <span>{activeMsg.code}</span>
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            </button>
          )}
        </div>

        {/* Right WhatsApp / contact shortcut */}
        <div className="hidden items-center gap-3 text-primary-foreground/75 md:flex">
          <a
            href={BRAND.whatsapp}
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-secondary"
          >
            WhatsApp Support
          </a>
        </div>
      </div>
    </div>
  );
}
