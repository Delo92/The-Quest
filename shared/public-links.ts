export function safeExternalHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value.trim());
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

function parseSocialLinksRecord(value: unknown): Record<string, unknown> {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return {};
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as Record<string, unknown>;
}

export function parsePublicLinks(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(parseSocialLinksRecord(value))
      .map(([label, url]) => [label, safeExternalHttpUrl(url)] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
  );
}

export function parseCustomPublicLinks(value: unknown): Array<{ label: string; url: string }> {
  const customLinks = parseSocialLinksRecord(value).customLinks;
  if (!Array.isArray(customLinks)) return [];

  return customLinks.slice(0, 5).flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const link = item as Record<string, unknown>;
    const label = typeof link.label === "string" ? link.label.trim().slice(0, 30) : "";
    const url = safeExternalHttpUrl(link.url);
    return label && url ? [{ label, url }] : [];
  });
}