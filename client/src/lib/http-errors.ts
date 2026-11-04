export class HttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

/** A missing or removed page is an expected outcome, not a site fault. */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof HttpError && (error.status === 404 || error.status === 410);
}

/** Retry only network drops, rate limits and server errors, never missing or forbidden pages. */
export function shouldRetryRequest(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (error instanceof HttpError) return error.status >= 500 || error.status === 429;
  return true;
}

export function retryDelay(attempt: number): number {
  return Math.min(1_000 * 2 ** attempt, 4_000);
}

export async function fetchPublicJson<T>(url: string, failureMessage: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new HttpError(failureMessage, response.status);
  return response.json() as Promise<T>;
}
