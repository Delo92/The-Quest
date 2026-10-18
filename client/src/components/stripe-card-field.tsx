import { useEffect, useRef, useState } from "react";
import { loadStripeScript, type StripeCardHandle } from "@/lib/buyer-payment";
import { logClientError } from "@/lib/client-error-logger";

/** Stripe owns the iframe; card numbers and CVC never enter Quest's state. */
export function StripeCardField({ publishableKey, onChange }: {
  publishableKey: string;
  onChange: (handle: StripeCardHandle | null) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    let card: StripeCardHandle["card"] | undefined;
    const lastReportedError = { current: "" };
    const showFieldError = (message: string, cause?: unknown) => {
      setError(message);
      if (!message) {
        lastReportedError.current = "";
        return;
      }
      if (lastReportedError.current === message) return;
      lastReportedError.current = message;
      const stripeCode = cause && typeof cause === "object" && "code" in cause
        && typeof cause.code === "string"
        ? cause.code
        : undefined;
      void logClientError({
        errorType: "payment",
        severity: "warning",
        message: `Payment card field error: ${message}`,
        error: cause,
        stackTrace: cause && typeof cause === "object" && "stack" in cause
          && typeof cause.stack === "string"
          ? cause.stack
          : new Error("Payment card field error").stack,
        wasShownToUser: true,
        context: { source: "stripe-card-field", stripeCode },
      });
    };
    onChange(null);
    loadStripeScript().then((loaded) => {
      if (cancelled) return;
      if (!loaded || !window.Stripe) {
        showFieldError(
          "Secure card entry could not load. Refresh to try again.",
          new Error("Stripe.js did not load or expose window.Stripe"),
        );
        return;
      }
      const stripe = window.Stripe(publishableKey);
      card = stripe.elements().create("card", {
        hidePostalCode: true,
        style: { base: { color: "#ffffff", fontSize: "16px", "::placeholder": { color: "#aaaaaa" } }, invalid: { color: "#fca5a5" } },
      });
      card.on("change", (event) => {
        showFieldError(event.error?.message || "", event.error);
        onChange({ stripe, card: card!, complete: event.complete });
      });
      card.mount(container.current!);
    }).catch((loadError: unknown) => {
      if (!cancelled) {
        showFieldError("Secure card entry could not load. Refresh to try again.", loadError);
      }
    });
    return () => { cancelled = true; onChange(null); card?.destroy(); };
  }, [publishableKey, onChange]);
  return (
    <div className="min-w-0 space-y-2" data-testid="stripe-card-field">
      <p className="text-xs uppercase tracking-wider text-white/70">Secure card details</p>
      <div ref={container} className="min-h-12 rounded-md border border-white/20 bg-white/[0.08] p-3 focus-within:ring-2 focus-within:ring-orange-400" />
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
