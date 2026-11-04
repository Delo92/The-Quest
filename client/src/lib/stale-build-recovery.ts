const RELOAD_KEY = "quest-stale-build-reload-at";
const RELOAD_WINDOW_MS = 60_000;

export function isStaleBuildError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(message);
}

/**
 * Reloads once per minute so a visitor with a pre-deploy tab gets the current
 * build. Returns false when a reload already happened, so a real outage can
 * still surface instead of looping.
 */
export function reloadForNewBuild(): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_WINDOW_MS) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
