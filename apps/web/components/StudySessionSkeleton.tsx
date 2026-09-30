export default function StudySessionSkeleton() {
  return (
    <main role="status" aria-label="Loading study cards" className="flex h-dvh flex-col items-center bg-[#07070f] px-5 py-6">
      <div aria-hidden="true" className="flex w-full max-w-md flex-1 flex-col animate-pulse md:max-w-[75vw]">
        <div className="h-1.5 w-full rounded-full bg-white/10" />
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <div className="h-20 w-40 rounded-2xl bg-white/10" />
          <div className="h-5 w-24 rounded bg-white/5" />
          <div className="mt-8 h-10 w-4/5 rounded-xl bg-white/10" />
          <div className="h-4 w-3/5 rounded bg-white/5" />
        </div>
        <div className="flex gap-3 pb-4">{[0, 1, 2, 3].map(i => <div key={i} className="h-11 flex-1 rounded-full bg-white/10" />)}</div>
      </div>
    </main>
  );
}
