"use client";

import Link from "next/link";

export default function StudySessionError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: "var(--g)", color: "var(--ink)" }}>
      <h1 className="text-2xl font-semibold">Could not load your study session</h1>
      <p className="max-w-sm text-sm" style={{ color: "var(--mut)" }}>Your progress has not been changed. Please try loading the cards again.</p>
      <button onClick={reset} className="rounded-xl px-5 py-3 font-semibold" style={{ background: "var(--s2)", border: "1px solid var(--ln)", color: "var(--ink)" }}>Retry</button>
      <Link href="/study" className="text-sm underline" style={{ color: "var(--mut)" }}>Back to levels</Link>
    </main>
  );
}
