import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // The admin "load sample data" button reads src/content at runtime; the standalone build only
  // copies files it can trace from imports, so include the JSON explicitly.
  // resized photos are kept (server and browser) for 30 days instead of the 4 hours default; file names never change content
  images: { minimumCacheTTL: 60 * 60 * 24 * 30 },
  async headers() {
    return [
      { source: "/sites/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }] },
    ];
  },
  outputFileTracingIncludes: {
    "/admin": ["./src/content/**/*"],
  },
};

export default nextConfig;
