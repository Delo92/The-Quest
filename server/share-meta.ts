import { storage } from "./storage";
import { firestoreReferrals } from "./firestore-collections";
import { slugify } from "../shared/slugify";

interface ShareMeta {
  title: string;
  description: string;
  image?: string | null;
  url: string;
}

const publicOrigin = () => {
  const configured = process.env.SITE_URL || "https://cbpublishing.live";
  return /^https?:\/\//i.test(configured) ? configured.replace(/\/+$/, "") : `https://${configured.replace(/\/+$/, "")}`;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function replaceMeta(template: string, attr: "name" | "property", key: string, value: string) {
  const escaped = escapeHtml(value);
  const pattern = new RegExp(`<meta\\s+${attr}="${key}"\\s+content="[^"]*"\\s*/?>`, "i");
  const replacement = `<meta ${attr}="${key}" content="${escaped}" />`;
  return pattern.test(template) ? template.replace(pattern, replacement) : template.replace("</head>", `    ${replacement}\n  </head>`);
}

export function applyShareMeta(template: string, meta: ShareMeta) {
  const description = meta.description.slice(0, 300);
  let page = template.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);
  page = replaceMeta(page, "name", "description", description);
  page = replaceMeta(page, "property", "og:title", meta.title);
  page = replaceMeta(page, "property", "og:description", description);
  page = replaceMeta(page, "property", "og:url", meta.url);
  page = replaceMeta(page, "property", "og:image", meta.image || `${publicOrigin()}/cb-logo-favicon.png?v=cbp-20260905`);
  page = replaceMeta(page, "name", "twitter:title", meta.title);
  page = replaceMeta(page, "name", "twitter:description", description);
  page = replaceMeta(page, "name", "twitter:image", meta.image || `${publicOrigin()}/cb-logo-favicon.png?v=cbp-20260905`);
  page = page.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${escapeHtml(meta.url)}" />`,
  );
  return page;
}

async function getCompetitionBySlugs(categorySlug: string, titleSlug: string) {
  const competitions = await storage.getCompetitions();
  return competitions.find((competition) =>
    slugify(competition.category) === categorySlug && slugify(competition.title) === titleSlug
  ) || null;
}

export async function getShareMeta(requestUrl: string, host: string): Promise<ShareMeta | null> {
  const url = new URL(requestUrl, `${requestUrl.startsWith("https") ? "" : "http"}://${host}`);
  const origin = publicOrigin();
  const ref = url.searchParams.get("ref")?.trim().toUpperCase();

  if (ref) {
    const referral = await firestoreReferrals.resolveCode(ref);
    const competition = referral?.competitionId ? await storage.getCompetition(referral.competitionId) : null;
    if (!referral || !competition) return null;
    const hostName = referral.ownerName || competition.title;
    return {
      title: `${competition.title} — Hosted by ${hostName}`,
      description: competition.description || `Join ${competition.title}, hosted by ${hostName}.`,
      image: competition.coverImage,
      url: `${origin}/?ref=${encodeURIComponent(referral.code)}`,
    };
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 3 && parts[0] === "thequest") {
    const competition = await getCompetitionBySlugs(parts[1], parts[2]);
    if (!competition) return null;
    return {
      title: `${competition.title} — ${competition.category} Competition`,
      description: competition.description || `View events, contestants, and voting for ${competition.title}.`,
      image: competition.coverImage,
      url: `${origin}/thequest/${slugify(competition.category)}/${slugify(competition.title)}`,
    };
  }

  return null;
}