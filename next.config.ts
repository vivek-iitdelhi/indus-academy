import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Blog Markdown is read from disk; ship it with server routes that render on demand
  // (such as per-article Open Graph images), not just with statically built pages.
  outputFileTracingIncludes: {
    "/*": ["./content/blog/**/*"],
  },
};

export default nextConfig;
