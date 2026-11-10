import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Firestore loads generated clients/proto assets relative to its package.
  // Preserve native Node resolution in standalone images.
  serverExternalPackages: ["@google-cloud/firestore"],
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
