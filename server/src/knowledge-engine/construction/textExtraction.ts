/**
 * The only text-derivation logic left once the AI writes summaries and
 * descriptions directly: turning a title + aliases into fuzzy-searchable
 * keywords for search.ts's Fuse.js index.
 */
export function deriveSearchKeywords(title: string, aliases: string[]): string[] {
  const words = title
    .toLowerCase()
    .split(/[\s,()-]+/)
    .filter((w) => w.length > 2);
  return [...new Set([...aliases.map((a) => a.toLowerCase()), ...words])];
}
