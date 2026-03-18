// utils/supabase/server.ts
// ─────────────────────────────────────────────────────────────────────────────
// Server-side Supabase client.
// Use this in Server Components, Server Actions, and Route Handlers.
// Reads and writes the auth token via Next.js cookies() — no service-role key
// needed for user-scoped operations; RLS applies automatically.
// ─────────────────────────────────────────────────────────────────────────────

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll is called from a Server Component where cookies cannot be
            // mutated. Safe to ignore — the middleware will refresh the session.
          }
        },
      },
    },
  );
}
