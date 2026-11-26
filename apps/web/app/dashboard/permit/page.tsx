"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AskClaude, DashShell, Freshness, Loading, Note, Problem, SignedOut, StatusChip, useFresh } from "@/components/Dash";
import { daysFrom, fmtDay, inspLabel, money, permitLabel, problem, type Fresh, type Inspection, type Me, type Permit } from "@/lib/dash";

export default function PermitPage() {
  return <Suspense fallback={<Loading />}><Detail /></Suspense>;
}

function Detail() {
  const q = useSearchParams();
  const city = q.get("city") ?? "", id = q.get("id") ?? "";
  return (
    <DashShell title={id || "Permit"}>
      {(me) => (city && id ? <Body me={me} city={city} id={id} /> : <Problem message="That permit link is missing a city or ID." />)}
    </DashShell>
  );
}

function Body({ me, city, id }: { me: Me; city: string; id: string }) {
  const { res, busy, refresh } = useFresh<Fresh & { permit: Permit; inspections: Inspection[] }>(`/permit?city=${encodeURIComponent(city)}&id=${encodeURIComponent(id)}`);
  if (!res) return <Loading slow />;
  if (!res.ok) return res.signedOut ? <SignedOut /> : <Problem message={res.message} retry={refresh} />;
  const { permit: p, inspections } = res.data;
  const [label, tone] = permitLabel[p.status];
  const x = problem(p, inspections);
  const cityName = me.cities.find((c) => c.id === p.jurisdiction);
  const left = p.expiresAt ? daysFrom(p.expiresAt) : null;
  const facts: [string, string][] = [
    ["City", cityName ? `${cityName.name}, ${cityName.state}` : p.jurisdiction],
    ["Applied", fmtDay(p.appliedAt)],
    ["Expires", p.expiresAt ? `${fmtDay(p.expiresAt)}${left !== null && left >= 0 ? ` (${left} days)` : ""}` : "Not set"],
    ["Fees due", money(p.feesDue ?? 0)],
  ];
  const sorted = [...inspections].sort((a, b) => (b.scheduledFor ?? "9").localeCompare(a.scheduledFor ?? "9"));

  return (
    <div className="mt-6 space-y-10">
      <Freshness at={res.data.fetchedAt} busy={busy} error={res.data.refreshError} onRefresh={refresh} />
      <div>
        <p className="text-xl font-semibold">{p.address}</p>
        <p className="mt-1 text-ink-2">{p.type}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <StatusChip label={label} tone={tone} />
          {x.why && x.tone && <Note tone={x.tone}>{x.why}</Note>}
        </div>
        {p.description && <p className="mt-4 max-w-2xl text-ink-2">{p.description}</p>}
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {facts.map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-line bg-panel p-5">
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-3">{k}</dt>
            <dd className="mt-2 text-lg font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="pi">
        <h2 id="pi" className="text-2xl font-semibold tracking-tight">Inspections <span className="text-ink-3">{inspections.length}</span></h2>
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
          {sorted.length === 0 && <li className="p-5 text-ink-2">No inspections on this permit yet.</li>}
          {sorted.map((i) => {
            const [l, t] = inspLabel[i.status];
            return (
              <li key={i.id} className="flex flex-wrap items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                  <p className="font-semibold">{i.type}</p>
                  <p className="mt-0.5 text-[15px] text-ink-2">{i.scheduledFor ? fmtDay(i.scheduledFor) : "No date yet"}</p>
                  {i.notes && <p className="mt-1 text-[15px] text-ink-2">Inspector: “{i.notes}”</p>}
                </div>
                <StatusChip label={l} tone={t} />
              </li>
            );
          })}
        </ul>
      </section>

      <AskClaude prompts={[`What's next on ${p.id}?`, `When does the ${p.address} permit expire?`, `What inspections are left on ${p.address}?`]} />
      <Link href="/dashboard" className="inline-block text-ink-2 hover:text-ink">← All permits</Link>
    </div>
  );
}
