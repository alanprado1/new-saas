"use server";

// app/login/actions.ts
// ─────────────────────────────────────────────────────────────────────────────
// Server Actions for email/password authentication.
// Both functions accept a FormData object so they can be used directly as
// HTML form actions — no client-side JS needed for the auth flow itself.
// ─────────────────────────────────────────────────────────────────────────────

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email:    formData.get("email")    as string,
    password: formData.get("password") as string,
  });

  if (error) {
    // Encode the message as a query param so the login page can display it
    // without client-side state.
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  // Session cookie is now set by the SSR client; redirect to dashboard.
  redirect("/");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email:    formData.get("email")    as string,
    password: formData.get("password") as string,
    options: {
      // Optional: set the redirect URL for the email confirmation link.
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  // If email confirmation is required, Supabase won't sign them in yet —
  // let them know to check their inbox.
  redirect("/login?message=Check+your+email+to+confirm+your+account");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
