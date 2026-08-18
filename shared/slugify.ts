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
