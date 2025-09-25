/**
 * Simple IP address utilities for session tracking
 */

/**
 * Get IP address with timeout and error handling
 */
export async function getIPAddress(): Promise<string | null> {
  try {
    // Use httpbin.org for simple IP lookup
    const response = await fetch('https://httpbin.org/ip');
    if (response.ok) {
      const data = await response.json();
      console.log('📍 IP address retrieved:', data.origin);
      return data.origin;
    }
  } catch (error) {
    console.warn('Failed to get IP address:', error);
  }

  return null;
}

/**
 * Get IP address with timeout
 */
export async function getIPAddressWithTimeout(timeoutMs: number = 3000): Promise<string | null> {
  return Promise.race([
    getIPAddress(),
    new Promise<string | null>((resolve) =>
      setTimeout(() => {
        console.warn('⏱️ IP lookup timed out');
        resolve(null);
      }, timeoutMs)
    )
  ]);
}