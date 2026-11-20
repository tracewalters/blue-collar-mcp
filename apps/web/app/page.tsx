import { Card, Code, INSTALL } from "@/components/ui";

const steps = [
  ["Install", "Add the MCP to Claude Code with one command."],
  ["Pick cities", "Choose the cities where you have active permits."],
  ["Log in once", "Sign in to each city portal, one by one. Never again."],
  ["Ask Claude", "“What’s the status of every open permit?”"],
];

const portals = [
  ["Tyler", "Portico / EnerGov"],
  ["Accela", "Civic Platform"],
  ["OpenGov", "Permitting & Licensing"],
  ["Salesforce", "Shape / Phoenix"],
];

export default function Home() {
  return (
    <>
      <section className="py-10 text-center">
        <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
          One MCP for every permit portal. <span className="text-accent">Log in once.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
          Contractors juggle permits and inspections across dozens of city portals. Permit MCP lets
          Claude read and act on all of them.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <a href="#install" className="rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-fg">
            Get started
          </a>
          <a href="https://github.com/tracewalters/Permit-MCP" className="rounded-lg border border-line px-5 py-2.5 font-medium hover:bg-surface">
            View on GitHub
          </a>
        </div>
      </section>

      <section aria-labelledby="how" className="mt-20">
        <h2 id="how" className="text-2xl font-semibold tracking-tight">How it works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([t, d], i) => (
            <li key={t}>
              <Card className="h-full">
                <span className="text-sm font-medium text-accent">Step {i + 1}</span>
                <h3 className="mt-1 font-semibold">{t}</h3>
                <p className="mt-2 text-sm text-muted">{d}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="portals" className="mt-20">
        <h2 id="portals" className="text-2xl font-semibold tracking-tight">Supported portals</h2>
        <p className="mt-2 text-muted">One adapter per platform. Each city is a small config on top.</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {portals.map(([n, d]) => (
            <li key={n}>
              <Card>
                <h3 className="font-semibold">{n}</h3>
                <p className="mt-1 text-sm text-muted">{d}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="safety" className="mt-20">
        <h2 id="safety" className="text-2xl font-semibold tracking-tight">Safe by design</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Card>
            <h3 className="font-semibold">Two-phase writes</h3>
            <p className="mt-2 text-sm text-muted">
              Submitting, scheduling, or paying is always propose, then confirm. Nothing happens
              without your approval.
            </p>
          </Card>
          <Card>
            <h3 className="font-semibold">Credentials never reach the model</h3>
            <p className="mt-2 text-sm text-muted">
              You log in through the terminal or a secure link, never in chat. Claude only sees a
              connection ID.
            </p>
          </Card>
        </div>
      </section>

      <section aria-labelledby="install" className="mt-20 scroll-mt-8">
        <h2 id="install" className="text-2xl font-semibold tracking-tight">Install for Claude Code</h2>
        <div className="mt-6 max-w-2xl"><Code label="Install command">{INSTALL}</Code></div>
        <p className="mt-3 text-sm text-muted">Not on npm yet. Until then, build from source (see the GitHub README).</p>
      </section>

      <section aria-labelledby="oss" className="mt-20">
        <Card className="text-center">
          <h2 id="oss" className="text-2xl font-semibold tracking-tight">Open source</h2>
          <p className="mx-auto mt-2 max-w-xl text-muted">
            MIT licensed. Run it locally or self-host. We also run a hosted version.
          </p>
          <a href="https://github.com/tracewalters/Permit-MCP" className="mt-5 inline-block rounded-lg border border-line px-5 py-2.5 font-medium hover:bg-bg">
            github.com/tracewalters/Permit-MCP
          </a>
        </Card>
      </section>
    </>
  );
}
