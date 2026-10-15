import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a New Password | TrendyToyz" },
      { name: "description", content: "Choose a new password for your TrendyToyz account." },
      { property: "og:title", content: "Set a New Password | TrendyToyz" },
      { property: "og:description", content: "Choose a new password for your TrendyToyz account." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <form
        className="space-y-3 rounded-3xl border-2 p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          if (pw.length < 8) return toast.error("Password must be at least 8 characters");
          setBusy(true);
          const { error } = await supabase.auth.updateUser({ password: pw });
          setBusy(false);
          if (error) return toast.error(error.message);
          toast.success("Password updated");
          nav({ to: "/" });
        }}
      >
        <h1 className="text-2xl">Set a new password</h1>
        <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (min 8 characters)" />
        <Button className="w-full" disabled={busy}>{busy ? "Saving…" : "Update password"}</Button>
      </form>
    </div>
  );
}
