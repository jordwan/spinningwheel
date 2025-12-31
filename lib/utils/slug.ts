/**
 * Utility functions for generating and validating URL slugs
 */

/**
 * Generates a random alphanumeric string of specified length
 */
export function generateRandomSuffix(length: number = 4): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Converts a string to URL-safe slug format
 * Example: "Team Winners!" -> "team-winners"
 */
export function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Remove all non-alphanumeric characters except hyphens
    .replace(/[^a-z0-9-]/g, '')
    // Remove multiple consecutive hyphens
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Limit length to 50 characters
    .substring(0, 50);
}

/**
 * Generates a unique slug from a team name
 * Example: "Team Winners" -> "team-winners-a1b2"
 */
export function generateSlug(teamName: string | undefined): string {
  // Use a default if no team name provided
  const baseName = teamName && teamName.trim()
    ? sanitizeSlug(teamName)
    : 'wheel';

  const suffix = generateRandomSuffix(4);

  return `${baseName}-${suffix}`;
}

/**
 * Validates a slug format
 * Must be lowercase alphanumeric with hyphens only
 */
export function validateSlug(slug: string): boolean {
  // Slug must be 5-60 characters (accounting for suffix)
  if (slug.length < 5 || slug.length > 60) {
    return false;
  }

  // Must match pattern: lowercase letters, numbers, and hyphens only
  // Must not start or end with hyphen
  const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  return slugPattern.test(slug);
}

/**
 * Extracts team name from slug (removes suffix)
 * Example: "team-winners-a1b2" -> "Team Winners"
 */
export function slugToTitle(slug: string): string {
  // Remove the last 5 characters (hyphen + 4 character suffix)
  const withoutSuffix = slug.slice(0, -5);

  // Convert hyphens to spaces and capitalize each word
  return withoutSuffix
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
