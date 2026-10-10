import type { Metadata, Viewport } from "next";
import { BIZ_UDPGothic, Figtree, Klee_One } from "next/font/google";
import WorkerWakeOnLoad from "@/components/WorkerWakeOnLoad";
import WordAudioCacheBoundary from "@/components/WordAudioCacheBoundary";
import StudyCacheProvider from "@/components/StudyCacheProvider";
import { GROUNDS, GROUND_STORAGE_KEY, THEMES, THEME_STORAGE_KEY } from "@/lib/themes";
import "./globals.css";

// Interface text. Variable font, so every weight is available.
const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

// Interface Japanese. preload is off: the Japanese slices load on demand by unicode-range.
const bizUdpGothic = BIZ_UDPGothic({
  weight: ["400", "700"],
  variable: "--font-biz-udpgothic",
  display: "swap",
  preload: false,
});

// Words being studied (flashcards, scene lines, kanji, lesson teaching text).
const kleeOne = Klee_One({
  weight: ["400", "600"],
  variable: "--font-klee-one",
  display: "swap",
  preload: false,
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1b1c1f",
};

export const metadata: Metadata = {
  title: "ani語",
  description: "Anime-style language learning",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ani語",
  },
};

// Runs before first paint so the saved accent and ground apply without a flash.
// Both choices are read separately; an unknown or missing value leaves the CSS defaults.
const APPEARANCE_SCRIPT = `try{var d=document.documentElement,a=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}),g=localStorage.getItem(${JSON.stringify(GROUND_STORAGE_KEY)});if(a&&${JSON.stringify(THEMES.map(t => t.name))}.indexOf(a)>-1)d.setAttribute("data-accent",a);if(g&&${JSON.stringify(GROUNDS.map(x => x.name))}.indexOf(g)>-1)d.setAttribute("data-ground",g)}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${figtree.variable} ${bizUdpGothic.variable} ${kleeOne.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_SCRIPT }} />
        {/* Explicit tags — more reliable than Next.js metadata export for Apple PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ani語" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased">
        <WorkerWakeOnLoad />
        <WordAudioCacheBoundary />
        <StudyCacheProvider>{children}</StudyCacheProvider>
      </body>
    </html>
  );
}
