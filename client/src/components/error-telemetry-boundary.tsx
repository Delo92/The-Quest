import { Component, type ErrorInfo, type ReactNode } from "react";
import { logClientError } from "@/lib/client-error-logger";

interface ErrorTelemetryBoundaryProps {
  children: ReactNode;
}

interface ErrorTelemetryBoundaryState {
  hasError: boolean;
}

export class ErrorTelemetryBoundary extends Component<
  ErrorTelemetryBoundaryProps,
  ErrorTelemetryBoundaryState
> {
  state: ErrorTelemetryBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorTelemetryBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const componentStack = info.componentStack?.slice(0, 8_000);
    void logClientError({
      errorType: "client",
      severity: "critical",
      message: `React render error: ${error.message || "Unknown error"}`,
      error,
      stackTrace: [error.stack, componentStack && `React component stack:\n${componentStack}`]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 12_000),
      wasShownToUser: true,
      context: {
        source: "react-error-boundary",
        route: typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : undefined,
      },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <main
          role="alert"
          className="flex min-h-screen items-center justify-center bg-[#0d0d0d] px-4 py-12 text-white"
        >
          <section className="w-full max-w-md text-center">
            <h1 className="font-serif text-2xl">Something went wrong</h1>
            <p className="mt-3 text-sm text-white/65">
              Please reload the page and try again.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 min-h-11 rounded-md bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300"
            >
              Reload page
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
