import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Inbox,
  LoaderCircle,
  Mail,
  MessageSquareReply,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Person = { name: string; emailAddress: string };
type InboxStatus = {
  active: boolean;
  mailboxAddress: string;
  mailboxAccessGranted: boolean;
};
type InboxItem = {
  id: string;
  subject: string;
  from: Person;
  receivedDateTime: string;
  bodyPreview: string;
  webLink: string | null;
};
type InboxResponse = { items: InboxItem[] };
type MessageDetail = {
  id: string;
  subject: string;
  from: Person;
  toRecipients: Person[];
  receivedDateTime: string;
  body: string;
  webLink: string | null;
};

const STATUS_KEY = ["/api/admin/microsoft-email/status"];
const INBOX_KEY = ["/api/admin/microsoft-email/inbox"];

function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : "The request could not be completed.";
  const text = message.replace(/^\s*\d{3}\s*:\s*/, "");
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.error === "string") return parsed.error;
  } catch {}
  return text;
}

function formatDate(value: string, withTime = true) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : { year: "numeric" }),
  }).format(date);
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function StateMessage({
  title,
  children,
  icon: Icon = Inbox,
  action,
}: {
  title: string;
  children: ReactNode;
  icon?: typeof Inbox;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-5 py-10 text-center" role="status">
      <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-orange-300">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-white/55">{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function MessageSkeleton() {
  return (
    <div className="divide-y divide-white/[0.07]" aria-label="Loading inbox messages" aria-busy="true">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="animate-pulse px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="h-3 w-32 rounded bg-white/10" />
            <div className="h-3 w-14 rounded bg-white/[0.07]" />
          </div>
          <div className="mt-3 h-3 w-3/4 rounded bg-white/[0.09]" />
          <div className="mt-2 h-3 w-full rounded bg-white/[0.05]" />
        </div>
      ))}
    </div>
  );
}

export default function AdminMicrosoftInbox() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const statusQuery = useQuery<InboxStatus>({
    queryKey: STATUS_KEY,
    queryFn: async () => (await apiRequest("GET", "/api/admin/microsoft-email/status")).json(),
  });
  const canReadInbox = Boolean(statusQuery.data?.active && statusQuery.data.mailboxAccessGranted);
  const inboxQuery = useQuery<InboxResponse>({
    queryKey: INBOX_KEY,
    queryFn: async () => (await apiRequest("GET", "/api/admin/microsoft-email/inbox")).json(),
    enabled: canReadInbox,
  });
  const detailQuery = useQuery<MessageDetail>({
    queryKey: [...INBOX_KEY, selectedId],
    queryFn: async () => {
      if (!selectedId) throw new Error("Select a message to view it.");
      return (await apiRequest("GET", `/api/admin/microsoft-email/inbox/${encodeURIComponent(selectedId)}`)).json();
    },
    enabled: canReadInbox && Boolean(selectedId),
  });
  const messages = inboxQuery.data?.items ?? [];
  const filteredMessages = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    if (!needle) return messages;
    return messages.filter((message) => [
      message.subject,
      message.from.name,
      message.from.emailAddress,
      message.bodyPreview,
    ].some((value) => value.toLocaleLowerCase().includes(needle)));
  }, [messages, search]);

  const replyMutation = useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment: string }) => {
      const response = await apiRequest("POST", `/api/admin/microsoft-email/inbox/${encodeURIComponent(id)}/reply`, { comment });
      return response.json() as Promise<{ success: true }>;
    },
    onSuccess: async () => {
      setReply("");
      toast({ title: "Reply sent", description: "Your message was sent from the Microsoft 365 mailbox." });
      await queryClient.invalidateQueries({ queryKey: INBOX_KEY });
    },
    onError: (error: Error) => {
      toast({
        title: "Reply could not be sent",
        description: errorText(error),
        variant: "destructive",
      });
    },
  });

  const selectMessage = (id: string) => {
    setSelectedId(id);
    setReply("");
  };

  const sendReply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedId || !reply.trim() || replyMutation.isPending) return;
    replyMutation.mutate({ id: selectedId, comment: reply.trim() });
  };

  const selected = detailQuery.data;

  return (
    <section
      aria-labelledby="microsoft-inbox-heading"
      className="min-w-0 space-y-4 border-t border-white/10 pt-5"
      data-testid="admin-microsoft-inbox"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-orange-400/20 bg-orange-400/[0.08] text-orange-300">
            <Inbox className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="microsoft-inbox-heading" className="text-base font-semibold text-white">Microsoft 365 inbox</h2>
            <p className="mt-1 break-words text-sm leading-relaxed text-white/55">
              {statusQuery.data?.mailboxAddress
                ? `Review and reply as ${statusQuery.data.mailboxAddress}.`
                : "Review and reply to messages in the connected Microsoft 365 mailbox."}
            </p>
          </div>
        </div>
        {canReadInbox && (
          <Button
            type="button"
            variant="outline"
            onClick={() => void inboxQuery.refetch()}
            disabled={inboxQuery.isFetching}
            className="min-h-10 w-full shrink-0 border-white/15 bg-white/[0.03] text-white hover:bg-white/[0.08] sm:w-auto"
            aria-label="Refresh Microsoft 365 inbox"
            data-testid="button-refresh-microsoft-inbox"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${inboxQuery.isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
            {inboxQuery.isFetching ? "Refreshing" : "Refresh"}
          </Button>
        )}
      </header>

      {statusQuery.isLoading ? (
        <div className="rounded-md border border-white/10 bg-zinc-900/60 p-5" aria-label="Checking mailbox access" aria-busy="true">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-40 rounded bg-white/10" />
            <div className="h-3 w-2/3 rounded bg-white/[0.06]" />
          </div>
        </div>
      ) : statusQuery.isError ? (
        <div className="rounded-md border border-red-400/25 bg-red-400/[0.06] p-4" role="alert">
          <p className="text-sm font-medium text-red-100">Mailbox status could not be checked</p>
          <p className="mt-1 break-words text-sm text-red-100/70">{errorText(statusQuery.error)}</p>
          <Button type="button" variant="outline" onClick={() => void statusQuery.refetch()} className="mt-3 min-h-10 border-red-200/20 text-red-50">
            Try again
          </Button>
        </div>
      ) : !statusQuery.data?.active ? (
        <div className="rounded-md border border-white/10 bg-zinc-900/60">
          <StateMessage title="Microsoft 365 is not connected" icon={WifiOff}>
            Connect Microsoft 365 from the email settings above to open the mailbox inbox.
          </StateMessage>
        </div>
      ) : !statusQuery.data.mailboxAccessGranted ? (
        <div className="rounded-md border border-amber-400/25 bg-amber-400/[0.04]">
          <StateMessage title="Inbox access needs approval" icon={ShieldAlert}>
            Reconnect Microsoft in settings and approve inbox and reply access. This inbox does not start a separate authorization flow.
          </StateMessage>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative min-w-0 flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" aria-hidden="true" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search sender, subject, or message"
                className="min-h-10 border-white/15 bg-white/[0.04] pl-9 text-white placeholder:text-white/35 focus-visible:ring-orange-400/60"
                aria-label="Search loaded inbox messages"
                data-testid="input-search-microsoft-inbox"
              />
            </label>
            <p className="text-xs tabular-nums text-white/45" aria-live="polite">
              {filteredMessages.length} {filteredMessages.length === 1 ? "message" : "messages"}
              {search.trim() ? " matching" : " loaded"} · latest 50
            </p>
          </div>

          <div className="grid min-w-0 overflow-hidden rounded-md border border-white/10 bg-zinc-900/45 md:min-h-[34rem] md:grid-cols-[minmax(17rem,0.78fr)_minmax(0,1.5fr)]">
            <div className={`${selectedId ? "hidden md:block" : "block"} min-w-0 border-white/10 md:border-r`}>
              {inboxQuery.isLoading ? (
                <MessageSkeleton />
              ) : inboxQuery.isError ? (
                <StateMessage
                  title="Inbox could not be loaded"
                  icon={WifiOff}
                  action={
                    <Button type="button" variant="outline" onClick={() => void inboxQuery.refetch()} className="min-h-10 border-white/15 text-white">
                      Try again
                    </Button>
                  }
                >
                  {errorText(inboxQuery.error)}
                </StateMessage>
              ) : messages.length === 0 ? (
                <StateMessage title="No messages in this inbox yet">
                  New messages sent to this mailbox will appear here.
                </StateMessage>
              ) : filteredMessages.length === 0 ? (
                <StateMessage title="No matching messages" icon={Search}>
                  Try another sender, subject, or phrase.
                </StateMessage>
              ) : (
                <ul aria-label="Inbox messages" className="max-h-[38rem] divide-y divide-white/[0.07] overflow-y-auto md:max-h-[42rem]">
                  {filteredMessages.map((message) => {
                    const isSelected = selectedId === message.id;
                    return (
                      <li key={message.id}>
                        <button
                          type="button"
                          onClick={() => selectMessage(message.id)}
                          aria-current={isSelected ? "true" : undefined}
                          className={`block min-h-[5.5rem] w-full min-w-0 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.045] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-400 ${isSelected ? "bg-orange-400/[0.08]" : ""}`}
                          data-testid={`button-inbox-message-${message.id}`}
                        >
                          <div className="flex min-w-0 items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium text-white">{message.from.name || message.from.emailAddress}</span>
                            <time className="shrink-0 text-[11px] tabular-nums text-white/40" dateTime={message.receivedDateTime}>
                              {formatDate(message.receivedDateTime)}
                            </time>
                          </div>
                          <p className="mt-1 truncate text-sm font-medium text-white/80">{message.subject || "(No subject)"}</p>
                          <p className="mt-1 line-clamp-2 break-words text-xs leading-relaxed text-white/45">{message.bodyPreview}</p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className={`${selectedId ? "block" : "hidden md:block"} min-w-0`}>
              {!selectedId ? (
                <StateMessage title="Select a message">
                  Choose a message from the inbox to review it and reply.
                </StateMessage>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => { setSelectedId(null); setReply(""); }}
                      className="min-h-10 px-2 text-white/70 hover:bg-white/[0.06] hover:text-white md:hidden"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                      Inbox
                    </Button>
                    {selected?.webLink ? (
                      <a
                        href={selected.webLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm text-orange-300 hover:bg-orange-400/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                      >
                        Open in Outlook <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      </a>
                    ) : <span className="ml-auto text-xs text-white/40">Microsoft mailbox</span>}
                  </div>

                  {detailQuery.isLoading ? (
                    <div className="animate-pulse space-y-4 p-5" aria-label="Loading message details" aria-busy="true">
                      <div className="h-5 w-3/4 rounded bg-white/10" />
                      <div className="h-3 w-1/2 rounded bg-white/[0.07]" />
                      <div className="mt-8 h-32 rounded bg-white/[0.05]" />
                    </div>
                  ) : detailQuery.isError ? (
                    <StateMessage
                      title="Message details could not be loaded"
                      icon={WifiOff}
                      action={
                        <Button type="button" variant="outline" onClick={() => void detailQuery.refetch()} className="min-h-10 border-white/15 text-white">
                          Try again
                        </Button>
                      }
                    >
                      {errorText(detailQuery.error)}
                    </StateMessage>
                  ) : selected ? (
                    <article className="min-w-0">
                      <header className="border-b border-white/[0.07] px-4 py-5 sm:px-6">
                        <h3 className="break-words text-lg font-semibold leading-snug text-white">{selected.subject || "(No subject)"}</h3>
                        <div className="mt-4 flex min-w-0 items-start gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-orange-300/20 bg-orange-300/[0.08] text-xs font-semibold text-orange-200" aria-hidden="true">
                            {initials(selected.from.name)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-sm font-medium text-white">{selected.from.name || selected.from.emailAddress}</p>
                            <p className="break-all text-xs text-white/45">{selected.from.emailAddress}</p>
                            <p className="mt-1 break-words text-xs text-white/40">
                              To: {selected.toRecipients.map((recipient) => recipient.emailAddress).join(", ") || "Microsoft mailbox"}
                            </p>
                          </div>
                          <time className="shrink-0 pt-0.5 text-right text-[11px] tabular-nums text-white/40" dateTime={selected.receivedDateTime}>
                            {formatDate(selected.receivedDateTime, false)}
                          </time>
                        </div>
                      </header>
                      <div className="max-h-[28rem] min-h-40 overflow-y-auto px-4 py-5 sm:px-6">
                        <p className="whitespace-pre-wrap break-words text-sm leading-7 text-white/80">{selected.body}</p>
                      </div>
                      <div className="border-t border-white/10 px-4 py-4 sm:px-6">
                        <form onSubmit={sendReply} className="space-y-3">
                          <label htmlFor="microsoft-inbox-reply" className="flex items-center gap-2 text-sm font-medium text-white/80">
                            <MessageSquareReply className="h-4 w-4 text-orange-300" aria-hidden="true" />
                            Reply from mailbox
                          </label>
                          <Textarea
                            id="microsoft-inbox-reply"
                            value={reply}
                            onChange={(event) => setReply(event.target.value)}
                            placeholder="Write a reply…"
                            maxLength={20_000}
                            className="min-h-28 resize-y border-white/15 bg-black/20 text-sm leading-relaxed text-white placeholder:text-white/35 focus-visible:ring-orange-400/60"
                            aria-describedby="microsoft-inbox-reply-note"
                            disabled={replyMutation.isPending}
                            data-testid="textarea-microsoft-inbox-reply"
                          />
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p id="microsoft-inbox-reply-note" className="text-xs leading-relaxed text-white/40">
                              Replies are sent from the connected Microsoft 365 mailbox.
                            </p>
                            <Button
                              type="submit"
                              disabled={!reply.trim() || replyMutation.isPending}
                              className="min-h-10 w-full bg-orange-500 text-white hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                              data-testid="button-send-microsoft-inbox-reply"
                            >
                              {replyMutation.isPending
                                ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                                : replyMutation.isSuccess
                                  ? <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
                                  : <Send className="mr-2 h-4 w-4" aria-hidden="true" />}
                              {replyMutation.isPending ? "Sending" : "Send reply"}
                            </Button>
                          </div>
                        </form>
                      </div>
                    </article>
                  ) : (
                    <StateMessage title="Message is unavailable" icon={Mail}>
                      Refresh the inbox and select the message again.
                    </StateMessage>
                  )}
                </>
              )}
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-white/35">
            Messages are opened without changing their read status. Search covers the latest 50 loaded messages.
          </p>
        </>
      )}
    </section>
  );
}
