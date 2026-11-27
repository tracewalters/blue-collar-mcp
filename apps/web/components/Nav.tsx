import Link from "next/link";
import { NavAuth } from "./NavAuth";
import { GITHUB } from "@/lib/content";

const links = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/packages", label: "Packages" },
  { href: "/rule-packs", label: "Rule packs" },
  { href: "/docs", label: "Docs" },
  { href: "/pricing", label: "Pricing" },
];

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime text-sm font-black text-lime-ink">BC</span>
      Blue Collar
    </Link>
  );
}

export function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-black/80 backdrop-blur">
      <nav aria-label="Main" className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <div className="flex items-center gap-8">
          <Logo />
          <ul className="hidden items-center gap-6 text-[15px] text-ink-2 lg:flex">
            {links.map((l) => (
              <li key={l.href}><Link href={l.href} className="hover:text-ink">{l.label}</Link></li>
            ))}
          </ul>
        </div>
        <div className="flex items-center gap-2">
          <NavAuth />
          <details className="relative lg:hidden">
            <summary className="cursor-pointer list-none rounded-xl bg-panel-2 px-3.5 py-2 text-sm font-semibold">Menu</summary>
            <ul className="absolute right-0 mt-2 w-56 rounded-2xl border border-line bg-panel p-2 shadow-2xl">
              {[{ href: "/dashboard", label: "Dashboard" }, ...links, { href: "/account", label: "Account" }, { href: "/billing", label: "Billing" }].map((l) => (
                <li key={l.href}><Link href={l.href} className="block rounded-xl px-4 py-3 hover:bg-panel-2">{l.label}</Link></li>
              ))}
            </ul>
          </details>
        </div>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 text-sm text-ink-2 sm:grid-cols-[1fr_auto] sm:px-8">
        <div>
          <Logo />
          <p className="mt-3 max-w-sm">A guided AI crew for residential trades, inside Claude chat. Open source (MIT).</p>
        </div>
        <ul className="grid grid-cols-2 gap-x-10 gap-y-2">
          {[{ href: "/dashboard", label: "Dashboard" }, ...links, { href: "/account", label: "Account" }, { href: "/billing", label: "Billing" }].map((l) => (
            <li key={l.href}><Link href={l.href} className="hover:text-ink">{l.label}</Link></li>
          ))}
          <li><a href={GITHUB} className="hover:text-ink">GitHub</a></li>
        </ul>
      </div>
    </footer>
  );
}
