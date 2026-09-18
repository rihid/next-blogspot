import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
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
      <body>{children}</body>
    </html>
  );
}
