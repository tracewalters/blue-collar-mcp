"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AskClaude, darkBtn, DashShell, Freshness, Loading, Note, Problem, SignedOut, Spinner, StatusChip, useApi, useFresh } from "@/components/Dash";
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

  const toBook = inspections.filter((i) => i.status === "needed");

  return (
    <div className="mt-8 space-y-14">
      <div className="space-y-4">
        <Link href="/dashboard" className="inline-flex min-h-11 items-center text-[15px] text-ink-2 hover:text-ink">← All permits</Link>
        <Freshness at={res.data.fetchedAt} busy={busy} error={res.data.refreshError} onRefresh={refresh} />
        <section aria-label="Summary" className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
          <p className="text-xl font-semibold">{p.address || "No site address"}</p>
          <p className="mt-1 text-ink-2">{p.type}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <StatusChip label={label} tone={tone} />
            {x.why && x.tone && <Note tone={x.tone}>{x.why}</Note>}
          </div>
          {p.description && <p className="mt-4 max-w-2xl text-ink-2">{p.description}</p>}
        </section>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {facts.map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-line bg-panel p-5">
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-3">{k}</dt>
              <dd className="mt-2 text-lg font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <section aria-labelledby="pi" className="min-w-0">
        <h2 id="pi" className="text-2xl font-semibold tracking-tight">Inspections <span className="text-ink-3">{inspections.length}</span></h2>
        <p className="mt-1 text-ink-2">Newest first. Open a result to read what the inspector wrote.</p>
        <ul className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
          {sorted.length === 0 && <li className="p-5 text-ink-2">No inspections on this permit yet.</li>}
          {sorted.map((i) => {
            const [l, t] = inspLabel[i.status];
            return (
              <li key={i.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold">{i.type}</p>
                    <p className="mt-0.5 text-[15px] text-ink-2">{i.scheduledFor ? fmtDay(i.scheduledFor) : "No date yet"}</p>
                    {i.notes && i.notes.toLowerCase() !== l.toLowerCase() && <p className="mt-1 text-[15px] text-ink-2">City result: {i.notes}</p>}
                  </div>
                  <StatusChip label={l} tone={t} />
                </div>
                {(i.status === "passed" || i.status === "failed") && <Comments city={p.jurisdiction} permitId={p.id} inspectionId={i.id} />}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="book" className="min-w-0 rounded-2xl border border-dashed border-white/15 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="book" className="text-xl font-semibold tracking-tight">Book an inspection</h2>
          <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-semibold text-ink-3">Soon</span>
        </div>
        <p className="mt-2 max-w-2xl text-ink-2">
          {toBook.length ? `Ready to book: ${toBook.map((i) => i.type).join(", ")}. ` : "Nothing needs booking on this permit right now. "}
          Booking from this page is coming. You'll check every detail before anything goes to the city.
        </p>
      </section>

      <AskClaude prompts={[...(inspections.some((i) => i.status === "failed") ? [`What did the inspector say on ${p.id}?`] : []), `What's next on ${p.id}?`, `When does the ${p.address} permit expire?`, `What inspections are left on ${p.address}?`]} />
    </div>
  );
}

/** The inspector's comments, read on demand: on real portals this opens the city site and takes up to a minute. */
function Comments({ city, permitId, inspectionId }: { city: string; permitId: string; inspectionId: string }) {
  const [open, setOpen] = useState(false);
  const { res, reload } = useApi<Inspection>(open ? `/inspection?city=${encodeURIComponent(city)}&permit=${encodeURIComponent(permitId)}&id=${encodeURIComponent(inspectionId)}` : null);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={`${darkBtn} mt-4`}>Read inspector comments</button>;
  if (!res) return <p className="mt-4 flex min-h-11 items-center gap-2 text-[15px] text-ink-2" role="status"><Spinner />Reading the city portal. This can take a minute…</p>;
  if (!res.ok) return (
    <p className="mt-4 text-[15px] text-ink-2">{res.message} <button type="button" onClick={reload} className="min-h-11 px-1 font-semibold text-ink underline underline-offset-4">Try again</button></p>
  );
  return (
    <div className="mt-4 max-w-2xl rounded-xl border border-line bg-panel-2 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-3">Inspector comments</p>
      <p className="mt-2 whitespace-pre-line text-[15px] text-ink-2">{res.data.comments ?? "The inspector left no comments."}</p>
    </div>
  );
}
