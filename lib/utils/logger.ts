/**
 * Development-only logging.
 *
 * The session/sync layer is chatty (emoji status lines on every save, spin and
 * sync). That is useful while developing but just noise (and a little wasted
 * work) for real visitors. `debugLog` is a no-op in production builds;
 * `console.warn` / `console.error` are still used directly for real problems.
 */
const isDevelopment = process.env.NODE_ENV !== 'production';

export function debugLog(...args: unknown[]): void {
  if (isDevelopment) {
    console.log(...args);
  }
}
