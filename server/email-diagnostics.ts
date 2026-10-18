import { randomUUID } from "node:crypto";
import { logError, type ErrorType } from "./services/errorLogger";

export type EmailDiagnosticStage =
  | "nominee_access_send"
  | "password_reset_link"
  | "nominee_account_setup";

export type SafeEmailErrorDetails = {
  name: string;
  message: string;
  stackTrace?: string;
  code?: string;
  command?: string;
  responseCode?: number;
};

function redactDiagnosticText(value: unknown, limit: number): string {
  return String(value ?? "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]")
    .replace(/([?&](?:continueUrl|oobCode|code|token|email|password|key|secret)=)[^&#\s]+/gi, "$1[REDACTED]")
    .replace(/\b(access_token|refresh_token|id_token|client_secret)\s*[:=]\s*[^\s&]+/gi, "$1=[REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .slice(0, limit);
}

function safeIdentifier(value: unknown, maxLength = 80): string | undefined {
  if (typeof value !== "string" || !/^[A-Za-z0-9_./ -]+$/.test(value)) return undefined;
  return value.slice(0, maxLength);
}

export function getSafeEmailErrorDetails(error: unknown): SafeEmailErrorDetails {
  const candidate = error && typeof error === "object"
    ? error as Record<string, unknown>
    : {};
  const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
  const stack = error instanceof Error ? error.stack : undefined;
  const responseCode = candidate.responseCode;

  return {
    name: safeIdentifier(error instanceof Error ? error.name : candidate.name) || "Error",
    message: redactDiagnosticText(message, 1_000) || "Unknown error",
    ...(stack ? { stackTrace: redactDiagnosticText(stack, 8_000) } : {}),
    ...(safeIdentifier(candidate.code) ? { code: safeIdentifier(candidate.code) } : {}),
    ...(safeIdentifier(candidate.command, 40) ? { command: safeIdentifier(candidate.command, 40) } : {}),
    ...(typeof responseCode === "number" && Number.isInteger(responseCode)
      ? { responseCode }
      : {}),
  };
}

export async function logEmailDiagnostic(input: {
  stage: EmailDiagnosticStage;
  error: unknown;
  diagnosticId?: string;
  endpoint?: string;
}) {
  const diagnosticId = input.diagnosticId || randomUUID();
  const details = getSafeEmailErrorDetails(input.error);
  const isFallback = input.stage === "password_reset_link";
  const errorType: ErrorType = input.stage === "password_reset_link"
    ? "authentication"
    : "email";
  const provider = input.stage === "password_reset_link" || input.stage === "nominee_account_setup"
    ? "firebase-auth"
    : "gmail-smtp";

  await logError({
    errorType,
    severity: isFallback ? "warning" : "error",
    message: `${input.stage}: ${details.message}`,
    ...(details.stackTrace ? { stackTrace: details.stackTrace } : {}),
    ...(input.endpoint
      ? { endpoint: input.endpoint }
      : input.stage === "nominee_access_send" || input.stage === "nominee_account_setup"
        ? { endpoint: "/api/join/nominate" }
        : {}),
    method: "POST",
    wasShownToUser: false,
    idempotencyKey: `quest-email:${input.stage}:${diagnosticId}`,
    context: {
      diagnosticId,
      stage: input.stage,
      provider,
      errorName: details.name,
      ...(details.code ? { errorCode: details.code } : {}),
      ...(details.command ? { smtpCommand: details.command } : {}),
      ...(details.responseCode !== undefined ? { smtpResponseCode: details.responseCode } : {}),
    },
  });

  return diagnosticId;
}
