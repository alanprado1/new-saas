import Link from "next/link";
import { requestPasswordReset } from "@/app/login/actions";

interface ForgotPasswordPageProps {
  searchParams: Promise<{ error?: string; message?: string }>;
}

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const { error, message } = await searchParams;

  return (
    <div className="login-root">
      <div className="login-glow" />
      <div className="login-card">
        <div className="login-header">
          <p className="login-kana">日本語</p>
          <h1 className="login-title">Reset password</h1>
          <p className="login-subtitle">Enter your email and we will send a reset link</p>
        </div>

        {error && (
          <div className="login-banner login-banner--error">
            {decodeURIComponent(error)}
          </div>
        )}

        {message && (
          <div className="login-banner login-banner--success">
            {decodeURIComponent(message)}
          </div>
        )}

        <form className="login-form">
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

          <div className="login-spacer" />

          <button formAction={requestPasswordReset} className="login-btn login-btn--primary">
            Send reset link
          </button>
        </form>

        <p className="login-footer">
          <Link href="/login" className="login-link">Back to login</Link>
        </p>
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
          transition: background 0.15s, box-shadow 0.15s;
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

        .login-footer {
          text-align: center;
          font-size: 0.75rem;
          color: rgba(255,255,255,0.18);
          margin: 24px 0 0;
        }

        .login-link {
          color: rgba(200,160,255,0.88);
          font-weight: 600;
          text-decoration: none;
        }

        .login-link:hover {
          color: rgba(220,200,255,0.98);
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
