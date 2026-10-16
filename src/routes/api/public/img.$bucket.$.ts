import { createFileRoute } from "@tanstack/react-router";

const ALLOWED = new Set(["product-images", "banners", "categories"]);
const FALLBACK = "/images/teddy.jpg";

export const Route = createFileRoute("/api/public/img/$bucket/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const bucket = params.bucket;
        const path = params._splat ?? "";
        if (!ALLOWED.has(bucket) || !path || path.includes("..")) {
          return Response.redirect(new URL(FALLBACK, "http://localhost"), 302);
        }
        try {
          let data: Blob | null = null;
          if (process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const res = await supabaseAdmin.storage.from(bucket).download(path);
            data = res.data;
          } else {
            // Fallback: publishable client (works for public buckets / permissive policies)
            const { createClient } = await import("@supabase/supabase-js");
            const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
            const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
            if (url && key) {
              const pub = createClient(url, key, { auth: { persistSession: false } });
              const res = await pub.storage.from(bucket).download(path);
              data = res.data;
            }
          }
          if (!data) return new Response(null, { status: 302, headers: { location: FALLBACK } });
          return new Response(data, {
            headers: {
              "content-type": data.type || "image/jpeg",
              "cache-control": "public, max-age=31536000, immutable",
            },
          });
        } catch {
          return new Response(null, { status: 302, headers: { location: FALLBACK } });
        }
      },
    },
  },
});
