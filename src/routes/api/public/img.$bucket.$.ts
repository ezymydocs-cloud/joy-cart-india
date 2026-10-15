import { createFileRoute } from "@tanstack/react-router";

const ALLOWED = new Set(["product-images", "banners", "categories"]);

export const Route = createFileRoute("/api/public/img/$bucket/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const bucket = params.bucket;
        const path = params._splat ?? "";
        if (!ALLOWED.has(bucket) || !path || path.includes("..")) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
        if (error || !data) return new Response("Not found", { status: 404 });
        return new Response(data, {
          headers: {
            "content-type": data.type || "image/jpeg",
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
