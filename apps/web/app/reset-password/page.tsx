import "@/app/login/auth.css";
import Link from "next/link";
import { Suspense } from "react";
import ResetPasswordForm from "./ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <div className="login-root">
      <div className="login-card">
        <div className="login-header">
          <div className="login-mark" aria-hidden="true">語</div>
          <h1 className="login-title">Choose a new password</h1>
          <p className="login-subtitle">Use at least 6 characters</p>
        </div>

        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>

        <p className="login-footer">
          <Link href="/login" className="login-link">Back to login</Link>
        </p>
      </div>

    </div>
  );
}
