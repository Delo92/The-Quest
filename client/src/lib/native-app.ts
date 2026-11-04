import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { getFirebaseAuth } from "@/lib/firebase";

/** True only inside the iPhone/Android app shell, never in a normal browser. */
export const isNativeApp = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

const QUEST_BASE = "/thequest";

/** Opens a page in the phone's own browser (Safari / Chrome), outside the app. */
export function openInSystemBrowser(url: string): void {
  void Browser.open({ url });
}

function isCheckoutPath(pathname: string): boolean {
  return pathname.startsWith(`${QUEST_BASE}/checkout/`);
}

/**
 * Purchases never happen inside the app. In the app, checkout opens the website
 * in the phone's browser; on the website it navigates normally.
 */
function withAccountEmail(url: URL): URL {
  const email = getFirebaseAuth()?.currentUser?.email;
  if (email && !url.searchParams.has("email")) url.searchParams.set("email", email);
  return url;
}

export function goToCheckout(path: string): void {
  const url = new URL(path.startsWith("/thequest") ? path : `${QUEST_BASE}${path}`, window.location.origin);
  if (isNativeApp()) openInSystemBrowser(withAccountEmail(url).toString());
  else window.location.assign(url.toString());
}

/**
 * App-only link handling: checkout and any other website open in the phone's
 * browser, and links shared as https://cbpublishing.live/thequest/... open the app.
 */
export function installNativeLinkHandling(): void {
  if (!isNativeApp()) return;

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!anchor || anchor.hasAttribute("download")) return;
    let url: URL;
    try {
      url = new URL(anchor.href, window.location.href);
    } catch {
      return;
    }
    if (url.protocol === "mailto:" || url.protocol === "tel:" || url.protocol === "sms:") return;
    const insideQuest = url.origin === window.location.origin
      && url.pathname.startsWith(QUEST_BASE)
      && !isCheckoutPath(url.pathname);
    if (insideQuest && anchor.target !== "_blank") return;
    // Checkout, other websites, and the main info site all open in the phone's browser.
    event.preventDefault();
    event.stopPropagation();
    openInSystemBrowser((isCheckoutPath(url.pathname) && url.origin === window.location.origin ? withAccountEmail(url) : url).toString());
  }, true);

  void CapacitorApp.addListener("appUrlOpen", ({ url }) => {
    try {
      const target = new URL(url);
      if (isCheckoutPath(target.pathname)) {
        openInSystemBrowser(target.toString());
      } else if (target.pathname.startsWith(QUEST_BASE)) {
        window.location.assign(`${target.pathname}${target.search}${target.hash}`);
      }
    } catch {
      // Ignore malformed links.
    }
  });
}
