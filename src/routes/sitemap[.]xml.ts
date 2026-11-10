import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const baseUrl = process.env["SITE_URL"] || "https://trendytoyz.in";
        const now = new Date().toISOString();

        // Fetch products and categories
        const [{ data: prods }, { data: cats }] = await Promise.all([
          supabase.from("products").select("slug, updated_at").eq("status", "active"),
          supabase.from("categories").select("slug, updated_at").eq("is_active", true),
        ]);

        const staticPages = [
          { loc: `${baseUrl}/`, priority: "1.0", changefreq: "daily" },
          { loc: `${baseUrl}/products`, priority: "0.9", changefreq: "daily" },
          { loc: `${baseUrl}/categories`, priority: "0.8", changefreq: "weekly" },
          { loc: `${baseUrl}/policies/shipping`, priority: "0.5", changefreq: "monthly" },
          { loc: `${baseUrl}/policies/cancellation-refund`, priority: "0.5", changefreq: "monthly" },
          { loc: `${baseUrl}/policies/privacy`, priority: "0.4", changefreq: "monthly" },
          { loc: `${baseUrl}/policies/terms`, priority: "0.4", changefreq: "monthly" },
        ];

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

        for (const p of staticPages) {
          xml += `  <url>\n    <loc>${p.loc}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>\n`;
        }

        if (cats) {
          for (const c of cats) {
            xml += `  <url>\n    <loc>${baseUrl}/category/${c.slug}</loc>\n    <lastmod>${c.updated_at || now}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
          }
        }

        if (prods) {
          for (const pr of prods) {
            xml += `  <url>\n    <loc>${baseUrl}/product/${pr.slug}</loc>\n    <lastmod>${pr.updated_at || now}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
          }
        }

        xml += `</urlset>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=86400",
          },
        });
      },
    },
  },
});
