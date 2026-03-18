// app/login/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Login / Sign-up page — pure Server Component, zero JS event handlers.
// Hover and focus states are handled entirely by CSS :hover / :focus.
// ─────────────────────────────────────────────────────────────────────────────

import { login, signup } from "./actions";

interface LoginPageProps {
  searchParams: Promise<{ error?: string; message?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, message } = await searchParams;

  return (
    <div className="login-root">

      {/* Subtle radial glow behind the card */}
      <div className="login-glow" />

      {/* Card */}
      <div className="login-card">

        {/* Logo / wordmark */}
        <div className="login-header">
          <p className="login-kana">日本語</p>
          <h1 className="login-title">Welcome back</h1>
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
          </div>

          <div className="login-spacer" />

          {/* Log In button */}
          <button formAction={login} className="login-btn login-btn--primary">
            Log In
          </button>

          {/* Sign Up button */}
          <button formAction={signup} className="login-btn login-btn--ghost">
            Create Account
          </button>

        </form>

        {/* Footer note */}
        <p className="login-footer">By continuing you agree to our Terms of Service</p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        .login-root {
          min-height: 100dvh;
          width: 100%;
          background: #07070f;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: 'Hiragino Sans', 'Noto Sans JP', sans-serif;
          padding: 24px 16px;
          position: relative;
          overflow: hidden;
        }

        .login-glow {
          position: absolute;
          top: 30%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 480px;
          height: 480px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(180,120,255,0.07) 0%, transparent 70%);
          pointer-events: none;
        }

        .login-card {
          width: 100%;
          max-width: 400px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 24px;
          box-shadow: 0 8px 48px rgba(0,0,0,0.6);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          padding: 36px 32px 32px;
          position: relative;
          z-index: 1;
        }

        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .login-kana {
          font-size: 0.7rem;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.25);
          margin: 0 0 8px;
        }

        .login-title {
          font-size: 1.6rem;
          font-weight: 700;
          color: rgba(255,255,255,0.92);
          letter-spacing: -0.4px;
          margin: 0;
        }

        .login-subtitle {
          font-size: 0.875rem;
          color: rgba(255,255,255,0.35);
          margin: 6px 0 0;
        }

        .login-banner {
          border-radius: 12px;
          padding: 10px 14px;
          margin-bottom: 20px;
          font-size: 0.82rem;
        }

        .login-banner--error {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.3);
          color: rgba(239,68,68,0.9);
        }

        .login-banner--success {
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.25);
          color: rgba(34,197,94,0.9);
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .login-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .login-label {
          font-size: 0.78rem;
          font-weight: 600;
          color: rgba(255,255,255,0.4);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .login-input {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 12px 16px;
          font-size: 0.95rem;
          font-family: inherit;
          color: rgba(255,255,255,0.88);
          outline: none;
          width: 100%;
          transition: border-color 0.15s;
        }

        .login-input::placeholder {
          color: rgba(255,255,255,0.2);
        }

        .login-input:focus {
          border-color: rgba(180,120,255,0.5);
        }

        .login-input:-webkit-autofill,
        .login-input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px rgba(20,10,35,0.95) inset !important;
          -webkit-text-fill-color: rgba(255,255,255,0.88) !important;
          caret-color: white;
        }

        .login-spacer {
          height: 4px;
        }

        .login-btn {
          width: 100%;
          padding: 13px 0;
          border-radius: 14px;
          font-size: 0.95rem;
          font-family: inherit;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: background 0.15s, box-shadow 0.15s, color 0.15s;
        }

        .login-btn--primary {
          background: rgba(180,120,255,0.15);
          border: 1px solid rgba(180,120,255,0.35);
          color: rgba(200,160,255,0.95);
          font-weight: 700;
          box-shadow: 0 0 24px rgba(180,120,255,0.1);
        }

        .login-btn--primary:hover {
          background: rgba(180,120,255,0.26);
          box-shadow: 0 0 36px rgba(180,120,255,0.22);
        }

        .login-btn--ghost {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.45);
          font-weight: 600;
        }

        .login-btn--ghost:hover {
          background: rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.75);
        }

        .login-footer {
          text-align: center;
          font-size: 0.75rem;
          color: rgba(255,255,255,0.18);
          margin: 24px 0 0;
        }
      `}</style>
    </div>
  );
}
