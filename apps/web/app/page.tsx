import Link from "next/link";
import { Badge, Button, Card, ChatDemo, Label } from "@/components/ui";
import { brainSetup, packages, rulePacks, trades } from "@/lib/content";

const scattered = ["Gmail", "Drive", "Texts", "Folders", "CRM", "QuickBooks", "City portals"];

const steps = [
  ["Add it to Claude", "The owner adds Blue Collar MCP once. Each person signs in."],
  ["Type a setup command", "Like /brain-setup. Claude asks simple multiple-choice questions."],
  ["Follow the steps", "Exact links, one step at a time. Claude connects your stuff and pulls it in."],
  ["Ask in plain English", "“Where are we on the Garcia job?” Everyone gets the same answer."],
];

export default function Home() {
  return (
    <>
      <section className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <Label>For residential trades</Label>
          <h1 className="mt-3 text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Your whole shop. <span className="text-orange">One straight answer.</span>
          </h1>
          <p className="mt-6 text-xl text-muted">
            A guided AI crew inside Claude chat. It learns your jobs, clients, and rules, then
            answers you and your team the same way, every time.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/docs#start">Start free</Button>
            <Button href="/how-it-works" kind="outline">See how setup works</Button>
          </div>
          <p className="mt-6 text-muted">No tech skills needed. If you can text, you can set this up.</p>
        </div>
        <ChatDemo command="/brain-setup" turns={brainSetup.slice(0, 2)} />
      </section>

      <section aria-label="Who it's for" className="mt-16">
        <ul className="flex flex-wrap gap-2">
          {trades.map((t) => (
            <li key={t} className="rounded-full border-2 border-blue/20 bg-surface px-4 py-1.5 font-semibold text-blue">{t}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="truth" className="mt-20 grid gap-8 rounded-2xl bg-blue p-8 text-white sm:p-12 lg:grid-cols-2">
        <div>
          <Label>One source of truth</Label>
          <h2 id="truth" className="mt-2 text-4xl font-extrabold tracking-tight">Stop digging through five apps.</h2>
          <p className="mt-4 text-xl text-white/85">
            Your info is spread across email, folders, texts, and your CRM. Blue Collar pulls it into one
            company brain. Old info gets flagged, so nobody works off last month&rsquo;s numbers.
          </p>
        </div>
        <ul className="flex flex-wrap content-center gap-3">
          {scattered.map((s) => (
            <li key={s} className="rounded-lg border-2 border-white/30 px-4 py-2 text-lg font-semibold">{s}</li>
          ))}
          <li className="w-full text-2xl font-bold text-orange" aria-hidden>↓</li>
          <li className="rounded-lg bg-orange px-5 py-3 text-xl font-extrabold">One company brain</li>
        </ul>
      </section>

      <section aria-labelledby="how" className="mt-20">
        <Label>Guided setup</Label>
        <h2 id="how" className="mt-2 text-4xl font-extrabold tracking-tight">Set up by answering a few questions.</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([t, d], i) => (
            <li key={t}>
              <Card className="h-full">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange text-xl font-extrabold text-white">{i + 1}</span>
                <h3 className="mt-3 text-xl font-bold">{t}</h3>
                <p className="mt-2 text-muted">{d}</p>
              </Card>
            </li>
          ))}
        </ol>
        <p className="mt-6"><Link href="/how-it-works" className="text-lg font-bold text-blue underline underline-offset-4">Walk through a real setup →</Link></p>
      </section>

      <section aria-labelledby="rules" className="mt-20">
        <Label>Trade-smart</Label>
        <h2 id="rules" className="mt-2 text-4xl font-extrabold tracking-tight">Rule packs that know your trade.</h2>
        <p className="mt-3 max-w-2xl text-xl text-muted">
          Start with a pack built for your kind of work. Keep, edit, or drop each rule. Your whole team gets the same version.
        </p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rulePacks.map((r) => (
            <li key={r.id}>
              <Card className="h-full">
                <h3 className="text-xl font-bold">{r.name}</h3>
                <p className="mt-1 text-muted">{r.forWho}</p>
                <p className="mt-3 border-l-4 border-orange pl-3">“{r.samples[0]}”</p>
              </Card>
            </li>
          ))}
          <li>
            <Card className="flex h-full flex-col justify-center border-dashed">
              <h3 className="text-xl font-bold">Or mine your own</h3>
              <p className="mt-2 text-muted">Claude spots what your shop repeats and suggests rules for you to approve.</p>
            </Card>
          </li>
        </ul>
      </section>

      <section aria-labelledby="pkgs" className="mt-20">
        <Label>Packages</Label>
        <h2 id="pkgs" className="mt-2 text-4xl font-extrabold tracking-tight">Add a crew member for each job.</h2>
        <p className="mt-3 max-w-2xl text-xl text-muted">Each package has its own setup command. Run it in Claude and follow along.</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((p) => (
            <li key={p.id}>
              <Card className="h-full">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-2xl font-extrabold">{p.name}</h3>
                  <Badge status={p.status} />
                </div>
                <p className="mt-2 text-muted">{p.what}</p>
                <code className="mt-4 inline-block rounded-md bg-code px-3 py-1.5 font-mono text-code-fg">{p.command}</code>
              </Card>
            </li>
          ))}
        </ul>
        <p className="mt-6"><Link href="/packages" className="text-lg font-bold text-blue underline underline-offset-4">See every package →</Link></p>
      </section>

      <section aria-labelledby="safe" className="mt-20 grid gap-4 sm:grid-cols-3">
        <h2 id="safe" className="sr-only">Safe by design</h2>
        {[
          ["Nothing happens without your OK", "Sending, ordering, scheduling, or paying always waits for you to confirm."],
          ["Passwords never go in chat", "You sign in through a secure link. Claude never sees your password."],
          ["Your data is yours", "Open source. Use our hosted server or run your own."],
        ].map(([t, d]) => (
          <Card key={t}>
            <h3 className="text-xl font-bold">{t}</h3>
            <p className="mt-2 text-muted">{d}</p>
          </Card>
        ))}
      </section>

      <section className="mt-20 rounded-2xl border-4 border-orange bg-surface p-8 text-center sm:p-12">
        <h2 className="text-4xl font-extrabold tracking-tight">Free to start.</h2>
        <p className="mx-auto mt-3 max-w-xl text-xl text-muted">Brain, rules, and permits are free. Pay only when you need more.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button href="/docs#start">Start free</Button>
          <Button href="/pricing" kind="outline">See pricing</Button>
        </div>
      </section>
    </>
  );
}
