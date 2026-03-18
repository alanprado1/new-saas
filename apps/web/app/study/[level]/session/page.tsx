// app/study/[level]/session/page.tsx  —  Server Component
// ─────────────────────────────────────────────────────────────────────────────
// Fetches today's due cards on the server, then hands them to the interactive
// Client Component. Zero client JS until after the initial HTML is served.
// ─────────────────────────────────────────────────────────────────────────────

import { getDueCards } from "@/app/actions/study";
import SessionClient  from "./SessionClient";

interface PageProps {
  params: Promise<{ level: string }>;
}

export default async function SessionPage({ params }: PageProps) {
  const { level } = await params;
  const dueCards  = await getDueCards(level);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (dueCards.length === 0) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          width: "100%",
          background: "#07070f",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Hiragino Sans', 'Noto Sans JP', sans-serif",
          padding: "24px 16px",
          textAlign: "center",
        }}
      >
        {/* Glow orb */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(100,220,150,0.18) 0%, transparent 70%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 32,
          }}
        >
          <span style={{ fontSize: "3rem", lineHeight: 1 }}>✅</span>
        </div>

        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            color: "rgba(255,255,255,0.92)",
            letterSpacing: "-0.4px",
            margin: "0 0 12px",
          }}
        >
          You&apos;re all caught up!
        </h1>
        <p
          style={{
            fontSize: "0.95rem",
            color: "rgba(255,255,255,0.38)",
            maxWidth: 320,
            lineHeight: 1.6,
            margin: "0 0 40px",
          }}
        >
          No cards are due for{" "}
          <span style={{ color: "rgba(100,220,150,0.9)", fontWeight: 600 }}>
            {level.toUpperCase()}
          </span>{" "}
          today. Come back tomorrow for your next review session.
        </p>

        {/* Back link — plain anchor, no client JS needed */}
        <a
          href={`/study/${level}`}
          style={{
            display: "inline-block",
            padding: "13px 32px",
            borderRadius: 14,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.6)",
            fontSize: "0.95rem",
            fontWeight: 600,
            letterSpacing: "0.04em",
            textDecoration: "none",
          }}
        >
          ← Back to Dashboard
        </a>

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700&display=swap');
        `}</style>
      </div>
    );
  }

  // ── Active session ─────────────────────────────────────────────────────────
  return <SessionClient initialCards={dueCards} level={level} />;
}
