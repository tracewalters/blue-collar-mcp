import type { Metadata } from "next";
import { Badge, Card, PageHeader } from "@/components/ui";
import { laterPackages, packages } from "@/lib/content";

export const metadata: Metadata = { title: "Packages · Blue Collar MCP" };

export default function Packages() {
  return (
    <>
      <PageHeader title="Packages" sub="Start with the brain. Add the rest when you're ready. Each one has its own guided setup." />
      <ul className="grid gap-6 md:grid-cols-2">
        {packages.map((p) => (
          <li key={p.id} id={p.id}>
            <Card className="h-full">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-3xl font-extrabold">{p.name}</h2>
                <Badge status={p.status} />
              </div>
              <p className="mt-2 text-lg">{p.what}</p>
              <ul className="mt-3 space-y-1 text-muted">
                {p.examples.map((e) => <li key={e}>• {e}</li>)}
              </ul>
              <p className="mt-5 text-sm font-bold uppercase tracking-widest text-orange-dark">Type this in Claude</p>
              <code className="mt-1 inline-block rounded-md bg-code px-3 py-1.5 font-mono text-lg text-code-fg">{p.command}</code>
              <ol className="mt-4 list-decimal space-y-1 pl-6 text-muted">
                {p.steps.map((s) => <li key={s}>{s}</li>)}
              </ol>
            </Card>
          </li>
        ))}
      </ul>
      <Card className="mt-6 border-dashed">
        <h2 className="text-xl font-bold">On the way</h2>
        <p className="mt-2 text-muted">{laterPackages.join(", ")}. Subs, field crews, documents, and client messages.</p>
      </Card>
    </>
  );
}
