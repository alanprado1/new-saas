"use client";

import { useFormStatus } from "react-dom";

export default function ForgotPasswordSubmitButton({
  idleText,
  pendingText,
}: {
  idleText: string;
  pendingText: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="login-btn login-btn--primary login-btn--with-spinner"
      disabled={pending}
    >
      {pending && <span className="login-spinner" aria-hidden="true" />}
      {pending ? pendingText : idleText}
    </button>
  );
}
