import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from common placeholder/CDN domains
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "cdn.transloadit.com" },
      { protocol: "https", hostname: "*.transloadit.com" },
    ],
  },
  // Extend API timeout for the execute route (30s+ crop delay)
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
