import { useState, useEffect } from "react";
import { Sparkles, Truck, Phone, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { BRAND } from "@/lib/format";

const MESSAGES = [
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

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % MESSAGES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const msg = MESSAGES[current];
  const Icon = msg.icon;

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
          <span className="line-clamp-1">{msg.text}</span>
          {msg.code && (
            <button
              onClick={() => handleCopyCode(msg.code!)}
              className="inline-flex items-center gap-1 rounded bg-secondary/20 px-1.5 py-0.5 text-[11px] font-bold text-secondary transition hover:bg-secondary hover:text-secondary-foreground"
              title="Click to copy coupon code"
            >
              <span>{msg.code}</span>
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
