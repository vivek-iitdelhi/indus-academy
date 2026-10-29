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
    // The partner player's hls.js, read from disk by src/app/embed/hls.js/route.ts.
    "/embed/hls.js": ["./node_modules/hls.js/dist/hls.min.js"],
  },
  // One address: sign-in only trusts indusai.academy (BETTER_AUTH_URL), and its cookie lives there.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.indusai.academy" }],
        destination: "https://indusai.academy/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
