import type { Metadata } from "next";
import { Button, Card, Chip, PageHeader } from "@/components/ui";
import { rulePacks } from "@/lib/content";

export const metadata: Metadata = { title: "Rule packs · Blue Collar MCP" };

const ways = [
  ["A", "Pick a rule pack", "Start from rules built for your trade."],
  ["B", "Mine my brain", "Claude finds what your shop repeats and suggests rules. You approve each one."],
  ["C", "Start from scratch", "A short guided interview about how you work."],
];

export default function RulePacks() {
  return (
    <>
      <PageHeader title="Rules that" accent="know your trade" sub="Rules keep answers short, right, and in your voice. Your whole team gets the same version." />
      <div className="mb-6"><Chip cmd>rules-setup</Chip></div>
      <ul className="grid gap-4 md:grid-cols-3">
        {ways.map(([k, t, d], i) => (
          <li key={k}>
            <Card className={`h-full ${i === 0 ? "border-lime/40" : ""}`}>
              <span className={`text-sm font-semibold ${i === 0 ? "text-lime" : "text-ink-3"}`}>Option {k}</span>
              <h2 className="mt-2 text-xl font-semibold">{t}</h2>
              <p className="mt-1 text-ink-2">{d}</p>
            </Card>
          </li>
        ))}
      </ul>

      <h2 className="mt-24 text-2xl font-semibold tracking-tight">Starter packs <span className="text-ink-3">{rulePacks.length}</span></h2>
      <p className="mt-2 text-ink-2">Example rules shown. Every pack is a starting point you edit.</p>
      <ul className="mt-8 grid gap-4 md:grid-cols-2">
        {rulePacks.map((r) => (
          <li key={r.id}>
            <Card className="h-full">
              <h3 className="text-xl font-semibold">{r.name}</h3>
              <p className="text-ink-3">{r.forWho}</p>
              <ul className="mt-5 space-y-2">
                {r.samples.map((s) => <li key={s} className="rounded-xl border border-line px-4 py-2.5 text-ink-2">{s}</li>)}
              </ul>
            </Card>
          </li>
        ))}
      </ul>

      <section className="mt-24 grid gap-10 lg:grid-cols-[280px_1fr]">
        <h2 className="text-2xl font-semibold tracking-tight">How rules stay in line</h2>
        <ul className="divide-y divide-line border-y border-line text-ink-2">
          <li className="py-4">Each rule is tagged: pricing, voice, process, or safety.</li>
          <li className="py-4">Rules are published as a version. Everyone uses the same one.</li>
          <li className="py-4">Every change is logged, so you know who changed what.</li>
        </ul>
      </section>
      <div className="mt-12"><Button href="/signup">Start free</Button></div>
    </>
  );
}
