import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PHONE_RE, addressLines } from "@/lib/format";
import { AddressForm, type AddressRow } from "@/components/site/AddressForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "My Account | TrendyToyz" },
      { name: "description", content: "Manage your TrendyToyz profile and saved addresses." },
      { property: "og:title", content: "My Account | TrendyToyz" },
      { property: "og:description", content: "Manage your TrendyToyz profile and addresses." },
    ],
  }),
  component: Account,
});

function Account() {
  const { user } = useAuth();
  const prof = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });
  const addrs = useQuery({
    queryKey: ["addresses", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", user!.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AddressRow[];
    },
  });
  const [p, setP] = useState({ full_name: "", phone: "" });
  const [editing, setEditing] = useState<string | "new" | null>(null);
  useEffect(() => { if (prof.data) setP({ full_name: prof.data.full_name ?? "", phone: prof.data.phone ?? "" }); }, [prof.data]);

  const saveProfile = async () => {
    if (p.phone && !PHONE_RE.test(p.phone)) return toast.error("Enter a valid 10-digit mobile number");
    const { error } = await supabase.from("profiles").upsert({ id: user!.id, full_name: p.full_name.trim(), phone: p.phone, email: user!.email });
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-6">
      <div className="flex items-center justify-between"><h1 className="text-3xl">My account</h1><Button asChild variant="outline"><Link to="/orders">My orders</Link></Button></div>
      <section className="space-y-3 rounded-2xl border p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl">Profile</h2>
          {user?.email_confirmed_at || user?.phone_confirmed_at ? (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              ✓ Verified Identity
            </span>
          ) : (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">
              Unverified
            </span>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Full name</Label><Input value={p.full_name} onChange={(e) => setP({ ...p, full_name: e.target.value })} /></div>
          <div><Label>Mobile number</Label><Input inputMode="numeric" maxLength={10} value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value.replace(/\D/g, "") })} /></div>
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between">
              <Label>Email</Label>
              {!user?.email_confirmed_at && user?.email && (
                <button
                  type="button"
                  className="text-xs font-semibold text-secondary hover:underline"
                  onClick={async () => {
                    const { error } = await supabase.auth.resend({ type: "signup", email: user.email! });
                    if (error) toast.error(error.message);
                    else toast.success("Verification link sent to " + user.email);
                  }}
                >
                  Send verification email
                </button>
              )}
            </div>
            <Input value={user?.email ?? ""} disabled className="mt-1" />
          </div>
        </div>
        <Button onClick={saveProfile}>Save profile</Button>
      </section>
      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-xl">Saved addresses</h2>{editing === null && <Button variant="outline" onClick={() => setEditing("new")}>+ Add address</Button>}</div>
        {editing === "new" && <AddressForm userId={user!.id} makeDefault={!addrs.data?.length} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); addrs.refetch(); }} />}
        {addrs.isLoading ? <div className="h-20 animate-pulse rounded-2xl bg-muted" /> : !addrs.data?.length && editing !== "new" ? <p className="text-sm text-muted-foreground">No saved addresses yet.</p> : null}
        {addrs.data?.map((a) => editing === a.id ? (
          <AddressForm key={a.id} userId={user!.id} initial={a} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); addrs.refetch(); }} />
        ) : (
          <div key={a.id} className="rounded-2xl border p-4 text-sm">
            <div className="flex items-center gap-2 font-bold">{a.full_name} · {a.phone}{a.is_default && <span className="rounded-full bg-sun-soft px-2 text-xs text-secondary">Default</span>}</div>
            <div className="text-muted-foreground">{addressLines(a).join(", ")}</div>
            <div className="mt-2 flex gap-3">
              <button className="font-bold text-primary" onClick={() => setEditing(a.id)}>Edit</button>
              {!a.is_default && <button className="font-bold text-primary" onClick={async () => { const { error } = await supabase.rpc("set_default_address", { p_id: a.id }); if (error) toast.error(error.message); else addrs.refetch(); }}>Set as default</button>}
              <button className="font-bold text-destructive" onClick={async () => { if (!confirm("Delete this address?")) return; const { error } = await supabase.from("addresses").delete().eq("id", a.id); if (error) toast.error(error.message); else addrs.refetch(); }}>Delete</button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
