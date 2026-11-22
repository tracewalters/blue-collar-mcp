import Link from "next/link";
import type { ReactNode } from "react";
import type { Status } from "@/lib/content";

// Components follow /TASTE.md.

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-panel p-6 ${className}`}>{children}</div>;
}

export function PageHeader({ title, accent, sub }: { title: string; accent?: string; sub?: string }) {
  return (
    <div className="relative py-16 sm:py-20">
      <div className="blueprint absolute inset-0 -z-10" aria-hidden />
      <h1 className="display text-5xl sm:text-7xl">
        {title} {accent && <span className="text-lime">{accent}</span>}
      </h1>
      {sub && <p className="mt-5 max-w-2xl text-lg text-ink-2">{sub}</p>}
    </div>
  );
}

const btn = {
  lime: "bg-lime text-lime-ink hover:brightness-95",
  white: "bg-white text-black hover:bg-white/90",
  dark: "bg-panel-2 text-ink hover:bg-white/10",
};

export function Button({ href, children, kind = "lime", small = false }:
  { href: string; children: ReactNode; kind?: keyof typeof btn; small?: boolean }) {
  const size = small ? "px-3.5 py-2 text-sm" : "px-6 py-3.5 text-base";
  return (
    <Link href={href} className={`inline-flex items-center gap-2 rounded-xl font-semibold ${size} ${btn[kind]}`}>
      {children}
    </Link>
  );
}

export function Tag({ status }: { status: Status }) {
  const cls = status === "Ready" ? "bg-lime text-lime-ink" : status === "Coming next" ? "bg-white/15 text-ink" : "bg-white/5 text-ink-3";
  const label = status === "Coming next" ? "Next" : status === "Later" ? "Soon" : status;
  return <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}

export function Chip({ children, cmd = false }: { children: ReactNode; cmd?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm text-ink">
      {cmd && <span className="font-bold text-lime">/</span>}
      <span className={cmd ? "font-mono" : ""}>{children}</span>
    </span>
  );
}

export function SectionTitle({ title, count, sub }: { title: string; count?: number; sub?: string }) {
  return (
    <div className="mb-8">
      <h2 className="text-2xl font-semibold tracking-tight">
        {title} {count !== undefined && <span className="text-ink-3">{count}</span>}
      </h2>
      {sub && <p className="mt-2 text-ink-2">{sub}</p>}
    </div>
  );
}

export function IconTile({ letter, active = false }: { letter: string; active?: boolean }) {
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${active ? "bg-lime text-lime-ink" : "bg-panel-2 text-ink-2"}`}>
      {letter}
    </span>
  );
}

// Claude chat mock showing the multiple-choice guided setup.
export function ChatDemo({ command, turns }: { command: string; turns: import("@/lib/content").Turn[] }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="flex items-center gap-2 border-b border-line px-5 py-3 text-sm text-ink-3">
        <span className="h-2 w-2 rounded-full bg-lime" aria-hidden />Claude chat
      </div>
      <div className="space-y-6 p-5">
        <p className="ml-auto w-fit rounded-xl bg-white/10 px-4 py-2 font-mono">{command}</p>
        {turns.map((t, i) => (
          <div key={i}>
            <p className="font-medium">{t.ask}</p>
            {t.choices && (
              <ol className="mt-3 grid gap-2">
                {t.choices.map((c, j) => (
                  <li key={c} className={`rounded-xl border px-4 py-2.5 ${j === t.pick ? "border-lime/60 bg-lime/10 text-ink" : "border-line text-ink-2"}`}>
                    <span className={`mr-2 font-semibold ${j === t.pick ? "text-lime" : "text-ink-3"}`}>{String.fromCharCode(65 + j)}</span>{c}
                  </li>
                ))}
              </ol>
            )}
            {t.note && <p className="mt-3 rounded-xl bg-panel-2 px-4 py-3 text-ink-2">{t.note}</p>}
          </div>
        ))}
      </div>
      <figcaption className="sr-only">Example of guided setup inside Claude chat</figcaption>
    </figure>
  );
}
