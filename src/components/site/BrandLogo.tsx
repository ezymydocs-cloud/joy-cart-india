import { useState } from "react";

export function BrandLogo({
  className = "h-9 sm:h-11 w-auto",
  alt = "TrendyToyz",
  variant = "header",
}: {
  className?: string;
  alt?: string;
  variant?: "header" | "footer";
}) {
  const [useTextFallback, setUseTextFallback] = useState(false);
  const [imgSrc, setImgSrc] = useState("/logo.svg");

  if (useTextFallback) {
    return (
      <div className="flex items-center gap-1.5 select-none py-1">
        <span className="font-display text-xl sm:text-2xl font-black tracking-tight leading-none">
          <span className={variant === "footer" ? "text-white" : "text-primary"}>Trendy</span>
          <span className="text-secondary">Toyz</span>
        </span>
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      onError={() => {
        if (imgSrc === "/logo.svg") {
          // Try PNG if SVG fails
          setImgSrc("/logo.png");
        } else {
          // Fallback to text logo if image fails
          setUseTextFallback(true);
        }
      }}
    />
  );
}
