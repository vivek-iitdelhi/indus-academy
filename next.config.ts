import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server for the AWS container image (Dockerfile); Vercel ignores it.
  output: "standalone",
  // Set by scripts/deploy-aws.sh to the git SHA, so open tabs reload cleanly across a
  // rolling deploy instead of calling a build that is no longer running.
  deploymentId: process.env.DEPLOYMENT_ID,
  // Blog Markdown is read from disk; ship it with server routes that render on demand
  // (such as per-article Open Graph images), not just with statically built pages.
  outputFileTracingIncludes: {
    "/*": ["./content/blog/**/*"],
  },
};

export default nextConfig;
