import Link from "next/link";
import { Button, Card, IconTile, SectionTitle } from "@/components/ui";
import { PackageRow } from "@/components/Previews";
import { packages, rulePacks, trades } from "@/lib/content";

const steps = [
  ["Add it to Claude", "The owner adds it once. Each person signs in."],
  ["Connect your city", "Sign in to your permit portal on your private dashboard."],
  ["Ask in plain English", "“Which inspections are this week?”"],
];

export default function Home() {
  return (
    <>
      <section className="relative -mx-5 overflow-hidden px-5 pb-16 pt-24 text-center sm:-mx-8 sm:pt-32">
        <div className="blueprint absolute inset-0 -z-10" aria-hidden />
        <div className="glow absolute inset-x-0 top-10 -z-10 h-96" aria-hidden />
        <p className="mx-auto w-fit rounded-full border border-line bg-panel px-3 py-1 text-sm text-ink-2">
          <span className="mr-2 rounded-md bg-lime px-1.5 py-0.5 text-xs font-semibold text-lime-ink">New</span>
          Permits is live. More packages coming later.
        </p>
        <h1 className="display mx-auto mt-8 max-w-5xl text-5xl sm:text-7xl lg:text-[88px]">
          Every permit, <span className="text-lime">one place</span>, right in Claude
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-ink-2">
          Connect your city permit portals once. Ask Claude what needs you. See it all on a private dashboard.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button href="/docs#start" kind="white">Add Blue Collar to Claude</Button>
          <Button href="/how-it-works" kind="dark">How does setup work?</Button>
        </div>
        <ul className="no-scrollbar mx-auto mt-14 flex max-w-4xl gap-2 overflow-x-auto sm:flex-wrap sm:justify-center">
          {trades.map((t, i) => (
            <li key={t} className={`shrink-0 rounded-full px-4 py-2 text-[15px] ${i === 0 ? "bg-white/10 text-ink" : "text-ink-3"}`}>{t}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="steps" className="grid gap-4 md:grid-cols-3">
        <h2 id="steps" className="sr-only">Three steps</h2>
        {steps.map(([t, d], i) => (
          <Card key={t}>
            <span className="display text-5xl text-lime">0{i + 1}</span>
            <h3 className="mt-4 text-xl font-semibold">{t}</h3>
            <p className="mt-1 text-ink-2">{d}</p>
          </Card>
        ))}
      </section>

      <section aria-labelledby="pk" className="mt-28 grid grid-cols-1 gap-10 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <h2 id="pk" className="text-2xl font-semibold tracking-tight">Setup commands <span className="text-ink-3">{packages.length}</span></h2>
          <p className="mt-2 text-ink-2">Type one in Claude. It walks you through the rest.</p>
          <ul className="no-scrollbar mt-6 flex gap-1 overflow-x-auto lg:flex-col">
            {packages.map((p, i) => (
              <li key={p.id} className="shrink-0">
                <a href={`#${p.id}`} className={`flex items-center gap-3 rounded-xl px-2 py-2 ${i === 0 ? "bg-panel-2 text-lime" : "hover:bg-panel-2"}`}>
                  <IconTile letter={p.name[0]} active={i === 0} />{p.name}
                </a>
              </li>
            ))}
          </ul>
        </aside>
        <div className="min-w-0 space-y-16">
          {packages.map((p) => <PackageRow key={p.id} p={p} />)}
        </div>
      </section>

      <section aria-labelledby="rp" className="mt-28">
        <SectionTitle title="Rule packs" count={rulePacks.length} sub="Rules built for your trade. Keep, edit, or drop each one. The whole team uses the same version." />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {rulePacks.map((r) => (
            <li key={r.id}>
              <Card className="h-full p-5">
                <h3 className="font-semibold">{r.name}</h3>
                <p className="mt-1 text-sm text-ink-3">{r.forWho}</p>
                <p className="mt-4 text-sm text-ink-2">“{r.samples[0]}”</p>
              </Card>
            </li>
          ))}
        </ul>
        <Link href="/rule-packs" className="mt-6 inline-block text-ink-2 hover:text-ink">All rule packs →</Link>
      </section>

      <section className="relative mt-28 overflow-hidden rounded-3xl border border-line bg-panel px-6 py-16 text-center">
        <div className="glow absolute inset-0 -z-0" aria-hidden />
        <div className="relative">
          <h2 className="display text-4xl sm:text-6xl">Free to <span className="text-lime">start</span></h2>
          <p className="mx-auto mt-4 max-w-md text-ink-2">Permits are free. Pay only when you need more.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button href="/docs#start">Start free</Button>
            <Button href="/pricing" kind="dark">See pricing</Button>
          </div>
        </div>
      </section>
    </>
  );
}
