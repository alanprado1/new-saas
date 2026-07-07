"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function prepareRecoverySession() {
      const supabase = createClient();
      const code = searchParams.get("code");
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const hashErrorDescription = hashParams.get("error_description");

      if (hashErrorDescription) {
        if (isMounted) {
          setError(hashErrorDescription.replace(/\+/g, " "));
          setIsReady(false);
        }
        return;
      }

      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          if (isMounted) {
            setError(
              "Your password reset link has expired. Please request a new one.",
            );
            setIsReady(false);
          }
          return;
        }

        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("code");
        window.history.replaceState(null, "", cleanUrl.toString());
      }

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          if (isMounted) {
            setError(
              "Your password reset link has expired. Please request a new one.",
            );
            setIsReady(false);
          }
          return;
        }

        window.history.replaceState(null, "", window.location.pathname);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (!session) {
        setError(
          "Your password reset link has expired. Please request a new one.",
        );
        setIsReady(false);
        return;
      }

      setIsReady(true);
    }

    prepareRecoverySession();

    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSaving(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setIsSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await supabase.auth.signOut();
    router.push("/login?message=Your+password+has+been+updated");
  }

  return (
    <>
      {error && (
        <div className="login-banner login-banner--error">
          {error}
        </div>
      )}

      {!isReady && !error && (
        <div className="login-banner login-banner--success">
          Preparing your password reset...
        </div>
      )}

      {isReady && (
        <form className="login-form" onSubmit={onSubmit}>
          <div className="login-field">
            <label htmlFor="password" className="login-label">New password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              placeholder="••••••••"
              className="login-input"
            />
          </div>

          <div className="login-field">
            <label htmlFor="confirmPassword" className="login-label">Confirm password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              placeholder="••••••••"
              className="login-input"
            />
          </div>

          <div className="login-spacer" />

          <button
            type="submit"
            className="login-btn login-btn--primary login-btn--with-spinner"
            disabled={isSaving}
          >
            {isSaving && <span className="login-spinner" aria-hidden="true" />}
            {isSaving ? "Updating password..." : "Update password"}
          </button>
        </form>
      )}
    </>
  );
}
