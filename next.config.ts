import type { NextConfig } from "next";

/**
 * Blogger re-hosts every uploaded image on Google's CDN and exposes its own
 * server-side resize parameters (`/s1600/`, `/w1200-h630-p-k-no-nu/`, ...).
 *
 * Next.js's image optimizer would compete with that transform, so image
 * optimization is disabled by default and sizing is handled upstream by
 * `lib/blogger/images.ts`.
 *
 * `remotePatterns` is kept for users who opt back into the Next.js optimizer.
 */
const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "*.bp.blogspot.com" },
    ],
  },
};

export default nextConfig;
