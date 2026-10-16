import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, Mail, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AccessStatus {
  resetAt: string | null;
  lastSignInAt: string | null;
  signedInSinceReset: boolean;
  lastResetTemporaryPassword?: string | null;
}
interface ResetResult {
  email: string | null;
  temporaryPassword: string;
  resetAt: string;
  emailSent: boolean | null;
}

export default function AdminAccountAccess({ uid, email, name }: {
  uid: string;
  email?: string | null;
  name: string;
}) {
  const { toast } = useToast();
  const [result, setResult] = useState<ResetResult | null>(null);
  const access = useQuery<AccessStatus>({
    queryKey: ["/api/admin/users", uid, "access-status"],
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const reset = useMutation({
    mutationFn: async (sendEmail: boolean) => {
      const response = await apiRequest("POST", `/api/admin/users/${encodeURIComponent(uid)}/reset-password`, { sendEmail });
      return response.json() as Promise<ResetResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", uid, "access-status"] });
      toast({
        title: data.emailSent === false ? "Password reset, but email delivery failed" : "Password reset",
        description: data.emailSent === true
          ? "Login instructions and the temporary password were emailed to the user."
          : "The password was changed. Copy the temporary password and share it securely with the user.",
        variant: data.emailSent === false ? "destructive" : "default",
      });
    },
    onError: (error: Error) => toast({
      title: "Could not reset password",
      description: error.message.replace(/^\d+:\s*/, ""),
      variant: "destructive",
    }),
  });
  const startReset = (sendEmail: boolean) => {
    if (!window.confirm(`Reset the password for ${email || name}? Their current password will stop working and existing sessions will be signed out.${sendEmail ? " The temporary password and a prefilled login link will be emailed to them." : ""}`)) return;
    setResult(null);
    reset.mutate(sendEmail);
  };
  return (
    <section className="rounded-lg border border-orange-400/20 bg-orange-400/[0.06] p-4" data-testid="user-account-access">
      <h3 className="text-xs font-bold uppercase tracking-widest text-orange-200">Account Access</h3>
      <p className="mt-2 text-xs leading-relaxed text-white/65">
        The original password cannot be recovered. Resetting uses the same temporary admin-reset password as host accounts and records the reset time.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button variant="outline" className="min-h-11 border-orange-400/30 text-orange-200"
          disabled={reset.isPending} onClick={() => startReset(false)} data-testid="button-reset-user-password">
          <RotateCcw className="mr-2 h-4 w-4" />{reset.isPending ? "Resetting…" : "Reset password"}
        </Button>
        <Button variant="outline" className="min-h-11 border-orange-400/30 text-orange-200"
          disabled={reset.isPending || !email} onClick={() => startReset(true)} data-testid="button-reset-and-email-user-password">
          <Mail className="mr-2 h-4 w-4" /> Reset and email login details
        </Button>
      </div>
      {result && (
        <div className="mt-3 rounded-md border border-orange-300/30 bg-white/[0.04] p-3" data-testid="temporary-user-password">
          <p className="text-xs text-white/65">Password set by this reset</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded bg-black/20 px-2 py-2 text-sm text-orange-100">{result.temporaryPassword}</code>
            <Button variant="ghost" className="min-h-11 min-w-11" aria-label="Copy temporary password"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(result.temporaryPassword);
                  toast({ title: "Temporary password copied" });
                } catch { toast({ title: "Could not copy", description: "Select and copy the displayed password.", variant: "destructive" }); }
              }}><Copy className="h-4 w-4" /></Button>
          </div>
          <p role="status" className="mt-2 text-xs text-white/70">
            {result.emailSent === true ? "Login instructions sent to the account email."
              : result.emailSent === false ? "Email delivery failed. The password was still reset; share it securely or retry the reset-and-email action."
                : "Share this securely with the user and ask them to change it after login."}
          </p>
        </div>
      )}
      <div className="mt-4 grid gap-3 border-t border-orange-400/15 pt-3 text-xs sm:grid-cols-2" data-testid="user-access-audit">
        {access.data?.lastResetTemporaryPassword && <div>
          <p className="text-white/50">Last known admin reset password</p>
          <code className="mt-1 block break-all text-orange-100">{access.data.lastResetTemporaryPassword}</code>
          <p className="mt-1 text-white/55">This is not necessarily the user&apos;s current password.</p>
        </div>}
        <div><p className="text-white/50">Last admin reset</p><p className="mt-1 text-white/85">{access.data?.resetAt ? new Date(access.data.resetAt).toLocaleString() : "No reset recorded"}</p></div>
        <div><p className="text-white/50">Last successful sign-in</p><p className="mt-1 text-white/85">{access.data?.lastSignInAt ? new Date(access.data.lastSignInAt).toLocaleString() : "None recorded"}</p></div>
        <div className="sm:col-span-2">
          {access.isError ? <Button variant="ghost" onClick={() => access.refetch()}>Could not load access status — retry</Button>
            : <Badge className="border-0 bg-white/10 text-white/75">
              {access.isLoading ? "Loading access status…" : access.data?.signedInSinceReset
                ? "User has signed in since the last reset"
                : access.data?.resetAt ? "No sign-in recorded since the last reset" : "Reset status not available yet"}
            </Badge>}
          <p className="mt-2 text-xs text-white/55">This confirms access activity; it does not reveal the user&apos;s current password.</p>
        </div>
      </div>
    </section>
  );
}
