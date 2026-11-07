import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { payWithRazorpayStandard, type VerifyPaymentResponse } from "@/lib/razorpay";

interface RazorpayButtonProps {
  amountInPaise: number; // e.g. 49900 for ₹499.00
  label?: string;
  className?: string;
  receipt?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: Record<string, string>;
  onSuccess?: (verifyResult: VerifyPaymentResponse) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
}

export function RazorpayButton({
  amountInPaise,
  label,
  className,
  receipt,
  customerName,
  customerEmail,
  customerPhone,
  notes,
  onSuccess,
  onError,
  disabled = false,
}: RazorpayButtonProps) {
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    if (loading || disabled) return;
    setLoading(true);

    try {
      await payWithRazorpayStandard({
        amountInPaise,
        receipt,
        customerName,
        customerEmail,
        customerPhone,
        notes,
        onSuccess: (res) => {
          setLoading(false);
          onSuccess?.(res);
        },
        onError: (err) => {
          setLoading(false);
          onError?.(err);
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const amountDisplay = (amountInPaise / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
  });

  return (
    <Button
      type="button"
      onClick={handlePay}
      disabled={disabled || loading}
      className={
        className ||
        "bg-secondary font-bold text-secondary-foreground hover:bg-secondary/90 transition-all shadow-sm"
      }
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 size-4 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <CreditCard className="mr-2 size-4" />
          {label || `Pay ${amountDisplay} with Razorpay`}
        </>
      )}
    </Button>
  );
}
