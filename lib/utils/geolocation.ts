import { debugLog } from './logger';

/**
 * Simple IP address utilities for session tracking.
 *
 * Asks our own /api/ip route (which reads the proxy headers) instead of a
 * third-party service, so it is fast, same-origin and has no external dependency.
 */

/**
 * Get the visitor's IP address, giving up after `timeoutMs`.
 * Returns null on timeout, network error, or if the server couldn't determine it.
 */
export async function getIPAddressWithTimeout(timeoutMs: number = 3000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('/api/ip', {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const data: { ip?: string | null } = await response.json();
    if (data.ip) {
      debugLog('📍 IP address retrieved:', data.ip);
      return data.ip;
    }
    return null;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      debugLog('⏱️ IP lookup timed out');
    } else {
      console.warn('Failed to get IP address:', error);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}
