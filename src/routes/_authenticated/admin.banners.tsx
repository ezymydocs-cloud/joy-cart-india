import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SingleImageUploader } from "@/components/admin/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/banners")({ component: Banners });

type B = { id?: string; title: string | null; subtitle: string | null; desktop_image_url: string | null; mobile_image_url: string | null; link_url: string | null; sort_order: number; is_active: boolean };

function Banners() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "banners"], queryFn: async () => (await supabase.from("banners").select("*").order("sort_order")).data ?? [] });
  const cats = useQuery({ queryKey: ["admin", "categories"], queryFn: async () => (await supabase.from("categories").select("*").order("sort_order")).data ?? [] });
  const prods = useQuery({ queryKey: ["admin", "product-names"], queryFn: async () => (await supabase.from("products").select("id,name,slug").order("name")).data ?? [] });
  const [edit, setEdit] = useState<B | null>(null);

  const save = async () => {
    if (!edit) return;
    if (!edit.desktop_image_url) return toast.error("Upload a desktop image");
    const payload = { ...edit, desktop_image_url: edit.desktop_image_url, title: edit.title?.trim() || null, subtitle: edit.subtitle?.trim() || null };
    const { error } = edit.id ? await supabase.from("banners").update(payload).eq("id", edit.id) : await supabase.from("banners").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEdit(null);
    qc.invalidateQueries();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl">Banners</h1><Button onClick={() => setEdit({ title: "", subtitle: "", desktop_image_url: null, mobile_image_url: null, link_url: "", sort_order: (q.data?.length ?? 0) + 1, is_active: true })}>+ Add banner</Button></div>
      {edit && (
        <div className="grid gap-3 rounded-2xl bg-background p-4 sm:grid-cols-2">
          <div><Label>Title (optional)</Label><Input value={edit.title ?? ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
          <div><Label>Subtitle (optional)</Label><Input value={edit.subtitle ?? ""} onChange={(e) => setEdit({ ...edit, subtitle: e.target.value })} /></div>
          <SingleImageUploader bucket="banners" label="Desktop image (wide, ~1600×640)" value={edit.desktop_image_url} onChange={(u) => setEdit({ ...edit, desktop_image_url: u })} />
          <SingleImageUploader bucket="banners" label="Mobile image (~800×450, optional)" value={edit.mobile_image_url} onChange={(u) => setEdit({ ...edit, mobile_image_url: u })} />
          <div><Label>Link to</Label>
            <Select value={edit.link_url || "none"} onValueChange={(v) => setEdit({ ...edit, link_url: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No link</SelectItem>
                <SelectItem value="/products">All products</SelectItem>
                {cats.data?.map((c) => <SelectItem key={c.id} value={`/category/${c.slug}`}>Category: {c.name}</SelectItem>)}
                {prods.data?.map((p) => <SelectItem key={p.id} value={`/product/${p.slug}`}>Product: {p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Sort order</Label><Input type="number" value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })} /></div>
          <label className="flex items-center gap-2 text-sm font-bold"><Switch checked={edit.is_active} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} /> Active</label>
          <div className="flex gap-2 sm:col-span-2"><Button onClick={save}>Save</Button><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button></div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {q.data?.length === 0 && <p className="rounded-2xl bg-background p-6 text-center text-muted-foreground sm:col-span-2">No banners yet.</p>}
        {q.data?.map((b) => (
          <div key={b.id} className="overflow-hidden rounded-2xl bg-background">
            <img src={b.desktop_image_url} alt="" className="aspect-[5/2] w-full object-cover" />
            <div className="flex items-center gap-2 p-3 text-sm">
              <div className="flex-1"><b>{b.title || "Untitled"}</b><div className="text-xs text-muted-foreground">{b.link_url ?? "No link"} · order {b.sort_order} · {b.is_active ? "Active" : "Hidden"}</div></div>
              <Button size="sm" variant="outline" onClick={() => setEdit(b)}>Edit</Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => { if (!confirm("Delete banner?")) return; await supabase.from("banners").delete().eq("id", b.id); qc.invalidateQueries(); }}>Delete</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
