import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/format";
import { SingleImageUploader } from "@/components/admin/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/categories")({ component: Categories });

type Cat = {
  id?: string;
  name: string;
  slug: string;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  seo_title?: string | null;
  seo_description?: string | null;
};

function Categories() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
  });
  const [edit, setEdit] = useState<Cat | null>(null);

  const save = async () => {
    if (!edit) return;
    if (edit.name.trim().length < 2) return toast.error("Enter category name");

    const cleanSlug = slugify(edit.slug || edit.name).replace("puzzel-blocks", "puzzle-blocks");
    const basePayload = {
      name: edit.name.trim(),
      slug: cleanSlug,
      image_url: edit.image_url,
      is_active: edit.is_active,
      sort_order: edit.sort_order,
    };

    // Try with full payload including SEO columns
    const fullPayload: Record<string, any> = {
      ...basePayload,
      ...(edit.seo_title ? { seo_title: edit.seo_title.trim() } : {}),
      ...(edit.seo_description ? { seo_description: edit.seo_description.trim() } : {}),
    };

    let { error } = edit.id
      ? await supabase.from("categories").update(fullPayload).eq("id", edit.id)
      : await supabase.from("categories").insert(fullPayload);

    // Graceful fallback if database table doesn't have seo_title / seo_description columns yet
    if (error && error.message.includes("column")) {
      const retry = edit.id
        ? await supabase.from("categories").update(basePayload).eq("id", edit.id)
        : await supabase.from("categories").insert(basePayload);
      error = retry.error;
    }

    if (error) {
      return toast.error(
        error.message.includes("slug")
          ? "A category with this name or slug already exists"
          : error.message
      );
    }

    toast.success("Category saved successfully");
    setEdit(null);
    qc.invalidateQueries();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
        <Button
          onClick={() =>
            setEdit({
              name: "",
              slug: "",
              image_url: null,
              is_active: true,
              sort_order: (q.data?.length ?? 0) + 1,
              seo_title: "",
              seo_description: "",
            })
          }
        >
          + Add category
        </Button>
      </div>

      {edit && (
        <div className="grid gap-4 rounded-2xl bg-background p-5 border border-border/70 shadow-sm sm:grid-cols-2">
          <div>
            <Label className="font-semibold">Category Name</Label>
            <Input
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              className="mt-1"
              placeholder="e.g. Die Cast Models"
            />
          </div>

          <div>
            <Label className="font-semibold">Sort order</Label>
            <Input
              type="number"
              value={edit.sort_order}
              onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })}
              className="mt-1"
            />
          </div>

          <div className="sm:col-span-2">
            <SingleImageUploader
              bucket="categories"
              label="Category Banner / Thumbnail Image"
              value={edit.image_url}
              onChange={(url) => setEdit({ ...edit, image_url: url })}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm font-bold">
              <Switch checked={edit.is_active} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} />
              Category Active on Storefront
            </label>
          </div>

          {/* Category SEO & Storefront Description */}
          <div className="sm:col-span-2 space-y-3 rounded-xl border border-secondary/30 bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-secondary">
                🔍 SEO & Category Storefront Overview
              </h2>
              <span className="text-[11px] text-muted-foreground">Optional</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Add custom Google SEO title and a rich category overview (100–150 words) to boost search engine rankings.
            </p>

            <div>
              <Label className="text-xs">Custom SEO Title</Label>
              <Input
                placeholder={`${edit.name || "Category"} Toys Collection | Buy Online India | TrendyToyz`}
                value={edit.seo_title || ""}
                onChange={(e) => setEdit({ ...edit, seo_title: e.target.value })}
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Leave empty to use automatic title:{" "}
                <span className="font-semibold">{edit.name || "Category"} Toys Collection | Buy Online India | TrendyToyz</span>
              </p>
            </div>

            <div>
              <Label className="text-xs">Category SEO Description (Storefront Overview & Google Snippet, 100–150 words)</Label>
              <Textarea
                rows={4}
                placeholder="Write 100–150 words describing this category, child safety features, age groups, and materials for buyers and Google."
                value={edit.seo_description || ""}
                onChange={(e) => setEdit({ ...edit, seo_description: e.target.value })}
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1 flex justify-between">
                <span>Displays at top of category page under the title for search authority.</span>
                <span>{(edit.seo_description || "").length} characters</span>
              </p>
            </div>
          </div>

          <div className="flex gap-2 sm:col-span-2 pt-2 border-t">
            <Button onClick={save} className="font-bold">
              Save Category
            </Button>
            <Button variant="ghost" onClick={() => setEdit(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {q.isLoading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-background" />
      ) : (
        <div className="divide-y rounded-2xl bg-background border shadow-xs">
          {q.data?.length === 0 && <p className="p-6 text-center text-muted-foreground">No categories yet.</p>}
          {q.data?.map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-3 text-sm">
              {c.image_url ? (
                <img src={c.image_url} alt={`${c.name} category`} className="size-12 rounded-lg object-contain bg-white border p-1" />
              ) : (
                <div className="size-12 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground">Toy</div>
              )}
              <div className="flex-1">
                <div className="font-bold">{c.name}</div>
                <div className="text-xs text-muted-foreground">
                  /{c.slug} · order {c.sort_order} · {c.is_active ? "Active" : "Hidden"}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setEdit(c)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10"
                onClick={async () => {
                  if (!confirm("Delete category? Products will become uncategorised.")) return;
                  const { error } = await supabase.from("categories").delete().eq("id", c.id);
                  if (error) toast.error(error.message);
                  qc.invalidateQueries();
                }}
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
