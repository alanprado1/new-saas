"use client";

/**
 * app/voicechat/page.tsx
 * ─────────────────────────────────────────────────────────────
 * Dedicated full-screen route for the AI avatar voice-chat tutor.
 *
 * Audio cleanup is handled inside AvatarChat's useEffect return:
 *   - audioCtxRef.current?.close() — closes the Web Audio context
 * This fully stops all audio and frees system resources on unmount
 * (i.e. when navigating away). No ghost audio possible.
 */

import { useRouter } from "next/navigation";
import AvatarChat from "@/components/AvatarChat";
import { useTheme } from "@/hooks/useTheme";

export default function VoicechatPage() {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <main
      style={{
        minHeight: "100dvh",
        width: "100%",
        background: "#07070f",
        backgroundImage: theme.gradient,
        overflowX: "hidden",
      }}
    >
      {/* ── Grain overlay ────────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0 opacity-25"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.15'/%3E%3C/svg%3E\")",
          backgroundRepeat: "repeat",
          backgroundSize: "128px",
          mixBlendMode: "overlay",
          zIndex: 0,
        }}
      />

      {/*
        AvatarChat fills the viewport. onClose navigates back to the dashboard.
        The component handles its own audio-context cleanup on unmount.
      */}
      <AvatarChat
        theme={theme}
        onClose={() => router.push("/")}
      />
    </main>
  );
}
