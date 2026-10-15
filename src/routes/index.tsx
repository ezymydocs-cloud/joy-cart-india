import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Truck, ShieldCheck, Wallet, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_SELECT, type Product } from "@/lib/catalog";
import { ProductCard, ProductGridSkeleton } from "@/components/site/ProductCard";
import { useCategories } from "@/components/site/ProductListing";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TrendyToyz | Trendy Toys for Kids, Delivered Across India" },
      { name: "description", content: "Shop soft toys, cars, building blocks and more at TrendyToyz. Cash on Delivery across India." },
      { property: "og:title", content: "TrendyToyz | Trendy Toys for Kids" },
      { property: "og:description", content: "Soft toys, cars, building blocks and more. Cash on Delivery across India." },
    ],
  }),
  component: Index,
});

function Banners() {
  const { data, isLoading } = useQuery({
    queryKey: ["banners", "public"],
    queryFn: async () => {
      const { data, error } = await supabase.from("banners").select("*").eq("is_active", true).order("sort_order");
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
    const t = setInterval(() => api.scrollNext(), 5000);
    return () => { clearInterval(t); api.off("select", on); };
  }, [api]);

  if (isLoading) return <div className="aspect-[16/9] animate-pulse rounded-3xl bg-muted md:aspect-[5/2]" />;
  if (!data?.length) return null;
  return (
    <div className="relative">
      <Carousel setApi={setApi} opts={{ loop: true }}>
        <CarouselContent>
          {data.map((b, i) => {
            const inner = (
              <div className="relative overflow-hidden rounded-3xl">
                <picture>
                  {b.mobile_image_url && <source media="(max-width: 767px)" srcSet={b.mobile_image_url} />}
                  <img src={b.desktop_image_url} alt={b.title ?? "TrendyToyz"} className="aspect-[16/9] w-full object-cover md:aspect-[5/2]" width={1600} height={640} loading={i === 0 ? "eager" : "lazy"} />
                </picture>
                {(b.title || b.subtitle) && (
                  <div className="absolute inset-y-0 left-0 flex w-3/5 flex-col justify-center p-5 md:p-12">
                    {b.title && <h2 className="text-2xl leading-tight text-primary md:text-5xl">{b.title}</h2>}
                    {b.subtitle && <p className="mt-2 text-sm font-bold text-primary/80 md:text-lg">{b.subtitle}</p>}
                    <span className="mt-4 hidden w-fit rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground md:inline-block">Shop now</span>
                  </div>
                )}
              </div>
            );
            return (
              <CarouselItem key={b.id}>
                {b.link_url ? <a href={b.link_url}>{inner}</a> : inner}
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>
      {data.length > 1 && (
        <div className="mt-3 flex justify-center gap-2">
          {data.map((b, i) => (
            <button key={b.id} aria-label={`Slide ${i + 1}`} onClick={() => api?.scrollTo(i)} className={`h-2.5 rounded-full transition-all ${i === idx ? "w-8 bg-secondary" : "w-2.5 bg-border"}`} />
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
    <section className="mt-12">
      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-2xl md:text-3xl">{title}</h2>
        <Link to="/products" className="text-sm font-bold text-secondary">View all →</Link>
      </div>
      {isLoading ? <ProductGridSkeleton n={4} /> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-5 lg:grid-cols-4">
          {data!.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      )}
    </section>
  );
}

function Index() {
  const cats = useCategories();
  const colors = ["bg-sun-soft", "bg-navy-soft", "bg-accent", "bg-muted"];
  return (
    <div className="mx-auto max-w-7xl px-4 pt-4">
      <Banners />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { i: Wallet, t: "Cash on Delivery" },
          { i: Truck, t: "Pan-India shipping" },
          { i: ShieldCheck, t: "Child-safe toys" },
          { i: Sparkles, t: "New arrivals weekly" },
        ].map(({ i: I, t }) => (
          <div key={t} className="flex items-center gap-2 rounded-2xl bg-navy-soft p-3 text-sm font-bold">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-sun"><I className="size-4 text-primary" /></span>
            {t}
          </div>
        ))}
      </div>

      <section className="mt-12">
        <h2 className="mb-4 text-2xl md:text-3xl">Shop by category</h2>
        {cats.isLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-square animate-pulse rounded-3xl bg-muted" />)}</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {cats.data?.map((c, i) => (
              <Link key={c.id} to="/category/$slug" params={{ slug: c.slug }} className={`group overflow-hidden rounded-3xl ${colors[i % 4]} p-3 text-center transition-transform hover:-translate-y-1`}>
                <div className="aspect-square overflow-hidden rounded-2xl bg-background">
                  {c.image_url && <img src={c.image_url} alt={c.name} loading="lazy" className="size-full object-cover transition-transform group-hover:scale-105" width={300} height={300} />}
                </div>
                <div className="mt-2 font-display text-lg">{c.name}</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <ProductRow title="⭐ Featured toys" featured />
      <ProductRow title="New arrivals" />

      <section className="mt-12 rounded-3xl bg-gradient-sun p-8 text-center">
        <h2 className="text-2xl text-primary md:text-3xl">Follow the fun on Instagram</h2>
        <p className="mt-1 font-bold text-primary/80">@trendy_toyzz</p>
        <Button asChild className="mt-4"><a href="https://instagram.com/trendy_toyzz" target="_blank" rel="noreferrer">Follow us</a></Button>
      </section>
    </div>
  );
}
