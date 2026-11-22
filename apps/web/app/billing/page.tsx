import type { Metadata } from "next";
import { getInvoices, getPlan, getUsage } from "@/lib/mock";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Billing · Blue Collar MCP" };

const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function Meter({ label, used, of }: { label: string; used: number; of: number }) {
  const pct = Math.min(100, Math.round((used / of) * 100));
  return (
    <div>
      <p className="flex justify-between"><span className="font-semibold">{label}</span>
        <span className="tabular-nums text-ink-2">{used.toLocaleString("en-US")} of {of.toLocaleString("en-US")}</span></p>
      <div role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}
        className="mt-2 h-3 rounded-full bg-line">
        <div className="h-3 rounded-full bg-lime" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function Billing() {
  const [plan, usage, invoices] = await Promise.all([getPlan(), getUsage(), getInvoices()]);
  return (
    <>
      <PageHeader title="Billing" sub="Sample data. Payments are not connected yet." />
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Plan</h2>
          <p className="mt-2 text-3xl font-semibold">{plan.name}</p>
          <p className="mt-1 text-ink-2">{plan.seats} seats · Resets {plan.renewsOn}</p>
          {/* TODO: POST to a server route that creates a Stripe Customer Portal session. */}
          <button type="button" disabled aria-disabled className="mt-5 cursor-not-allowed rounded-lg border border-line px-5 py-2.5 font-bold opacity-60">
            Manage plan (coming soon)
          </button>
        </Card>
        <Card className="space-y-5">
          <h2 className="text-lg font-semibold">This month</h2>
          <Meter label="Questions" used={usage.totalCalls} of={plan.includedCalls} />
          {plan.credits.map((c) => <Meter key={c.name} label={c.name} used={c.used} of={c.included} />)}
        </Card>
      </div>

      <h2 className="mt-12 text-2xl font-semibold tracking-tight">Invoices</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full text-left">
          <thead className="text-ink-3">
            <tr>
              {["Invoice", "Date", "Amount", "Status"].map((h) => (
                <th key={h} scope="col" className="p-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id} className="border-t border-line">
                <th scope="row" className="p-3 font-normal"><a href={i.url} className="underline underline-offset-2">{i.id}</a></th>
                <td className="p-3 text-ink-2">{i.date}</td>
                <td className="p-3 tabular-nums">{usd(i.amountUsd)}</td>
                <td className="p-3 capitalize">{i.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
