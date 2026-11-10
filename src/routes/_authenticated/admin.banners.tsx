import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Plus, Image as ImageIcon, Eye, Trash2, Edit2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SingleImageUploader } from "@/components/admin/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/banners")({ component: Banners });

type B = {
  id?: string;
  title: string | null;
  subtitle: string | null;
  desktop_image_url: string | null;
  mobile_image_url: string | null;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
};

const SAMPLE_BANNERS = [
  {
    title: "Cozy Plush & Soft Cuddles",
    subtitle: "Premium, ultra-soft & 100% child-safe teddy bears crafted for joyful hugs",
    desktop_image_url: "/images/teddy.jpg",
    mobile_image_url: "/images/teddy.jpg",
    link_url: "/products",
    sort_order: 1,
    is_active: true,
  },
  {
    title: "Mega Toy Carnival",
    subtitle: "Explore our premium collection of certified child-safe trending toys delivered Pan-India",
    desktop_image_url: "/images/banner.jpg",
    mobile_image_url: "/images/banner.jpg",
    link_url: "/products",
    sort_order: 2,
    is_active: true,
  },
  {
    title: "STEM & Building Blocks",
    subtitle: "Spark your child's creativity and engineering skills with safe building blocks",
    desktop_image_url: "/images/blocks.jpg",
    mobile_image_url: "/images/blocks.jpg",
    link_url: "/products",
    sort_order: 3,
    is_active: true,
  },
];

function Banners() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "banners"],
    queryFn: async () => (await supabase.from("banners").select("*").order("sort_order")).data ?? [],
  });
  const cats = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
  });
  const prods = useQuery({
    queryKey: ["admin", "product-names"],
    queryFn: async () => (await supabase.from("products").select("id,name,slug").order("name")).data ?? [],
  });
  const [edit, setEdit] = useState<B | null>(null);
  const [seeding, setSeeding] = useState(false);

  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      const { error } = await supabase.from("banners").insert(SAMPLE_BANNERS as any);
      if (error) throw error;
      toast.success("Initial clean banners imported into database! You can now manage them below.");
      qc.invalidateQueries({ queryKey: ["admin", "banners"] });
      qc.invalidateQueries({ queryKey: ["banners", "public"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to import banners");
    } finally {
      setSeeding(false);
    }
  };

  const save = async () => {
    if (!edit) return;
    if (!edit.desktop_image_url) return toast.error("Upload or provide a desktop image");
    const payload = {
      ...edit,
      desktop_image_url: edit.desktop_image_url,
      title: edit.title?.trim() || null,
      subtitle: edit.subtitle?.trim() || null,
    };
    const { error } = edit.id
      ? await supabase.from("banners").update(payload).eq("id", edit.id)
      : await supabase.from("banners").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Banner saved successfully!");
    setEdit(null);
    qc.invalidateQueries({ queryKey: ["admin", "banners"] });
    qc.invalidateQueries({ queryKey: ["banners", "public"] });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Homepage Banners</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Manage your homepage carousel banners. Banners listed here are 100% in sync with your live storefront.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {q.data?.length === 0 && (
            <Button
              variant="outline"
              disabled={seeding}
              onClick={handleSeedDefaults}
              className="font-bold gap-1.5 border-secondary/50 text-secondary hover:bg-secondary/10"
            >
              <Sparkles className="size-4" /> {seeding ? "Importing..." : "Import Default Banners"}
            </Button>
          )}
          <Button
            onClick={() =>
              setEdit({
                title: "",
                subtitle: "",
                desktop_image_url: null,
                mobile_image_url: null,
                link_url: "",
                sort_order: (q.data?.length ?? 0) + 1,
                is_active: true,
              })
            }
            className="font-bold gap-1.5 shadow-sm"
          >
            <Plus className="size-4" /> Add Banner
          </Button>
        </div>
      </div>

      {/* Editor Modal / Card */}
      {edit && (
        <div className="grid gap-4 rounded-3xl border bg-card p-5 sm:p-6 shadow-card sm:grid-cols-2">
          <div className="sm:col-span-2 border-b pb-3">
            <h3 className="font-bold text-base text-foreground">
              {edit.id ? "Edit Banner" : "Create New Banner"}
            </h3>
            <p className="text-xs text-muted-foreground">Set headline, subtitle, images and destination link.</p>
          </div>

          <div>
            <Label className="font-bold text-xs">Title / Headline (optional)</Label>
            <Input
              value={edit.title ?? ""}
              onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              placeholder="e.g. Mega Toy Carnival"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="font-bold text-xs">Subtitle / Offer Description (optional)</Label>
            <Input
              value={edit.subtitle ?? ""}
              onChange={(e) => setEdit({ ...edit, subtitle: e.target.value })}
              placeholder="e.g. Certified 100% child-safe toys"
              className="mt-1"
            />
          </div>

          <div className="sm:col-span-1">
            <SingleImageUploader
              bucket="banners"
              label="Desktop Banner Image (~1600×640 px)"
              value={edit.desktop_image_url}
              onChange={(u) => setEdit({ ...edit, desktop_image_url: u })}
            />
          </div>

          <div className="sm:col-span-1">
            <SingleImageUploader
              bucket="banners"
              label="Mobile Banner Image (~800×450 px, optional)"
              value={edit.mobile_image_url}
              onChange={(u) => setEdit({ ...edit, mobile_image_url: u })}
            />
          </div>

          <div>
            <Label className="font-bold text-xs">Link To Destination</Label>
            <Select
              value={edit.link_url || "none"}
              onValueChange={(v) => setEdit({ ...edit, link_url: v === "none" ? null : v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No link</SelectItem>
                <SelectItem value="/products">All Products Page</SelectItem>
                <SelectItem value="/offers">Offers & BOGO Page</SelectItem>
                {cats.data?.map((c) => (
                  <SelectItem key={c.id} value={`/category/${c.slug}`}>
                    Category: {c.name}
                  </SelectItem>
                ))}
                {prods.data?.map((p) => (
                  <SelectItem key={p.id} value={`/product/${p.slug}`}>
                    Product: {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="font-bold text-xs">Sort Order (Lower appears first)</Label>
            <Input
              type="number"
              value={edit.sort_order}
              onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })}
              className="mt-1"
            />
          </div>

          <div className="sm:col-span-2 flex items-center justify-between rounded-xl border bg-muted/20 p-3">
            <div>
              <span className="text-xs font-bold text-foreground">Banner Visibility</span>
              <p className="text-[11px] text-muted-foreground">Toggle to show or hide this banner from customer view.</p>
            </div>
            <Switch
              checked={edit.is_active}
              onCheckedChange={(v) => setEdit({ ...edit, is_active: v })}
            />
          </div>

          <div className="flex gap-2 sm:col-span-2 pt-2">
            <Button onClick={save} className="font-bold">
              Save Banner
            </Button>
            <Button variant="ghost" onClick={() => setEdit(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Banner Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {q.data?.length === 0 && (
          <div className="rounded-3xl border border-dashed bg-card p-12 text-center text-muted-foreground sm:col-span-2 space-y-3">
            <ImageIcon className="size-10 mx-auto opacity-30" />
            <h3 className="font-bold text-foreground text-base">No Banners in Database</h3>
            <p className="text-xs max-w-md mx-auto">
              Your database currently has 0 banners configured. Click "Import Default Banners" to add initial clean store banners, or click "Add Banner" to upload custom photos.
            </p>
            <Button
              variant="outline"
              onClick={handleSeedDefaults}
              disabled={seeding}
              className="font-bold text-xs border-secondary text-secondary"
            >
              <Sparkles className="size-3.5 mr-1" /> Import Default Banners Now
            </Button>
          </div>
        )}

        {q.data?.map((b) => (
          <div key={b.id} className="overflow-hidden rounded-3xl border bg-card shadow-xs transition hover:shadow-hover">
            <div className="relative aspect-[21/9] w-full overflow-hidden bg-muted">
              {b.desktop_image_url ? (
                <img src={b.desktop_image_url} alt="" className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center text-xs text-muted-foreground">
                  No Image
                </div>
              )}
              <span
                className={`absolute top-2.5 right-2.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                  b.is_active ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {b.is_active ? "Active" : "Hidden"}
              </span>
            </div>

            <div className="p-4 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm text-foreground truncate">{b.title || "Untitled Banner"}</h4>
                <p className="text-xs text-muted-foreground truncate">{b.subtitle || "No subtitle"}</p>
                <div className="text-[11px] text-secondary font-medium mt-1">
                  Link: {b.link_url ?? "None"} · Order #{b.sort_order}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Button size="sm" variant="outline" onClick={() => setEdit(b)} className="gap-1 text-xs">
                  <Edit2 className="size-3.5" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive p-2"
                  onClick={async () => {
                    if (!confirm("Are you sure you want to delete this banner?")) return;
                    await supabase.from("banners").delete().eq("id", b.id);
                    qc.invalidateQueries({ queryKey: ["admin", "banners"] });
                    qc.invalidateQueries({ queryKey: ["banners", "public"] });
                    toast.success("Banner deleted");
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
