import "@/app/login/auth.css";
import Link from "next/link";
import { requestPasswordReset } from "@/app/login/actions";
import ForgotPasswordSubmitButton from "./ForgotPasswordSubmitButton";

interface ForgotPasswordPageProps {
  searchParams: Promise<{ error?: string; sentTo?: string }>;
}

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const { error, sentTo } = await searchParams;
  const email = sentTo ?? "";

  return (
    <div className="login-root">
      <div className="login-card">
        <div className="login-header">
          <div className="login-mark" aria-hidden="true">語</div>
          <h1 className="login-title">
            {email ? "Check your email" : "Reset password"}
          </h1>
          <p className="login-subtitle">
            {email
              ? "We sent a password reset request to"
              : "Enter your email and we will send a reset link"}
          </p>
          {email && (
            <>
              <p className="login-sent-email">{email}</p>
              <Link href="/forgot-password" className="login-link login-wrong-email">
                Wrong email?
              </Link>
            </>
          )}
        </div>

        {error && (
          <div className="login-banner login-banner--error">
            {decodeURIComponent(error)}
          </div>
        )}

        {email ? (
          <>
            <form className="login-form login-form--sent" action={requestPasswordReset}>
              <input type="hidden" name="email" value={email} />
              <ForgotPasswordSubmitButton
                idleText="Resend reset link"
                pendingText="Sending..."
              />
            </form>

            <p className="login-footer">
              <Link href="/login" className="login-link">Back to login</Link>
            </p>
          </>
        ) : (
          <>
            <form className="login-form" action={requestPasswordReset}>
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

              <ForgotPasswordSubmitButton
                idleText="Send reset link"
                pendingText="Sending..."
              />
            </form>

            <p className="login-footer">
              <Link href="/login" className="login-link">Back to login</Link>
            </p>
          </>
        )}
      </div>

    </div>
  );
}
