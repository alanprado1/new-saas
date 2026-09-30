"use client";

import Link from "next/link";

export default function StudySessionError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#07070f] px-6 text-center text-white">
      <h1 className="text-2xl font-semibold">Could not load your study session</h1>
      <p className="max-w-sm text-sm text-white/60">Your progress has not been changed. Please try loading the cards again.</p>
      <button onClick={reset} className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 font-semibold">Retry</button>
      <Link href="/study" className="text-sm text-white/60 underline">Back to levels</Link>
    </main>
  );
}
