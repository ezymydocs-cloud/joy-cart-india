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

export const Route = createFileRoute("/_authenticated/admin/categories")({ component: Categories });

type Cat = { id?: string; name: string; slug: string; image_url: string | null; is_active: boolean; sort_order: number };

function Categories() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "categories"], queryFn: async () => (await supabase.from("categories").select("*").order("sort_order")).data ?? [] });
  const [edit, setEdit] = useState<Cat | null>(null);

  const save = async () => {
    if (!edit) return;
    if (edit.name.trim().length < 2) return toast.error("Enter category name");
    const payload = { ...edit, name: edit.name.trim(), slug: slugify(edit.slug || edit.name) };
    const { error } = edit.id ? await supabase.from("categories").update(payload).eq("id", edit.id) : await supabase.from("categories").insert(payload);
    if (error) return toast.error(error.message.includes("slug") ? "A category with this name already exists" : error.message);
    toast.success("Saved");
    setEdit(null);
    qc.invalidateQueries();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl">Categories</h1><Button onClick={() => setEdit({ name: "", slug: "", image_url: null, is_active: true, sort_order: (q.data?.length ?? 0) + 1 })}>+ Add category</Button></div>
      {edit && (
        <div className="grid gap-3 rounded-2xl bg-background p-4 sm:grid-cols-2">
          <div><Label>Name</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
          <div><Label>Sort order</Label><Input type="number" value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })} /></div>
          <SingleImageUploader bucket="categories" label="Image" value={edit.image_url} onChange={(url) => setEdit({ ...edit, image_url: url })} />
          <label className="flex items-center gap-2 text-sm font-bold"><Switch checked={edit.is_active} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} /> Active</label>
          <div className="flex gap-2 sm:col-span-2"><Button onClick={save}>Save</Button><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button></div>
        </div>
      )}
      {q.isLoading ? <div className="h-32 animate-pulse rounded-2xl bg-background" /> : (
        <div className="divide-y rounded-2xl bg-background">
          {q.data?.length === 0 && <p className="p-6 text-center text-muted-foreground">No categories yet.</p>}
          {q.data?.map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-3 text-sm">
              {c.image_url ? <img src={c.image_url} alt="" className="size-12 rounded-lg object-cover" /> : <div className="size-12 rounded-lg bg-muted" />}
              <div className="flex-1"><b>{c.name}</b><div className="text-xs text-muted-foreground">/{c.slug} · order {c.sort_order} · {c.is_active ? "Active" : "Hidden"}</div></div>
              <Button size="sm" variant="outline" onClick={() => setEdit(c)}>Edit</Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => { if (!confirm("Delete category? Products will become uncategorised.")) return; const { error } = await supabase.from("categories").delete().eq("id", c.id); if (error) toast.error(error.message); qc.invalidateQueries(); }}>Delete</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
