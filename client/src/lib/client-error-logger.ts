import { getFirebaseAuth, getIdToken } from "@/lib/firebase";

export type ClientErrorInput = {
  errorType?: string;
  severity?: "critical" | "error" | "warning" | "info";
  message: string;
  error?: unknown;
  stackTrace?: string;
  statusCode?: number;
  endpoint?: string;
  method?: string;
  wasShownToUser?: boolean;
  idempotencyKey?: string;
  context?: Record<string, unknown>;
};

let handlersInstalled = false;
const recentReactQueryErrors: Array<{
  message: string;
  route: string;
  expiresAt: number;
}> = [];

function getErrorDetails(error: unknown): { message?: string; stackTrace?: string } {
  if (error instanceof Error) {
    return { message: error.message, stackTrace: error.stack };
  }
  if (typeof error === "string") return { message: error };
  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; stack?: unknown };
    return {
      message: typeof candidate.message === "string" ? candidate.message : undefined,
      stackTrace: typeof candidate.stack === "string" ? candidate.stack : undefined,
    };
  }
  return {};
}

function normalizeErrorMessage(message: string): string {
  let normalized = message.trim().replace(/^\d{3}:\s*/, "");
  try {
    const parsed = JSON.parse(normalized);
    if (parsed && typeof parsed.message === "string") normalized = parsed.message;
  } catch {
    // Most API errors are plain text; keep the original when not JSON.
  }
  return normalized.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Query/mutation cache handlers record the underlying exception first. Avoid
 * adding a second, lower-detail toast record when that same failure is shown.
 */
export function wasRecentlyLoggedReactQueryError(message: string): boolean {
  if (typeof window === "undefined") return false;
  const now = Date.now();
  const route = window.location.pathname;
  const visibleMessage = normalizeErrorMessage(message);
  if (visibleMessage.length < 4) return false;
  for (let index = recentReactQueryErrors.length - 1; index >= 0; index -= 1) {
    const item = recentReactQueryErrors[index];
    if (item.expiresAt <= now) {
      recentReactQueryErrors.splice(index, 1);
      continue;
    }
    if (
      item.route === route
      && item.message.length >= 8
      && (visibleMessage.includes(item.message) || item.message.includes(visibleMessage))
    ) {
      return true;
    }
  }
  return false;
}

function getDeviceInfo() {
  if (typeof navigator === "undefined") {
    return {
      userAgent: undefined,
      browser: "Unknown",
      browserVersion: undefined,
      operatingSystem: "Unknown",
      operatingSystemVersion: undefined,
      deviceType: "Unknown",
      isMobile: false,
      isTablet: false,
    };
  }

  const userAgent = navigator.userAgent;
  const isMobile = /Mobile|Android|iPhone|iPod/i.test(userAgent);
  const isTablet = /iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent);
  const deviceType = isTablet ? "Tablet" : isMobile ? "Mobile" : "Desktop";

  const browserMatch = userAgent.match(
    /(Edg|OPR|Chrome|Firefox|Version|Safari)\/([\d.]+)/i,
  );
  const browser = /Edg\//i.test(userAgent)
    ? "Edge"
    : /OPR\//i.test(userAgent)
      ? "Opera"
      : /Firefox\//i.test(userAgent)
        ? "Firefox"
        : /Chrome\//i.test(userAgent)
          ? "Chrome"
          : /Safari\//i.test(userAgent)
            ? "Safari"
            : "Browser";
  const browserVersion = browserMatch?.[2];

  let operatingSystem = "Unknown";
  let operatingSystemVersion: string | undefined;
  const iosMatch = userAgent.match(/(?:iPhone OS|CPU OS)\s([\d_]+)/i);
  const androidMatch = userAgent.match(/Android\s([\d.]+)/i);
  const windowsMatch = userAgent.match(/Windows NT\s([\d.]+)/i);
  const macMatch = userAgent.match(/Mac OS X\s([\d_]+)/i);

  if (iosMatch) {
    operatingSystem = /iPad/i.test(userAgent) ? "iPadOS" : "iOS";
    operatingSystemVersion = iosMatch[1].replace(/_/g, ".");
  } else if (androidMatch) {
    operatingSystem = "Android";
    operatingSystemVersion = androidMatch[1];
  } else if (windowsMatch) {
    operatingSystem = "Windows";
    operatingSystemVersion = ({
      "10.0": "10/11",
      "6.3": "8.1",
      "6.2": "8",
      "6.1": "7",
    } as Record<string, string>)[windowsMatch[1]] || windowsMatch[1];
  } else if (macMatch) {
    operatingSystem = "macOS";
    operatingSystemVersion = macMatch[1].replace(/_/g, ".");
  } else if (/Linux/i.test(userAgent)) {
    operatingSystem = "Linux";
  }

  return {
    userAgent: userAgent.slice(0, 500),
    browser,
    browserVersion,
    operatingSystem,
    operatingSystemVersion,
    deviceType,
    isMobile,
    isTablet,
  };
}

export async function logClientError(input: ClientErrorInput): Promise<void> {
  if (typeof window === "undefined" || !input.message?.trim()) return;

  const source = typeof input.context?.source === "string" ? input.context.source : "";
  if (source.startsWith("react-query-") && input.wasShownToUser) {
    recentReactQueryErrors.push({
      message: normalizeErrorMessage(input.message),
      route: window.location.pathname,
      expiresAt: Date.now() + 10_000,
    });
    if (recentReactQueryErrors.length > 100) recentReactQueryErrors.splice(0, recentReactQueryErrors.length - 100);
  }

  try {
    const auth = getFirebaseAuth();
    const currentUser = auth?.currentUser;
    const token = await getIdToken().catch(() => null);
    const details = getErrorDetails(input.error);
    const deviceInfo = getDeviceInfo();
    const deviceTag = [
      deviceInfo.deviceType,
      deviceInfo.operatingSystem,
      deviceInfo.operatingSystemVersion,
      deviceInfo.browser,
    ].filter(Boolean).join(" · ");
    const message = `${input.message.trim().slice(0, 900)} [${deviceTag}]`;

    await fetch("/api/error/log-client-error", {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        errorType: input.errorType || "client",
        severity: input.severity || "error",
        message,
        stackTrace: input.stackTrace || details.stackTrace,
        userUid: currentUser?.uid,
        userName: currentUser?.displayName || undefined,
        userEmail: currentUser?.email || undefined,
        statusCode: input.statusCode,
        endpoint: input.endpoint,
        method: input.method || "CLIENT",
        route: `${window.location.pathname}${window.location.search}`,
        wasShownToUser: input.wasShownToUser ?? false,
        idempotencyKey: input.idempotencyKey,
        context: {
          ...input.context,
          route: `${window.location.pathname}${window.location.search}`,
          ...deviceInfo,
          appVersion: document.documentElement.dataset.appVersion || undefined,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          language: navigator.language,
        },
      }),
    });
  } catch {
    // Error reporting must never create a second user-facing failure.
  }
}

export function installClientErrorHandlers(): () => void {
  if (typeof window === "undefined" || handlersInstalled) return () => {};
  handlersInstalled = true;

  const handleError = (event: ErrorEvent) => {
    void logClientError({
      errorType: "client",
      severity: "error",
      message: event.message || "Unhandled browser error",
      error: event.error,
      context: {
        source: "window.error",
        filename: event.filename,
        lineNumber: event.lineno,
        columnNumber: event.colno,
      },
    });
  };

  const handleRejection = (event: PromiseRejectionEvent) => {
    const details = getErrorDetails(event.reason);
    void logClientError({
      errorType: "client",
      severity: "error",
      message: details.message || "Unhandled promise rejection",
      error: event.reason,
      context: { source: "unhandledrejection" },
    });
  };

  window.addEventListener("error", handleError);
  window.addEventListener("unhandledrejection", handleRejection);

  return () => {
    window.removeEventListener("error", handleError);
    window.removeEventListener("unhandledrejection", handleRejection);
    handlersInstalled = false;
  };
}