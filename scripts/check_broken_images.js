#!/usr/bin/env node
/**
 * Diagnostic tool to check broken images in Categories and Products
 * Usage: node scripts/check_broken_images.js
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://hhrgtxpupgzjzstfzclw.supabase.co";
const SUPABASE_KEY = "sb_publishable__But7U88H7fh0FtfqiRCHQ_fMCVUrmM";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function resolveUrl(url) {
  if (!url) return null;
  if (url.startsWith("/api/public/img/")) {
    const sub = url.replace(/^\/api\/public\/img\//, "");
    return `https://hhrgtxpupgzjzstfzclw.supabase.co/storage/v1/object/public/${sub}`;
  }
  return url;
}

async function testUrl(url) {
  if (!url) return { ok: false, status: "MISSING" };
  const target = resolveUrl(url);
  try {
    const res = await fetch(target, { method: "HEAD" });
    return { ok: res.ok, status: res.status, url: target };
  } catch (err) {
    return { ok: false, status: err.message, url: target };
  }
}

async function main() {
  console.log("==================================================");
  console.log("TrendyToyz - Image Health & Broken Image Scanner");
  console.log("==================================================\n");

  // 1. Categories
  console.log("Checking Categories...");
  const { data: cats, error: catErr } = await supabase
    .from("categories")
    .select("id, name, slug, image_url, is_active");

  if (catErr) {
    console.error("Error fetching categories:", catErr.message);
  } else {
    let brokenCats = 0;
    for (const c of cats) {
      if (!c.image_url) {
        console.log(`[!] Category '${c.name}' (${c.slug}): Image URL is NULL`);
        brokenCats++;
      } else {
        const check = await testUrl(c.image_url);
        if (!check.ok) {
          console.log(`[X] Category '${c.name}' (${c.slug}): BROKEN (${check.status}) -> ${check.url}`);
          brokenCats++;
        } else {
          console.log(`[✓] Category '${c.name}' (${c.slug}): OK (HTTP ${check.status})`);
        }
      }
    }
    console.log(`Categories checked: ${cats.length}, Issues found: ${brokenCats}\n`);
  }

  // 2. Products
  console.log("Checking Active Products (Top 50)...");
  const { data: prods, error: prodErr } = await supabase
    .from("products")
    .select("id, name, slug, product_images(url)")
    .eq("status", "active")
    .limit(50);

  if (prodErr) {
    console.error("Error fetching products:", prodErr.message);
  } else {
    let brokenProds = 0;
    for (const p of prods) {
      const imgs = p.product_images || [];
      if (imgs.length === 0) {
        console.log(`[!] Product '${p.name}': No images registered`);
        brokenProds++;
      } else {
        const first = imgs[0]?.url;
        const check = await testUrl(first);
        if (!check.ok) {
          console.log(`[X] Product '${p.name}': BROKEN (${check.status}) -> ${check.url}`);
          brokenProds++;
        }
      }
    }
    console.log(`Products checked: ${prods.length}, Issues found: ${brokenProds}\n`);
  }

  console.log("==================================================");
  console.log("Scan Complete!");
  console.log("==================================================");
}

main();
