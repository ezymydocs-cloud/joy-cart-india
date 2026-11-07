import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowRight, Sparkles, Star, ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_SELECT, type Product } from "@/lib/catalog";
import { ProductCard, ProductGridSkeleton } from "@/components/site/ProductCard";
import { useCategories } from "@/components/site/ProductListing";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { TrustSection } from "@/components/site/TrustSection";
import { PromoBannerGrid } from "@/components/site/PromoBannerGrid";
import { FlashSaleSection } from "@/components/site/FlashSaleSection";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TrendyToyz | Premium Toys for Kids Delivered Across India" },
      {
        name: "description",
        content:
          "Discover trending, child-safe, and educational toys at TrendyToyz. Fast delivery across India, Cash on Delivery, and hassle-free returns.",
      },
      { property: "og:title", content: "TrendyToyz | India's Favorite Toy Store" },
      {
        property: "og:description",
        content:
          "Explore soft toys, remote control cars, STEM building blocks, and games at TrendyToyz.",
      },
    ],
  }),
  component: Index,
});

// Default fallback banners when database has none configured yet
const DEFAULT_BANNERS = [
  {
    id: "promo-teddy",
    title: "Cozy Plush & Soft Cuddles",
    subtitle: "Premium, ultra-soft & 100% child-safe teddy bears crafted for joyful hugs and peaceful sleep",
    desktop_image_url: "/images/teddy.jpg",
    mobile_image_url: "/images/teddy.jpg",
    link_url: "/products",
    badge: "COZY BESTSELLER",
  },
  {
    id: "promo-1",
    title: "Mega Toy Carnival",
    subtitle: "Up to 40% OFF on Best-Selling Toys · Extra 10% with code TOYZ10",
    desktop_image_url: "/images/banner.jpg",
    mobile_image_url: "/images/banner.jpg",
    link_url: "/products",
    badge: "FESTIVE SALE",
  },
  {
    id: "promo-2",
    title: "STEM & Building Blocks",
    subtitle: "Spark your child's creativity and engineering skills with safe blocks",
    desktop_image_url: "/images/blocks.jpg",
    mobile_image_url: "/images/blocks.jpg",
    link_url: "/products",
    badge: "TRENDING NOW",
  },
];

function Banners() {
  const { data, isLoading } = useQuery({
    queryKey: ["banners", "public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banners")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const [api, setApi] = useState<CarouselApi>();
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!api) return;
    const on = () => setIdx(api.selectedScrollSnap());
    api.on("select", on);
    const t = setInterval(() => api.scrollNext(), 5500);
    return () => {
      clearInterval(t);
      api.off("select", on);
    };
  }, [api]);

  if (isLoading) {
    return <div className="aspect-[16/9] animate-pulse rounded-3xl bg-muted md:aspect-[21/9]" />;
  }

  const bannersToRender = data && data.length > 0 ? data : DEFAULT_BANNERS;

  return (
    <div className="relative group">
      <Carousel setApi={setApi} opts={{ loop: true }}>
        <CarouselContent>
          {bannersToRender.map((b, i) => {
            const inner = (
              <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-primary/95 text-primary-foreground shadow-card">
                {/* Background image with dual subtle gradient overlay for text legibility */}
                <picture>
                  {b.mobile_image_url && (
                    <source media="(max-width: 767px)" srcSet={b.mobile_image_url} />
                  )}
                  <img
                    src={b.desktop_image_url || "/images/banner.jpg"}
                    alt={b.title ?? "TrendyToyz Promotion"}
                    className="aspect-[16/9] w-full object-cover opacity-85 transition-transform duration-700 md:aspect-[21/9]"
                    width={1600}
                    height={680}
                    loading={i === 0 ? "eager" : "lazy"}
                  />
                </picture>

                <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/70 to-transparent sm:w-2/3" />

                {/* Banner Content Overlay */}
                <div className="absolute inset-y-0 left-0 flex w-full flex-col justify-center p-6 sm:w-3/5 sm:p-10 md:p-14">
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-secondary-foreground shadow-xs">
                    <Sparkles className="size-3" />
                    {"badge" in b ? (b.badge as string) : "SPECIAL PROMO"}
                  </span>

                  {b.title && (
                    <h2 className="mt-3 font-display text-2xl font-bold leading-tight text-white sm:text-4xl md:text-5xl">
                      {b.title}
                    </h2>
                  )}

                  {b.subtitle && (
                    <p className="mt-2 text-xs font-medium text-white/90 sm:text-sm md:text-base max-w-md">
                      {b.subtitle}
                    </p>
                  )}

                  <div className="mt-5 flex items-center gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 px-7 py-3 text-sm font-bold text-white shadow-lg transition-all hover:scale-105 hover:from-orange-600 hover:to-amber-600 hover:gap-2.5">
                      Shop Now <ArrowRight className="size-4" />
                    </span>
                    <span className="hidden sm:inline-flex items-center rounded-full bg-white/15 backdrop-blur-xs border border-white/20 px-5 py-3 text-xs font-semibold text-white transition hover:bg-white/25">
                      View Categories
                    </span>
                  </div>
                </div>
              </div>
            );

            return (
              <CarouselItem key={b.id || i}>
                {b.link_url ? (
                  <Link to={b.link_url.startsWith("/") ? b.link_url : "/products"}>
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>

      {/* Slide Navigation Dots */}
      {bannersToRender.length > 1 && (
        <div className="mt-3.5 flex justify-center gap-2">
          {bannersToRender.map((b, i) => (
            <button
              key={b.id || i}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => api?.scrollTo(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === idx ? "w-8 bg-secondary" : "w-2 bg-border hover:bg-muted-foreground"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductRow({ title, featured }: { title: string; featured?: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ["products", "home", featured ? "featured" : "new"],
    queryFn: async () => {
      let q = supabase.from("products").select(PRODUCT_SELECT).eq("status", "active");
      if (featured) q = q.eq("is_featured", true);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(8);
      if (error) throw error;
      return data as unknown as Product[];
    },
  });

  if (!isLoading && !data?.length) return null;

  return (
    <section className="mt-14">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-secondary">
            {featured ? "Handpicked by TrendyToyz" : "Fresh in Stock"}
          </span>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            {title}
          </h2>
        </div>
        <Link
          to="/products"
          search={featured ? { sort: "popular" } : { sort: "new" }}
          className="inline-flex items-center gap-1 text-xs font-bold text-secondary transition hover:gap-1.5"
        >
          View all <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {isLoading ? (
        <ProductGridSkeleton n={4} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-5 lg:grid-cols-4">
          {data!.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </section>
  );
}

function ParentTestimonials() {
  const reviews = [
    {
      name: "Pooja Sharma",
      location: "Bengaluru",
      rating: 5,
      text: "The building block set arrived in just 2 days. The plastic quality is top-notch, smooth corners, completely safe for my 4-year-old. TrendyToyz is now my go-to gift store!",
    },
    {
      name: "Rohit Verma",
      location: "Mumbai",
      rating: 5,
      text: "Ordered the rechargeable stunt car for my nephew. Works amazingly well on all surfaces and battery life is great. Super satisfied with COD payment and packaging.",
    },
    {
      name: "Ananya Iyer",
      location: "Chennai",
      rating: 5,
      text: "Extremely happy with the customer service on WhatsApp. They helped me pick the right educational puzzle for my daughter. Very trustworthy brand!",
    },
  ];

  return (
    <section className="mt-16 rounded-3xl border bg-card p-6 md:p-10 shadow-xs">
      <div className="text-center max-w-2xl mx-auto">
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-3 py-1 text-xs font-bold text-secondary uppercase tracking-wider">
          <Heart className="size-3 fill-current" /> Loved by Parents
        </span>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          What Parents Across India Say
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Real reviews from parents who choose safe, quality playtime for their children.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
        {reviews.map((r, i) => (
          <div key={i} className="flex flex-col justify-between rounded-2xl border bg-muted/30 p-5">
            <div>
              <div className="flex items-center gap-1 text-amber-500">
                {Array.from({ length: r.rating }).map((_, s) => (
                  <Star key={s} className="size-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-foreground/80 italic">
                "{r.text}"
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border/60">
              <p className="text-xs font-bold text-foreground">{r.name}</p>
              <p className="text-[11px] text-muted-foreground">{r.location}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Index() {
  const cats = useCategories();

  return (
    <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
      {/* Prominent Hero Carousel */}
      <Banners />

      {/* Modern 4-point Trust / USP Section */}
      <TrustSection />

      {/* Category Showcase Section */}
      <section className="mt-14">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-secondary">
              Explore Collections
            </span>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Shop by Category
            </h2>
          </div>
          <Link
            to="/categories"
            className="inline-flex items-center gap-1 text-xs font-bold text-secondary transition hover:gap-1.5"
          >
            All categories <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {cats.isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-2xl bg-muted/60" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-5">
            {cats.data?.map((c) => (
              <Link
                key={c.id}
                to="/category/$slug"
                params={{ slug: c.slug }}
                className="group relative flex flex-col items-center overflow-hidden rounded-2xl border bg-card p-3 text-center transition-all duration-300 hover:-translate-y-1 hover:border-secondary/40 hover:shadow-hover"
              >
                <div className="aspect-square w-full overflow-hidden rounded-xl bg-muted/60">
                  {c.image_url ? (
                    <img
                      src={c.image_url}
                      alt={c.name}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-108"
                      width={300}
                      height={300}
                    />
                  ) : (
                    <div className="grid size-full place-items-center text-3xl">🧸</div>
                  )}
                </div>
                <div className="mt-3 text-sm font-bold text-foreground group-hover:text-secondary transition-colors">
                  {c.name}
                </div>
                <span className="text-[11px] text-muted-foreground mt-0.5">Explore →</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Deal of the Day / Flash Sale Banner */}
      <FlashSaleSection />

      {/* Featured Toys Row */}
      <ProductRow title="Featured Toys" featured />

      {/* 3-Column Split Promotional Tiles */}
      <PromoBannerGrid />

      {/* New Arrivals Row */}
      <ProductRow title="New Arrivals" />

      {/* Social Proof & Customer Reviews */}
      <ParentTestimonials />

      {/* Community / Instagram Promotion Banner */}
      <section className="my-16 overflow-hidden rounded-3xl bg-gradient-to-r from-primary via-primary/95 to-primary p-8 text-center text-primary-foreground shadow-card md:p-12">
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-secondary">
          <Sparkles className="size-3.5" /> Join TrendyToyz Community
        </span>
        <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-4xl text-white">
          Follow @trendy_toyzz on Instagram
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-xs md:text-sm text-primary-foreground/80">
          Tag us in your unboxing videos to get featured and win monthly gift vouchers!
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button
            asChild
            className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-bold px-6"
          >
            <a href="https://instagram.com/trendy_toyzz" target="_blank" rel="noreferrer">
              Follow on Instagram
            </a>
          </Button>
          <Button asChild variant="outline" className="border-white/30 text-white hover:bg-white/10">
            <Link to="/products">Shop Catalog</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
