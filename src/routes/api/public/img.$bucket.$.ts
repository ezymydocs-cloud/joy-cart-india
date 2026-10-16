import { createFileRoute } from "@tanstack/react-router";

const ALLOWED = new Set(["product-images", "banners", "categories"]);

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
          return new Response(null, { status: 302, headers: { Location: "/images/teddy.jpg" } });
        }

        try {
          let client;
          if (process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            client = supabaseAdmin;
          } else {
            const { supabase } = await import("@/integrations/supabase/client");
            client = supabase;
          }

          const { data, error } = await client.storage.from(bucket).download(path);
          if (error || !data) {
            console.error("[img-proxy] Storage download failed for", bucket, path, error?.message || error);
            return new Response(null, { status: 302, headers: { Location: "/images/teddy.jpg" } });
          }

          return new Response(data, {
            headers: {
              "content-type": data.type || "image/jpeg",
              "cache-control": "public, max-age=31536000, immutable",
            },
          });
        } catch (err) {
          console.error("[img-proxy] Error retrieving image:", err);
          return new Response(null, { status: 302, headers: { Location: "/images/teddy.jpg" } });
        }
      },
    },
  },
});
