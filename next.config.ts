import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: false, // Consistent URL structure without trailing slashes
  images: {
    // Enable modern image formats for better compression
    formats: ['image/webp', 'image/avif'],
    // Next 16 only serves qualities listed here; the background uses 85
    qualities: [75, 85],
    // Add quality settings for different use cases
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Enable optimization
    unoptimized: false,
  },
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,

  // Add security and caching headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            // Site is HTTPS-only; tell browsers to stop trying plain HTTP for 2 years
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000'
          },
          {
            // We never use these browser APIs; opt out so embedded third parties can't either
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()'
          },
          // Cache-Control for pages. Next.js sets its own immutable cache headers on
          // hashed /_next/static assets, so a single rule here is enough. (A previous
          // "immutable" rule on this same path was silently overridden by this one:
          // when two rules set the same header, the last match wins.)
          {
            key: 'Cache-Control',
            value: 's-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
      // API responses are per-visitor; never let the CDN cache them
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store',
          },
        ],
      },
      // Font optimization
      {
        source: '/fonts/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
