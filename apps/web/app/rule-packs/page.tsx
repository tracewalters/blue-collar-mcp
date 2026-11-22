import type { Metadata } from "next";
import { Button, Card, Label, PageHeader } from "@/components/ui";
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
      <PageHeader title="Rule packs" sub="Rules keep answers short, right, and in your voice. Your whole team gets the same version." />

      <Label>Type /rules-setup and pick one</Label>
      <ul className="mt-4 grid gap-4 md:grid-cols-3">
        {ways.map(([k, t, d]) => (
          <li key={k}>
            <Card className="h-full">
              <span className="text-2xl font-extrabold text-orange">{k}.</span>
              <h2 className="mt-1 text-xl font-bold">{t}</h2>
              <p className="mt-2 text-muted">{d}</p>
            </Card>
          </li>
        ))}
      </ul>

      <h2 className="mt-16 text-3xl font-extrabold">Starter packs</h2>
      <p className="mt-2 text-muted">Example rules shown. Every pack is a starting point you edit.</p>
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {rulePacks.map((r) => (
          <li key={r.id}>
            <Card className="h-full">
              <h3 className="text-2xl font-extrabold">{r.name}</h3>
              <p className="text-muted">{r.forWho}</p>
              <ul className="mt-4 space-y-2">
                {r.samples.map((s) => <li key={s} className="border-l-4 border-orange pl-3">{s}</li>)}
              </ul>
            </Card>
          </li>
        ))}
      </ul>

      <section className="mt-16 rounded-2xl bg-blue p-8 text-white sm:p-12">
        <h2 className="text-3xl font-extrabold">How rules stay in line</h2>
        <ul className="mt-4 space-y-2 text-lg">
          <li>• Each rule is tagged: pricing, voice, process, or safety.</li>
          <li>• Rules are published as a version. Everyone uses the same one.</li>
          <li>• Every change is logged, so you know who changed what.</li>
        </ul>
      </section>
      <div className="mt-10"><Button href="/docs#start">Start free</Button></div>
    </>
  );
}
