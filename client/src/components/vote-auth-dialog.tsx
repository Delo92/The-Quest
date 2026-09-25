import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link, useLocation } from "wouter";

interface VoteAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function isVoteAuthenticationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /^\s*401(?:\s|:)/.test(message)
    || /\b(?:unauthenticated|authentication required|login required)\b/i.test(message);
}

export function VoteAuthDialog({ open, onOpenChange }: VoteAuthDialogProps) {
  const [location] = useLocation();
  const returnTo = `${location}${window.location.search}`;
  const authQuery = new URLSearchParams({
    level: "1",
    requireAccount: "1",
    returnTo,
  }).toString();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-h-[90dvh] max-w-md overflow-y-auto border-white/10 bg-[#111] text-white">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Log in or create an account to vote
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Sign in to cast your vote. You’ll return to this competition afterward.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button
            asChild
            className="min-h-11 w-full rounded-none bg-[#FF5A09] font-bold text-white hover:bg-[#E84F06]"
          >
            <Link href={`/login?${authQuery}`} onClick={() => onOpenChange(false)}>
              Log in
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="min-h-11 w-full rounded-none border-white/25 bg-transparent font-bold text-white hover:bg-white/10"
          >
            <Link href={`/register?${authQuery}`} onClick={() => onOpenChange(false)}>
              Create account
            </Link>
          </Button>
        </div>

        <p className="text-center text-xs leading-relaxed text-white/45">
          After signing in, tap Vote again to submit your vote.
        </p>
      </DialogContent>
    </Dialog>
  );
}