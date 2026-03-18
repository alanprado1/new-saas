// utils/supabase/client.ts
// ─────────────────────────────────────────────────────────────────────────────
// Browser-side Supabase client.
// Use this in Client Components ("use client") and browser-only code.
// Token storage is handled automatically via the SSR cookie adapter.
// ─────────────────────────────────────────────────────────────────────────────

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
