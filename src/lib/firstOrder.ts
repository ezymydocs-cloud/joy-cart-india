import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

export type FirstOrderEligibility = {
  eligible: boolean;
  discount_percent?: number;
  reason?: "not_logged_in" | "not_verified" | "already_ordered" | "already_claimed" | "user_not_found";
  message?: string;
  email?: string;
  phone?: string;
};

/**
 * Normalizes an Indian phone number to 10 digits
 */
export function normalizePhone(raw?: string | null): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/**
 * React Query hook to check server-side First Order 20% discount eligibility
 */
export function useFirstOrderEligibility() {
  const { user } = useAuth();

  return useQuery<FirstOrderEligibility>({
    queryKey: ["first-order-eligibility", user?.id],
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    queryFn: async () => {
      if (!user) {
        return {
          eligible: false,
          reason: "not_logged_in",
          message: "Login & verify to get 20% off your first order.",
        };
      }

      const { data, error } = await supabase.rpc("check_first_order_eligibility");
      if (error) {
        console.warn("[FirstOrder] RPC check failed:", error);
        // Fallback: check if user has verified email or phone
        const isVerified = Boolean(user.email_confirmed_at || user.phone_confirmed_at);
        if (!isVerified) {
          return {
            eligible: false,
            reason: "not_verified",
            email: user.email,
            message: "Please verify your email or phone to activate 20% off your first order.",
          };
        }
        return {
          eligible: false,
          reason: "not_logged_in",
          message: "Could not verify first order eligibility.",
        };
      }

      return data as FirstOrderEligibility;
    },
  });
}
