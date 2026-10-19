import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface WelcomeEmailActivity {
  id: string;
  kind: "welcome";
  recipientEmail: string;
  recipientName: string;
  competitionName: string | null;
  status: "sending" | "provider_accepted" | "failed";
  attemptedAt: string;
  updatedAt: string;
  providerMessageId?: string | null;
  failureCode?: string | null;
}

interface ActivityResponse {
  items: WelcomeEmailActivity[];
}

function statusPresentation(status: WelcomeEmailActivity["status"]) {
  if (status === "provider_accepted") {
    return {
      label: "Accepted by provider",
      className: "border-green-500/30 bg-green-500/10 text-green-300",
    };
  }
  if (status === "failed") {
    return {
      label: "Send failed",
      className: "border-red-500/30 bg-red-500/10 text-red-300",
    };
  }
  return {
    label: "Outcome not recorded",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  };
}

function formatAttemptedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function AdminEmailActivity() {
  const [search, setSearch] = useState("");
  const { data, isLoading, isError, isFetching, refetch } = useQuery<ActivityResponse>({
    queryKey: ["/api/admin/email-activity"],
    refetchInterval: 30_000,
  });
  const items = data?.items ?? [];
  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => [
      item.recipientName,
      item.recipientEmail,
      item.competitionName || "",
    ].some((value) => value.toLowerCase().includes(needle)));
  }, [items, search]);

  return (
    <section className="space-y-4 border-t border-white/10 pt-5" aria-labelledby="welcome-email-activity-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id="welcome-email-activity-title" className="text-base font-semibold text-white">
            Welcome email activity
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/60">
            New welcome, invitation, and nomination access emails appear here. “Accepted by provider” means the mail service
            accepted the message; it does not confirm inbox delivery. The app does not request delivery
            or read receipts. Activity tracking began after earlier sends, so old messages are not backfilled.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-10 shrink-0 border-white/15 text-white"
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh-email-activity"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, email, or competition"
          aria-label="Search welcome email activity"
          className="min-h-10 border-white/15 bg-white/[0.04] text-white placeholder:text-white/35 sm:max-w-sm"
          data-testid="input-search-email-activity"
        />
        <span className="text-xs text-white/45">
          Showing {filteredItems.length} of {items.length} recent sends
        </span>
      </div>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-white/50">Loading email activity…</p>
      ) : isError ? (
        <div role="alert" className="rounded-md border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-200">
          Email activity could not be loaded. Try refreshing.
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-md border border-white/10 px-4 py-8 text-center text-sm text-white/50">
          No tracked welcome emails yet. Only sends made after activity tracking was added will appear here.
        </p>
      ) : filteredItems.length === 0 ? (
        <p className="rounded-md border border-white/10 px-4 py-8 text-center text-sm text-white/50">
          No recent sends match that search.
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-white/10">
          <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-white/45 md:grid">
            <span>Recipient</span>
            <span>Competition</span>
            <span>Attempted</span>
            <span>Send result</span>
          </div>
          <div className="divide-y divide-white/[0.07]">
            {filteredItems.map((item) => {
              const status = statusPresentation(item.status);
              return (
                <article
                  key={item.id}
                  className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-center md:gap-3"
                  data-testid={`email-activity-${item.id}`}
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-white">{item.recipientName}</p>
                    <p className="break-all text-xs text-white/55">{item.recipientEmail}</p>
                  </div>
                  <p className="text-xs text-white/65">
                    <span className="mr-1 text-white/40 md:hidden">Competition:</span>
                    {item.competitionName || "The Quest"}
                  </p>
                  <p className="text-xs tabular-nums text-white/55">
                    <span className="mr-1 text-white/40 md:hidden">Attempted:</span>
                    {formatAttemptedAt(item.attemptedAt)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={status.className}>{status.label}</Badge>
                    {item.failureCode && <span className="text-[11px] text-white/45">Code: {item.failureCode}</span>}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
