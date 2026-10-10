// app/login/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Login / Sign-up page — pure Server Component, zero JS event handlers.
// Hover and focus states are handled entirely by CSS :hover / :focus.
// ─────────────────────────────────────────────────────────────────────────────

import "./auth.css";
import { login, signup } from "./actions";
import LoginSubmitButtons from "./LoginSubmitButtons";
import Link from "next/link";

interface LoginPageProps {
  searchParams: Promise<{ error?: string; message?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, message } = await searchParams;

  return (
    <div className="login-root">


      {/* Card */}
      <div className="login-card">

        {/* Logo / wordmark */}
        <div className="login-header">
          <div className="login-mark" aria-hidden="true">語</div>
          <h1 className="login-title">Welcome</h1>
          <p className="login-subtitle">Sign in to continue your study session</p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="login-banner login-banner--error">
            {decodeURIComponent(error)}
          </div>
        )}

        {/* Success / info banner */}
        {message && (
          <div className="login-banner login-banner--success">
            {decodeURIComponent(message)}
          </div>
        )}

        {/* Form */}
        <form className="login-form">

          {/* Email */}
          <div className="login-field">
            <label htmlFor="email" className="login-label">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              className="login-input"
            />
          </div>

          {/* Password */}
          <div className="login-field">
            <label htmlFor="password" className="login-label">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="login-input"
            />
            <Link href="/forgot-password" className="login-inline-link">
              Forgot password?
            </Link>
          </div>

          <div className="login-spacer" />

          <LoginSubmitButtons loginAction={login} signupAction={signup} />

        </form>

        {/* Footer note */}
        <p className="login-footer">By continuing you agree to our Terms of Service</p>
      </div>

    </div>
  );
}
