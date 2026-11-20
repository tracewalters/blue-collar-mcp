import Link from "next/link";

const links = [
  { href: "/docs", label: "Docs" },
  { href: "/account", label: "Account" },
  { href: "/billing", label: "Billing" },
];

export function Nav() {
  return (
    <header className="border-b border-line">
      <nav aria-label="Main" className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-semibold tracking-tight">
          Permit<span className="text-accent">MCP</span>
        </Link>
        <ul className="flex items-center gap-5 text-sm">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="text-muted hover:text-fg">
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <a
              href="https://github.com/tracewalters/Permit-MCP"
              className="rounded-md border border-line px-3 py-1.5 hover:bg-surface"
            >
              GitHub
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto max-w-5xl px-6 py-8 text-sm text-muted">
        MIT licensed. This site never shows permit data or takes portal actions.
      </div>
    </footer>
  );
}
