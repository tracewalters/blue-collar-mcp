import type { Metadata } from "next";
import { Button, Card, PageHeader } from "@/components/ui";
import { freeTier, paidLevers } from "@/lib/content";

export const metadata: Metadata = { title: "Pricing · Blue Collar MCP" };

const faq = [
  ["Do I need a credit card to start?", "No. Add a card only when you want more."],
  ["What will paid use cost?", "We'll post exact prices before paid plans open. You always see the meter before you're charged."],
  ["Do I need Claude?", "Yes. Blue Collar runs inside Claude chat, on your own Claude account."],
  ["Can I run it myself?", "Yes. It's open source. Host it on your own server for free."],
];

export default function Pricing() {
  return (
    <>
      <PageHeader title="Free to start." accent="Pay as you grow." sub="Start with the brain, rules, and permits at no cost. Pay only for what you use." />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        <div className="relative overflow-hidden rounded-3xl border border-lime/40 bg-panel p-8">
          <div className="glow absolute -top-20 inset-x-0 h-64" aria-hidden />
          <div className="relative">
            <p className="text-sm font-semibold text-lime">Free plan</p>
            <p className="display mt-3 text-7xl">$0</p>
            <p className="mt-1 text-ink-3">No card needed</p>
            <ul className="mt-8 space-y-3">
              {freeTier.map((f) => (
                <li key={f} className="flex gap-3"><span className="text-lime" aria-hidden>✓</span><span className="text-ink-2">{f}</span></li>
              ))}
            </ul>
            <div className="mt-10"><Button href="/docs#start">Start free</Button></div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Pay when you use more <span className="text-ink-3">{paidLevers.length}</span></h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {paidLevers.map((l, i) => (
              <li key={l.name}>
                <Card className="h-full p-5">
                  <span className="text-sm text-ink-3">0{i + 1}</span>
                  <h3 className="mt-2 text-lg font-semibold">{l.name}</h3>
                  <p className="mt-1 text-ink-2">{l.why}</p>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <section aria-labelledby="faq" className="mt-24 grid gap-10 lg:grid-cols-[280px_1fr]">
        <h2 id="faq" className="text-2xl font-semibold tracking-tight">Questions <span className="text-ink-3">{faq.length}</span></h2>
        <dl className="divide-y divide-line border-y border-line">
          {faq.map(([q, a]) => (
            <div key={q} className="py-6">
              <dt className="text-lg font-semibold">{q}</dt>
              <dd className="mt-2 text-ink-2">{a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
