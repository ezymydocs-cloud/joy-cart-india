/**
 * Vercel Serverless Function: /api/sitemap
 * Dynamically generates sitemap.xml directly from Supabase database
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://hhrgtxpupgzjzstfzclw.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable__But7U88H7fh0FtfqiRCHQ_fMCVUrmM";
const BASE_URL = process.env.SITE_URL || "https://trendytoyz.in";

function escapeXml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(d) {
  if (!d) return new Date().toISOString().split("T")[0];
  try {
    return new Date(d).toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

export default async function handler(req, res) {
  try {
    // 1. Fetch active categories & active products directly via Supabase REST
    const headers = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    };

    const [catRes, prodRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/categories?is_active=eq.true&select=slug,updated_at&order=sort_order.asc`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/products?status=eq.active&select=slug,updated_at&order=updated_at.desc`, { headers }),
    ]);

    const cats = catRes.ok ? await catRes.json() : [];
    const prods = prodRes.ok ? await prodRes.json() : [];

    const today = new Date().toISOString().split("T")[0];

    const staticRoutes = [
      { loc: `${BASE_URL}/`, priority: "1.0", changefreq: "daily" },
      { loc: `${BASE_URL}/products`, priority: "0.9", changefreq: "daily" },
      { loc: `${BASE_URL}/categories`, priority: "0.8", changefreq: "weekly" },
      { loc: `${BASE_URL}/policies/shipping`, priority: "0.5", changefreq: "monthly" },
      { loc: `${BASE_URL}/policies/cancellation-refund`, priority: "0.5", changefreq: "monthly" },
      { loc: `${BASE_URL}/policies/privacy`, priority: "0.5", changefreq: "monthly" },
      { loc: `${BASE_URL}/policies/terms`, priority: "0.5", changefreq: "monthly" },
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

    // Static Pages
    for (const r of staticRoutes) {
      xml += `  <url>\n    <loc>${escapeXml(r.loc)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>\n`;
    }

    // Active Categories
    for (const c of cats) {
      xml += `  <url>\n    <loc>${escapeXml(`${BASE_URL}/category/${c.slug}`)}</loc>\n    <lastmod>${formatDate(c.updated_at)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    }

    // Active Products (exclude admin, cart, checkout, orders, inactive)
    for (const p of prods) {
      xml += `  <url>\n    <loc>${escapeXml(`${BASE_URL}/product/${p.slug}`)}</loc>\n    <lastmod>${formatDate(p.updated_at)}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    }

    xml += `</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=43200");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(xml);
  } catch (err) {
    console.error("[sitemap-error]", err);
    // Fallback minimal valid XML so search engine crawler never gets a 500 error
    const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${BASE_URL}/</loc><priority>1.0</priority></url>\n  <url><loc>${BASE_URL}/products</loc><priority>0.9</priority></url>\n  <url><loc>${BASE_URL}/categories</loc><priority>0.8</priority></url>\n</urlset>`;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    return res.status(200).send(fallbackXml);
  }
}
