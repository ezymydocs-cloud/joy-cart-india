import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/coupons")({
  head: () => ({ meta: [{ title: "Coupons | TrendyToyz Admin" }] }),
  component: Coupons,
});

type C = {
  id?: string; code: string; description: string | null; discount_type: string; discount_value: number;
  min_order: number; max_discount: number | null; usage_limit: number | null; used_count?: number;
  expires_at: string | null; is_active: boolean;
};

const blank: C = { code: "", description: "", discount_type: "percent", discount_value: 10, min_order: 0, max_discount: null, usage_limit: null, expires_at: null, is_active: true };

function Coupons() {
  const q = useQuery({ queryKey: ["admin", "coupons"], queryFn: async () => (await supabase.from("coupons").select("*").order("created_at", { ascending: false })).data ?? [] });
  const [edit, setEdit] = useState<C | null>(null);
  const save = async () => {
    if (!edit) return;
    const code = edit.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return toast.error("Code: 3-30 letters/numbers, no spaces");
    if (!(edit.discount_value > 0)) return toast.error("Enter a discount value");
    if (edit.discount_type === "percent" && edit.discount_value > 100) return toast.error("Percent can't exceed 100");
    const { used_count: _u, ...rest } = edit;
    const payload = { ...rest, code, description: edit.description?.trim() || null };
    const { error } = edit.id ? await supabase.from("coupons").update(payload).eq("id", edit.id) : await supabase.from("coupons").insert(payload);
    if (error) return toast.error(error.message.includes("duplicate") ? "This code already exists" : error.message);
    toast.success("Saved"); setEdit(null); q.refetch();
  };
  const num = (v: string) => (v === "" ? null : Number(v));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl">Coupons</h1><Button onClick={() => setEdit({ ...blank })}>+ Add coupon</Button></div>
      {edit && (
        <div className="grid gap-3 rounded-2xl bg-background p-4 sm:grid-cols-2">
          <div><Label>Code</Label><Input value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} placeholder="DIWALI10" /></div>
          <div><Label>Description (optional)</Label><Input value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
          <div><Label>Type</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={edit.discount_type} onChange={(e) => setEdit({ ...edit, discount_type: e.target.value })}>
              <option value="percent">Percent (%)</option><option value="flat">Flat (₹)</option>
            </select></div>
          <div><Label>Discount value</Label><Input type="number" min={1} value={edit.discount_value} onChange={(e) => setEdit({ ...edit, discount_value: Number(e.target.value) })} /></div>
          <div><Label>Minimum order (₹)</Label><Input type="number" min={0} value={edit.min_order} onChange={(e) => setEdit({ ...edit, min_order: Number(e.target.value) })} /></div>
          <div><Label>Max discount (₹, optional)</Label><Input type="number" min={0} value={edit.max_discount ?? ""} onChange={(e) => setEdit({ ...edit, max_discount: num(e.target.value) })} /></div>
          <div><Label>Total uses allowed (optional)</Label><Input type="number" min={1} value={edit.usage_limit ?? ""} onChange={(e) => setEdit({ ...edit, usage_limit: num(e.target.value) })} /></div>
          <div><Label>Expires on (optional)</Label><Input type="date" value={edit.expires_at?.slice(0, 10) ?? ""} onChange={(e) => setEdit({ ...edit, expires_at: e.target.value ? `${e.target.value}T23:59:59+05:30` : null })} /></div>
          <label className="flex items-center gap-2 text-sm font-bold"><Switch checked={edit.is_active} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} /> Active</label>
          <div className="flex gap-2 sm:col-span-2"><Button onClick={save}>Save</Button><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button></div>
        </div>
      )}
      <div className="divide-y rounded-2xl bg-background">
        {q.isLoading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
        {q.data?.length === 0 && <div className="p-4 text-sm text-muted-foreground">No coupons yet.</div>}
        {q.data?.map((c) => (
          <div key={c.id} className="flex items-center gap-3 p-3 text-sm">
            <div className="min-w-0 flex-1">
              <b className="font-mono">{c.code}</b> · {c.discount_type === "percent" ? `${Number(c.discount_value)}% off` : `${inr(c.discount_value)} off`}
              <div className="text-xs text-muted-foreground">
                {Number(c.min_order) > 0 && `Min ${inr(c.min_order)} · `}
                Used {c.used_count}{c.usage_limit ? `/${c.usage_limit}` : ""}
                {c.expires_at && ` · Expires ${new Date(c.expires_at).toLocaleDateString("en-IN")}`}
              </div>
            </div>
            <Switch checked={c.is_active} onCheckedChange={async (v) => { await supabase.from("coupons").update({ is_active: v }).eq("id", c.id); q.refetch(); }} aria-label="Active" />
            <Button size="sm" variant="outline" onClick={() => setEdit(c as C)}>Edit</Button>
            <Button size="sm" variant="ghost" onClick={async () => { if (!confirm(`Delete ${c.code}?`)) return; await supabase.from("coupons").delete().eq("id", c.id); q.refetch(); }}>Delete</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
