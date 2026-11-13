import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Engineer Roadmap",
  description: "Daily AI Engineer sprint and detailed learning roadmap for Dubai roles",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github-dark.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
