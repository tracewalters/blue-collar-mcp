import Link from "next/link";
import { GITHUB } from "@/lib/content";

const links = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/packages", label: "Packages" },
  { href: "/rule-packs", label: "Rule packs" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
  { href: "/account", label: "Account" },
];

function Logo() {
  return (
    <Link href="/" className="text-xl font-extrabold tracking-tight text-white">
      Blue Collar <span className="rounded bg-orange px-1.5 py-0.5">MCP</span>
    </Link>
  );
}

export function Nav() {
  return (
    <header className="bg-blue">
      <nav aria-label="Main" className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Logo />
        <ul className="hidden items-center gap-6 font-semibold text-white/85 lg:flex">
          {links.map((l) => (
            <li key={l.href}><Link href={l.href} className="hover:text-white">{l.label}</Link></li>
          ))}
          <li>
            <Link href="/docs#start" className="rounded-lg bg-orange px-4 py-2 text-white hover:bg-orange-dark">
              Start free
            </Link>
          </li>
        </ul>
        {/* Mobile menu: no JS needed. */}
        <details className="relative lg:hidden">
          <summary className="cursor-pointer list-none rounded-lg border-2 border-white/40 px-4 py-2 font-bold text-white">
            Menu
          </summary>
          <ul className="absolute right-0 z-10 mt-2 w-60 rounded-xl border-2 border-line bg-surface p-2 text-lg font-semibold shadow-xl">
            {links.map((l) => (
              <li key={l.href}><Link href={l.href} className="block rounded-lg px-4 py-3 hover:bg-bg">{l.label}</Link></li>
            ))}
            <li><Link href="/billing" className="block rounded-lg px-4 py-3 hover:bg-bg">Billing</Link></li>
            <li>
              <Link href="/docs#start" className="mt-1 block rounded-lg bg-orange px-4 py-3 text-center text-white">Start free</Link>
            </li>
          </ul>
        </details>
      </nav>
      <div className="hazard" aria-hidden />
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 bg-blue-dark text-white/80">
      <div className="hazard" aria-hidden />
      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-10 sm:grid-cols-2">
        <div>
          <Logo />
          <p className="mt-3">A guided AI crew for residential trades, inside Claude chat.</p>
        </div>
        <ul className="grid grid-cols-2 gap-2 font-semibold">
          {[...links, { href: "/billing", label: "Billing" }].map((l) => (
            <li key={l.href}><Link href={l.href} className="hover:text-white">{l.label}</Link></li>
          ))}
          <li><a href={GITHUB} className="hover:text-white">GitHub</a></li>
        </ul>
        <p className="text-sm sm:col-span-2">Open source (MIT). Your data stays yours. Nothing gets sent or changed without your OK.</p>
      </div>
    </footer>
  );
}
