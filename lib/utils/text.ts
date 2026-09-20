/**
 * Display helpers for user-entered text.
 */

/**
 * Capitalise the first letter of each word, leaving the rest as typed.
 * "team jamal" -> "Team Jamal"; "SS27 raffle" -> "SS27 Raffle"; "iPhone" -> "IPhone" is
 * avoided by only touching words that start lowercase-then-lowercase or are all lowercase.
 * Used for display only (headings, tab title, share card); slugs stay lowercase.
 */
export function toTitleCase(text: string): string {
  return text
    .trim()
    .split(/(\s+)/) // keep the whitespace runs so spacing is preserved
    .map((part) => {
      if (!part || /^\s+$/.test(part)) return part;
      // Leave words with internal capitals alone (iPhone, McDonald, SS27)
      if (/[A-Z\p{Lu}]/u.test(part.slice(1))) return part;
      return part.charAt(0).toLocaleUpperCase() + part.slice(1);
    })
    .join("");
}
