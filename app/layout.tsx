import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Geist } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SITE_URL } from "@/lib/cms/config";
import { cn } from "@/lib/utils";

import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "next-blogspot",
    template: "%s | next-blogspot",
  },
  description:
    "A headless blog frontend for Blogger/Blogspot built with Next.js. Keep your URLs, SEO, and comment history.",
};

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/posts", label: "All posts" },
  { href: "/search", label: "Search" },
  { href: "/rss.xml", label: "RSS" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(geist.variable)} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-background font-sans text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:border focus:border-border focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground"
          >
            Skip to content
          </a>

          <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
            <nav
              aria-label="Main"
              className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 text-sm sm:px-6"
            >
              <Link
                href="/"
                className="flex items-center gap-2 font-semibold tracking-tight whitespace-nowrap text-foreground"
              >
                <Image
                  src="/mark.svg"
                  alt=""
                  width={18}
                  height={18}
                  aria-hidden
                  className="dark:invert"
                />
                next-blogspot
              </Link>

              <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                <ul className="flex flex-wrap items-center gap-x-4 sm:gap-x-5">
                  {NAV_LINKS.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                <ThemeToggle />
              </div>
            </nav>
          </header>

          <main
            id="main-content"
            className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-12"
          >
            {children}
          </main>

          <footer className="border-t border-border">
            <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
              <p className="text-xs text-muted-foreground">
                Powered by Blogger. Frontend by next-blogspot.
              </p>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
