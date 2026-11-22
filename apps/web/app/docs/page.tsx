import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { GITHUB, packages } from "@/lib/content";

export const metadata: Metadata = { title: "Docs · Blue Collar MCP" };

const H2 = ({ id, children }: { id: string; children: string }) => (
  <h2 id={id} className="mt-14 scroll-mt-8 text-3xl font-extrabold">{children}</h2>
);

export default function Docs() {
  return (
    <article className="max-w-3xl">
      <PageHeader title="Docs" sub="Early draft. Commands and steps may change." />

      <H2 id="start">1. Add it to Claude</H2>
      <p className="mt-3 text-lg">The owner does this once. Each team member then signs in with their own account.</p>
      <ol className="mt-4 list-decimal space-y-2 pl-6 text-lg">
        <li>Open Claude and go to <b>Settings → Connectors</b>.</li>
        <li>Click <b>Add custom connector</b>.</li>
        <li>Paste the Blue Collar MCP link and sign in.</li>
      </ol>
      <Card className="mt-5 border-orange">
        <p className="text-lg"><b>Heads up:</b> the hosted link opens soon. Until then, you can run it yourself from the{" "}
          <a href={GITHUB} className="font-bold text-blue underline underline-offset-4">GitHub code</a>.</p>
      </Card>

      <H2 id="setup">2. Run a setup command</H2>
      <p className="mt-3 text-lg">Type one of these in a Claude chat. Start with <code className="font-mono">/brain-setup</code>.</p>
      <div className="mt-4 overflow-x-auto rounded-xl border-2 border-line bg-surface">
        <table className="w-full text-left">
          <caption className="sr-only">Setup commands</caption>
          <thead className="bg-blue text-white">
            <tr><th scope="col" className="p-3">Command</th><th scope="col" className="p-3">What it sets up</th></tr>
          </thead>
          <tbody>
            {packages.map((p) => (
              <tr key={p.id} className="border-t-2 border-line">
                <th scope="row" className="whitespace-nowrap p-3 font-mono font-semibold">{p.command}</th>
                <td className="p-3 text-muted">{p.what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2 id="ask">3. Ask in plain English</H2>
      <ul className="mt-3 space-y-2 text-lg">
        <li>“What did we decide with the Parkers last week?”</li>
        <li>“Which permits have inspections coming up?”</li>
        <li>“Draft a follow-up to every quote older than 10 days.”</li>
      </ul>

      <H2 id="safety">Safety</H2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-lg">
        <li>Anything that sends, orders, schedules, or pays shows you a plan first. Nothing happens until you say yes.</li>
        <li>Never type a password into chat. Use the secure sign-in link Claude gives you.</li>
        <li>Info has an “updated” date. Old info is flagged.</li>
        <li>It only touches your own accounts and portals.</li>
      </ul>

      <H2 id="self-host">Run it yourself</H2>
      <p className="mt-3 text-lg">Open source under MIT. See the <a href={GITHUB} className="font-bold text-blue underline underline-offset-4">README on GitHub</a> to build from source.</p>
    </article>
  );
}
