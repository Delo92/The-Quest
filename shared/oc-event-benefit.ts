export type OCEventRole = "artist" | "host";

export interface OCBenefitEvent {
  id: number;
  title: string;
  category: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  endDateTbd?: boolean;
  createdBy: string | null;
}

export interface OCBenefitEntry {
  id: number;
  competitionId: number;
  talentProfileId: number;
  applicationStatus: string;
  stageResults?: Record<string, string>;
}

export const OC_EVENT_OFFER = {
  code: "QUEST_EVENT_AUTOMATION",
  plan: "gold",
  feature: "social_media_automation",
  planMonthlyPriceCents: 10500,
  currency: "USD",
} as const;

export const benefitMessages: Record<string, string> = {
  eligible: "Eligible for the event-based OC offer.",
  account_removed: "The Quest account no longer exists.",
  role_changed: "The Quest account no longer has the required role.",
  event_removed: "The event was removed.",
  event_cancelled: "The event was cancelled.",
  event_ended: "The event has ended.",
  event_not_active: "The event is not active or voting.",
  event_end_unconfirmed: "The event needs a confirmed end date before this offer can start.",
  host_removed: "This account no longer hosts the event.",
  entry_removed: "The contestant has withdrawn or was removed from the event.",
  entry_not_approved: "The contestant entry is no longer approved.",
  entry_replaced: "The original contestant entry no longer exists.",
  contestant_eliminated: "The contestant was eliminated.",
  offer_already_assigned: "The one-time Quest offer is already assigned to a different event or entry.",
  handoff_expired: "The signup link expired. Return to Quest to continue.",
};

export function evaluateOCEventBenefit(input: {
  uid: string;
  role: OCEventRole;
  accountLevel: number | null;
  event: OCBenefitEvent | null;
  entry: OCBenefitEntry | null;
  profileId: number | null;
  originalEntryId?: number | null;
  originalProfileId?: number | null;
  now: number;
}): { eligible: boolean; reason: string; expiresAt: string | null } {
  const fail = (reason: string) => ({ eligible: false, reason, expiresAt: null });
  if (input.accountLevel === null) return fail("account_removed");
  if (input.accountLevel !== (input.role === "host" ? 3 : 2)) return fail("role_changed");
  const event = input.event;
  if (!event) return fail("event_removed");
  const status = event.status.toLowerCase();
  if (["cancelled", "canceled"].includes(status)) return fail("event_cancelled");
  if (["completed", "ended", "archived", "deleted"].includes(status)) return fail("event_ended");
  // Match the app's date-only deadline convention: include the entire UTC day.
  const dateOnly = event.endDate && /^\d{4}-\d{2}-\d{2}$/.test(event.endDate);
  const end = event.endDate ? Date.parse(dateOnly ? `${event.endDate}T23:59:59.999Z` : event.endDate) : NaN;
  const validDate = Number.isFinite(end) && (!dateOnly || new Date(end).toISOString().slice(0, 10) === event.endDate);
  if (!event.endDateTbd && validDate && end <= input.now) return fail("event_ended");
  if (!["active", "voting"].includes(status)) return fail("event_not_active");
  if (event.endDateTbd || !validDate) return fail("event_end_unconfirmed");
  if (input.role === "host") {
    if (event.createdBy !== input.uid) return fail("host_removed");
  } else {
    const entry = input.entry;
    if (!entry || input.profileId === null || entry.competitionId !== event.id
      || entry.talentProfileId !== input.profileId) return fail("entry_removed");
    if ((input.originalEntryId != null && entry.id !== input.originalEntryId)
      || (input.originalProfileId != null && input.profileId !== input.originalProfileId)) {
      return fail("entry_replaced");
    }
    if (entry.applicationStatus !== "approved") return fail("entry_not_approved");
    if (Object.values(entry.stageResults ?? {}).includes("eliminated")) return fail("contestant_eliminated");
  }
  return { eligible: true, reason: "eligible", expiresAt: new Date(end).toISOString() };
}
