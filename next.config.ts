import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: false, // Consistent URL structure without trailing slashes
  images: {
    // Enable modern image formats for better compression
    formats: ['image/webp', 'image/avif'],
    // Add quality settings for different use cases
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Enable optimization
    unoptimized: false,
  },
};

export default nextConfig;
