"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { retainWordAudioForPath } from "@/lib/word-audio-session";

export default function WordAudioCacheBoundary() {
  const pathname = usePathname();
  useEffect(() => {
    retainWordAudioForPath(pathname);
  }, [pathname]);
  return null;
}
