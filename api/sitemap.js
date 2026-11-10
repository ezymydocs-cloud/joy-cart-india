/**
 * Vercel Serverless Function: /api/sitemap
 * Dynamically generates full XML sitemap from Supabase database
 * Includes static pages, all active categories, and all active products
 */

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://hhrgtxpupgzjzstfzclw.supabase.co";

const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable__But7U88H7fh0FtfqiRCHQ_fMCVUrmM";

const BASE_URL = process.env.SITE_URL || "https://trendytoyz.in";

function escapeXml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(d) {
  if (!d) return new Date().toISOString().split("T")[0];
  try {
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) {
      return new Date().toISOString().split("T")[0];
    }
    return parsed.toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

/**
 * Fetch all active categories with pagination support
 */
async function fetchAllCategories(headers) {
  const allCategories = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/categories?is_active=eq.true&select=slug,created_at&order=sort_order.asc&limit=${pageSize}&offset=${offset}`,
      { headers }
    );
    if (!res.ok) {
      console.error("[sitemap] Failed categories fetch at offset", offset, res.status, await res.text());
      break;
    }
    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) {
      break;
    }
    allCategories.push(...page);
    if (page.length < pageSize) {
      hasMore = false;
    } else {
      offset += pageSize;
    }
  }

  return allCategories;
}

/**
 * Fetch all active products with pagination support
 */
async function fetchAllProducts(headers) {
  const allProducts = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/products?status=eq.active&select=slug,updated_at,created_at&order=updated_at.desc&limit=${pageSize}&offset=${offset}`,
      { headers }
    );
    if (!res.ok) {
      console.error("[sitemap] Failed products fetch at offset", offset, res.status, await res.text());
      break;
    }
    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) {
      break;
    }
    allProducts.push(...page);
    if (page.length < pageSize) {
      hasMore = false;
    } else {
      offset += pageSize;
    }
  }

  return allProducts;
}

export default async function handler(req, res) {
  // Set required headers
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const today = new Date().toISOString().split("T")[0];

  const staticRoutes = [
    { loc: `${BASE_URL}/`, priority: "1.0", changefreq: "daily", lastmod: today },
    { loc: `${BASE_URL}/products`, priority: "0.9", changefreq: "daily", lastmod: today },
    { loc: `${BASE_URL}/categories`, priority: "0.8", changefreq: "weekly", lastmod: today },
    { loc: `${BASE_URL}/policies/shipping`, priority: "0.5", changefreq: "monthly", lastmod: today },
    { loc: `${BASE_URL}/policies/cancellation-refund`, priority: "0.5", changefreq: "monthly", lastmod: today },
    { loc: `${BASE_URL}/policies/privacy`, priority: "0.5", changefreq: "monthly", lastmod: today },
    { loc: `${BASE_URL}/policies/terms`, priority: "0.5", changefreq: "monthly", lastmod: today },
  ];

  try {
    const headers = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    };

    const [categories, products] = await Promise.all([
      fetchAllCategories(headers),
      fetchAllProducts(headers),
    ]);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

    // 1. Static Pages
    for (const r of staticRoutes) {
      xml += `  <url>\n    <loc>${escapeXml(r.loc)}</loc>\n    <lastmod>${r.lastmod}</lastmod>\n    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>\n`;
    }

    // 2. Active Categories
    for (const c of categories) {
      if (!c.slug) continue;
      const mod = formatDate(c.created_at || today);
      xml += `  <url>\n    <loc>${escapeXml(`${BASE_URL}/category/${c.slug}`)}</loc>\n    <lastmod>${mod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    }

    // 3. Active Products
    for (const p of products) {
      if (!p.slug) continue;
      const mod = formatDate(p.updated_at || p.created_at || today);
      xml += `  <url>\n    <loc>${escapeXml(`${BASE_URL}/product/${p.slug}`)}</loc>\n    <lastmod>${mod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    }

    xml += `</urlset>`;

    return res.status(200).send(xml);
  } catch (err) {
    console.error("[sitemap-generation-error]", err);

    // Fail-safe: Always return valid XML with static pages rather than 500 error
    let fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    fallbackXml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    for (const r of staticRoutes) {
      fallbackXml += `  <url>\n    <loc>${escapeXml(r.loc)}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${r.priority}</priority>\n  </url>\n`;
    }
    fallbackXml += `</urlset>`;

    return res.status(200).send(fallbackXml);
  }
}
