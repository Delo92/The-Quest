export const VOTE_COUNT_UPDATED_EVENT = "quest:vote-count-updated";

export function notifyVoteCountUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(VOTE_COUNT_UPDATED_EVENT));
  }
}
