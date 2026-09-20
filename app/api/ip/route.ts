import { NextRequest, NextResponse } from 'next/server';

// Same-origin replacement for the old httpbin.org lookup. The hosting proxy
// (Netlify, or any CDN in front) tells us the client's IP via headers; we just
// echo it back so the session layer can store it. Never cached.
export const dynamic = 'force-dynamic';

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-f]{0,4}(?::[0-9a-f]{0,4}){1,7}$/i;

function normalize(raw: string): string | null {
  let ip = raw.trim();

  // "[::1]:1234" or "1.2.3.4:1234" -> strip port
  const bracketed = ip.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketed) ip = bracketed[1];
  const v4WithPort = ip.match(/^((?:\d{1,3}\.){3}\d{1,3}):\d+$/);
  if (v4WithPort) ip = v4WithPort[1];

  // IPv4-mapped IPv6 ("::ffff:1.2.3.4") -> plain IPv4
  if (/^::ffff:(?:\d{1,3}\.){3}\d{1,3}$/i.test(ip)) ip = ip.slice(7);

  if (IPV4.test(ip) || IPV6.test(ip)) return ip;
  return null;
}

function clientIp(request: NextRequest): string | null {
  const candidates = [
    request.headers.get('x-nf-client-connection-ip'), // Netlify
    request.headers.get('cf-connecting-ip'), // Cloudflare
    request.headers.get('x-real-ip'), // nginx / Vercel
    request.headers.get('x-forwarded-for')?.split(',')[0], // generic; first hop is the client
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const ip = normalize(candidate);
    if (ip) return ip;
  }
  return null;
}

export function GET(request: NextRequest) {
  return NextResponse.json(
    { ip: clientIp(request) },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
