import type { Metadata, Viewport } from "next";
import { Nav, Footer } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blue Collar MCP: a guided AI crew for residential trades",
  description: "One company brain, your shop's rules, and every tool connected. Inside Claude chat. Free to start.",
};

export const viewport: Viewport = { themeColor: "#1d3a63" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:m-2 focus:rounded focus:bg-surface focus:p-2">
          Skip to content
        </a>
        <Nav />
        <main id="main" className="mx-auto max-w-6xl px-5 py-12">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
