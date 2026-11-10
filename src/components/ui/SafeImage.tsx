import { useState, useEffect } from "react";
import { resolveImageUrl, DEFAULT_PRODUCT_FALLBACK } from "@/lib/images";

export interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
  categorySlug?: string;
  aspectRatioClass?: string;
  containerClassName?: string;
  maxRetries?: number;
}

export function SafeImage({
  src,
  alt,
  fallbackSrc = DEFAULT_PRODUCT_FALLBACK,
  categorySlug,
  className = "",
  containerClassName = "",
  aspectRatioClass = "aspect-square",
  maxRetries = 2,
  loading = "lazy",
  width,
  height,
  ...props
}: SafeImageProps) {
  const initialResolved = resolveImageUrl(src, categorySlug);
  const [currentSrc, setCurrentSrc] = useState<string>(initialResolved);
  const [retries, setRetries] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const resolved = resolveImageUrl(src, categorySlug);
    setCurrentSrc(resolved);
    setRetries(0);
    setLoaded(false);
    setFailed(false);
  }, [src, categorySlug]);

  const handleError = () => {
    if (retries < maxRetries) {
      const nextAttempt = retries + 1;
      setRetries(nextAttempt);
      // Append cache buster parameter to retry
      const sep = currentSrc.includes("?") ? "&" : "?";
      const cleanSrc = currentSrc.replace(/[?&]retry=\d+/, "");
      setCurrentSrc(`${cleanSrc}${sep}retry=${nextAttempt}`);
    } else {
      if (currentSrc !== fallbackSrc) {
        setCurrentSrc(fallbackSrc);
      } else {
        setFailed(true);
      }
    }
  };

  return (
    <div
      className={`relative overflow-hidden bg-white flex items-center justify-center select-none ${aspectRatioClass} ${containerClassName}`}
    >
      {/* Loading Skeleton */}
      {!loaded && !failed && (
        <div className="absolute inset-0 animate-pulse bg-muted/40 z-0" />
      )}

      {/* Fallback SVG if image completely fails */}
      {failed ? (
        <div className="flex flex-col items-center justify-center p-4 text-center text-muted-foreground z-10">
          <span className="text-3xl">🧸</span>
          <span className="mt-1 text-[10px] font-bold uppercase tracking-wider line-clamp-1">
            {alt || "TrendyToyz"}
          </span>
        </div>
      ) : (
        <img
          src={currentSrc}
          alt={alt || "Product image"}
          loading={loading}
          decoding="async"
          width={width}
          height={height}
          onLoad={() => setLoaded(true)}
          onError={handleError}
          className={`size-full object-contain transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          } ${className}`}
          {...props}
        />
      )}
    </div>
  );
}
