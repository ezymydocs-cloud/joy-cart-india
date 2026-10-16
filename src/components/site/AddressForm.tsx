import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PHONE_RE, PINCODE_RE } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AddressRow = {
  id: string; full_name: string; phone: string; line1: string; line2: string | null; landmark: string | null;
  city: string; state: string; pincode: string; is_default: boolean;
};

const empty = { full_name: "", phone: "", line1: "", line2: "", landmark: "", city: "", state: "", pincode: "" };

export function AddressForm({ userId, initial, onSaved, onCancel, makeDefault }: { userId: string; initial?: AddressRow; onSaved: (id: string) => void; onCancel?: () => void; makeDefault?: boolean }) {
  const [f, setF] = useState({ ...empty, ...(initial ? { ...initial, line2: initial.line2 ?? "", landmark: initial.landmark ?? "" } : {}) });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (f.full_name.trim().length < 2) er.full_name = "Enter full name";
    if (!PHONE_RE.test(f.phone)) er.phone = "Enter a valid 10-digit mobile number";
    if (f.line1.trim().length < 3) er.line1 = "Enter house / street";
    if (!f.city.trim()) er.city = "Enter city";
    if (!f.state.trim()) er.state = "Enter state";
    if (!PINCODE_RE.test(f.pincode)) er.pincode = "Enter a valid 6-digit pincode";
    setErr(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    const payload = {
      full_name: f.full_name.trim(), phone: f.phone, line1: f.line1.trim(), line2: f.line2.trim() || null, landmark: f.landmark.trim() || null,
      city: f.city.trim(), state: f.state.trim(), pincode: f.pincode,
    };
    const res = initial
      ? await supabase.from("addresses").update(payload).eq("id", initial.id).select("id").single()
      : await supabase.from("addresses").insert({ ...payload, user_id: userId, is_default: !!makeDefault }).select("id").single();
    setBusy(false);
    if (res.error) return toast.error(res.error.message);
    toast.success("Address saved");
    onSaved(res.data.id);
  };

  const field = (k: keyof typeof empty, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={f[k]} onChange={set(k)} {...props} />
      {err[k] && <p className="mt-0.5 text-xs text-destructive">{err[k]}</p>}
    </div>
  );

  return (
    <form onSubmit={save} className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-2">
      {field("full_name", "Full name")}
      <div>
        <Label className="text-xs">Mobile number</Label>
        <Input inputMode="numeric" maxLength={10} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, "") })} />
        {err.phone && <p className="mt-0.5 text-xs text-destructive">{err.phone}</p>}
      </div>
      <div className="sm:col-span-2">{field("line1", "House no., building, street")}</div>
      {field("line2", "Area / locality (optional)")}
      {field("landmark", "Landmark (optional)")}
      {field("city", "City")}
      {field("state", "State")}
      <div>
        <Label className="text-xs">Pincode</Label>
        <Input inputMode="numeric" maxLength={6} value={f.pincode} onChange={(e) => setF({ ...f, pincode: e.target.value.replace(/\D/g, "") })} />
        {err.pincode && <p className="mt-0.5 text-xs text-destructive">{err.pincode}</p>}
      </div>
      <div className="flex items-end gap-2 sm:col-span-2">
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save address"}</Button>
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}
