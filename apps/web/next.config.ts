import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * experimental.after
   * ────────────────────────────────────────────────────────────
   * Enables the `after()` API from `next/server`, which allows
   * work to be scheduled AFTER the response is sent to the client.
   *
   * Used in /api/generate/route.ts to run background image
   * generation without blocking the 202 response that triggers
   * the audio worker. Without this flag, `after()` throws at runtime.
   *
   * Stable in Next.js 15+; listed under `experimental` for compatibility.
   */
  experimental: {
    after: true,
  },
};

export default nextConfig;
