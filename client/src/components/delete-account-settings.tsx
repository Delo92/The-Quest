import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { firebaseLogin, getIdToken } from "@/lib/firebase";

const SUPPORT_EMAIL = "info@cbpublishing.live";

export default function DeleteAccountSettings() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;
  const reviewed = user.level >= 3;

  const deleteAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (confirmText.trim() !== "DELETE") {
      setError("Type DELETE exactly to confirm.");
      return;
    }
    setPending(true);
    try {
      // A fresh sign-in proves the owner is the one deleting the account.
      await firebaseLogin(user.email, password);
      const token = await getIdToken(true);
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "We couldn't delete your account.");
      }
      await logout().catch(() => {});
      window.location.assign("/thequest/");
    } catch (cause) {
      const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
      setError(
        code.startsWith("auth/")
          ? "That password isn't correct."
          : cause instanceof Error ? cause.message : "We couldn't delete your account.",
      );
      setPending(false);
    }
  };

  return (
    <section className="rounded-md border border-red-400/25 bg-red-500/[0.05] p-4 sm:p-5" data-testid="delete-account-settings">
      <div className="flex items-start gap-3">
        <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-red-300" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white">Delete account</h3>
          <p className="mt-1 text-xs leading-relaxed text-white/65">
            This permanently removes your login, profile and competition entries. It cannot be undone.
          </p>
          {reviewed ? (
            <p className="mt-3 text-xs leading-relaxed text-white/65">
              Host and admin accounts have event and payout records, so deletion is reviewed.{" "}
              <a className="text-[#ff9958] underline" href={`mailto:${SUPPORT_EMAIL}?subject=Delete%20my%20Quest%20account`}>
                Email support to request it
              </a>.
            </p>
          ) : !open ? (
            <Button type="button" variant="outline" onClick={() => setOpen(true)} className="mt-3 min-h-11 border-red-400/50 bg-transparent text-red-200 hover:bg-red-500/10" data-testid="button-delete-account">
              Delete my account
            </Button>
          ) : (
            <form onSubmit={deleteAccount} className="mt-3 space-y-3" data-testid="form-delete-account">
              <div className="space-y-1.5">
                <Label htmlFor="delete-account-password" className="text-xs text-white/65">Confirm your password</Label>
                <Input id="delete-account-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-white/[0.07] border-white/15 text-white" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="delete-account-confirm" className="text-xs text-white/65">Type DELETE to confirm</Label>
                <Input id="delete-account-confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" required className="bg-white/[0.07] border-white/15 text-white" />
              </div>
              {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={pending} className="min-h-11 bg-red-600 text-white hover:bg-red-500" data-testid="button-confirm-delete-account">
                  {pending ? "Deleting..." : "Permanently delete"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => { setOpen(false); setError(null); }} className="min-h-11 text-white/70">
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
