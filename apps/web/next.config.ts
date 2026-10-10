import type { NextConfig } from "next";

const walkthrough = process.env.NODE_ENV === "development" && process.env.BUSUU_LOCAL_WALKTHROUGH === "1";

const nextConfig: NextConfig = {
  // Busuu local walkthrough (dev only; see lib/busuu/local-walkthrough.ts). Active only when NODE_ENV is development and
  // BUSUU_LOCAL_WALKTHROUGH=1. It mirrors the opt-in to the browser bundle and uses its own build cache (inside .next) so it
  // can run beside a normal dev server and never shares compiled output with it.
  ...(walkthrough ? { distDir: ".next/walkthrough" } : {}),
  env: {
    NEXT_PUBLIC_BUSUU_LOCAL_WALKTHROUGH: walkthrough ? "1" : "",
  },
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
    // Keep visited pages in the browser's router cache so moving between Home, Library, Course and Study
    // reuses them instead of showing the loading screen each time. Data inside the pages is still
    // refreshed by their own client reads (course progress, study snapshot, library).
    staleTimes: { dynamic: 300, static: 300 },
  },
};

export default nextConfig;
