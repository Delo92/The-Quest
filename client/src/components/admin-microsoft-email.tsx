import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ExternalLink, Loader2, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type MicrosoftEmailStatus = {
  mailboxAddress: string;
  clientId: string;
  tenantId: string;
  configured: boolean;
  connected: boolean;
  active: boolean;
  connectedAt: string | null;
  encryptionReady: boolean;
};

type AuthorizationFlow = {
  flowId: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string | null;
  expiresIn: number;
  intervalSeconds: number;
};

export default function AdminMicrosoftEmail() {
  const { toast } = useToast();
  const [clientId, setClientId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [flow, setFlow] = useState<AuthorizationFlow | null>(null);
  const [starting, setStarting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  const { data: status, isLoading, refetch } = useQuery<MicrosoftEmailStatus>({
    queryKey: ["/api/admin/microsoft-email/status"],
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!status) return;
    setClientId((current) => current || status.clientId);
    setTenantId((current) => current || status.tenantId);
  }, [status]);

  useEffect(() => {
    if (!flow) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const response = await apiRequest(
          "POST",
          "/api/admin/microsoft-email/connect/poll",
          { flowId: flow.flowId },
        );
        const result = await response.json() as {
          status: "pending" | "connected" | "failed";
          retryAfterSeconds?: number;
          message?: string;
        };
        if (cancelled) return;

        if (result.status === "connected") {
          setFlow(null);
          setVerified(false);
          await queryClient.invalidateQueries({ queryKey: ["/api/admin/microsoft-email/status"] });
          await queryClient.invalidateQueries({ queryKey: ["/api/admin/gmail-status"] });
          await refetch();
          toast({
            title: "Microsoft mailbox connected",
            description: "The Quest is now set to send from info@cbpublishing.live.",
          });
          return;
        }

        if (result.status === "failed") {
          setFlow(null);
          toast({
            title: "Microsoft sign-in did not finish",
            description: result.message || "Start a new connection attempt.",
            variant: "destructive",
          });
          return;
        }

        const delaySeconds = Math.max(2, result.retryAfterSeconds || flow.intervalSeconds);
        timer = setTimeout(poll, delaySeconds * 1000);
      } catch {
        if (!cancelled) timer = setTimeout(poll, 8000);
      }
    };

    timer = setTimeout(poll, Math.max(2, flow.intervalSeconds) * 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [flow, refetch, toast]);

  const startConnection = async () => {
    if (!clientId.trim() || !tenantId.trim()) return;
    setStarting(true);
    setVerified(false);
    try {
      const response = await apiRequest(
        "POST",
        "/api/admin/microsoft-email/connect/start",
        { clientId: clientId.trim(), tenantId: tenantId.trim() },
      );
      const result = await response.json() as AuthorizationFlow;
      setFlow(result);
      await refetch();
    } catch (error: any) {
      toast({
        title: "Could not start Microsoft sign-in",
        description: error.message || "Check the application and tenant IDs.",
        variant: "destructive",
      });
    } finally {
      setStarting(false);
    }
  };

  const verifyConnection = async () => {
    setVerifying(true);
    setVerified(false);
    try {
      await apiRequest("POST", "/api/admin/microsoft-email/verify");
      setVerified(true);
      toast({
        title: "Microsoft SMTP connection verified",
        description: "The connection was checked without sending an email.",
      });
    } catch (error: any) {
      toast({
        title: "Microsoft SMTP verification failed",
        description: error.message || "Check the mailbox authorization and SMTP Authentication setting.",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const copyCode = async () => {
    if (!flow) return;
    try {
      await navigator.clipboard.writeText(flow.userCode);
      toast({ title: "Code copied" });
    } catch {
      toast({
        title: "Could not copy the code",
        description: "Select the displayed code and copy it manually.",
        variant: "destructive",
      });
    }
  };

  const statusText = isLoading
    ? "Checking"
    : status?.active
      ? "Microsoft 365 is the active sender"
      : status?.connected
        ? "Connected, but not active"
        : "Gmail remains the active sender";

  return (
    <section className="rounded-lg border border-white/15 bg-zinc-900 p-4 space-y-4" aria-labelledby="microsoft-email-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2.5">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" aria-hidden="true" />
          <div>
            <h3 id="microsoft-email-heading" className="text-sm font-semibold text-white">
              Microsoft 365 email
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-white/55">
              Connect {status?.mailboxAddress || "info@cbpublishing.live"} with Microsoft OAuth. The mailbox token is encrypted on the server and never shown here.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/65" aria-live="polite">
          <span className={`h-2 w-2 rounded-full ${status?.active ? "bg-green-500" : status?.connected ? "bg-amber-400" : "bg-zinc-500"}`} />
          <span>{statusText}</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-white/50 hover:text-white"
            onClick={() => refetch()}
            aria-label="Refresh Microsoft email status"
            data-testid="button-refresh-microsoft-email-status"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {!status?.encryptionReady && (
        <p role="alert" className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">
          Secure token storage is not configured in this environment. An administrator must configure the app’s encryption key before connecting the mailbox.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="min-w-0 space-y-1.5 text-xs text-white/70">
          <span>Application (client) ID</span>
          <Input
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            placeholder="Microsoft app client ID"
            autoComplete="off"
            className="h-10 border-white/20 bg-zinc-800 text-sm text-white"
            aria-label="Microsoft Application client ID"
            data-testid="input-microsoft-email-client-id"
          />
        </label>
        <label className="min-w-0 space-y-1.5 text-xs text-white/70">
          <span>Directory (tenant) ID</span>
          <Input
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
            placeholder="Microsoft tenant ID"
            autoComplete="off"
            className="h-10 border-white/20 bg-zinc-800 text-sm text-white"
            aria-label="Microsoft Directory tenant ID"
            data-testid="input-microsoft-email-tenant-id"
          />
        </label>
      </div>

      <p className="text-xs leading-relaxed text-white/50">
        The Microsoft app needs delegated <code className="text-orange-300">SMTP.Send</code> permission and public-client sign-in enabled. No client secret is needed. When prompted, sign in as <strong className="text-white/75">info@cbpublishing.live</strong>.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          onClick={startConnection}
          disabled={starting || !clientId.trim() || !tenantId.trim() || !status?.encryptionReady}
          className="min-h-10 w-full bg-orange-500 text-white hover:bg-orange-400 sm:w-auto"
          data-testid="button-connect-microsoft-email"
        >
          {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
          {status?.active ? "Reconnect Microsoft 365" : "Connect Microsoft 365"}
        </Button>

        {status?.active && (
          <Button
            type="button"
            onClick={verifyConnection}
            disabled={verifying}
            variant="outline"
            className="min-h-10 w-full border-white/20 bg-zinc-800 text-white hover:bg-zinc-700 sm:w-auto"
            data-testid="button-verify-microsoft-email"
          >
            {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : verified ? <Check className="mr-2 h-4 w-4 text-green-400" /> : null}
            {verifying ? "Checking…" : verified ? "Verified" : "Verify connection"}
          </Button>
        )}
      </div>

      {flow && (
        <div className="rounded-md border border-orange-500/30 bg-black/20 p-3 sm:p-4" aria-live="polite">
          <p className="text-sm font-medium text-white">Finish signing in to Microsoft</p>
          <p className="mt-1 text-xs leading-relaxed text-white/60">
            Open Microsoft’s sign-in page, enter this code, and approve the requested mail permission. Keep this page open while it checks for approval.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <code className="rounded bg-zinc-800 px-3 py-2 text-lg font-semibold tracking-widest text-orange-300" data-testid="text-microsoft-device-code">
                {flow.userCode}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={copyCode}
                className="min-h-10 border-white/20 bg-zinc-800 text-white hover:bg-zinc-700"
              >
                Copy code
              </Button>
            </div>
            <a
              href={flow.verificationUriComplete || flow.verificationUri}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-orange-400/50 px-3 text-sm font-medium text-orange-300 hover:bg-orange-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
              data-testid="link-microsoft-device-login"
            >
              Continue to Microsoft <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
          <p className="mt-3 text-xs text-white/40">This sign-in code expires in about {Math.ceil(flow.expiresIn / 60)} minutes.</p>
        </div>
      )}

      <p className="text-[11px] text-white/40">
        {status?.active
          ? "The Quest now sends through smtp.office365.com using OAuth."
          : "The current Gmail sender remains in use until Microsoft authorization completes."}
      </p>
    </section>
  );
}
