import type { Pkg } from "@/lib/content";
import { Button, Chip, Tag } from "@/components/ui";

// Mock "output" panels: show what each package makes (TASTE.md principle 1).

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col overflow-hidden md:aspect-[16/10] rounded-2xl border border-line bg-gradient-to-b from-panel-2 to-panel">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-xs text-ink-3">
        <span className="h-2 w-2 rounded-full bg-lime" aria-hidden />{title}
      </div>
      <div className="flex-1 overflow-hidden p-4 text-sm">{children}</div>
    </div>
  );
}

const Dot = ({ c }: { c: "ok" | "warn" | "bad" }) =>
  <span className={`inline-block h-2 w-2 rounded-full ${{ ok: "bg-ok", warn: "bg-warn", bad: "bg-bad" }[c]}`} aria-hidden />;

function Brain() {
  return (
    <Frame title="Claude · Garcia remodel">
      <p className="ml-auto w-fit rounded-xl bg-white/10 px-3 py-2">What did we promise the Garcias?</p>
      <div className="mt-3 space-y-2 rounded-xl border border-line p-3">
        <p className="font-semibold">3 open commitments</p>
        <p className="text-ink-2">• Tile samples by Fri (Maria)</p>
        <p className="text-ink-2">• Revised quote with pantry (you)</p>
        <p className="text-ink-2">• Call back about permit timing</p>
        <p className="text-xs text-ink-3">From email 11/14 and meeting 11/18 · updated today</p>
      </div>
    </Frame>
  );
}

function Rules() {
  const rows = [["Change orders in writing before work", "Process"], ["Quotes list allowances on their own line", "Pricing"], ["Replies under 5 sentences", "Voice"]];
  return (
    <Frame title="Rules · version 3">
      <ul className="space-y-2">
        {rows.map(([r, t]) => (
          <li key={r} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2">
            <span>{r}</span><span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs text-ink-2">{t}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-3">Same version for 4 team members</p>
    </Frame>
  );
}

function Permits() {
  const rows: [string, string, string, "ok" | "warn" | "bad"][] = [
    ["Phoenix", "Pool · 2214 E Elm", "Inspection Thu", "ok"],
    ["Queen Creek", "Patio cover", "Resubmit by 12/2", "warn"],
    ["Mesa", "Electrical upgrade", "Expires in 9 days", "bad"],
    ["Gilbert", "Kitchen remodel", "Approved", "ok"],
  ];
  return (
    <Frame title="Permits · all cities">
      <table className="w-full text-left">
        <tbody>
          {rows.map(([c, j, s, d]) => (
            <tr key={j} className="border-b border-line last:border-0">
              <td className="py-2 text-ink-3">{c}</td><td className="py-2">{j}</td>
              <td className="py-2 text-right text-ink-2"><span className="inline-flex items-center gap-2">{s} <Dot c={d} /></span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Frame>
  );
}

function Books() {
  const bars = [62, 48, 71, 55, 80, 67];
  return (
    <Frame title="Books · read-only">
      <p className="text-xs uppercase tracking-wide text-ink-3">Profit, last 6 months</p>
      <p className="mt-1 text-3xl font-semibold">$84,210</p>
      <div className="mt-3 flex h-20 items-end gap-2">
        {bars.map((b, i) => <div key={i} className={`flex-1 rounded-t ${i === bars.length - 1 ? "bg-lime" : "bg-white/20"}`} style={{ height: `${b}%` }} />)}
      </div>
    </Frame>
  );
}

function Crm() {
  const cols = [["Leads", ["Nguyen pool", "Ortiz ADU"]], ["Quoted", ["Patel kitchen", "Lee backyard"]], ["Won", ["Garcia remodel"]]] as const;
  return (
    <Frame title="CRM · from JobTread">
      <div className="grid grid-cols-3 gap-2">
        {cols.map(([h, items]) => (
          <div key={h}>
            <p className="mb-2 text-xs uppercase tracking-wide text-ink-3">{h}</p>
            {items.map((i) => <p key={i} className="mb-2 rounded-lg border border-line px-2 py-1.5">{i}</p>)}
          </div>
        ))}
      </div>
    </Frame>
  );
}

function Inventory() {
  const rows = [["Pool pump 1.5HP", "Pool Corp · Chandler", "6 in stock"], ["PVC 2\" × 20ft", "Home Depot · Mesa", "40 in stock"], ["Pebble finish, Midnight", "Pool Corp · Tempe", "Order 3 days"]];
  return (
    <Frame title="Inventory · Nguyen pool list">
      <ul className="space-y-2">
        {rows.map(([i, w, s]) => (
          <li key={i} className="flex justify-between gap-2 rounded-xl border border-line px-3 py-2">
            <span>{i}<span className="block text-xs text-ink-3">{w}</span></span><span className="text-ink-2">{s}</span>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

export const previews: Record<string, () => React.ReactElement> = {
  brain: Brain, rules: Rules, permits: Permits, books: Books, crm: Crm, inventory: Inventory,
};

// Catalog row: preview left, text + chips + buttons right.
export function PackageRow({ p }: { p: Pkg }) {
  const Preview = previews[p.id];
  return (
    <article id={p.id} className="grid scroll-mt-24 grid-cols-1 gap-6 md:grid-cols-[1.15fr_1fr] md:gap-8">
      <Preview />
      <div className="flex min-w-0 flex-col">
        <h3 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">{p.name} <Tag status={p.status} /></h3>
        <p className="mt-2 text-ink-2">{p.what}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip cmd>{p.command.slice(1)}</Chip>
          {p.examples.slice(0, 1).map((e) => <Chip key={e}>{e}</Chip>)}
        </div>
        <div className="mt-6 flex gap-2 md:mt-auto">
          <Button href="/docs#start" kind="white" small>Try now</Button>
          <Button href={`/packages#${p.id}`} kind="dark" small>Learn more</Button>
        </div>
      </div>
    </article>
  );
}
