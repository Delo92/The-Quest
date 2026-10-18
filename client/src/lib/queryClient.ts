import { MutationCache, QueryCache, QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthToken } from "@/hooks/use-auth";
import { logClientError } from "@/lib/client-error-logger";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Request failed with an unknown error";
}

function errorStatusCode(error: unknown): number | undefined {
  const match = errorMessage(error).match(/^\s*(\d{3})\s*:/);
  return match ? Number(match[1]) : undefined;
}

function errorStack(error: unknown, fallback: string): string | undefined {
  if (error && typeof error === "object" && "stack" in error && typeof error.stack === "string") {
    return error.stack;
  }
  return new Error(fallback).stack;
}

function safeEndpoint(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.startsWith("/")) return undefined;
  return value.split("?")[0].slice(0, 500);
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
  };
  if (data) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      headers: getAuthHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

const queryCache = new QueryCache({
  onError: (error, query) => {
    const endpoint = safeEndpoint(query.queryKey[0]);
    const wasShownToUser = query.getObserversCount() > 0;
    void logClientError({
      errorType: "api",
      severity: "error",
      message: errorMessage(error),
      error,
      stackTrace: errorStack(error, `React Query request failed${endpoint ? `: ${endpoint}` : ""}`),
      endpoint,
      method: "GET",
      statusCode: errorStatusCode(error),
      wasShownToUser,
      context: { source: "react-query-query" },
    });
  },
});

const mutationCache = new MutationCache({
  onError: (error, _variables, _context, mutation) => {
    // Mutation instances do not expose observer counts in this TanStack Query
    // version. An explicit mutation-level onError handler is the app's signal
    // that the failure is surfaced by the calling UI (usually as a toast).
    const wasShownToUser = typeof mutation.options.onError === "function";
    void logClientError({
      errorType: "api",
      severity: "error",
      message: errorMessage(error),
      error,
      stackTrace: errorStack(error, "React Query mutation failed"),
      method: "MUTATION",
      statusCode: errorStatusCode(error),
      wasShownToUser,
      context: {
        source: "react-query-mutation",
        mutationKey: mutation.options.mutationKey?.map((part) => (
          typeof part === "string" || typeof part === "number" ? String(part) : typeof part
        )).join("/"),
      },
    });
  },
});

export const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
