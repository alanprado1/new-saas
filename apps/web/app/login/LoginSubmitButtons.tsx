"use client";

import { useFormStatus } from "react-dom";

export default function LoginSubmitButtons({
  loginAction,
  signupAction,
}: {
  loginAction: (formData: FormData) => void | Promise<void>;
  signupAction: (formData: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();

  return (
    <>
      <button
        formAction={loginAction}
        className="login-btn login-btn--primary"
        disabled={pending}
      >
        {pending ? "Signing in..." : "Log In"}
      </button>

      <button
        formAction={signupAction}
        className="login-btn login-btn--ghost"
        disabled={pending}
      >
        {pending ? "Please wait..." : "Create Account"}
      </button>
    </>
  );
}
