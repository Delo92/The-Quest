import type { SiteLivery } from "./schema";

export type NonprofitPageTextDefinition = {
  imageKey: string;
  label: string;
  defaultText: string;
};

export const NONPROFIT_PAGE_TEXT: NonprofitPageTextDefinition[] = [
  { imageKey: "nonprofits_eyebrow", label: "Nonprofit Page - Hero Eyebrow", defaultText: "A different kind of spotlight" },
  { imageKey: "nonprofits_hero_title", label: "Nonprofit Page - Hero Title", defaultText: "When talent rises, its impact can travel further." },
  { imageKey: "nonprofits_hero_copy", label: "Nonprofit Page - Hero Description", defaultText: "The Quest connects entertainment with participant-led nonprofit support. Contestants and hosts can contribute a share of their own eligible earnings to an organization they choose. The Quest may match that actual amount when its available share allows." },
  { imageKey: "nonprofits_flow_eyebrow", label: "Nonprofit Page - Giving Flow Eyebrow", defaultText: "A clear, participant-led flow" },
  { imageKey: "nonprofits_flow_title", label: "Nonprofit Page - Giving Flow Title", defaultText: "Giving begins with the person on stage." },
  { imageKey: "nonprofits_flow_copy", label: "Nonprofit Page - Giving Flow Copy", defaultText: "This program is separate from donations made to The Quest to receive votes or register. A participant names their organization, chooses a rate, and contributes from their eligible earnings." },
  { imageKey: "nonprofits_step_1_title", label: "Nonprofit Page - Step 1 Title", defaultText: "Choose an organization" },
  { imageKey: "nonprofits_step_1_copy", label: "Nonprofit Page - Step 1 Copy", defaultText: "Contestants and hosts choose an eligible nonprofit for their own contribution." },
  { imageKey: "nonprofits_step_2_title", label: "Nonprofit Page - Step 2 Title", defaultText: "Set a rate" },
  { imageKey: "nonprofits_step_2_copy", label: "Nonprofit Page - Step 2 Copy", defaultText: "They select 1–10% of their eligible earnings. If they leave the rate unset, it defaults to 10%." },
  { imageKey: "nonprofits_step_3_title", label: "Nonprofit Page - Step 3 Title", defaultText: "A match may follow" },
  { imageKey: "nonprofits_step_3_copy", label: "Nonprofit Page - Step 3 Copy", defaultText: "The Quest can match the participant’s actual recorded amount, when its available share allows." },
  { imageKey: "nonprofits_example_eyebrow", label: "Nonprofit Page - Dollar Example Eyebrow", defaultText: "A simple example" },
  { imageKey: "nonprofits_example_title", label: "Nonprofit Page - Dollar Example Title", defaultText: "What a match could look like" },
  { imageKey: "nonprofits_example_note", label: "Nonprofit Page - Dollar Example Note", defaultText: "The rate may be 1–10%; 10% applies only when the participant leaves the rate unset. A match is not guaranteed and depends on The Quest’s available share. Contributions are recorded through payout operations; The Quest does not automatically send funds to nonprofits." },
  { imageKey: "nonprofits_roster_eyebrow", label: "Nonprofit Page - Participant Roster Eyebrow", defaultText: "A community of choice" },
  { imageKey: "nonprofits_roster_title", label: "Nonprofit Page - Participant Roster Title", defaultText: "Organizations participants have named." },
  { imageKey: "nonprofits_roster_copy", label: "Nonprofit Page - Participant Roster Copy", defaultText: "These are organization names entered by contestants and hosts. Their appearance here is not a verification, endorsement, eligibility determination, or promise of donations." },
  { imageKey: "nonprofits_roster_empty", label: "Nonprofit Page - Participant Roster Empty State", defaultText: "When contestants or hosts enter an organization, it will appear here." },
  { imageKey: "nonprofits_featured_eyebrow", label: "Nonprofit Page - Featured Organizations Eyebrow", defaultText: "Featured program organizations" },
  { imageKey: "nonprofits_featured_title", label: "Nonprofit Page - Featured Organizations Title", defaultText: "Two organizations connected to the program." },
  { imageKey: "nonprofits_featured_copy", label: "Nonprofit Page - Featured Organizations Copy", defaultText: "These links share organizations featured in the program. They are not automatically selected payout recipients; each participant makes their own choice." },
  { imageKey: "nonprofits_gallery_eyebrow", label: "Nonprofit Page - Community Gallery Eyebrow", defaultText: "From the community" },
  { imageKey: "nonprofits_gallery_title", label: "Nonprofit Page - Community Gallery Title", defaultText: "Real moments. Shared with care." },
  { imageKey: "nonprofits_gallery_copy", label: "Nonprofit Page - Community Gallery Copy", defaultText: "Media shared by The Quest community. Each image or video is shown as supplied by the program team." },
  { imageKey: "nonprofits_gallery_empty", label: "Nonprofit Page - Community Gallery Empty State", defaultText: "Community media will appear here when it has been shared." },
  { imageKey: "nonprofits_clarity_eyebrow", label: "Nonprofit Page - Donation Clarity Eyebrow", defaultText: "The important distinction" },
  { imageKey: "nonprofits_clarity_title", label: "Nonprofit Page - Donation Clarity Title", defaultText: "A donation for votes is not a donation to a nonprofit." },
  { imageKey: "nonprofits_clarity_copy", label: "Nonprofit Page - Donation Clarity Copy", defaultText: "People donate to The Quest to receive votes; registration is also a donation. Those donations are received by The Quest and are not sent directly to a nonprofit at checkout. Nonprofit support is separate: contestants and hosts may contribute a share of their own eligible earnings to an organization they choose." },
  { imageKey: "nonprofits_clarity_aside", label: "Nonprofit Page - Donation Clarity Aside", defaultText: "Contribution amounts and any Quest match are recorded through payout operations. The Quest does not automatically transfer funds to nonprofits." },
  { imageKey: "nonprofits_inquiry_eyebrow", label: "Nonprofit Page - Organization Inquiry Eyebrow", defaultText: "For nonprofit organizations" },
  { imageKey: "nonprofits_inquiry_title", label: "Nonprofit Page - Organization Inquiry Title", defaultText: "A mission worth knowing about?" },
  { imageKey: "nonprofits_inquiry_copy", label: "Nonprofit Page - Organization Inquiry Copy", defaultText: "Eligible organizations may contact The Quest to share their mission and ask to be considered. An inquiry is not a registration, selection, eligibility decision, or promise of donations." },
];

export const FEATURED_NONPROFIT_ORGANIZATIONS = [
  {
    name: "It Stops Now Foundation",
    website: "https://www.facebook.com/itstopsnowfoundation",
  },
  {
    name: "Event Pro Group Foundation",
    website: "https://eventprogroupusa.com/Foundation",
  },
] as const;

export type PublicNonprofitOrganization = {
  name: string;
  website: string | null;
  logoKey: string;
};

type NonprofitProfileSource = {
  role?: unknown;
  nonprofitDeclaration?: {
    publicName?: unknown;
    website?: unknown;
  } | null;
};

export function nonprofitLogoMediaKey(name: string): string {
  const normalized = name.normalize("NFKD").trim().toLocaleLowerCase();
  const slug = normalized
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "organization";

  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `nonprofit_logo_${slug}_${(hash >>> 0).toString(36)}`;
}

function publicWebsite(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export function collectPublicNonprofitOrganizations(
  profiles: NonprofitProfileSource[],
): PublicNonprofitOrganization[] {
  const byName = new Map<string, PublicNonprofitOrganization>();

  for (const profile of profiles) {
    const role = String(profile.role || "").toLowerCase();
    if (role !== "talent" && role !== "host") continue;

    const declaration = profile.nonprofitDeclaration;
    const name = typeof declaration?.publicName === "string"
      ? declaration.publicName.trim().replace(/\s+/g, " ").slice(0, 180)
      : "";
    if (!name) continue;

    const normalizedName = name.toLocaleLowerCase();
    const website = publicWebsite(declaration?.website);
    const existing = byName.get(normalizedName);
    if (existing) {
      if (!existing.website && website) existing.website = website;
      continue;
    }

    byName.set(normalizedName, {
      name,
      website,
      logoKey: nonprofitLogoMediaKey(name),
    });
  }

  return [...byName.values()].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
  );
}

export function nonprofitPageTextLiveryDefaults(): SiteLivery[] {
  return NONPROFIT_PAGE_TEXT.map(({ imageKey, label, defaultText }) => ({
    imageKey,
    label,
    imageUrl: null,
    defaultUrl: "",
    defaultText,
    itemType: "text",
  }));
}

export function nonprofitLogoLiveryDefault(name: string): SiteLivery {
  return {
    imageKey: nonprofitLogoMediaKey(name),
    label: `Nonprofit Logo - ${name}`,
    imageUrl: null,
    defaultUrl: "",
    mediaType: "image",
    itemType: "media",
  };
}
