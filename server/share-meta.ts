import { storage } from "./storage";
import { firestoreInvitations, firestoreReferrals } from "./firestore-collections";
import { extractIdFromSlug, slugify, slugifyWithId } from "../shared/slugify";
import { parsePublicLinks } from "../shared/public-links";

interface ShareMeta {
  title: string;
  description: string;
  image?: string | null;
  url: string;
  canonical?: string;
  ogType?: string;
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

function fallbackHtml(
  title: string,
  description: string,
  links: Array<{ label: string; url: string; external?: boolean }> = [],
  details: Array<{ label: string; value: string }> = [],
) {
  const detailMarkup = details.length
    ? `<dl>${details.map(({ label, value }) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join("")}</dl>`
    : "";
  const linkMarkup = links.length
    ? `<ul>${links.map(({ label, url, external }) =>
        `<li><a href="${escapeHtml(url)}"${external ? ' rel="me noopener noreferrer"' : ""}>${escapeHtml(label)}</a></li>`
      ).join("")}</ul>`
    : "";

  return `<noscript><main><article><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p>${detailMarkup}${linkMarkup}</article></main></noscript>`;
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
  page = replaceMeta(page, "name", "site-origin", getPublicOrigin());
  page = replaceMeta(page, "property", "og:title", meta.title);
  page = replaceMeta(page, "property", "og:description", description);
  page = replaceMeta(page, "property", "og:url", meta.url);
  page = replaceMeta(page, "property", "og:type", meta.ogType || "website");
  page = replaceMeta(page, "property", "og:site_name", "The Quest | CB Publishing");
  page = replaceMeta(page, "property", "og:image", meta.image || `${getPublicOrigin()}/cb-logo-favicon.png?v=cbp-20260905`);
  page = replaceMeta(page, "name", "twitter:card", "summary_large_image");
  page = replaceMeta(page, "name", "twitter:title", meta.title);
  page = replaceMeta(page, "name", "twitter:description", description);
  page = replaceMeta(page, "name", "twitter:image", meta.image || `${getPublicOrigin()}/cb-logo-favicon.png?v=cbp-20260905`);
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

export async function getShareMeta(requestUrl: string, host: string): Promise<ShareMeta | null> {
  const url = new URL(requestUrl, `${requestUrl.startsWith("https") ? "" : "http"}://${host}`);
  const origin = getPublicOrigin();
  const parts = url.pathname.split("/").filter(Boolean);
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
      canonical: `${origin}/thequest/${slugify(competition.category)}/${slugify(competition.title)}`,
    };
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

  if (url.pathname === "/thequest/host") {
    const hostProfiles = await storage.getHostProfiles();
    const canonical = `${origin}/thequest/host`;
    const links = hostProfiles.map((profile) => {
      const name = profile.stageName || profile.displayName;
      return {
        label: name,
        url: `${origin}/thequest/host/${slugifyWithId(name, profile.id)}`,
      };
    });
    const description = "Meet the hosts who organize public talent competitions on The Quest.";
    return {
      title: "Competition Hosts | The Quest",
      description,
      url: canonical,
      canonical,
      structuredData: [{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        url: canonical,
        name: "Competition Hosts on The Quest",
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
      fallbackHtml: fallbackHtml("Competition Hosts on The Quest", description, links),
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
    if (!profile) return null;

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
            sameAs: Object.values(links),
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

  if (parts.length === 4 && parts[0] === "thequest") {
    const [categorySlug, compSlug, requestedTalentSlug] = parts.slice(1);
    const competition = await getCompetitionBySlugs(categorySlug, compSlug);
    if (!competition || competition.status === "draft") return null;
    const contestants = await storage.getContestantsByCompetition(competition.id);
    const { id: talentProfileId } = extractIdFromSlug(requestedTalentSlug);
    const contestant = talentProfileId
      ? contestants.find((item) => Number(item.talentProfile.id) === talentProfileId)
      : contestants.find((item) =>
          slugify(item.talentProfile.displayName) === requestedTalentSlug ||
          (item.talentProfile.stageName && slugify(item.talentProfile.stageName) === requestedTalentSlug)
        );
    if (!contestant) return null;

    const profile = contestant.talentProfile;
    const name = profile.stageName || profile.displayName || "Contestant";
    const talentSlug = slugifyWithId(name, profile.id);
    const compUrl = `${origin}/thequest/${slugify(competition.category)}/${slugify(competition.title)}`;
    const canonical = `${compUrl}/${talentSlug}`;
    const links = parsePublicLinks(profile.socialLinks);
    const description = profile.bio?.trim()
      || `${name} is competing in ${competition.title}, a ${competition.category} competition on The Quest.`;

    return {
      title: `${name} — ${competition.title} | The Quest`,
      description,
      image: profile.imageUrls?.[0] || competition.coverImage || null,
      url: canonical,
      canonical,
      ogType: "profile",
      structuredData: [
        {
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          url: canonical,
          name: `${name} — ${competition.title}`,
          mainEntity: {
            "@type": "Person",
            name,
            description: profile.bio || undefined,
            image: profile.imageUrls?.[0] || undefined,
            homeLocation: profile.location
              ? { "@type": "Place", name: profile.location }
              : undefined,
            sameAs: Object.values(links),
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
        `${name} — ${competition.title}`,
        description,
        [
          { label: `${competition.title} competition`, url: compUrl },
          { label: "Browse all competitions", url: `${origin}/thequest/competitions` },
          ...Object.entries(links).map(([label, href]) => ({ label, url: href, external: true })),
        ],
        [
          { label: "Category", value: competition.category },
          ...(profile.location ? [{ label: "Location", value: profile.location }] : []),
        ],
      ),
    };
  }

  if (parts.length === 3 && parts[0] === "thequest") {
    const competition = await getCompetitionBySlugs(parts[1], parts[2]);
    if (!competition || competition.status === "draft") return null;
    const canonical = `${origin}/thequest/${slugify(competition.category)}/${slugify(competition.title)}`;
    const description = competition.description
      || `View contestants, competition details, and voting for ${competition.title} on The Quest.`;
    const [contestants, hostProfiles] = await Promise.all([
      storage.getContestantsByCompetition(competition.id),
      storage.getHostProfiles(),
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
    const mainEntity = hasValidStartDate
      ? {
          "@type": "Event",
          name: competition.title,
          description,
          url: canonical,
          image: competition.coverImage || undefined,
          startDate: startDate!.toISOString(),
          ...(endDate && Number.isFinite(endDate.getTime()) ? { endDate: endDate.toISOString() } : {}),
          eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
          location: { "@type": "VirtualLocation", url: canonical },
          organizer: hostProfile && hostName && hostUrl
            ? {
                "@type": "Person",
                name: hostName,
                url: hostUrl,
                sameAs: Object.values(parsePublicLinks((hostProfile as any).socialLinks)),
              }
            : { "@type": "Organization", name: "CB Publishing", url: origin },
        }
      : {
          "@type": "CreativeWork",
          name: competition.title,
          description,
          url: canonical,
          image: competition.coverImage || undefined,
        };

    return {
      title: `${competition.title} — ${competition.category} Competition`,
      description,
      image: competition.coverImage,
      url: canonical,
      canonical,
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
    const description = competition.description
      || `View contestants, competition details, and voting for ${competition.title} on The Quest.`;
    return {
      title: `${competition.title} — ${competition.category} Competition`,
      description,
      image: competition.coverImage,
      url: canonical,
      canonical,
      fallbackHtml: fallbackHtml(
        `${competition.title} — ${competition.category} Competition`,
        description,
        [{ label: "Open this competition", url: canonical }, { label: "Browse all competitions", url: `${origin}/thequest/competitions` }],
      ),
    };
  }

  return null;
}