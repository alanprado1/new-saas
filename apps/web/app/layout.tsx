import Script from "next/script";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
  description: "Anime-style Japanese learning",
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
      <body
        
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        
        <Script src="/kuromoji.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}