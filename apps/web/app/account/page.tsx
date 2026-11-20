import type { Metadata } from "next";
import { getPortals, getUsage, type PortalStatus } from "@/lib/mock";
import { Card, PageHeader } from "@/components/ui";
import { UsageChart } from "@/components/UsageChart";

export const metadata: Metadata = { title: "Account · Permit MCP" };

const status: Record<PortalStatus, { label: string; cls: string }> = {
  healthy: { label: "Healthy", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  needs_relogin: { label: "Needs re-login", cls: "bg-amber-500/15 text-amber-800 dark:text-amber-300" },
  needs_2fa: { label: "Needs 2FA", cls: "bg-amber-500/15 text-amber-800 dark:text-amber-300" },
};

export default async function Account() {
  const [usage, portals] = await Promise.all([getUsage(), getPortals()]);
  const top = Math.max(...usage.byTool.map((t) => t.calls));
  return (
    <>
      <PageHeader title="Account" sub={`Usage for ${usage.month}. Sample data.`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="font-semibold">Calls this month</h2>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{usage.totalCalls.toLocaleString("en-US")}</p>
          <div className="mt-4"><UsageChart data={usage.daily} /></div>
        </Card>
        <Card>
          <h2 className="font-semibold">Connected portals</h2>
          <ul className="mt-4 space-y-3">
            {portals.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span>
                  {p.name}
                  <span className="block text-xs text-muted">{p.platform}</span>
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status[p.status].cls}`}>
                  {status[p.status].label}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="lg:col-span-3">
          <h2 className="font-semibold">Calls by tool</h2>
          <ul className="mt-4 space-y-3">
            {usage.byTool.map((t) => (
              <li key={t.tool} className="grid grid-cols-[10rem_1fr_4rem] items-center gap-3 text-sm sm:grid-cols-[12rem_1fr_4rem]">
                <span className="truncate font-mono">{t.tool}</span>
                <div className="h-2 rounded-full bg-line" aria-hidden>
                  <div className="h-2 rounded-full bg-accent" style={{ width: `${(t.calls / top) * 100}%` }} />
                </div>
                <span className="text-right tabular-nums text-muted">{t.calls}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
