import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { PackageRow } from "@/components/Previews";
import { laterPackages, packages } from "@/lib/content";

export const metadata: Metadata = { title: "Packages · Blue Collar MCP" };

export default function Packages() {
  return (
    <>
      <PageHeader title="Add a crew member" accent="for each job" sub="Permits works today. The brain, rules, and books are coming later. Each one has its own guided setup." />
      <div className="space-y-20">
        {packages.map((p) => (
          <div key={p.id}>
            <PackageRow p={p} />
            <ol className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {p.steps.map((s, i) => (
                <li key={s} className="flex gap-3 rounded-xl border border-line px-4 py-3 text-ink-2">
                  <span className="text-ink-3">{i + 1}</span>{s}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <Card className="mt-20">
        <h2 className="text-lg font-semibold">On the way <span className="text-ink-3">{laterPackages.length}</span></h2>
        <p className="mt-1 text-ink-2">{laterPackages.join(", ")}: subs, field crews, documents, and client messages.</p>
      </Card>
    </>
  );
}
