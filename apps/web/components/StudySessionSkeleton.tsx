export default function StudySessionSkeleton() {
  return (
    <main role="status" aria-label="Loading study cards" className="flex h-dvh flex-col items-center px-5 py-6" style={{ background: "var(--g)" }}>
      <div aria-hidden="true" className="flex w-full max-w-md flex-1 flex-col animate-pulse md:max-w-[75vw]">
        <div className="h-1.5 w-full rounded-full" style={{ background: "var(--s3)" }} />
        <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-6 rounded-[22px] p-4" style={{ background: "var(--s1)", border: "1px solid var(--ln)" }}>
          <div className="h-20 w-40 rounded-2xl" style={{ background: "var(--s3)" }} />
          <div className="h-5 w-24 rounded" style={{ background: "var(--s2)" }} />
          <div className="mt-8 h-10 w-4/5 rounded-xl" style={{ background: "var(--s3)" }} />
          <div className="h-4 w-3/5 rounded" style={{ background: "var(--s2)" }} />
        </div>
        <div className="mt-3 flex gap-2 pb-4">{[0, 1, 2, 3].map(i => <div key={i} className="h-[50px] flex-1 rounded-[14px]" style={{ background: "var(--s2)" }} />)}</div>
      </div>
    </main>
  );
}
