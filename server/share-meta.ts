import { storage } from "./storage";
import { firestoreInvitations, firestoreReferrals } from "./firestore-collections";
import { extractIdFromSlug, slugify, slugifyWithId } from "../shared/slugify";
import { parsePublicLinks } from "../shared/public-links";
import { videoShareTags, type VideoShareMetadata } from "../shared/video-share";
import { getCompetitionShareVideo, getContestantShareVideo } from "./share-video";
import { normalizeVoteSupportCopy } from "../shared/vote-support-copy";
import { getCompetitionPublicDescription, getContestantDivisionLabel } from "../shared/competition-divisions";

interface ShareMeta {
  title: string;
  description: string;
  image?: string | null;
  favicon?: string | null;
  url: string;
  canonical?: string;
  ogType?: string;
  robots?: string;
  video?: VideoShareMetadata | null;
  structuredData?: unknown[];
  fallbackHtml?: string;
}

export function getPublicOrigin() {
  const configured = process.env.SITE_URL?.trim() || "https://cbpublishing.live";
  const withProtocol = /^https?:\/\//i.test(configured) ? configured : `https://${configured}`;
  try {
    return new URL(withProtocol).origin;
  } catch {
    throw new Error("SITE_URL must be a valid public site URL");
  }
}

export function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function jsonLdScript(data: unknown) {
  const json = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return `<script type="application/ld+json">${json}</script>`;
}

function breadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

type PublicFaq = { question: string; answer: string };

let publicFaqCache: { expiresAt: number; items: PublicFaq[] } | null = null;

async function getPublicFaqs(): Promise<PublicFaq[]> {
  if (publicFaqCache && publicFaqCache.expiresAt > Date.now()) return publicFaqCache.items;
  const livery = await storage.getAllLivery();
  const textByKey = new Map(livery.map((item) => [item.imageKey, item]));
  const getText = (key: string) => {
    const item = textByKey.get(key);
    const value = item?.textContent ?? item?.defaultText ?? "";
    return normalizeVoteSupportCopy(value).trim();
  };
  const items: PublicFaq[] = [];
  for (let index = 1; index <= 19; index++) {
    const question = getText(`faq_${index}_q`);
    const answer = getText(`faq_${index}_a`);
    if (question && answer) items.push({ question, answer });
  }
  publicFaqCache = { items, expiresAt: Date.now() + 60_000 };
  return items;
}

function fallbackHtml(
  title: string,
  description: string,
  links: Array<{ label: string; url: string; external?: boolean }> = [],
  details: Array<{ label: string; value: string }> = [],
  faqs: PublicFaq[] = [],
) {
  const detailMarkup = details.length
    ? `<dl>${details.map(({ label, value }) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join("")}</dl>`
    : "";
  const linkMarkup = links.length
    ? `<ul>${links.map(({ label, url, external }) =>
        `<li><a href="${escapeHtml(url)}"${external ? ' rel="me noopener noreferrer"' : ""}>${escapeHtml(label)}</a></li>`
      ).join("")}</ul>`
    : "";
  const faqMarkup = faqs.length
    ? `<section><h2>Frequently asked questions</h2>${faqs.map(({ question, answer }) =>
        `<div><h3>${escapeHtml(question)}</h3><p>${escapeHtml(answer)}</p></div>`
      ).join("")}</section>`
    : "";

  return `<noscript><main><article><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p>${detailMarkup}${faqMarkup}${linkMarkup}</article></main></noscript>`;
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
  if (meta.robots) page = replaceMeta(page, "name", "robots", meta.robots);
  page = replaceMeta(page, "name", "site-origin", getPublicOrigin());
  page = replaceMeta(page, "property", "og:title", meta.title);
  page = replaceMeta(page, "property", "og:description", description);
  page = replaceMeta(page, "property", "og:url", meta.url);
  page = replaceMeta(page, "property", "og:type", meta.ogType || "website");
  page = replaceMeta(page, "property", "og:site_name", "The Quest | CB Publishing");
  page = replaceMeta(page, "property", "og:image", meta.image || `${getPublicOrigin()}/cb-publishing-social.png`);
  if (meta.favicon) {
    const favicon = escapeHtml(meta.favicon);
    page = page.replace(
      /<link\b(?=[^>]*\brel=(["'])(?:icon|shortcut icon|apple-touch-icon)\1)[^>]*\/?>/gi,
      "",
    );
    page = page.replace("</head>", [
      `<link rel="icon" href="${favicon}" />`,
      `<link rel="shortcut icon" href="${favicon}" />`,
      `<link rel="apple-touch-icon" href="${favicon}" />`,
      "</head>",
    ].join("\n"));
  }
  if (meta.image) {
    // Dynamic profile and competition images have unknown dimensions.
    page = page.replace(/<meta\s+property="og:image:(?:width|height)"\s+content="[^"]*"\s*\/?>/gi, "");
  } else {
    page = replaceMeta(page, "property", "og:image:width", "1200");
    page = replaceMeta(page, "property", "og:image:height", "630");
  }
  page = replaceMeta(page, "name", "twitter:card", meta.video ? "player" : "summary_large_image");
  page = replaceMeta(page, "name", "twitter:title", meta.title);
  page = replaceMeta(page, "name", "twitter:description", description);
  page = replaceMeta(page, "name", "twitter:image", meta.image || `${getPublicOrigin()}/cb-publishing-social.png`);
  page = page.replace(/<meta\s+(?:property|name)="(?:og:video(?::[^"]*)?|video:duration|twitter:player(?::[^"]*)?)"\s+content="[^"]*"\s*\/?>/gi, "");
  if (meta.video) {
    const tags = videoShareTags(meta.video, getPublicOrigin())
      .map(({ attr, key, value }) => `<meta ${attr}="${key}" content="${escapeHtml(value)}" />`).join("\n");
    page = page.replace("</head>", `${tags}\n</head>`);
  }
  page = page.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${escapeHtml(meta.canonical || meta.url)}" />`,
  );
  if (meta.structuredData?.length) {
    page = page.replace("</head>", `${meta.structuredData.map(jsonLdScript).join("\n")}\n</head>`);
  }
  if (meta.fallbackHtml) {
    page = page.replace('<div id="root"></div>', `<div id="root"></div>\n${meta.fallbackHtml}`);
  }
  return page;
}

async function getCompetitionBySlugs(categorySlug: string, titleSlug: string) {
  const competitions = await storage.getCompetitions();
  return competitions.find((competition) =>
    slugify(competition.category) === categorySlug && slugify(competition.title) === titleSlug
  ) || null;
}

async function getTalentProfileShareMeta(
  profile: any,
  origin: string,
  requestedUrl: string,
): Promise<ShareMeta> {
  if (!profile || String(profile.role || "").toLowerCase() !== "talent") {
    return {
      title: "Artist profile unavailable | The Quest",
      description: "This artist profile is not available as a public profile.",
      url: requestedUrl,
      canonical: requestedUrl,
      robots: "noindex, follow",
      fallbackHtml: fallbackHtml(
        "Artist profile unavailable",
        "This artist profile is not available as a public profile.",
        [{ label: "Browse competitions", url: `${origin}/thequest/competitions` }],
      ),
    };
  }

  const id = Number(profile.id);
  const name = String(profile.stageName || profile.displayName || "Artist").trim();
  const canonical = `${origin}/thequest/talent/${id}`;
  const bio = typeof profile.bio === "string" ? profile.bio.trim() : "";
  const image = profile.imageUrls?.[0] || null;
  const links = parsePublicLinks(profile.socialLinks);
  let competitionLinks: Array<{ label: string; url: string }> = [];
  try {
    const entries = await storage.getContestantsByTalent(id);
    const approved = entries.filter((entry) => entry.applicationStatus === "approved");
    const competitions = await Promise.all(
      [...new Set(approved.map((entry) => entry.competitionId))]
        .map((competitionId) => storage.getCompetition(competitionId)),
    );
    competitionLinks = competitions
      .filter((competition): competition is NonNullable<typeof competition> =>
        !!competition && competition.status !== "draft"
      )
      .map((competition) => ({
        label: competition.title,
        url: `${origin}/thequest/${slugify(competition.category)}/${slugify(competition.title)}`,
      }));
  } catch {
    console.warn("[share-meta] Public artist competition links are temporarily unavailable");
  }

  const description = bio
    || `${name} is an artist on The Quest. Explore their public profile, work, and competition entries.`;
  const socialLinks = Object.values(links);
  const structuredData: unknown[] = [
    {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      url: canonical,
      name: `${name} | Artist Profile on The Quest`,
      mainEntity: {
        "@type": "Person",
        name,
        description: bio || undefined,
        image: image || undefined,
        jobTitle: "Artist",
        homeLocation: profile.location
          ? { "@type": "Place", name: profile.location }
          : undefined,
        ...(socialLinks.length ? { sameAs: socialLinks } : {}),
      },
    },
    breadcrumbSchema([
      { name: "The Quest", url: `${origin}/thequest` },
      { name: "Artist profiles", url: `${origin}/thequest/competitions` },
      { name, url: canonical },
    ]),
  ];

  return {
    title: `${name} | Artist Profile on The Quest`,
    description,
    image,
    url: canonical,
    canonical,
    ogType: "profile",
    structuredData,
    fallbackHtml: fallbackHtml(
      `${name} | Artist Profile`,
      description,
      [
        ...competitionLinks,
        { label: "Browse all competitions", url: `${origin}/thequest/competitions` },
        ...Object.entries(links).map(([label, href]) => ({ label, url: href, external: true })),
      ],
      [
        ...(profile.category ? [{ label: "Category", value: String(profile.category) }] : []),
        ...(profile.location ? [{ label: "Location", value: String(profile.location) }] : []),
      ],
    ),
  };
}

export async function getShareMeta(requestUrl: string, host: string): Promise<ShareMeta | null> {
  const url = new URL(requestUrl, `${requestUrl.startsWith("https") ? "" : "http"}://${host}`);
  const origin = getPublicOrigin();
  const parts = url.pathname.split("/").filter(Boolean);
  const ref = url.searchParams.get("ref")?.trim().toUpperCase();
  const isContestantProfilePath = parts.length === 4 && parts[0] === "thequest";

  // A contestant profile's URL is the source of its share card. Its `ref`
  // query may be a contestant attribution slug, not a host referral code.
  if (ref && !isContestantProfilePath) {
    const referral = await firestoreReferrals.resolveCode(ref);
    const competition = referral?.competitionId ? await storage.getCompetition(referral.competitionId) : null;
    if (referral && competition) {
      const hostName = referral.ownerName || competition.title;
      return {
        title: `${competition.title} — Hosted by ${hostName}`,
        description: competition.description || `Join ${competition.title}, hosted by ${hostName}.`,
        image: competition.coverImage,
        url: `${origin}/?ref=${encodeURIComponent(referral.code)}`,
        canonical: `${origin}/thequest/${slugify(competition.category)}/${slugify(competition.title)}`,
      };
    }
  }

  if (
    (url.pathname === "/thequest/login" || url.pathname === "/thequest/register") &&
    typeof url.searchParams.get("invite") === "string"
  ) {
    const inviteToken = url.searchParams.get("invite")!;
    const invitation = await firestoreInvitations.getByToken(inviteToken);
    const competition = invitation?.competitionId
      ? await storage.getCompetition(invitation.competitionId)
      : null;
    if (invitation) {
      const competitionTitle = competition?.title || invitation.suggestedEventName || "The Quest";
      const title = competition
        ? `${competitionTitle} | The Quest`
        : "Invitation to The Quest";
      const description = competition?.description
        || `Continue your invitation to ${competitionTitle} on The Quest.`;
      return {
        title,
        description,
        image: competition?.coverImage || null,
        url: `${origin}${url.pathname}?invite=${encodeURIComponent(inviteToken)}`,
        canonical: `${origin}${url.pathname}`,
        fallbackHtml: fallbackHtml(
          title,
          description,
          competition
            ? [{ label: `${competitionTitle} competition`, url: `${origin}/thequest/${slugify(competition.category)}/${slugify(competition.title)}` }]
            : [{ label: "Explore The Quest", url: `${origin}/thequest` }],
        ),
      };
    }
  }

  if (url.pathname === "/") {
    const canonical = origin;
    const description = "CB Publishing develops artists and brands, promotes music, and produces The Quest, a talent competition and voting platform.";
    return {
      title: "CB Publishing | Community. Brand. Entertainment",
      description,
      url: canonical,
      canonical,
      structuredData: [{
        "@context": "https://schema.org",
        "@type": "WebPage",
        url: canonical,
        name: "CB Publishing | Community. Brand. Entertainment",
        description,
        isPartOf: { "@type": "WebSite", name: "CB Publishing", url: origin },
      }],
      fallbackHtml: fallbackHtml(
        "CB Publishing",
        description,
        [
          { label: "Explore The Quest", url: `${origin}/thequest` },
          { label: "Browse competitions", url: `${origin}/thequest/competitions` },
          { label: "About The Quest", url: `${origin}/thequest/about` },
          { label: "Contact CB Publishing", url: `${origin}/thequest/about#contact` },
        ],
      ),
    };
  }

  if (url.pathname === "/thequest" || url.pathname === "/thequest/") {
    const canonical = `${origin}/thequest`;
    const description = "Discover public talent competitions, meet competitors, vote for your favorites, nominate talent, or host an event on The Quest by CB Publishing.";
    return {
      title: "The Quest — Where Competitions Live | CB Publishing",
      description,
      url: canonical,
      canonical,
      structuredData: [{
        "@context": "https://schema.org",
        "@type": "WebPage",
        url: canonical,
        name: "The Quest — Where Competitions Live",
        description,
        isPartOf: { "@type": "WebSite", name: "CB Publishing", url: origin },
      }],
      fallbackHtml: fallbackHtml(
        "The Quest — Where Competitions Live",
        description,
        [
          { label: "Browse competitions", url: `${origin}/thequest/competitions` },
          { label: "Nominate talent", url: `${origin}/thequest/nominate` },
          { label: "Host a competition", url: `${origin}/thequest/host` },
          { label: "About The Quest", url: `${origin}/thequest/about` },
        ],
      ),
    };
  }

  if (url.pathname === "/thequest/competitions") {
    const competitions = (await storage.getCompetitions())
      .filter((competition) => competition.status !== "draft");
    const canonical = `${origin}/thequest/competitions`;
    const links = competitions.map((competition) => ({
      label: `${competition.title} — ${competition.category}`,
      url: `${origin}/thequest/${slugify(competition.category)}/${slugify(competition.title)}`,
    }));
    const description = "Browse public talent competitions on The Quest, including music, modeling, dance, fitness, and other categories.";
    return {
      title: "Browse Competitions | The Quest",
      description,
      url: canonical,
      canonical,
      structuredData: [{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        url: canonical,
        name: "Competitions on The Quest",
        description,
        mainEntity: {
          "@type": "ItemList",
          itemListElement: links.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.label,
            url: item.url,
          })),
        },
      }],
      fallbackHtml: fallbackHtml(
        "Browse Competitions on The Quest",
        description,
        [...links, { label: "Nominate talent", url: `${origin}/thequest/nominate` }],
      ),
    };
  }

  if (url.pathname === "/thequest/about") {
    const canonical = `${origin}/thequest/about`;
    const description = "Learn about The Quest, a competition and voting platform for artists, hosts, and audiences, including online and in-person event participation.";
    return {
      title: "About The Quest | CB Publishing",
      description,
      url: canonical,
      canonical,
      structuredData: [
        {
          "@context": "https://schema.org",
          "@type": "AboutPage",
          url: canonical,
          name: "About The Quest",
          description,
          isPartOf: { "@type": "WebSite", name: "The Quest", url: `${origin}/thequest` },
        },
        breadcrumbSchema([
          { name: "The Quest", url: `${origin}/thequest` },
          { name: "About", url: canonical },
        ]),
      ],
      fallbackHtml: fallbackHtml(
        "About The Quest",
        description,
        [
          { label: "Browse competitions", url: `${origin}/thequest/competitions` },
          { label: "Host a competition", url: `${origin}/thequest/host` },
          { label: "Nominate talent", url: `${origin}/thequest/nominate` },
          { label: "The Quest FAQ", url: `${origin}/thequest/faq` },
          { label: "Nonprofit program", url: `${origin}/thequest/NonProfits` },
        ],
      ),
    };
  }

  if (url.pathname === "/thequest/faq") {
    const canonical = `${origin}/thequest/faq`;
    const description = "Get answers about The Quest competitions, voting, nominations, fees, and how artists and audiences can participate.";
    let faqs: PublicFaq[] = [];
    try {
      faqs = await getPublicFaqs();
    } catch {
      console.warn("[share-meta] Public FAQ content is temporarily unavailable");
    }
    const structuredData = faqs.length ? [{
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    }] : [];
    return {
      title: "The Quest FAQ | Competitions, Voting & Nominations",
      description,
      url: canonical,
      canonical,
      structuredData,
      fallbackHtml: fallbackHtml(
        "The Quest Frequently Asked Questions",
        description,
        [
          { label: "Browse competitions", url: `${origin}/thequest/competitions` },
          { label: "Nominate talent", url: `${origin}/thequest/nominate` },
          { label: "Host a competition", url: `${origin}/thequest/host` },
        ],
        [],
        faqs,
      ),
    };
  }

  if (url.pathname === "/thequest/nominate") {
    const canonical = `${origin}/thequest/nominate`;
    const description = "Nominate yourself or another artist to join an eligible public talent competition on The Quest.";
    return {
      title: "Nominate Talent | The Quest",
      description,
      url: canonical,
      canonical,
      structuredData: [{
        "@context": "https://schema.org",
        "@type": "WebPage",
        url: canonical,
        name: "Nominate Talent on The Quest",
        description,
        isPartOf: { "@type": "WebSite", name: "The Quest", url: `${origin}/thequest` },
      }],
      fallbackHtml: fallbackHtml(
        "Nominate Talent on The Quest",
        description,
        [
          { label: "Browse competitions", url: `${origin}/thequest/competitions` },
          { label: "Learn about The Quest", url: `${origin}/thequest/about` },
          { label: "Read frequently asked questions", url: `${origin}/thequest/faq` },
        ],
      ),
    };
  }

  if (/^\/thequest\/nonprofits?$/i.test(url.pathname)) {
    const canonical = `${origin}${url.pathname}`;
    const description = "Learn about The Quest nonprofit program, participant-selected organizations, and how eligible contributions are handled.";
    return {
      title: "The Quest Nonprofit Program | CB Publishing",
      description,
      url: canonical,
      canonical,
      structuredData: [
        {
          "@context": "https://schema.org",
          "@type": "WebPage",
          url: canonical,
          name: "The Quest Nonprofit Program",
          description,
          isPartOf: { "@type": "WebSite", name: "The Quest", url: `${origin}/thequest` },
        },
        breadcrumbSchema([
          { name: "The Quest", url: `${origin}/thequest` },
          { name: "Nonprofit program", url: canonical },
        ]),
      ],
      fallbackHtml: fallbackHtml(
        "The Quest Nonprofit Program",
        description,
        [
          { label: "About The Quest", url: `${origin}/thequest/about` },
          { label: "Browse competitions", url: `${origin}/thequest/competitions` },
          { label: "Frequently asked questions", url: `${origin}/thequest/faq` },
        ],
      ),
    };
  }

  if (url.pathname === "/thequest/host") {
    const canonical = `${origin}/thequest/host`;
    const description = "Host an online or in-person talent competition on The Quest with contestant management, voting tools, and on-site QR-code voting.";
    return {
      title: "Host a Talent Competition | The Quest",
      description,
      url: canonical,
      canonical,
      structuredData: [{
        "@context": "https://schema.org",
        "@type": "WebPage",
        url: canonical,
        name: "Host a Talent Competition on The Quest",
        description,
        isPartOf: { "@type": "WebSite", name: "The Quest", url: `${origin}/thequest` },
      }],
      fallbackHtml: fallbackHtml(
        "Host a Talent Competition on The Quest",
        description,
        [
          { label: "Browse competitions", url: `${origin}/thequest/competitions` },
          { label: "About The Quest", url: `${origin}/thequest/about` },
          { label: "Frequently asked questions", url: `${origin}/thequest/faq` },
        ],
      ),
    };
  }

  if (parts.length === 3 && parts[0] === "thequest" && parts[1] === "host") {
    const requestedSlug = parts[2];
    const { id: hostId } = extractIdFromSlug(requestedSlug);
    const hostProfiles = await storage.getHostProfiles();
    const profile = hostId
      ? hostProfiles.find((item) => Number(item.id) === hostId)
      : hostProfiles.find((item) =>
          slugify(item.displayName) === requestedSlug ||
          (item.stageName && slugify(item.stageName) === requestedSlug)
        );
    if (!profile) {
      const canonical = `${origin}/thequest/host/${requestedSlug}`;
      return {
        title: "Host profile unavailable | The Quest",
        description: "This public host profile could not be found.",
        url: canonical,
        canonical,
        robots: "noindex, follow",
        fallbackHtml: fallbackHtml(
          "Host profile unavailable",
          "This public host profile could not be found.",
          [{ label: "Browse competitions", url: `${origin}/thequest/competitions` }],
        ),
      };
    }

    const hostName = profile.stageName || profile.displayName;
    const canonicalSlug = slugifyWithId(hostName, profile.id);
    const canonical = `${origin}/thequest/host/${canonicalSlug}`;
    const user = await storage.getUser(profile.userId);
    const image = (profile as any).profileImageUrl || user?.profileImageUrl || profile.imageUrls?.[0] || null;
    const links = parsePublicLinks((profile as any).socialLinks || user?.socialLinks);
    const hostCompetitions = (await storage.getCompetitionsByCreator(profile.userId))
      .filter((competition) => competition.status !== "draft");
    const competitionLinks = hostCompetitions.map((competition) => ({
      label: competition.title,
      url: `${origin}/thequest/${slugify(competition.category)}/${slugify(competition.title)}`,
    }));
    const externalLinks = Object.entries(links).map(([label, href]) => ({
      label,
      url: href,
      external: true,
    }));
    const description = profile.bio?.trim()
      || `${hostName} hosts public competitions on The Quest, CB Publishing's talent competition and voting platform.`;

    return {
      title: `${hostName} | Competition Host on The Quest`,
      description,
      image,
      url: canonical,
      canonical,
      ogType: "profile",
      structuredData: [
        {
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          url: canonical,
          name: `${hostName} | Competition Host on The Quest`,
          mainEntity: {
            "@type": "Person",
            name: hostName,
            description: profile.bio || undefined,
            image: image || undefined,
            jobTitle: "Competition host",
            ...(Object.keys(links).length ? { sameAs: Object.values(links) } : {}),
          },
        },
        breadcrumbSchema([
          { name: "The Quest", url: `${origin}/thequest` },
          { name: "Hosts", url: `${origin}/thequest/host` },
          { name: hostName, url: canonical },
        ]),
      ],
      fallbackHtml: fallbackHtml(
        `${hostName} — Competition Host`,
        description,
        [
          ...competitionLinks,
          { label: "Browse all competitions", url: `${origin}/thequest/competitions` },
          ...externalLinks,
        ],
        profile.location ? [{ label: "Location", value: profile.location }] : [],
      ),
    };
  }

  if (parts.length === 3 && parts[0] === "thequest" && parts[1].toLowerCase() === "talent") {
    const profileId = /^\d+$/.test(parts[2]) ? Number(parts[2]) : NaN;
    const profile = Number.isSafeInteger(profileId) && profileId > 0
      ? await storage.getTalentProfile(profileId)
      : null;
    return getTalentProfileShareMeta(profile, origin, `${origin}${url.pathname}`);
  }

  if (parts.length === 3 && parts[0] === "thequest" && parts[1].toLowerCase() === "competitor") {
    let decodedName = parts[2];
    try {
      decodedName = decodeURIComponent(parts[2]);
    } catch {}
    const requestedName = slugify(decodedName);
    const profile = requestedName
      ? (await storage.getAllTalentProfiles()).find((item) =>
          String(item.role || "").toLowerCase() === "talent" &&
          slugify(String(item.stageName || item.displayName || "")) === requestedName
        )
      : null;
    return getTalentProfileShareMeta(profile, origin, `${origin}${url.pathname}`);
  }

  if (parts.length === 4 && parts[0] === "thequest") {
    const [categorySlug, compSlug, requestedTalentSlug] = parts.slice(1);
    const competition = await getCompetitionBySlugs(categorySlug, compSlug);
    if (!competition || competition.status === "draft") {
      const canonical = `${origin}/thequest/${categorySlug}/${compSlug}/${requestedTalentSlug}`;
      return {
        title: "Competition page unavailable | The Quest",
        description: "This competition or artist page is not available as a public page.",
        url: canonical,
        canonical,
        robots: "noindex, follow",
        fallbackHtml: fallbackHtml(
          "Public competition page unavailable",
          "This competition or artist page is not available as a public page.",
          [{ label: "Browse competitions", url: `${origin}/thequest/competitions` }],
        ),
      };
    }
    const contestants = await storage.getContestantsByCompetition(competition.id);
    const { id: talentProfileId } = extractIdFromSlug(requestedTalentSlug);
    const contestant = talentProfileId
      ? contestants.find((item) => Number(item.talentProfile.id) === talentProfileId)
      : contestants.find((item) =>
          slugify(item.talentProfile.displayName) === requestedTalentSlug ||
          (item.talentProfile.stageName && slugify(item.talentProfile.stageName) === requestedTalentSlug)
        );
    if (!contestant) {
      const canonical = `${origin}/thequest/${categorySlug}/${compSlug}/${requestedTalentSlug}`;
      return {
        title: "Artist profile unavailable | The Quest",
        description: "This public artist profile could not be found in this competition.",
        url: canonical,
        canonical,
        robots: "noindex, follow",
        fallbackHtml: fallbackHtml(
          "Artist profile unavailable",
          "This public artist profile could not be found in this competition.",
          [{ label: `${competition.title} competition`, url: `${origin}/thequest/${categorySlug}/${compSlug}` }],
        ),
      };
    }

    const profile = contestant.talentProfile;
    const name = (profile.stageName || profile.displayName || "Contestant").trim();
    const division = getContestantDivisionLabel(competition, contestant.contestantDivision);
    const talentSlug = slugifyWithId(name, profile.id);
    const compUrl = `${origin}/thequest/${slugify(competition.category)}/${slugify(competition.title)}`;
    const canonical = `${compUrl}/${talentSlug}`;
    const links = parsePublicLinks(profile.socialLinks);
    const description = [
      division ? `${division} division` : "",
      profile.bio?.trim() || `${name} is competing in ${competition.title}, a ${competition.category} competition on The Quest.`,
    ].filter(Boolean).join(" · ");
    const video = await getContestantShareVideo(competition, profile, origin);
    const shareTitle = `${name}${division ? ` — ${division}` : ""} — ${competition.title}`;
    const videoSchema = video ? {
      "@type": "VideoObject",
      name: shareTitle,
      description,
      thumbnailUrl: video.posterUrl,
      embedUrl: video.playerUrl,
      ...(video.streamUrl ? { contentUrl: video.streamUrl } : {}),
      ...(video.uploadDate ? { uploadDate: video.uploadDate } : {}),
      ...(video.duration ? { duration: `PT${Math.round(video.duration)}S` } : {}),
    } : undefined;

    return {
      title: `${shareTitle} | The Quest`,
      description,
      image: profile.imageUrls?.[0] || competition.coverImage || null,
      video,
      url: canonical,
      canonical,
      ogType: video ? "video.other" : "profile",
      structuredData: [
        {
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          url: canonical,
          name: shareTitle,
          ...(videoSchema ? { video: videoSchema } : {}),
          mainEntity: {
            "@type": "Person",
            name,
            description: profile.bio || undefined,
            image: profile.imageUrls?.[0] || undefined,
            homeLocation: profile.location
              ? { "@type": "Place", name: profile.location }
              : undefined,
            ...(Object.keys(links).length ? { sameAs: Object.values(links) } : {}),
          },
        },
        breadcrumbSchema([
          { name: "The Quest", url: `${origin}/thequest` },
          { name: "Competitions", url: `${origin}/thequest/competitions` },
          { name: competition.title, url: compUrl },
          { name, url: canonical },
        ]),
      ],
      fallbackHtml: fallbackHtml(
        shareTitle,
        description,
        [
          { label: `${competition.title} competition`, url: compUrl },
          { label: "Browse all competitions", url: `${origin}/thequest/competitions` },
          ...Object.entries(links).map(([label, href]) => ({ label, url: href, external: true })),
        ],
        [
          { label: "Category", value: competition.category },
          ...(division ? [{ label: "Division", value: division }] : []),
          ...(profile.location ? [{ label: "Location", value: profile.location }] : []),
        ],
      ),
    };
  }

  if (parts.length === 3 && parts[0] === "thequest") {
    const competition = await getCompetitionBySlugs(parts[1], parts[2]);
    if (!competition || competition.status === "draft") {
      const canonical = `${origin}/thequest/${parts[1]}/${parts[2]}`;
      return {
        title: "Competition page unavailable | The Quest",
        description: "This competition page is not available as a public page.",
        url: canonical,
        canonical,
        robots: "noindex, follow",
        fallbackHtml: fallbackHtml(
          "Public competition page unavailable",
          "This competition page is not available as a public page.",
          [{ label: "Browse competitions", url: `${origin}/thequest/competitions` }],
        ),
      };
    }
    const canonical = `${origin}/thequest/${slugify(competition.category)}/${slugify(competition.title)}`;
    const description = getCompetitionPublicDescription(competition)
      || `View contestants, competition details, and voting for ${competition.title} on The Quest.`;
    const [contestants, hostProfiles, video] = await Promise.all([
      storage.getContestantsByCompetition(competition.id),
      storage.getHostProfiles(),
      getCompetitionShareVideo(competition, origin),
    ]);
    const hostProfile = competition.createdBy
      ? hostProfiles.find((profile) => profile.userId === competition.createdBy)
      : null;
    const hostName = hostProfile?.stageName || hostProfile?.displayName;
    const hostUrl = hostProfile && hostName
      ? `${origin}/thequest/host/${slugifyWithId(hostName, hostProfile.id)}`
      : null;
    const contestantLinks = contestants
      .map((contestant) => {
        const profile = contestant.talentProfile;
        const name = profile.stageName || profile.displayName;
        if (!name || !profile.id) return null;
        return {
          label: name,
          url: `${canonical}/${slugifyWithId(name, profile.id)}`,
        };
      })
      .filter((item): item is { label: string; url: string } => item !== null);
    const startDate = competition.startDate ? new Date(competition.startDate) : null;
    const endDate = competition.endDate ? new Date(competition.endDate) : null;
    const hasValidStartDate = startDate && Number.isFinite(startDate.getTime());
    const videoSchema = video ? {
      "@type": "VideoObject",
      name: `${competition.title} competition video`,
      description,
      thumbnailUrl: video.posterUrl,
      embedUrl: video.playerUrl,
      ...(video.streamUrl ? { contentUrl: video.streamUrl } : {}),
      ...(video.uploadDate ? { uploadDate: video.uploadDate } : {}),
      ...(video.duration ? { duration: `PT${Math.round(video.duration)}S` } : {}),
    } : undefined;
    const mainEntity = hasValidStartDate
      ? {
          "@type": "Event",
          name: competition.title,
          description,
          url: canonical,
          image: competition.coverImage || undefined,
          startDate: startDate!.toISOString(),
          ...(endDate && Number.isFinite(endDate.getTime()) ? { endDate: endDate.toISOString() } : {}),
          ...(competition.inPersonOnly
            ? { eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode" }
            : {}),
          organizer: hostProfile && hostName && hostUrl
            ? {
                "@type": "Person",
                name: hostName,
                url: hostUrl,
                ...(Object.keys(parsePublicLinks((hostProfile as any).socialLinks)).length
                  ? { sameAs: Object.values(parsePublicLinks((hostProfile as any).socialLinks)) }
                  : {}),
              }
            : { "@type": "Organization", name: "CB Publishing", url: origin },
          ...(videoSchema ? { video: videoSchema } : {}),
        }
      : {
          "@type": "CreativeWork",
          name: competition.title,
          description,
          url: canonical,
          image: competition.coverImage || undefined,
          ...(videoSchema ? { video: videoSchema } : {}),
        };

    return {
      title: `${competition.title} — ${competition.category} Competition`,
      description,
      image: video?.posterUrl || competition.coverImage || null,
      favicon: competition.coverImage || video?.posterUrl || null,
      video,
      url: canonical,
      canonical,
      ogType: video ? "video.other" : undefined,
      structuredData: [
        {
          "@context": "https://schema.org",
          "@type": "WebPage",
          url: canonical,
          name: `${competition.title} — ${competition.category} Competition`,
          description,
          isPartOf: { "@type": "WebSite", name: "The Quest", url: `${origin}/thequest` },
          mainEntity,
        },
        breadcrumbSchema([
          { name: "The Quest", url: `${origin}/thequest` },
          { name: "Competitions", url: `${origin}/thequest/competitions` },
          { name: competition.title, url: canonical },
        ]),
        ...(contestantLinks.length ? [{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `${competition.title} contestants`,
          itemListElement: contestantLinks.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.label,
            url: item.url,
          })),
        }] : []),
      ],
      fallbackHtml: fallbackHtml(
        `${competition.title} — ${competition.category} Competition`,
        description,
        [
          ...(hostName && hostUrl ? [{ label: `Hosted by ${hostName}`, url: hostUrl }] : []),
          ...contestantLinks.slice(0, 80),
          { label: "Browse all competitions", url: `${origin}/thequest/competitions` },
          { label: "Nominate talent", url: `${origin}/thequest/nominate` },
        ],
        [
          { label: "Category", value: competition.category },
          ...(competition.status ? [{ label: "Status", value: competition.status }] : []),
          ...(hasValidStartDate ? [{ label: "Starts", value: startDate!.toISOString().slice(0, 10) }] : []),
          ...(endDate && Number.isFinite(endDate.getTime()) ? [{ label: "Ends", value: endDate.toISOString().slice(0, 10) }] : []),
        ],
      ),
    };
  }

  if (parts.length === 2 && parts[0] === "competition") {
    const { id: competitionId } = extractIdFromSlug(parts[1]);
    const competitions = await storage.getCompetitions();
    const competition = competitionId
      ? competitions.find((item) => Number(item.id) === competitionId)
      : competitions.find((item) => slugify(item.title) === parts[1]);
    if (!competition || competition.status === "draft") return null;

    const canonical = `${origin}/thequest/${slugify(competition.category)}/${slugify(competition.title)}`;
    const description = getCompetitionPublicDescription(competition)
      || `View contestants, competition details, and voting for ${competition.title} on The Quest.`;
    const video = await getCompetitionShareVideo(competition, origin);
    return {
      title: `${competition.title} — ${competition.category} Competition`,
      description,
      image: competition.coverImage || video?.posterUrl || null,
      video,
      url: canonical,
      canonical,
      ogType: video ? "video.other" : undefined,
      fallbackHtml: fallbackHtml(
        `${competition.title} — ${competition.category} Competition`,
        description,
        [{ label: "Open this competition", url: canonical }, { label: "Browse all competitions", url: `${origin}/thequest/competitions` }],
      ),
    };
  }

  return null;
}