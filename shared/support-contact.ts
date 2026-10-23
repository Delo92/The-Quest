export const SUPPORT_EMAIL = "info@cbpublishing.live";

/** Keep intentional contact overrides, but never publish the old placeholder. */
export function resolveSupportEmail(configuredEmail?: string | null): string {
  const email = configuredEmail?.trim();
  return !email || email.toLowerCase() === "admin@thequest.com" ? SUPPORT_EMAIL : email;
}
