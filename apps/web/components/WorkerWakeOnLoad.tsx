"use client";

import { useEffect } from "react";

const WAKE_SESSION_KEY = "audio-worker-wake-sent";

export default function WorkerWakeOnLoad() {
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(WAKE_SESSION_KEY) === "1") return;
      window.sessionStorage.setItem(WAKE_SESSION_KEY, "1");
    } catch {
      // If sessionStorage is unavailable, still try once for this mount.
    }

    fetch("/api/worker/wake", {
      method: "POST",
      keepalive: true,
      cache: "no-store",
    }).catch(() => {
      // Best-effort pre-wake only; lesson generation still wakes the worker too.
    });
  }, []);

  return null;
}
