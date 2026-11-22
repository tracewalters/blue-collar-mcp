import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Nav, Footer } from "@/components/Nav";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: "700", variable: "--font-grotesk" });

export const metadata: Metadata = {
  title: "Blue Collar MCP: a guided AI crew for residential trades",
  description: "One company brain, your shop's rules, and every tool connected. Inside Claude chat. Free to start.",
};

export const viewport: Viewport = { themeColor: "#000000" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable}`}>
      <body className="antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:m-2 focus:rounded focus:bg-panel focus:p-2">
          Skip to content
        </a>
        <Nav />
        <main id="main" className="mx-auto max-w-7xl px-5 pb-12 sm:px-8">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
