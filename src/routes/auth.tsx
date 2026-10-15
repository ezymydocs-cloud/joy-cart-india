import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { PHONE_RE } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Login or Sign up | TrendyToyz" },
      { name: "description", content: "Log in or create your TrendyToyz account to place orders and track them." },
      { property: "og:title", content: "Login or Sign up | TrendyToyz" },
      { property: "og:description", content: "Log in or create your TrendyToyz account." },
    ],
  }),
  component: AuthPage,
});

const safePath = (r?: string) => {
  if (!r) return "/";
  try {
    const u = new URL(r, window.location.origin);
    return u.origin === window.location.origin ? u.pathname + u.search : "/";
  } catch { return "/"; }
};

function AuthPage() {
  const { redirect } = Route.useSearch();
  const { user, ready } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", phone: "", email: "", password: "" });
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (redirect) sessionStorage.setItem("tt_after_login", redirect);
  }, [redirect]);
  useEffect(() => {
    if (ready && user) {
      const r = sessionStorage.getItem("tt_after_login") ?? redirect;
      sessionStorage.removeItem("tt_after_login");
      nav({ to: safePath(r), replace: true });
    }
  }, [ready, user, redirect, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const email = f.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error("Enter a valid email");
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        toast.success("Password reset link sent to your email");
        setMode("login");
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: f.password });
        if (error) throw error;
      } else {
        if (f.name.trim().length < 2) throw new Error("Enter your full name");
        if (!PHONE_RE.test(f.phone)) throw new Error("Enter a valid 10-digit mobile number");
        if (f.password.length < 8) throw new Error("Password must be at least 8 characters");
        const { data, error } = await supabase.auth.signUp({
          email,
          password: f.password,
          options: { emailRedirectTo: window.location.origin + "/auth", data: { full_name: f.name.trim(), phone: f.phone } },
        });
        if (error) throw error;
        if (!data.session) setSent(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const social = async (p: "google" | "apple") => {
    const r = await lovable.auth.signInWithOAuth(p, { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error(r.error.message ?? "Sign in failed");
  };

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="rounded-3xl border-2 p-6 shadow-card">
        <img src="/logo-sm.png" alt="TrendyToyz" className="mx-auto h-24 w-auto" />
        {sent ? (
          <div className="mt-6 text-center">
            <h1 className="text-2xl">Check your email 📬</h1>
            <p className="mt-2 text-sm text-muted-foreground">We sent a confirmation link to {f.email}. Click it to finish creating your account.</p>
          </div>
        ) : (
          <>
            <h1 className="mt-4 text-center text-2xl">{mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset password" : "Welcome back!"}</h1>
            {redirect?.includes("checkout") && <p className="mt-1 text-center text-sm text-muted-foreground">Please log in to place your order.</p>}
            {mode !== "forgot" && (
              <div className="mt-5 grid gap-2">
                <Button variant="outline" onClick={() => social("google")}>Continue with Google</Button>
                <Button variant="outline" onClick={() => social("apple")}> Continue with Apple</Button>
                <div className="my-2 text-center text-xs text-muted-foreground">or use email</div>
              </div>
            )}
            <form onSubmit={submit} className="space-y-3">
              {mode === "signup" && (
                <>
                  <div><Label>Full name</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
                  <div><Label>Mobile number</Label><Input required inputMode="numeric" maxLength={10} placeholder="10-digit number" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, "") })} /></div>
                </>
              )}
              <div><Label>Email</Label><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
              {mode !== "forgot" && <div><Label>Password</Label><Input type="password" required minLength={mode === "signup" ? 8 : 1} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>}
              <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Sign up" : mode === "forgot" ? "Send reset link" : "Login"}</Button>
            </form>
            <div className="mt-4 space-y-1 text-center text-sm">
              {mode === "login" && <button className="text-secondary" onClick={() => setMode("forgot")}>Forgot password?</button>}
              <div>
                {mode === "signup" ? "Already have an account? " : "New to TrendyToyz? "}
                <button className="font-bold text-primary underline" onClick={() => setMode(mode === "signup" ? "login" : "signup")}>{mode === "signup" ? "Login" : "Sign up"}</button>
              </div>
            </div>
          </>
        )}
      </div>
      <p className="mt-4 text-center text-sm"><Link to="/" className="text-muted-foreground">← Back to shop</Link></p>
    </div>
  );
}
