import type { Metadata } from "next";
import { Nav, Footer } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Permit MCP: one MCP for every permit portal",
  description: "Log in once. Ask Claude about all your permits and inspections.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:m-2 focus:rounded focus:bg-surface focus:p-2">
          Skip to content
        </a>
        <Nav />
        <main id="main" className="mx-auto max-w-5xl px-6 py-12">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
