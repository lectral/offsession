import type { NextConfig } from "next";

const nextBuildId = process.env.NEXT_BUILD_ID?.trim();
const buildTimestamp = process.env.NEXT_PUBLIC_BUILD_TIMESTAMP?.trim() || new Date().toISOString();

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_BUILD_TIMESTAMP: buildTimestamp,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  headers: async () => [
    {
      source: "/",
      headers: [
        {
          key: "Cache-Control",
          value: "no-store, max-age=0, must-revalidate",
        },
      ],
    },
    {
      source: "/api/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "no-store, max-age=0, must-revalidate",
        },
      ],
    },
    {
      source: "/_next/static/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=31536000, immutable",
        },
      ],
    },
  ],
  ...(nextBuildId
    ? {
        generateBuildId: async () => nextBuildId,
      }
    : {}),
};

export default nextConfig;
