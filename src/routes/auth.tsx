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
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: p,
        options: { redirectTo: window.location.origin + "/auth" },
      });
      if (error) toast.error(error.message ?? "Sign in failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This sign-in method is not configured yet");
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <div className="rounded-3xl border bg-card p-6 sm:p-8 shadow-xs">
        <div className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold shadow-xs">
            <span className="text-xl">✨</span>
          </div>
          <div className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground">
            Trendy<span className="text-secondary">Toyz</span>
          </div>
        </div>

        {sent ? (
          <div className="mt-6 text-center">
            <h1 className="text-xl font-bold">Check your email 📬</h1>
            <p className="mt-2 text-xs text-muted-foreground">We sent a confirmation link to {f.email}. Click it to finish creating your account.</p>
          </div>
        ) : (
          <>
            <h1 className="mt-5 text-center text-xl font-bold text-foreground">
              {mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Welcome back!"}
            </h1>
            {redirect?.includes("checkout") && (
              <p className="mt-1 text-center text-xs text-secondary font-semibold">
                Please log in to continue to secure checkout.
              </p>
            )}
            {mode !== "forgot" && (
              <div className="mt-5 grid gap-2">
                <Button variant="outline" className="rounded-xl text-xs font-semibold" onClick={() => social("google")}>
                  Continue with Google
                </Button>
                <Button variant="outline" className="rounded-xl text-xs font-semibold" onClick={() => social("apple")}>
                  Continue with Apple
                </Button>
                <div className="my-2 flex items-center gap-2 text-center text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
                  or use email
                </div>
              </div>
            )}
            <form onSubmit={submit} className="space-y-3.5">
              {mode === "signup" && (
                <>
                  <div>
                    <Label className="text-xs">Full name</Label>
                    <Input className="rounded-xl mt-1" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Mobile number</Label>
                    <Input
                      className="rounded-xl mt-1"
                      required
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="10-digit mobile"
                      value={f.phone}
                      onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, "") })}
                    />
                  </div>
                </>
              )}
              <div>
                <Label className="text-xs">Email address</Label>
                <Input className="rounded-xl mt-1" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
              </div>
              {mode !== "forgot" && (
                <div>
                  <Label className="text-xs">Password</Label>
                  <Input
                    className="rounded-xl mt-1"
                    type="password"
                    required
                    minLength={mode === "signup" ? 8 : 1}
                    value={f.password}
                    onChange={(e) => setF({ ...f, password: e.target.value })}
                  />
                </div>
              )}
              <Button type="submit" size="lg" className="w-full rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/90 font-bold" disabled={busy}>
                {busy ? "Please wait…" : mode === "signup" ? "Create Account" : mode === "forgot" ? "Send Reset Link" : "Sign In"}
              </Button>
            </form>
            <div className="mt-4 space-y-1.5 text-center text-xs">
              {mode === "login" && (
                <div>
                  <button className="text-secondary font-semibold hover:underline" onClick={() => setMode("forgot")}>
                    Forgot password?
                  </button>
                </div>
              )}
              <div className="text-muted-foreground">
                {mode === "signup" ? "Already have an account? " : "New to TrendyToyz? "}
                <button
                  className="font-bold text-foreground hover:text-secondary underline"
                  onClick={() => setMode(mode === "signup" ? "login" : "signup")}
                >
                  {mode === "signup" ? "Login" : "Sign up"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">← Back to shop</Link>
      </p>
    </div>
  );
}
