import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type AuthCtx = { session: Session | null; user: User | null; ready: boolean; isAdmin: boolean; signOut: () => Promise<void> };
const Ctx = createContext<AuthCtx>({ session: null, user: null, ready: false, isAdmin: false, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const qc = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    // Detect password recovery token in URL hash fragment
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
        router.navigate({ to: "/reset-password", replace: true });
        return;
      }

      if (event === "SIGNED_OUT") {
        try {
          localStorage.removeItem("tt_cart_v1");
          sessionStorage.clear();
        } catch {}
        qc.clear();
        router.invalidate();
        return;
      }

      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        router.invalidate();
        qc.invalidateQueries();
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, [qc, router]);

  const user = session?.user ?? null;
  const { data: isAdmin = false } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user!.id, _role: "admin" });
      return !!data;
    },
  });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    try {
      localStorage.removeItem("tt_cart_v1");
      sessionStorage.clear();
    } catch {}
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  };

  return <Ctx.Provider value={{ session, user, ready, isAdmin: !!user && isAdmin, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
