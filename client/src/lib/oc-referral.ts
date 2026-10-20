import { safeExternalHttpUrl } from "../../../shared/public-links";

export type OCReferralRole = "artist" | "host";

export interface OCReferralDetails {
  role: OCReferralRole;
  email?: string | null;
  displayName?: string | null;
  stageName?: string | null;
  socialLinks?: unknown;
}

function cleanSocialLinks(value: unknown): Record<string, unknown> {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return {};
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(parsed as Record<string, unknown>)) {
    if (key === "customLinks" && Array.isArray(item)) {
      const customLinks = item.flatMap((link) => {
        if (!link || typeof link !== "object" || Array.isArray(link)) return [];
        const record = link as Record<string, unknown>;
        const label = typeof record.label === "string" ? record.label.trim().slice(0, 30) : "";
        const url = safeExternalHttpUrl(record.url);
        return label && url ? [{ label, url }] : [];
      });
      if (customLinks.length) result.customLinks = customLinks.slice(0, 5);
      continue;
    }

    const url = safeExternalHttpUrl(item);
    if (url) result[key] = url;
  }
  return result;
}

export function buildOCReferralUrl(details: OCReferralDetails): string {
  const url = new URL("https://oraginalconcepts.com/s/TheQuest/referral");
  const displayName = details.displayName?.trim() || "";
  const stageName = details.stageName?.trim() || "";
  const brandName = stageName || displayName;
  const email = details.email?.trim() || "";
  const socialLinks = cleanSocialLinks(details.socialLinks);

  url.searchParams.set("source", "the-quest");
  url.searchParams.set("promoCode", "THE QUEST");
  url.searchParams.set("role", details.role);
  if (email) url.searchParams.set("email", email);
  if (brandName) url.searchParams.set("brandName", brandName);
  if (displayName) url.searchParams.set("displayName", displayName);
  if (stageName) url.searchParams.set("stageName", stageName);
  if (details.role === "artist" && brandName) url.searchParams.set("artistName", brandName);
  if (Object.keys(socialLinks).length) {
    url.searchParams.set("socialLinks", JSON.stringify(socialLinks));
  }

  return url.toString();
}
