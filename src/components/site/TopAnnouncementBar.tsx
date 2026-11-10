import { useState, useEffect } from "react";
import {
  Sparkles,
  Truck,
  Phone,
  Copy,
  Check,
  Flame,
  ShieldCheck,
  Gift,
  Heart,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { fetchSettings } from "@/lib/catalog";
import { BRAND, formatPhone } from "@/lib/format";

export const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  truck: Truck,
  shield: ShieldCheck,
  phone: Phone,
  sparkles: Sparkles,
  flame: Flame,
  gift: Gift,
  heart: Heart,
  zap: Zap,
};

export interface BannerMessage {
  id?: string;
  text: string;
  icon?: string;
  link?: string | null;
  code?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

const DEFAULT_CENTER_MESSAGES: BannerMessage[] = [
  {
    id: "default-1",
    text: "100% Child-Safe, Certified & Non-Toxic Premium Toys for Kids",
    icon: "shield",
  },
  {
    id: "default-2",
    text: "Fast Pan-India Delivery · Same-Day Return Policy on Delivery Date",
    icon: "truck",
  },
  {
    id: "default-3",
    text: "Customer Support Mon–Sat · WhatsApp Available",
    icon: "phone",
    link: BRAND.whatsapp,
  },
];

export function TopAnnouncementBar() {
  const [current, setCurrent] = useState(0);
  const [copied, setCopied] = useState(false);

  // Fetch settings from database
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  const isBarEnabled = (settings as any)?.announcement_bar_enabled !== false;

  const bgColor = (settings as any)?.announcement_bg_color || "#0f172a";
  const textColor = (settings as any)?.announcement_text_color || "#ffffff";

  // Left banner config
  const leftText = (settings as any)?.announcement_left_text ?? "Pan-India Safe Delivery";
  const leftIconKey = (settings as any)?.announcement_left_icon ?? "truck";
  const leftLink = (settings as any)?.announcement_left_link ?? "";
  const LeftIcon = ICON_MAP[leftIconKey] || Truck;

  // Right banner config (with permanent ++91 fix)
  const rawPhone = (settings as any)?.announcement_support_phone || (settings as any)?.phone || BRAND.phone;
  const formattedPhone = formatPhone(rawPhone);
  const rightText = (settings as any)?.announcement_right_text
    ? (settings as any).announcement_right_text
        .replace(/Support:\s*\++91/gi, "Support: +91")
        .replace(/\+{2,}/g, "+")
    : `Support: ${formattedPhone}`;
  const rightIconKey = (settings as any)?.announcement_right_icon ?? "phone";
  const rightLink = (settings as any)?.announcement_right_link || BRAND.whatsapp;
  const RightIcon = ICON_MAP[rightIconKey] || Phone;

  // Center messages config
  const rawCenterMsgs: BannerMessage[] = Array.isArray((settings as any)?.announcement_center_messages)
    ? (settings as any).announcement_center_messages
    : Array.isArray((settings as any)?.announcement_messages) && (settings as any).announcement_messages.length > 0
    ? (settings as any).announcement_messages
    : DEFAULT_CENTER_MESSAGES;

  const now = new Date();
  const validMessages = rawCenterMsgs.filter((m) => {
    if (!m || !m.text || !m.text.trim()) return false;
    if (m.start_date && new Date(m.start_date) > now) return false;
    if (m.end_date && new Date(m.end_date) < now) return false;
    return true;
  });

  const activeMessages = validMessages.length > 0 ? validMessages : DEFAULT_CENTER_MESSAGES;

  useEffect(() => {
    if (activeMessages.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % activeMessages.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [activeMessages.length]);

  if (!isBarEnabled) return null;

  const activeMsg = activeMessages[current % activeMessages.length] || activeMessages[0];
  const CenterIcon = ICON_MAP[activeMsg.icon || "sparkles"] || Sparkles;

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success(`Coupon code "${code}" copied to clipboard!`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{ backgroundColor: bgColor, color: textColor }}
      className="relative z-50 px-3 py-2 text-xs transition-colors duration-300 shadow-xs"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        {/* Left item (desktop only) */}
        {leftText && (
          <div className="hidden items-center gap-2 opacity-90 md:flex">
            {leftLink ? (
              <a
                href={leftLink}
                className="flex items-center gap-1.5 transition hover:opacity-100"
                target={leftLink.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
              >
                <LeftIcon className="size-3.5 text-secondary shrink-0" />
                <span>{leftText}</span>
              </a>
            ) : (
              <div className="flex items-center gap-1.5">
                <LeftIcon className="size-3.5 text-secondary shrink-0" />
                <span>{leftText}</span>
              </div>
            )}
          </div>
        )}

        {/* Center Rotating Message */}
        <div className="flex flex-1 items-center justify-center gap-2 text-center">
          <CenterIcon className="size-3.5 shrink-0 text-secondary" />
          {activeMsg.link ? (
            <a
              href={activeMsg.link}
              target={activeMsg.link.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className="font-medium hover:underline truncate max-w-[280px] sm:max-w-md md:max-w-lg"
            >
              {activeMsg.text}
            </a>
          ) : (
            <span className="font-medium truncate max-w-[280px] sm:max-w-md md:max-w-lg">
              {activeMsg.text}
            </span>
          )}

          {activeMsg.code && (
            <button
              onClick={() => handleCopyCode(activeMsg.code!)}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 font-mono text-[11px] font-bold text-secondary-foreground shadow-xs transition hover:brightness-110 active:scale-95 shrink-0"
              title="Click to copy code"
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              <span>{activeMsg.code}</span>
            </button>
          )}
        </div>

        {/* Right Help / Phone item (desktop only) */}
        {rightText && (
          <div className="hidden items-center gap-2 opacity-90 md:flex">
            {rightLink ? (
              <a
                href={rightLink}
                target={rightLink.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
                className="flex items-center gap-1.5 transition hover:opacity-100"
              >
                <RightIcon className="size-3.5 text-secondary shrink-0" />
                <span>{rightText}</span>
              </a>
            ) : (
              <div className="flex items-center gap-1.5">
                <RightIcon className="size-3.5 text-secondary shrink-0" />
                <span>{rightText}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
