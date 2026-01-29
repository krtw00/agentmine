import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile workspace packages
  transpilePackages: ["@agentmine/core"],

  // Expose DATABASE_URL to server components
  serverExternalPackages: ["pg"],
};

export default nextConfig;
