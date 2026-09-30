export default function LoadingLesson() {
  return (
    <main role="status" aria-label="Loading lesson" className="min-h-screen bg-[#07070f] px-4 py-3">
      <div aria-hidden="true" className="mx-auto flex max-w-[896px] animate-pulse flex-col gap-5">
        <div className="h-7 w-44 rounded-lg bg-white/10" />
        <div className="aspect-video w-full rounded-2xl bg-white/5" />
        <div className="h-5 w-3/4 rounded bg-white/10" />
        <div className="h-5 w-full rounded bg-white/5" />
        <div className="h-5 w-2/3 rounded bg-white/5" />
      </div>
    </main>
  );
}
