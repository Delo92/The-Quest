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

function getErrorDetails(error: unknown): { message?: string; stackTrace?: string } {
  if (error instanceof Error) {
    return { message: error.message, stackTrace: error.stack };
  }
  if (typeof error === "string") return { message: error };
  return {};
}

function getDeviceTag(): string {
  if (typeof navigator === "undefined") return "Unknown device";
  const userAgent = navigator.userAgent;
  const device = /iPhone|iPad|iPod/.test(userAgent)
    ? "iPhone/iPad"
    : /Android/.test(userAgent)
      ? "Android"
      : /Macintosh/.test(userAgent)
        ? "Mac"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "Unknown device";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "Browser";
  const mobile = /Mobile|Android|iPhone|iPad|iPod/.test(userAgent) ? "Mobile" : "Desktop";
  return `${device} · ${browser} · ${mobile}`;
}

export async function logClientError(input: ClientErrorInput): Promise<void> {
  if (typeof window === "undefined" || !input.message?.trim()) return;

  try {
    const auth = getFirebaseAuth();
    const currentUser = auth?.currentUser;
    const token = await getIdToken().catch(() => null);
    const details = getErrorDetails(input.error);
    const message = `${input.message.trim().slice(0, 900)} [${getDeviceTag()}]`;

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