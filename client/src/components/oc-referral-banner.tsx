import { useEffect, useId, useState } from "react";
import { ArrowUpRight, ChevronDown, Loader2, Megaphone } from "lucide-react";
import { useGetOCReferralEvents, useStartOCEventReferral, getGetOCReferralEventsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface OCReferralBannerProps {
  audience: "artist" | "host";
}

export default function OCReferralBanner({ audience }: OCReferralBannerProps) {
  const uid = useId();
  const profileType = audience === "artist" ? "contestant" : "host";
  const { user, isLoading } = useAuth();
  const [choice, setChoice] = useState("");
  const [error, setError] = useState("");
  const eventsQuery = useGetOCReferralEvents({
    query: {
      enabled: !!user && !isLoading,
      queryKey: [...getGetOCReferralEventsQueryKey(), user?.uid],
      retry: 1,
      staleTime: 0,
    },
  });
  const startMutation = useStartOCEventReferral();
  const events = eventsQuery.data?.events ?? [];
  const eligibleEvents = events.filter((event) => event.eligible);
  const selectedId = choice || (eligibleEvents.length === 1 ? String(eligibleEvents[0].competitionId) : "");
  const selectedEvent = eligibleEvents.find((event) => String(event.competitionId) === selectedId);
  useEffect(() => { setChoice(""); setError(""); }, [user?.uid]);

  const continueToOC = async () => {
    if (!selectedEvent || startMutation.isPending) return;
    setError("");
    const destination = window.open("about:blank", "_blank");
    if (!destination) {
      setError("Allow a new tab for Original Concepts, then try again.");
      return;
    }
    destination.opener = null;
    try {
      const result = await startMutation.mutateAsync({ data: { competitionId: selectedEvent.competitionId } });
      if (!destination.closed) destination.location.replace(result.referralUrl);
    } catch (requestError) {
      destination.close();
      setError(requestError instanceof Error ? requestError.message : "Could not verify this event. Please try again.");
      void eventsQuery.refetch();
    }
  };

  return (
    <section
      className="rounded-xl border border-orange-400/20 bg-orange-400/[0.05] p-4 sm:p-5"
      aria-labelledby={`oc-referral-title-${uid}`}
      data-testid={`oc-referral-banner-${audience}`}
    >
      <div className="space-y-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-400/10 text-orange-300">
            <Megaphone className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 id={`oc-referral-title-${uid}`} className="text-sm font-semibold text-white">
              Free social automation for your Quest event
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-white/70">
              Eligible participants get OC’s Gold social automation package, normally $105/month, free during their Quest event. Promo code{" "}
              <span className="font-semibold text-orange-200">THE QUEST</span>.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-white/55">
              When you continue, Quest shares your name, saved email, social links, and selected event details with OC to prefill setup and verify the offer. This does not connect OC to Quest or authorize Quest to publish.
            </p>
            <details className="group mt-2 text-xs leading-relaxed text-white/65">
              <summary className="flex min-h-8 cursor-pointer list-none items-center gap-1 font-medium text-orange-200 [&::-webkit-details-marker]:hidden">
                Offer eligibility and expiration
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="mt-1">
                The free benefit ends when the event ends or is cancelled, you withdraw or are removed, or you are eliminated. A confirmed event end date{audience === "artist" ? " and an approved entry are" : " is"} required.
              </p>
            </details>
          </div>
        </div>
        {eventsQuery.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-white/65" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking your Quest events…
          </p>
        ) : eventsQuery.isError ? (
          <div className="space-y-2" role="alert">
            <p className="break-words text-sm text-red-100">Could not verify your event associations. Try again before continuing to OC.</p>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => void eventsQuery.refetch()}>Retry event check</Button>
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-white/65">
            {eventsQuery.data?.claimedCompetitionId
              ? "Your one-time offer is already assigned to a previous event. It cannot restart for another event."
              : audience === "host" ? "Create an active Quest event with a confirmed end date to use this offer." : "Join a Quest event and have your entry approved to use this offer."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="min-w-0 space-y-2">
              {events.length === 1 && selectedEvent ? (
                <p className="text-sm text-white/80">Event: <span className="font-semibold text-white">{selectedEvent.title}</span></p>
              ) : (<>
              <Label htmlFor={`oc-referral-event-${uid}`} className="text-sm text-white">Event for your one-time Quest offer</Label>
              <select
                id={`oc-referral-event-${uid}`}
                value={selectedEvent ? selectedId : ""}
                onChange={(event) => { setChoice(event.target.value); setError(""); }}
                disabled={startMutation.isPending || eligibleEvents.length === 0}
                className="min-h-11 w-full min-w-0 rounded-md border border-white/20 bg-[#222] px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-60"
                data-testid={`select-oc-referral-event-${uid}`}
              >
                <option value="" disabled>{eligibleEvents.length ? "Choose the event that brings you to OC" : "No eligible event available"}</option>
                {events.map((event) => (
                  <option key={event.competitionId} value={String(event.competitionId)} disabled={!event.eligible}>
                    {event.title}{event.eligible ? "" : ` — ${event.message}`}
                  </option>
                ))}
              </select>
              </>)}
              {selectedEvent?.endDate && <p className="text-xs text-white/60">Event end: {selectedEvent.endDate.slice(0, 10)}. Subject to OC eligibility checks.</p>}
              {eligibleEvents.length === 0 && <p className="text-xs text-orange-100" role="status">{events.find((event) => event.competitionId === eventsQuery.data?.claimedCompetitionId)?.message || events[0]?.message}</p>}
            </div>
            <Button
              type="button"
              onClick={() => void continueToOC()}
              disabled={!selectedEvent || startMutation.isPending}
              className="min-h-11 w-full shrink-0 gap-2 bg-orange-500 text-white hover:bg-orange-400 md:w-auto"
              data-testid={`button-oc-referral-${audience}`}
            >
              {startMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowUpRight className="h-4 w-4" aria-hidden="true" />}
              Send my {profileType} identity to OC
            </Button>
          </div>
        )}
        {error && <p className="break-words text-sm text-red-100" role="alert">{error}</p>}
      </div>
    </section>
  );
}
