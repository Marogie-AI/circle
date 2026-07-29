import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // keeps the dev overlay badge out of captured review evidence
  devIndicators: false,
};

export default nextConfig;
