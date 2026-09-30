export default function LoadingStudySession() {
  return (
    <main role="status" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#07070f] px-6 text-white">
      <div className="h-48 w-full max-w-md animate-pulse rounded-3xl border border-white/10 bg-white/5" />
      <p className="text-sm text-white/60">Loading your cards…</p>
    </main>
  );
}
