import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // student documents are up to 2 MB, sent as base64 (≈ 2.7 MB) through a server action
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default nextConfig;
