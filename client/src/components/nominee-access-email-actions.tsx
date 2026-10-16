import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Nominee {
  id: string;
  fullName: string;
  email: string;
  type?: string;
  status: string;
  nominationStatus?: string | null;
  accessEmailStatus?: string;
  accessEmailLastAttemptAt?: string;
}

export default function NomineeAccessEmailActions({ submissions, single = false }: {
  submissions: Nominee[];
  single?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<{ sent: number; failed: string[] } | null>(null);
  const { toast } = useToast();
  const seen = new Set<string>();
  const recipients = submissions.filter((sub) => {
    const email = sub.email?.trim().toLowerCase();
    if (sub.type !== "nomination" || sub.status !== "approved"
      || sub.nominationStatus === "not_interested" || !email || seen.has(email)) return false;
    seen.add(email);
    return true;
  });
  const send = useMutation({
    mutationFn: async () => {
      let sent = 0;
      const failed: string[] = [];
      for (const sub of recipients) {
        try {
          await apiRequest("POST", `/api/admin/join/submissions/${encodeURIComponent(sub.id)}/send-access-email`);
          sent++;
        } catch (error) {
          failed.push(`${sub.fullName}: ${error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Delivery failed"}`);
        }
      }
      return { sent, failed };
    },
    onSuccess: (result) => {
      setResults(result);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/join/submissions"] });
      toast({
        title: `${result.sent} access email${result.sent === 1 ? "" : "s"} sent`,
        description: result.failed.length ? `${result.failed.length} failed. See details before retrying.` : "Recipients can sign in or securely choose a password.",
        variant: result.failed.length ? "destructive" : "default",
      });
    },
  });
  const previous = single ? submissions[0] : undefined;
  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" className="min-h-11 w-full border-white/20 text-white sm:w-auto"
        disabled={!recipients.length || send.isPending}
        data-testid={single ? `send-nominee-access-${previous?.id}` : "send-all-nominee-access"}
        onClick={() => { setResults(null); setOpen(true); }}>
        <Mail className="mr-2 h-4 w-4" />
        {single ? "Send login / password setup email" : "Send login emails to existing nominees"}
      </Button>
      {previous?.accessEmailStatus && <p className="text-xs text-white/60">
        Last email: {previous.accessEmailStatus === "sent" ? "accepted by email provider" : "delivery failed"}
        {previous.accessEmailLastAttemptAt ? ` · ${new Date(previous.accessEmailLastAttemptAt).toLocaleString()}` : ""}
      </p>}
      <Dialog open={open} onOpenChange={(value) => { if (!send.isPending) setOpen(value); }}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto border-white/15 bg-[#202020] text-white">
          <DialogHeader><DialogTitle>Send account access instructions</DialogTitle></DialogHeader>
          <p className="text-sm leading-relaxed text-white/75">
            Send to {single ? recipients[0]?.fullName : `${recipients.length} unique approved nominees`}.
            Each email includes a prefilled login button and a secure password setup/reset link.
            Existing passwords will not be changed by sending the email.
          </p>
          {!single && <p className="text-xs text-white/60">Rejected nominations and people marked Not Interested are excluded. Duplicate email addresses receive one message.</p>}
          {results && <div role="status" className="space-y-2 rounded-md border border-white/15 p-3 text-sm">
            <p>{results.sent} sent · {results.failed.length} failed</p>
            {results.failed.map((message) => <p key={message} className="break-words text-orange-200">{message}</p>)}
          </div>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" disabled={send.isPending} onClick={() => setOpen(false)}>Close</Button>
            {!results && <Button disabled={send.isPending || !recipients.length} onClick={() => send.mutate()}>
              {send.isPending ? "Sending emails…" : `Send ${recipients.length === 1 ? "email" : `${recipients.length} emails`}`}
            </Button>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
