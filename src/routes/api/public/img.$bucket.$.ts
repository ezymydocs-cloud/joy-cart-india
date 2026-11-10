import { createFileRoute } from "@tanstack/react-router";

const ALLOWED = new Set(["product-images", "banners", "categories"]);
const SUPABASE_STORAGE_BASE = "https://hhrgtxpupgzjzstfzclw.supabase.co/storage/v1/object/public";
const FALLBACK = "/images/teddy.jpg";

export const Route = createFileRoute("/api/public/img/$bucket/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const bucket = params.bucket;
        let path = params._splat ?? "";
        try {
          path = decodeURIComponent(path).replace(/^\/+/, "");
        } catch {
          path = path.replace(/^\/+/, "");
        }

        if (!ALLOWED.has(bucket) || !path || path.includes("..")) {
          return new Response(null, { status: 302, headers: { Location: FALLBACK } });
        }

        // Direct fast redirect to Supabase Public CDN URL
        // Bypasses Node.js buffer limitations and streaming socket termination
        const cdnUrl = `${SUPABASE_STORAGE_BASE}/${bucket}/${path}`;
        return new Response(null, {
          status: 302,
          headers: {
            Location: cdnUrl,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
