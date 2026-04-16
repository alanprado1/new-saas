/**
 * lib/supabase.ts
 * ─────────────────────────────────────────────────────────────
 * Single source-of-truth for the browser-side Supabase client.
 * Import { supabase } anywhere in the app — never call createClient again.
 *
 * NOTE: This file must stay in /lib (not /app) so it can be imported by
 * both Server Components (layouts) and Client Components alike.
 */

import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,    // keeps session in localStorage for PWA
      autoRefreshToken: true,  // auto-refresh so tokens don't expire
      detectSessionInUrl: true,
    },
  }
);

/**
 * ensureSession
 * ─────────────────────────────────────────────────────────────
 * Ensures a valid Supabase session exists before making
 * authenticated requests. Falls back to dev credentials.
 * Call this once on app bootstrap (in layout or page useEffect).
 */
export async function ensureSession(): Promise<void> {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  // If there is no session, we simply stop.
  // We do NOT provide hardcoded credentials.
  if (error || !session) {
    console.warn("No active session found.");
    // Optional: You could throw an error here if you want to 
    // force a hard-stop on whatever process called this.
    throw new Error("Authentication required");
  }
}
