import type { ReactNode } from "react";

export function Code({ children, label }: { children: string; label?: string }) {
  return (
    <pre
      tabIndex={0}
      aria-label={label}
      className="overflow-x-auto rounded-lg bg-code p-4 font-mono text-sm leading-relaxed text-code-fg"
    >
      <code>{children}</code>
    </pre>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-surface p-5 ${className}`}>{children}</div>;
}

export function PageHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {sub && <p className="mt-2 text-muted">{sub}</p>}
    </div>
  );
}

export const INSTALL = "claude mcp add permit -- npx -y permit-mcp";
