import type { Metadata } from "next";
import Link from "next/link";

import { SITE_URL } from "@/lib/cms/config";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "next-blogspot",
    template: "%s | next-blogspot",
  },
  description:
    "A headless blog frontend for Blogger/Blogspot built with Next.js. Keep your URLs, SEO, and comment history.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        <header className="border-b border-neutral-200">
          <nav className="mx-auto flex max-w-3xl flex-wrap items-center gap-4 px-4 py-4 text-sm">
            <Link href="/" className="font-semibold">
              next-blogspot
            </Link>
            <Link href="/posts" className="underline">
              All posts
            </Link>
            <Link href="/rss.xml" className="underline">
              RSS
            </Link>
          </nav>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>

        <footer className="mx-auto max-w-3xl px-4 py-8 text-xs text-neutral-500">
          Powered by Blogger. Frontend by next-blogspot.
        </footer>
      </body>
    </html>
  );
}
