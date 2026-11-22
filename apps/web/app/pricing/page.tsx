import type { Metadata } from "next";
import { Button, Card, Label, PageHeader } from "@/components/ui";
import { freeTier, paidLevers } from "@/lib/content";

export const metadata: Metadata = { title: "Pricing · Blue Collar MCP" };

const faq = [
  ["Do I need a credit card to start?", "No. The free plan is free. Add a card only when you want more."],
  ["What will paid use cost?", "We'll post exact prices before paid plans open. You always see the meter before you're charged."],
  ["Do I need Claude?", "Yes. Blue Collar MCP runs inside Claude chat. You use your own Claude account."],
  ["Can I run it myself?", "Yes. It's open source. Host it on your own server for free."],
];

export default function Pricing() {
  return (
    <>
      <PageHeader title="Pricing" sub="Free to start. Pay only for what you use, when you need more." />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card className="border-4 border-orange">
          <Label>Free plan</Label>
          <p className="mt-2 text-6xl font-extrabold">$0</p>
          <p className="text-muted">No card needed</p>
          <ul className="mt-6 space-y-3 text-lg">
            {freeTier.map((f) => (
              <li key={f} className="flex gap-3"><span className="font-extrabold text-orange" aria-hidden>✓</span>{f}</li>
            ))}
          </ul>
          <div className="mt-8"><Button href="/docs#start">Start free</Button></div>
        </Card>

        <div>
          <Label>Pay as you grow</Label>
          <h2 className="mt-2 text-3xl font-extrabold">Only pay when you use more.</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {paidLevers.map((l) => (
              <li key={l.name}>
                <Card className="h-full p-5">
                  <h3 className="text-xl font-bold">{l.name}</h3>
                  <p className="mt-1 text-muted">{l.why}</p>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <section aria-labelledby="faq" className="mt-16 max-w-3xl">
        <h2 id="faq" className="text-3xl font-extrabold">Questions</h2>
        <dl className="mt-6 space-y-6">
          {faq.map(([q, a]) => (
            <div key={q}>
              <dt className="text-xl font-bold">{q}</dt>
              <dd className="mt-1 text-lg text-muted">{a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
