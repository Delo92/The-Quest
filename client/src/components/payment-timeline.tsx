import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface PaymentLog {
  id: string;
  severity: string;
  message: string;
  timestamp: string;
  statusCode?: number;
  userEmail?: string;
  environment?: string;
  stackTrace?: string;
  context?: Record<string, any>;
}

type AttemptStatus = "succeeded" | "failed" | "stalled" | "in-progress";

interface Attempt {
  key: string;
  logs: PaymentLog[];
  status: AttemptStatus;
  startedAt: string;
  email?: string;
  lastStep: string;
  reason?: string;
}

const STATUS_STYLES: Record<AttemptStatus, string> = {
  succeeded: "bg-green-950/50 text-green-300 border-green-800/50",
  failed: "bg-red-950/50 text-red-300 border-red-800/50",
  stalled: "bg-orange-950/50 text-orange-300 border-orange-800/50",
  "in-progress": "bg-blue-950/50 text-blue-300 border-blue-800/50",
};

const STATUS_LABELS: Record<AttemptStatus, string> = {
  succeeded: "Paid",
  failed: "Failed",
  stalled: "Stalled — check Stripe",
  "in-progress": "In progress",
};

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  error: "bg-orange-500",
  warning: "bg-yellow-400",
  info: "bg-sky-400",
};

function centralTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }) + " CT";
}

function attemptKey(log: PaymentLog): string {
  const ctx = log.context || {};
  const ref = ctx.attemptRef || ctx.attemptId;
  if (typeof ref === "string" && ref) {
    // Server request logs use "<attempt>:<path>"; stalled/webhook/Stripe-call logs have their own prefixes.
    return ctx.attemptRef ? String(ctx.attemptRef) : /^(stripe|paypal|stalled)/.test(ref) ? ref : ref.split(":")[0];
  }
  if (typeof ctx.paymentIntentId === "string") return ctx.paymentIntentId;
  return log.id;
}

function buildAttempts(logs: PaymentLog[]): Attempt[] {
  const groups = new Map<string, PaymentLog[]>();
  for (const log of logs) {
    const key = attemptKey(log);
    groups.set(key, [...(groups.get(key) || []), log]);
  }
  // Merge Stripe-side records (webhooks, stall reports) into the buyer attempt sharing their payment intent.
  const byIntent = new Map<string, string>();
  groups.forEach((items, key) => {
    items.forEach((l) => {
      const pi = l.context?.paymentIntentId;
      if (typeof pi === "string" && l.context?.source === "payment-trace") byIntent.set(pi, key);
    });
  });
  const merged = new Map<string, PaymentLog[]>();
  groups.forEach((items, key) => {
    const pi = items.map((l) => l.context?.paymentIntentId).find((v) => typeof v === "string") as string | undefined;
    const target = pi && byIntent.get(pi) ? byIntent.get(pi)! : key;
    merged.set(target, [...(merged.get(target) || []), ...items]);
  });
  // Routine provider call records alone are not an attempt; keep them only when they are part of one or are not healthy.
  merged.forEach((items, key) => {
    const meaningful = items.some((l) =>
      l.context?.source === "payment-trace" || /stalled-attempt|webhook/.test(String(l.context?.step || "")) || l.severity !== "info");
    if (!meaningful) merged.delete(key);
  });

  return Array.from(merged.entries()).map(([key, items]) => {
    const sorted = [...items].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const steps = sorted.map((l) => String(l.context?.step || ""));
    const paid = steps.includes("confirm-succeeded") || sorted.some((l) => /payment_intent\.succeeded|CAPTURE\.COMPLETED/.test(l.message));
    const stalled = steps.includes("stalled-attempt") || steps.includes("confirm-stalled");
    const failedLog = [...sorted].reverse().find((l) => l.severity === "error" || l.severity === "critical");
    let status: AttemptStatus = "in-progress";
    if (paid && !steps.includes("confirm-failed")) status = "succeeded";
    else if (stalled && !paid) status = "stalled";
    else if (failedLog && !paid) status = "failed";
    return {
      key,
      logs: sorted,
      status,
      startedAt: sorted[0].timestamp,
      email: sorted.find((l) => l.userEmail)?.userEmail,
      lastStep: steps.filter(Boolean).pop() || "",
      reason: failedLog?.context?.errorMessage || failedLog?.message,
    };
  }).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

export function PaymentTimeline() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [onlyProblems, setOnlyProblems] = useState(true);

  const { data, isLoading, refetch, isFetching } = useQuery<{ logs: PaymentLog[] }>({
    queryKey: ["/api/admin/error-logs", "payment-timeline"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/error-logs?errorType=payment&limit=250")).json(),
    refetchInterval: 30_000,
  });

  const attempts = useMemo(() => buildAttempts(data?.logs || []), [data]);
  const shown = onlyProblems ? attempts.filter((a) => a.status !== "succeeded") : attempts;
  const counts = {
    failed: attempts.filter((a) => a.status === "failed").length,
    stalled: attempts.filter((a) => a.status === "stalled").length,
    succeeded: attempts.filter((a) => a.status === "succeeded").length,
  };

  return (
    <div className="space-y-3" data-testid="payment-timeline">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className={STATUS_STYLES.failed}>{counts.failed} failed</Badge>
          <Badge variant="outline" className={STATUS_STYLES.stalled}>{counts.stalled} stalled</Badge>
          <Badge variant="outline" className={STATUS_STYLES.succeeded}>{counts.succeeded} paid</Badge>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10" onClick={() => setOnlyProblems((v) => !v)}>
            {onlyProblems ? "Show all attempts" : "Show only problems"}
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5 text-white/70 hover:text-white hover:bg-white/10" onClick={() => refetch()}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 bg-white/5" />)}</div>
      ) : shown.length === 0 ? (
        <div className="rounded-md border border-white/10 bg-white/5 p-8 text-center text-sm text-white/60">
          {onlyProblems ? "No failed or stalled payments in the recent log." : "No payment activity recorded yet."}
        </div>
      ) : (
        <div className="space-y-1.5">
          {shown.map((attempt) => {
            const open = expanded === attempt.key;
            return (
              <div key={attempt.key} className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                <button className="flex w-full items-start gap-3 p-3 text-left" onClick={() => setExpanded(open ? null : attempt.key)}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={STATUS_STYLES[attempt.status]}>{STATUS_LABELS[attempt.status]}</Badge>
                      {attempt.logs[0].environment && (
                        <Badge variant="outline" className="border-white/20 text-xs text-white/60">{attempt.logs[0].environment}</Badge>
                      )}
                      <span className="text-xs text-white/60">{centralTime(attempt.startedAt)}</span>
                      {attempt.email && <span className="text-xs text-white/60">{attempt.email}</span>}
                    </div>
                    <div className="mt-1 truncate text-sm text-white/90">
                      {attempt.status === "succeeded" ? "Payment completed" : attempt.reason || "Waiting on a result"}
                    </div>
                    <div className="mt-0.5 text-xs text-white/50">Last step: {attempt.lastStep || "—"} · {attempt.logs.length} events</div>
                  </div>
                  {open ? <ChevronDown className="mt-1 h-4 w-4 text-white/50" /> : <ChevronRight className="mt-1 h-4 w-4 text-white/50" />}
                </button>
                {open && (
                  <ol className="space-y-2 border-t border-white/10 p-3">
                    {attempt.logs.map((log) => (
                      <li key={log.id} className="flex gap-3 text-xs">
                        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[log.severity] || "bg-white/40"}`} />
                        <div className="min-w-0 flex-1">
                          <div className="text-white/90">{log.message}</div>
                          <div className="text-white/50">
                            {centralTime(log.timestamp)}
                            {typeof log.context?.elapsedMs === "number" && ` · +${log.context.elapsedMs}ms`}
                            {typeof log.context?.durationMs === "number" && ` · ${log.context.durationMs}ms`}
                            {log.statusCode ? ` · HTTP ${log.statusCode}` : ""}
                          </div>
                          {log.context?.inAppBrowser && <div className="text-white/50">In-app browser: {String(log.context.inAppBrowser)}</div>}
                          {log.context?.stripeCode && <div className="text-orange-300">Stripe: {log.context.stripeType} / {log.context.stripeCode}{log.context.declineCode ? ` / ${log.context.declineCode}` : ""}</div>}
                          {log.stackTrace && (
                            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-black/30 p-2 text-white/60">{log.stackTrace}</pre>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
