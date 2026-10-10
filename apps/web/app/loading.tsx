export default function LoadingApp() {
  return (
    <main role="status" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--g)] text-[var(--ink)]">
      <span className="text-3xl font-semibold tracking-wide">ani語</span>
      <span className="text-sm text-[var(--mut)]">Loading…</span>
    </main>
  );
}
