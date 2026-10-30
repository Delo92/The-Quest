export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function slugifyWithId(text: string, id: number): string {
  return `${slugify(text)}-${id}`;
}

export function extractIdFromSlug(slug: string): { baseSlug: string; id: number | null } {
  const match = slug.match(/^(.+)-(\d+)$/);
  if (match) {
    return { baseSlug: match[1], id: parseInt(match[2]) };
  }
  return { baseSlug: slug, id: null };
}

/** Public URL slug for a competition: an explicit override wins over the title-derived slug. */
export function competitionSlug(competition: { title: string; slug?: string | null }): string {
  return competition.slug?.trim() ? slugify(competition.slug) : slugify(competition.title);
}

/**
 * Resolve a competition URL using its canonical slug, while preserving older
 * title-derived links when they uniquely identify a competition in a category.
 */
export function findCompetitionByRouteSlug<T extends {
  title: string;
  category: string;
  slug?: string | null;
}>(
  competitions: readonly T[],
  categorySlug: string,
  routeSlug: string,
): T | undefined {
  const inCategory = competitions.filter(
    (competition) => slugify(competition.category) === slugify(categorySlug),
  );
  const canonicalMatch = inCategory.find(
    (competition) => competitionSlug(competition) === routeSlug,
  );
  if (canonicalMatch) return canonicalMatch;

  const titleMatches = inCategory.filter(
    (competition) => slugify(competition.title) === routeSlug,
  );
  return titleMatches.length === 1 ? titleMatches[0] : undefined;
}
