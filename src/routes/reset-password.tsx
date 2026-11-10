import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a New Password | TrendyToyz" },
      { name: "description", content: "Choose a new secure password for your TrendyToyz account." },
      { property: "og:title", content: "Set a New Password | TrendyToyz" },
      { property: "og:description", content: "Choose a new password for your TrendyToyz account." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const { session, ready } = useAuth();
  const [pw, setPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifiedToken, setVerifiedToken] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    // Check if recovery token is present in hash fragment or session
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash.includes("type=recovery") || hash.includes("access_token")) {
        setVerifiedToken(true);
      }
    }
    if (session?.user) {
      setVerifiedToken(true);
    }
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) {
      return toast.error("Password must be at least 8 characters");
    }
    if (pw !== confirmPw) {
      return toast.error("Passwords do not match");
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;

      // Invalidate recovery session so user cannot automatically browse authenticated
      await supabase.auth.signOut();
      try {
        localStorage.removeItem("tt_cart_v1");
        sessionStorage.clear();
      } catch {}

      toast.success("Password updated successfully! Please log in with your new password.");
      nav({ to: "/auth", replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to reset password. Link may have expired.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Set a new password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choose a strong password with at least 8 characters to secure your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-pw">New Password</Label>
            <Input
              id="new-pw"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Min 8 characters"
              disabled={busy}
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-pw">Confirm New Password</Label>
            <Input
              id="confirm-pw"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="Re-type new password"
              disabled={busy}
              autoComplete="new-password"
            />
          </div>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Updating password…" : "Update Password & Login"}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Remembered your password?{" "}
          <button
            type="button"
            onClick={() => nav({ to: "/auth" })}
            className="font-semibold text-primary underline underline-offset-2"
          >
            Back to login
          </button>
        </p>
      </div>
    </div>
  );
}
