import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import WorkerWakeOnLoad from "@/components/WorkerWakeOnLoad";
import WordAudioCacheBoundary from "@/components/WordAudioCacheBoundary";
import "./globals.css";


import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#07070f",
};



const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ani語",
  description: "Anime-style language learning",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ani語",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Explicit tags — more reliable than Next.js metadata export for Apple PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ani語" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <WorkerWakeOnLoad />
        <WordAudioCacheBoundary />
        {children}
      </body>
    </html>
  );
}
