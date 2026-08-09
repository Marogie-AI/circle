import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root. Left to inference, Turbopack walks up looking for a lockfile
  // and can settle on a directory above the repo entirely — it picked ~/Desktop here.
  // Dependencies hoist to the repo root, so that is the correct root.
  turbopack: { root: path.join(import.meta.dirname, "..", "..") },

  // keeps the dev overlay badge out of captured review evidence
  devIndicators: false,
};

export default nextConfig;
