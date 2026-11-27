import type { Metadata } from "next";
import { Button, Card, ChatDemo, PageHeader } from "@/components/ui";
import { permitsSetup } from "@/lib/content";

export const metadata: Metadata = { title: "How it works · Blue Collar MCP" };

const pattern = [
  ["You type a command", "Like /permits-setup."],
  ["Claude asks one question", "Pick A, B, C, or D. No essays."],
  ["You get exact steps", "The right link and what to click."],
  ["Claude checks it worked", "It tests the connection before moving on."],
  ["You get a first win", "A real answer about your own business."],
];

const promises = [
  "One question at a time, in plain English.",
  "Always the exact link, never “go find the settings.”",
  "Passwords never go in chat. You use a secure sign-in link.",
  "Before anything is saved, sent, or ordered, you see a preview and say yes.",
  "If it doesn't know, it says so. It never makes things up.",
];

export default function HowItWorks() {
  return (
    <>
      <PageHeader title="Setup is a" accent="multiple-choice quiz" sub="Every package sets up the same way. Claude asks, you pick, it walks you through." />

      <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Every setup <span className="text-ink-3">5 steps</span></h2>
          <ol className="mt-8 space-y-6">
            {pattern.map(([t, d], i) => (
              <li key={t} className="flex gap-5">
                <span className="display w-12 shrink-0 text-4xl text-lime">0{i + 1}</span>
                <div>
                  <h3 className="text-lg font-semibold">{t}</h3>
                  <p className="text-ink-2">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <ChatDemo command="/permits-setup" turns={permitsSetup} />
      </div>

      <section aria-labelledby="promise" className="mt-24 grid gap-10 lg:grid-cols-[280px_1fr]">
        <h2 id="promise" className="text-2xl font-semibold tracking-tight">Our promises <span className="text-ink-3">{promises.length}</span></h2>
        <ul className="divide-y divide-line border-y border-line">
          {promises.map((r) => (
            <li key={r} className="flex gap-4 py-4 text-lg"><span className="text-lime" aria-hidden>✓</span><span className="text-ink-2">{r}</span></li>
          ))}
        </ul>
      </section>

      <section className="mt-24 grid gap-4 md:grid-cols-3">
        {[
          ["Review the odd ones", "Unclear matches and duplicates, one at a time. You decide."],
          ["Check your dashboard", "Every permit and inspection, problems first."],
          ["Ask anything", "“Which permits expire this month?”"],
        ].map(([t, d]) => <Card key={t}><h3 className="font-semibold">{t}</h3><p className="mt-1 text-ink-2">{d}</p></Card>)}
      </section>

      <div className="mt-12 flex flex-wrap gap-3">
        <Button href="/signup">Start free</Button>
        <Button href="/packages" kind="dark">See all setup commands</Button>
      </div>
    </>
  );
}
