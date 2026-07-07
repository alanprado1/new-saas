"use server";

// app/login/actions.ts
// ─────────────────────────────────────────────────────────────────────────────
// Server Actions for email/password authentication.
// Both functions accept a FormData object so they can be used directly as
// HTML form actions — no client-side JS needed for the auth flow itself.
// ─────────────────────────────────────────────────────────────────────────────

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";

async function getSiteUrl() {
  const headerStore = await headers();
  const origin = headerStore.get("origin");
  const siteUrl = origin ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return siteUrl.replace(/\/$/, "");
}

async function getAuthRedirectUrl(pathname: string) {
  return new URL(pathname, await getSiteUrl()).toString();
}

function createPasswordResetClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: "implicit",
        persistSession: false,
      },
    },
  );
}

export async function login(formData: FormData) {
  const supabase = await createServerClient();

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
  const supabase = await createServerClient();

  const { error } = await supabase.auth.signUp({
    email:    formData.get("email")    as string,
    password: formData.get("password") as string,
    options: {
      // Optional: set the redirect URL for the email confirmation link.
      emailRedirectTo: await getAuthRedirectUrl("/auth/callback"),
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
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(formData: FormData) {
  const supabase = createPasswordResetClient();
  const email = ((formData.get("email") as string) ?? "").trim();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: await getAuthRedirectUrl("/reset-password"),
  });

  if (error) {
    redirect(`/forgot-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect(
    `/forgot-password?sentTo=${encodeURIComponent(email)}`,
  );
}

export async function updatePassword(formData: FormData) {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (password.length < 6) {
    redirect(
      `/reset-password?error=${encodeURIComponent(
        "Password must be at least 6 characters",
      )}`,
    );
  }

  if (password !== confirmPassword) {
    redirect(
      `/reset-password?error=${encodeURIComponent("Passwords do not match")}`,
    );
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?message=Your+password+has+been+updated");
}
