import type { Metadata } from "next";
import { Button, Card, ChatDemo, Label, PageHeader } from "@/components/ui";
import { brainSetup } from "@/lib/content";

export const metadata: Metadata = { title: "How it works · Blue Collar MCP" };

const pattern = [
  ["You type a command", "Like /brain-setup or /permits-setup."],
  ["Claude asks one question", "Pick A, B, C, or D. No typing essays."],
  ["You get exact steps", "The right link and what to click. One step at a time."],
  ["Claude checks it worked", "It tests the connection before moving on."],
  ["You get a first win", "A real answer about your own business, right away."],
];

const rules = [
  "One question at a time, in plain English.",
  "Always the exact link, never “go find the settings.”",
  "Passwords never go in chat. You use a secure sign-in link.",
  "Before anything is saved, sent, or ordered, you see a preview and say yes.",
  "If it doesn't know, it says so. It never makes things up.",
];

export default function HowItWorks() {
  return (
    <>
      <PageHeader title="How it works" sub="Every setup works the same way. Claude asks, you pick, it walks you through." />

      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <Label>Every setup follows 5 steps</Label>
          <ol className="mt-4 space-y-4">
            {pattern.map(([t, d], i) => (
              <li key={t} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange text-xl font-extrabold text-white">{i + 1}</span>
                <div>
                  <h2 className="text-xl font-bold">{t}</h2>
                  <p className="text-muted">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <Label>Example: /brain-setup</Label>
          <div className="mt-4"><ChatDemo command="/brain-setup" turns={brainSetup} /></div>
        </div>
      </div>

      <section aria-labelledby="after" className="mt-16 grid gap-4 md:grid-cols-3">
        <h2 id="after" className="sr-only">After setup</h2>
        {[
          ["Review the odd ones", "Claude shows you unclear matches and duplicates one at a time. You decide."],
          ["Pick your rules", "Next it offers /rules-setup so answers match how your shop works."],
          ["Ask anything", "“What did we promise the Lees?” “Which permits expire this month?”"],
        ].map(([t, d]) => (
          <Card key={t}><h3 className="text-xl font-bold">{t}</h3><p className="mt-2 text-muted">{d}</p></Card>
        ))}
      </section>

      <section aria-labelledby="promise" className="mt-16 rounded-2xl bg-blue p-8 text-white sm:p-12">
        <h2 id="promise" className="text-3xl font-extrabold">Our setup promises</h2>
        <ul className="mt-6 space-y-3 text-lg">
          {rules.map((r) => (
            <li key={r} className="flex gap-3"><span className="font-extrabold text-orange" aria-hidden>✓</span>{r}</li>
          ))}
        </ul>
      </section>

      <div className="mt-12 flex flex-wrap gap-3">
        <Button href="/docs#start">Start free</Button>
        <Button href="/packages" kind="outline">See all setup commands</Button>
      </div>
    </>
  );
}
