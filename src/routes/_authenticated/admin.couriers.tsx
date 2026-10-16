import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/couriers")({ component: Couriers });

type C = { id?: string; name: string; tracking_url_template: string | null; is_active: boolean; sort_order: number };

function Couriers() {
  const q = useQuery({ queryKey: ["admin", "couriers"], queryFn: async () => (await supabase.from("couriers").select("*").order("sort_order")).data ?? [] });
  const [edit, setEdit] = useState<C | null>(null);
  const save = async () => {
    if (!edit) return;
    if (!edit.name.trim()) return toast.error("Enter courier name");
    const t = edit.tracking_url_template?.trim() || null;
    if (t && (!/^https?:\/\//.test(t))) return toast.error("Tracking URL must start with http(s)://");
    const payload = { ...edit, name: edit.name.trim(), tracking_url_template: t };
    const { error } = edit.id ? await supabase.from("couriers").update(payload).eq("id", edit.id) : await supabase.from("couriers").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Saved"); setEdit(null); q.refetch();
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl">Couriers</h1><Button onClick={() => setEdit({ name: "", tracking_url_template: "", is_active: true, sort_order: (q.data?.length ?? 0) + 1 })}>+ Add courier</Button></div>
      {edit && (
        <div className="grid gap-3 rounded-2xl bg-background p-4 sm:grid-cols-2">
          <div><Label>Name</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
          <div><Label>Sort order</Label><Input type="number" value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })} /></div>
          <div className="sm:col-span-2"><Label>Tracking URL template (optional)</Label><Input placeholder="https://www.dtdc.in/tracking.asp?awb={AWB}" value={edit.tracking_url_template ?? ""} onChange={(e) => setEdit({ ...edit, tracking_url_template: e.target.value })} /><p className="text-xs text-muted-foreground">Use {"{AWB}"} where the tracking number goes. Leave empty to show a copyable AWB only.</p></div>
          <label className="flex items-center gap-2 text-sm font-bold"><Switch checked={edit.is_active} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} /> Active</label>
          <div className="flex gap-2 sm:col-span-2"><Button onClick={save}>Save</Button><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button></div>
        </div>
      )}
      <div className="divide-y rounded-2xl bg-background">
        {q.data?.map((c) => (
          <div key={c.id} className="flex items-center gap-3 p-3 text-sm">
            <div className="min-w-0 flex-1"><b>{c.name}</b><div className="truncate text-xs text-muted-foreground">{c.tracking_url_template || "No tracking link"}</div></div>
            <Switch checked={c.is_active} onCheckedChange={async (v) => { await supabase.from("couriers").update({ is_active: v }).eq("id", c.id); q.refetch(); }} aria-label="Active" />
            <Button size="sm" variant="outline" onClick={() => setEdit(c)}>Edit</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
