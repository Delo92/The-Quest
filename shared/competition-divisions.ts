import { slugify } from "./slugify";

export interface CompetitionDivisionSource {
  title?: string | null;
  category?: string | null;
  description?: string | null;
  contestantDivisions?: readonly string[] | null;
}

export const CHRONIC_CUTIES_COMPETITION_DIVISIONS = [
  "Chronic Cuties",
  "Chronic Hunks",
] as const;

export function getContestantDivisionOptions(
  competition: CompetitionDivisionSource | null | undefined,
): string[] {
  if (!competition) return [];

  const configured = Array.isArray(competition.contestantDivisions)
    ? [...new Set(competition.contestantDivisions
        .filter((division): division is string => typeof division === "string")
        .map((division) => division.trim())
        .filter(Boolean))]
    : [];
  if (configured.length) return configured;

  if (
    slugify(competition.category || "") === "modelingfashion" &&
    slugify(competition.title || "") === "chronic-cuties-of-hawaii"
  ) {
    return [...CHRONIC_CUTIES_COMPETITION_DIVISIONS];
  }

  return [];
}

export function resolveContestantDivision(
  competition: CompetitionDivisionSource | null | undefined,
  requestedDivision: unknown,
  requireSelection = false,
): { contestantDivision: string | null; error?: string } {
  const options = getContestantDivisionOptions(competition);
  if (!options.length) return { contestantDivision: null };

  const division = typeof requestedDivision === "string" ? requestedDivision.trim() : "";
  if (!division) {
    return requireSelection
      ? { contestantDivision: null, error: "Please choose a contestant division." }
      : { contestantDivision: options[0] };
  }
  if (!options.includes(division)) {
    return { contestantDivision: null, error: "Choose one of the available contestant divisions." };
  }
  return { contestantDivision: division };
}

export function getContestantDivisionLabel(
  competition: CompetitionDivisionSource | null | undefined,
  contestantDivision: unknown,
): string | null {
  const options = getContestantDivisionOptions(competition);
  if (!options.length) return null;
  return typeof contestantDivision === "string" && options.includes(contestantDivision.trim())
    ? contestantDivision.trim()
    : options[0];
}

export function getCompetitionPublicDescription(
  competition: CompetitionDivisionSource | null | undefined,
): string | null {
  const description = competition?.description?.trim() || null;
  if (!description || !getContestantDivisionOptions(competition).includes("Chronic Hunks")) {
    return description;
  }
  return description.replace(/\bconfident women\b/i, "confident models of all genders");
}
