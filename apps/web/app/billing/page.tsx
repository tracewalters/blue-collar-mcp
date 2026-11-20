import type { Metadata } from "next";
import { getInvoices, getPlan, getUsage } from "@/lib/mock";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Billing · Permit MCP" };

const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export default async function Billing() {
  const [plan, usage, invoices] = await Promise.all([getPlan(), getUsage(), getInvoices()]);
  const pct = Math.min(100, Math.round((usage.totalCalls / plan.includedCalls) * 100));
  return (
    <>
      <PageHeader title="Billing" sub="Sample data. Stripe is not connected yet." />
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Plan</h2>
          <p className="mt-2 text-3xl font-semibold">
            {plan.name} <span className="text-base font-normal text-muted">{usd(plan.priceUsd)}/month</span>
          </p>
          <p className="mt-1 text-sm text-muted">Renews {plan.renewsOn}</p>
          {/* TODO: POST to a server route that creates a Stripe Customer Portal session. */}
          <button type="button" disabled aria-disabled className="mt-4 cursor-not-allowed rounded-lg border border-line px-4 py-2 text-sm opacity-60">
            Manage plan (coming soon)
          </button>
        </Card>
        <Card>
          <h2 className="font-semibold">Usage</h2>
          <p className="mt-2 text-sm">
            <span className="text-3xl font-semibold tabular-nums">{usage.totalCalls.toLocaleString("en-US")}</span>{" "}
            <span className="text-muted">of {plan.includedCalls.toLocaleString("en-US")} calls</span>
          </p>
          <div role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Plan usage"
            className="mt-4 h-3 rounded-full bg-line">
            <div className="h-3 rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted">{pct}% used this month</p>
        </Card>
      </div>

      <h2 className="mt-10 text-xl font-semibold">Invoices</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-muted">
            <tr>
              {["Invoice", "Date", "Amount", "Status"].map((h) => (
                <th key={h} scope="col" className="p-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id} className="border-t border-line">
                <th scope="row" className="p-3 font-normal"><a href={i.url} className="underline underline-offset-2">{i.id}</a></th>
                <td className="p-3 text-muted">{i.date}</td>
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
