import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Engineer Roadmap",
  description: "Detailed, click-to-read AI Engineer roadmap — Dubai, by Aug 31",
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
