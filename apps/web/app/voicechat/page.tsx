"use client";

/**
 * app/voicechat/page.tsx
 * ─────────────────────────────────────────────────────────────
 * Route for the AI avatar voice-chat tutor, shown inside the app shell
 * (Dock on desktop, tab bar on phones). Close goes back to Home.
 *
 * Audio cleanup is handled inside AvatarChat's useEffect return:
 *   - audioCtxRef.current?.close() — closes the Web Audio context
 * This fully stops all audio and frees system resources on unmount
 * (i.e. when navigating away). No ghost audio possible.
 */

import { useRouter } from "next/navigation";
import AppShell from "@/components/shell/AppShell";
import AvatarChat from "@/components/AvatarChat";

export default function VoicechatPage() {
  const router = useRouter();

  return (
    <AppShell active="chat">
      {/*
        AvatarChat fills this box. Desktop: the full viewport height (the Dock sits beside it).
        Phones: the viewport minus the shell's top bar and bottom tab bar (about 124px plus the safe areas).
        The component handles its own audio-context cleanup on unmount.
      */}
      <main className="chat-page">
        <AvatarChat onClose={() => router.push("/")} />
        <style>{`
          .chat-page {
            width: 100%;
            height: 100dvh;
            min-height: 480px;
            background: var(--g);
          }
          @media (max-width: 767px) {
            .chat-page {
              height: calc(100dvh - 124px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
            }
          }
        `}</style>
      </main>
    </AppShell>
  );
}
