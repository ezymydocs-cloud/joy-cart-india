import { useState, useEffect } from "react";
import { Sparkles, Truck, Phone, Copy, Check, Flame, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchSettings } from "@/lib/catalog";
import { BRAND } from "@/lib/format";

type AnnouncementMessage = {
  icon: typeof Sparkles;
  text: string;
  code?: string | null;
  link?: string | null;
};

// Clean default messages WITHOUT fake coupon codes
const CLEAN_DEFAULT_MESSAGES: AnnouncementMessage[] = [
  {
    icon: Truck,
    text: "Fast Pan-India Delivery · Same-Day Return Policy on Delivery Date",
  },
  {
    icon: ShieldCheck,
    text: "100% Child-Safe, Certified & Non-Toxic Premium Toys for Kids",
  },
  {
    icon: Phone,
    text: `Customer Support Available Mon–Sat · WhatsApp: +${BRAND.phone}`,
    link: BRAND.whatsapp,
  },
];

export function TopAnnouncementBar() {
  const [current, setCurrent] = useState(0);
  const [copied, setCopied] = useState(false);

  // 1. Fetch store settings
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  const isBarEnabled = (settings as any)?.announcement_bar_enabled !== false;
  const customMessages: any[] = Array.isArray((settings as any)?.announcement_messages)
    ? (settings as any).announcement_messages
    : [];

  // 2. Fetch real active offers from database (no mock/fake fallbacks)
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
      code: o.coupon_code || null,
      link: o.link_url,
    }));

  const parsedCustomMessages: AnnouncementMessage[] = customMessages
    .filter((m) => m && m.text && typeof m.text === "string" && m.text.trim())
    .map((m) => ({
      icon: Sparkles,
      text: m.text,
      code: m.code || null,
      link: m.link || null,
    }));

  // Combine real messages: custom admin messages first, then real active offers, then clean store highlights
  const allMessages: AnnouncementMessage[] =
    parsedCustomMessages.length > 0 || validOfferMessages.length > 0
      ? [...parsedCustomMessages, ...validOfferMessages, ...CLEAN_DEFAULT_MESSAGES.slice(0, 1)]
      : CLEAN_DEFAULT_MESSAGES;

  useEffect(() => {
    if (allMessages.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % allMessages.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [allMessages.length]);

  if (!isBarEnabled) return null;

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

        {/* Center Carousel */}
        <div className="flex flex-1 items-center justify-center gap-2 text-center">
          <Icon className="size-3.5 shrink-0 text-secondary" />
          <span className="font-medium truncate max-w-[280px] sm:max-w-md md:max-w-lg">
            {activeMsg.text}
          </span>

          {activeMsg.code && (
            <button
              onClick={() => handleCopyCode(activeMsg.code!)}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 font-mono text-[11px] font-bold text-secondary-foreground shadow-xs transition hover:brightness-110 active:scale-95"
              title="Click to copy code"
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              <span>{activeMsg.code}</span>
            </button>
          )}

          {activeMsg.link && !activeMsg.code && (
            <a
              href={activeMsg.link}
              target="_blank"
              rel="noreferrer"
              className="font-bold underline text-secondary hover:text-secondary-foreground text-[11px]"
            >
              Chat
            </a>
          )}
        </div>

        {/* Right Help info */}
        <div className="hidden items-center gap-3 text-primary-foreground/75 md:flex">
          <a
            href={BRAND.whatsapp}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 hover:text-white"
          >
            <Phone className="size-3" />
            <span>Support: +{BRAND.phone}</span>
          </a>
        </div>
      </div>
    </div>
  );
}
