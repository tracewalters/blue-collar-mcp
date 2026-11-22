import type { Metadata } from "next";
import { getSeats, getSources, getUsage, type SourceStatus } from "@/lib/mock";
import { Card, PageHeader } from "@/components/ui";
import { UsageChart } from "@/components/UsageChart";

export const metadata: Metadata = { title: "Account · Blue Collar MCP" };

const status: Record<SourceStatus, { label: string; cls: string }> = {
  healthy: { label: "Connected", cls: "bg-blue text-white" },
  needs_relogin: { label: "Sign in again", cls: "bg-orange text-white" },
  needs_2fa: { label: "Needs code", cls: "bg-orange text-white" },
};

export default async function Account() {
  const [usage, sources, seats] = await Promise.all([getUsage(), getSources(), getSeats()]);
  const top = Math.max(...usage.byTool.map((t) => t.calls));
  return (
    <>
      <PageHeader title="Account" sub={`Your shop for ${usage.month}. Sample data.`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="text-xl font-bold">Questions answered this month</h2>
          <p className="mt-1 text-4xl font-extrabold tabular-nums">{usage.totalCalls.toLocaleString("en-US")}</p>
          <div className="mt-4"><UsageChart data={usage.daily} /></div>
        </Card>
        <Card>
          <h2 className="text-xl font-bold">Connected sources</h2>
          <ul className="mt-4 space-y-4">
            {sources.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  {s.name}
                  <span className="block text-sm font-normal text-muted">{s.kind}</span>
                </span>
                <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${status[s.status].cls}`}>
                  {status[s.status].label}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="text-xl font-bold">Use by package</h2>
          <ul className="mt-4 space-y-3">
            {usage.byTool.map((t) => (
              <li key={t.tool} className="grid grid-cols-[6rem_1fr_3.5rem] items-center gap-3">
                <span className="font-semibold">{t.tool}</span>
                <div className="h-3 rounded-full bg-line" aria-hidden>
                  <div className="h-3 rounded-full bg-orange" style={{ width: `${(t.calls / top) * 100}%` }} />
                </div>
                <span className="text-right tabular-nums text-muted">{t.calls}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="text-xl font-bold">Team</h2>
          <ul className="mt-4 space-y-3">
            {seats.map((s) => (
              <li key={s.name} className="flex justify-between"><span>{s.name}</span><span className="text-muted">{s.role}</span></li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
