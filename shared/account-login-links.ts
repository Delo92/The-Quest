export function readLoginEmail(params: URLSearchParams): string {
  const email = (params.get("email") || "").trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export function buildAccountLoginUrl(siteUrl: string, email: string, options: {
  level?: number;
  inviteToken?: string;
  reset?: boolean;
} = {}): string {
  const url = new URL("/thequest/login", siteUrl);
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("Invalid site URL");
  url.searchParams.set("email", email.trim().toLowerCase());
  url.searchParams.set("level", String(options.level || 2));
  if (options.inviteToken) url.searchParams.set("invite", options.inviteToken);
  if (options.reset) url.searchParams.set("mode", "reset");
  return url.toString();
}
