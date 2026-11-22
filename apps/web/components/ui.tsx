import Link from "next/link";
import type { ReactNode } from "react";
import type { Status, Turn } from "@/lib/content";

export function Code({ children, label }: { children: string; label?: string }) {
  return (
    <pre tabIndex={0} aria-label={label}
      className="overflow-x-auto rounded-lg bg-code p-4 font-mono text-base leading-relaxed text-code-fg">
      <code>{children}</code>
    </pre>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border-2 border-line bg-surface p-6 ${className}`}>{children}</div>;
}

export function PageHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-10">
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
      {sub && <p className="mt-3 max-w-2xl text-xl text-muted">{sub}</p>}
    </div>
  );
}

export function Button({ href, children, kind = "orange" }: { href: string; children: ReactNode; kind?: "orange" | "outline" }) {
  const cls = kind === "orange"
    ? "bg-orange text-white hover:bg-orange-dark"
    : "border-2 border-blue text-blue hover:bg-blue hover:text-white";
  return (
    <Link href={href} className={`inline-block rounded-lg px-6 py-3.5 text-lg font-bold ${cls}`}>
      {children}
    </Link>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <p className="text-sm font-bold uppercase tracking-widest text-orange-dark">{children}</p>;
}

export function Badge({ status }: { status: Status }) {
  const cls = {
    Ready: "bg-blue text-white",
    "Coming next": "bg-orange/15 text-orange-dark",
    Later: "bg-line text-muted",
  }[status];
  return <span className={`rounded-full px-3 py-1 text-sm font-bold ${cls}`}>{status}</span>;
}

// A Claude chat showing the multiple-choice guided setup.
export function ChatDemo({ command, turns }: { command: string; turns: Turn[] }) {
  return (
    <figure className="overflow-hidden rounded-2xl border-2 border-blue bg-surface shadow-lg">
      <div className="flex items-center gap-2 bg-blue px-5 py-3 text-white">
        <span className="h-3 w-3 rounded-full bg-orange" aria-hidden />
        <span className="font-bold">Claude chat</span>
      </div>
      <div className="space-y-5 p-5">
        <p className="ml-auto w-fit rounded-xl bg-blue px-4 py-2 font-mono text-white">{command}</p>
        {turns.map((t, i) => (
          <div key={i}>
            <p className="font-semibold">{t.ask}</p>
            {t.choices && (
              <ol className="mt-2 grid gap-2">
                {t.choices.map((c, j) => (
                  <li key={c}
                    className={`rounded-lg border-2 px-4 py-2 ${j === t.pick ? "border-orange bg-orange/10 font-semibold" : "border-line"}`}>
                    <span className="mr-2 font-bold text-blue">{String.fromCharCode(65 + j)}.</span>{c}
                  </li>
                ))}
              </ol>
            )}
            {t.note && <p className="mt-2 rounded-lg bg-bg px-4 py-2 text-muted">{t.note}</p>}
          </div>
        ))}
      </div>
      <figcaption className="sr-only">Example of guided setup inside Claude chat</figcaption>
    </figure>
  );
}
