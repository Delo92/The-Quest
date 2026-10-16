interface ScopeInput {
  userLevel?: number;
  authLevel?: number;
  roles: string[];
  ownsCompetition: boolean;
  authExists: boolean;
  disabled?: boolean;
  email?: string;
}

export function artistResetEligibility(input: ScopeInput): "eligible" | "host-admin" | "not-artist" | "missing-account" | "disabled" | "missing-email" | "role-conflict" {
  const roles = input.roles.map((role) => role.trim().toLowerCase());
  if (Number(input.userLevel) >= 3 || Number(input.authLevel) >= 3
    || roles.some((role) => role === "host" || role === "admin") || input.ownsCompetition) return "host-admin";
  if (Number(input.userLevel) !== 2 && Number(input.authLevel) !== 2
    && !roles.some((role) => ["talent", "artist", "competitor"].includes(role))) return "not-artist";
  if (!input.authExists) return "missing-account";
  if (input.disabled) return "disabled";
  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return "missing-email";
  if (Number(input.userLevel) !== 2) return "role-conflict";
  return "eligible";
}
