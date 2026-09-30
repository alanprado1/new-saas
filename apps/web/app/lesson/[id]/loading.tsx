export default function LoadingLesson() {
  return (
    <main role="status" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#07070f] px-6 text-white">
      <div className="aspect-video w-full max-w-2xl animate-pulse rounded-2xl border border-white/10 bg-white/5" />
      <p className="text-sm text-white/60">Opening your scene…</p>
    </main>
  );
}
