import { useState, type FormEvent } from "react";
import { verifyBeforeUpdateEmail } from "firebase/auth";
import { Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getFirebaseAuth } from "@/lib/firebase";

export default function LoginEmailSettings({ currentEmail }: { currentEmail: string }) {
  const [newEmail, setNewEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSentTo(null);

    const normalizedEmail = newEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Enter the new email address.");
      return;
    }
    if (normalizedEmail === currentEmail.trim().toLowerCase()) {
      setError("That is already your login email.");
      return;
    }

    const firebaseUser = getFirebaseAuth()?.currentUser;
    if (!firebaseUser) {
      setError("You are signed out. Sign in again before changing your login email.");
      return;
    }

    setPending(true);
    try {
      await verifyBeforeUpdateEmail(firebaseUser, normalizedEmail);
      setSentTo(normalizedEmail);
      setNewEmail("");
    } catch (cause) {
      const code = cause && typeof cause === "object" && "code" in cause
        ? String(cause.code)
        : "";
      if (code === "auth/email-already-in-use") {
        setError("That email is already connected to another account.");
      } else if (code === "auth/requires-recent-login") {
        setError("For security, sign out and sign in again, then request the email change.");
      } else if (code === "auth/invalid-email") {
        setError("Enter a valid email address.");
      } else {
        setError("We couldn’t send the verification email. Please try again.");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <section
      className="rounded-lg border border-white/10 bg-white/[0.03] p-4"
      data-testid="login-email-settings"
    >
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">Login email</h3>
          <p className="mt-1 break-all text-xs text-white/55">
            Current sign-in email: <span className="text-white/80">{currentEmail || "Unavailable"}</span>
          </p>
          <p className="mt-1 text-xs leading-relaxed text-white/45">
            We’ll send a verification link to the new address. Your login email changes only after you confirm it; your password stays the same.
          </p>
        </div>
      </div>

      <form onSubmit={requestChange} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="new-login-email" className="text-xs text-white/65">New login email</Label>
          <Input
            id="new-login-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            maxLength={320}
            required
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            disabled={pending}
            placeholder="you@example.com"
            className="min-h-11 border-white/15 bg-white/[0.06] text-white placeholder:text-white/30"
            data-testid="input-new-login-email"
          />
        </div>
        <Button
          type="submit"
          disabled={pending || !newEmail.trim()}
          className="min-h-11 bg-orange-500 text-white hover:bg-orange-400"
          data-testid="button-send-login-email-verification"
        >
          <Mail className="mr-2 h-4 w-4" />
          {pending ? "Sending…" : "Send verification"}
        </Button>
      </form>

      {sentTo && (
        <p role="status" className="mt-3 rounded-md border border-green-400/20 bg-green-400/[0.06] p-3 text-xs leading-relaxed text-green-100" data-testid="login-email-verification-sent">
          Verification sent to {sentTo}. Confirm the link, then return to The Quest and sign in with that email.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-md border border-red-400/20 bg-red-400/[0.06] p-3 text-xs leading-relaxed text-red-100" data-testid="login-email-error">
          {error}
        </p>
      )}
    </section>
  );
}
