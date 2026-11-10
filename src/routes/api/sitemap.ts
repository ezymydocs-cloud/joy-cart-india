import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(d?: string | null): string {
  if (!d) return new Date().toISOString().split("T")[0];
  try {
    return new Date(d).toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

export const Route = createFileRoute("/api/sitemap")({
  server: {
    handlers: {
      GET: async () => {
        const baseUrl = process.env["SITE_URL"] || "https://trendytoyz.in";

        // Query active products and active categories only
        const [{ data: prods }, { data: cats }] = await Promise.all([
          supabase
            .from("products")
            .select("slug, updated_at")
            .eq("status", "active")
            .order("updated_at", { ascending: false }),
          supabase
            .from("categories")
            .select("slug, updated_at")
            .eq("is_active", true)
            .order("sort_order", { ascending: true }),
        ]);

        const staticRoutes = [
          { loc: `${baseUrl}/`, priority: "1.0", changefreq: "daily" },
          { loc: `${baseUrl}/products`, priority: "0.9", changefreq: "daily" },
          { loc: `${baseUrl}/categories`, priority: "0.8", changefreq: "weekly" },
          { loc: `${baseUrl}/policies/shipping`, priority: "0.5", changefreq: "monthly" },
          { loc: `${baseUrl}/policies/cancellation-refund`, priority: "0.5", changefreq: "monthly" },
          { loc: `${baseUrl}/policies/privacy`, priority: "0.5", changefreq: "monthly" },
          { loc: `${baseUrl}/policies/terms`, priority: "0.5", changefreq: "monthly" },
        ];

        const today = new Date().toISOString().split("T")[0];

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

        // 1. Static Pages
        for (const r of staticRoutes) {
          xml += `  <url>\n`;
          xml += `    <loc>${escapeXml(r.loc)}</loc>\n`;
          xml += `    <lastmod>${today}</lastmod>\n`;
          xml += `    <changefreq>${r.changefreq}</changefreq>\n`;
          xml += `    <priority>${r.priority}</priority>\n`;
          xml += `  </url>\n`;
        }

        // 2. Active Categories
        if (cats && cats.length > 0) {
          for (const c of cats) {
            xml += `  <url>\n`;
            xml += `    <loc>${escapeXml(`${baseUrl}/category/${c.slug}`)}</loc>\n`;
            xml += `    <lastmod>${formatDate(c.updated_at)}</lastmod>\n`;
            xml += `    <changefreq>weekly</changefreq>\n`;
            xml += `    <priority>0.8</priority>\n`;
            xml += `  </url>\n`;
          }
        }

        // 3. Active Products
        if (prods && prods.length > 0) {
          for (const p of prods) {
            xml += `  <url>\n`;
            xml += `    <loc>${escapeXml(`${baseUrl}/product/${p.slug}`)}</loc>\n`;
            xml += `    <lastmod>${formatDate(p.updated_at)}</lastmod>\n`;
            xml += `    <changefreq>daily</changefreq>\n`;
            xml += `    <priority>0.8</priority>\n`;
            xml += `  </url>\n`;
          }
        }

        xml += `</urlset>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=43200",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
