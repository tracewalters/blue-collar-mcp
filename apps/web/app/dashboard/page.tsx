"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AskClaude, DashShell, Loading, Note, Pill, Problem, SignedOut, StatusChip, darkBtn, dot, limeBtn, useApi } from "@/components/Dash";
import {
  CLOSED, api, daysFrom, fmtDay, inspLabel, money, pendingCities, permitHref, permitLabel, problem,
  type Inspection, type Job, type Jobs as JobList, type Me, type Permit,
} from "@/lib/dash";

const views = [["all", "All"], ["action", "Needs you"], ["open", "Open"], ["closed", "Closed"]] as const;

export default function Dashboard() {
  return (
    <DashShell>
      {(me) => (
        <>
          <NeedsLogin n={pendingCities(me).length} />
          {me.connections.length ? <Board me={me} /> : <NoCities />}
        </>
      )}
    </DashShell>
  );
}

function NeedsLogin({ n }: { n: number }) {
  if (!n) return null;
  return (
    <Link href="/dashboard/connect" className="mt-8 flex min-h-12 items-center justify-between gap-3 rounded-xl border border-warn/40 bg-panel px-4 py-3 hover:bg-panel-2">
      <span className="flex items-center gap-2 text-[15px]"><span className="h-2 w-2 shrink-0 rounded-full bg-warn" aria-hidden />{n} {n === 1 ? "city still needs" : "cities still need"} a login</span>
      <span className="shrink-0 text-[15px] font-semibold">Connect →</span>
    </Link>
  );
}

function NoCities() {
  return (
    <div className="mt-10 rounded-2xl border border-line bg-panel p-8 text-center">
      <h2 className="text-2xl font-semibold tracking-tight">Connect your first city</h2>
      <p className="mx-auto mt-2 max-w-md text-ink-2">Sign in to your city permit portal once. Then your permits and inspections show up here and in Claude.</p>
      <Link href="/dashboard/connect" className={`${limeBtn} mt-6`}>Connect a city</Link>
    </div>
  );
}

function Board({ me }: { me: Me }) {
  const permits = useApi<Permit[]>("/permits");
  const insp = useApi<Inspection[]>("/inspections");
  const [city, setCity] = useState("all");
  const [view, setView] = useState<(typeof views)[number][0]>("all");

  for (const r of [permits.res, insp.res]) if (r && !r.ok && r.signedOut) return <SignedOut />;
  if (!permits.res || !insp.res) return <Loading />;
  if (!permits.res.ok) return <Problem message={permits.res.message} retry={permits.reload} />;
  const list = permits.res.data;
  const inspections = insp.res.ok ? insp.res.data : [];
  const cityName = (id: string) => me.connections.find((c) => c.id === id)?.name ?? id;

  const open = list.filter((p) => !CLOSED.includes(p.status));
  const fixes = list.filter((p) => p.status === "corrections_required").length;
  const week = inspections.filter((i) => i.status === "scheduled" && i.scheduledFor && daysFrom(i.scheduledFor) >= 0 && daysFrom(i.scheduledFor) < 7).length;
  const fees = list.reduce((s, p) => s + (p.feesDue ?? 0), 0);

  const ranked = list
    .map((p) => ({ p, x: problem(p, inspections) }))
    .filter(({ p }) => city === "all" || p.jurisdiction === city)
    .filter(({ p, x }) => view === "all" || (view === "action" ? x.rank < 9 : view === "open" ? !CLOSED.includes(p.status) : CLOSED.includes(p.status)))
    .sort((a, b) => a.x.rank - b.x.rank || (b.p.appliedAt ?? "").localeCompare(a.p.appliedAt ?? ""));

  const tiles: [string, string, boolean][] = [
    ["Open permits", String(open.length), false],
    ["Corrections needed", String(fixes), fixes > 0],
    ["Inspections this week", String(week), false],
    ["Fees due", money(fees), fees > 0],
  ];

  return (
    <div className="mt-10 space-y-14">
      <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([label, n, hot]) => (
          <div key={label} className="rounded-2xl border border-line bg-panel p-5">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-3">
              {hot && <span className="h-2 w-2 rounded-full bg-bad" aria-label="Needs you" />}{label}
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{n}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="permits" className="min-w-0">
        <h2 id="permits" className="text-2xl font-semibold tracking-tight">Permits <span className="text-ink-3">{list.length}</span></h2>
        <p className="mt-1 text-ink-2">Problems first. Tap a permit for the full story.</p>
        <div className="no-scrollbar -mx-1 mt-5 flex gap-1 overflow-x-auto px-1">
          {views.map(([v, l]) => <Pill key={v} active={view === v} onClick={() => setView(v)}>{l}</Pill>)}
        </div>
        {me.connections.length > 1 && (
          <div className="no-scrollbar -mx-1 mt-1 flex gap-1 overflow-x-auto px-1">
            <Pill active={city === "all"} onClick={() => setCity("all")}>All cities</Pill>
            {me.connections.map((c) => <Pill key={c.id} active={city === c.id} onClick={() => setCity(c.id)}>{c.name}</Pill>)}
          </div>
        )}
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
          {ranked.length === 0 && <li className="p-6 text-ink-2">Nothing here. Try another filter.</li>}
          {ranked.map(({ p, x }) => {
            const [label, tone] = permitLabel[p.status];
            return (
              <li key={`${p.jurisdiction}|${p.id}`}>
                <Link href={permitHref(p)} className="grid gap-3 p-5 hover:bg-panel-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold">{p.address || "No site address"}</p>
                    <p className="mt-0.5 text-[15px] text-ink-2">{p.type} · <span className="font-mono text-sm">{p.id}</span> · {cityName(p.jurisdiction)}</p>
                    {x.why && x.tone && <div className="mt-2"><Note tone={x.tone}>{x.why}</Note></div>}
                  </div>
                  <StatusChip label={label} tone={tone} />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <Jobs permits={list} inspections={inspections} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Timeline inspections={inspections} permits={list} failed={!insp.res.ok} />
        <AskClaude prompts={["Which permits need me this week?", "How is the job on Oak St going?", "What does the city want fixed on my electrical permit?", "What fees do I owe the city?"]} />
      </div>
    </div>
  );
}

function Timeline({ inspections, permits, failed }: { inspections: Inspection[]; permits: Permit[]; failed: boolean }) {
  const dated = (i: Inspection) => (i.scheduledFor ? daysFrom(i.scheduledFor) : null);
  const upcoming = inspections
    .filter((i) => (i.status === "needed" || i.status === "scheduled") && (dated(i) ?? 0) >= 0)
    .sort((a, b) => (a.scheduledFor ?? "9").localeCompare(b.scheduledFor ?? "9"));
  const recent = inspections
    .filter((i) => !upcoming.includes(i) && i.scheduledFor)
    .sort((a, b) => b.scheduledFor!.localeCompare(a.scheduledFor!))
    .slice(0, 5);
  const find = (i: Inspection) => permits.find((p) => p.id === i.permitId && (!i.jurisdiction || p.jurisdiction === i.jurisdiction));

  const Row = ({ i }: { i: Inspection }) => {
    const p = find(i);
    const [label, tone] = inspLabel[i.status];
    const body = (
      <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-4 p-5 hover:bg-panel-2">
        <p className="text-sm text-ink-3">{i.scheduledFor ? fmtDay(i.scheduledFor).replace(/, \d{4}$/, "") : "No date"}</p>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{i.type}</p>
            <StatusChip label={label} tone={tone} />
          </div>
          <p className="mt-1 text-[15px] text-ink-2">{p ? `${p.address} · ` : ""}<span className="font-mono text-sm">{i.permitId}</span></p>
          {i.notes && <p className="mt-1 text-[15px] text-ink-2">“{i.notes}”</p>}
        </div>
      </div>
    );
    return <li>{p ? <Link href={permitHref(p)}>{body}</Link> : body}</li>;
  };

  const block = (title: string, rows: Inspection[], empty: string) => (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wide text-ink-3">{title}</h3>
      <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
        {rows.length ? rows.map((i) => <Row key={`${i.jurisdiction}|${i.id}`} i={i} />) : <li className="p-5 text-ink-2">{empty}</li>}
      </ul>
    </div>
  );

  return (
    <section aria-labelledby="insp" className="min-w-0">
      <h2 id="insp" className="text-2xl font-semibold tracking-tight">Inspections</h2>
      {failed && <p className="mt-2 text-ink-2">We couldn't load inspections right now.</p>}
      <div className="mt-5 space-y-6">
        {block("Coming up", upcoming, "Nothing booked yet.")}
        {block("Recent", recent, "No past inspections.")}
      </div>
    </section>
  );
}

/** Permits grouped by site address. Rename and merge are saved for the whole company. */
function Jobs({ permits, inspections }: { permits: Permit[]; inspections: Inspection[] }) {
  const { res, reload } = useApi<JobList>("/jobs");
  const [data, setData] = useState<JobList | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState("");
  if (!res) return null;
  if (!res.ok) return res.signedOut ? null : <section className="min-w-0"><h2 className="text-2xl font-semibold tracking-tight">Jobs</h2><p className="mt-2 text-ink-2">We couldn't load jobs right now. <button type="button" className="underline" onClick={reload}>Try again</button></p></section>;
  const { jobs, ungrouped } = data ?? res.data;
  const full = (id: string, city: string) => permits.find((p) => p.id === id && p.jurisdiction === city);
  const worst = (j: Job) => j.permits.map((jp) => { const p = full(jp.id, jp.jurisdiction); return p ? { p, x: problem(p, inspections) } : null; })
    .filter((v) => v !== null).sort((a, b) => a.x.rank - b.x.rank)[0];
  const ranked = jobs.map((j) => ({ j, w: worst(j) })).sort((a, b) => (a.w?.x.rank ?? 9) - (b.w?.x.rank ?? 9) || a.j.name.localeCompare(b.j.name));
  const save = async (path: string, body: object) => {
    setErr("");
    const r = await api<JobList>(path, body);
    if (r.ok) { setData(r.data); setOpen(null); } else setErr(r.message);
  };

  return (
    <section aria-labelledby="jobs" className="min-w-0">
      <h2 id="jobs" className="text-2xl font-semibold tracking-tight">Jobs <span className="text-ink-3">{jobs.length}</span></h2>
      <p className="mt-1 text-ink-2">Permits grouped by site address. Rename a job or merge two that are the same site.</p>
      <ul className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
        {jobs.length === 0 && <li className="p-6 text-ink-2">No jobs yet. Permits with a site address show up here.</li>}
        {ranked.map(({ j, w }) => (
          <li key={j.id} className="p-5">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div className="min-w-0">
                <p className="text-lg font-semibold">{j.name}</p>
                <p className="mt-0.5 text-[15px] text-ink-2">{j.permits.length} permit{j.permits.length === 1 ? "" : "s"} · {j.addresses.join(" · ")}</p>
                {w?.x.why && w.x.tone && <div className="mt-2"><Note tone={w.x.tone}><span>{w.x.why} <span className="text-ink-3">({w.p.id})</span></span></Note></div>}
                <ul className="mt-3 flex flex-wrap gap-2">
                  {j.permits.map((p) => {
                    const [label, tone] = permitLabel[p.status];
                    return (
                      <li key={`${p.jurisdiction}|${p.id}`} className="min-w-0">
                        <Link href={permitHref(p)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-panel-2 px-3 text-sm hover:bg-white/10">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${dot[tone]}`} aria-hidden />
                          {p.type} <span className="font-mono text-ink-3">{p.id}</span><span className="sr-only">, {label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <button type="button" className={`${darkBtn} w-fit`} aria-expanded={open === j.id} onClick={() => { setErr(""); setOpen(open === j.id ? null : j.id); }}>Edit</button>
            </div>
            {open === j.id && <JobEdit job={j} others={jobs.filter((o) => o.id !== j.id)} error={err} save={save} />}
          </li>
        ))}
      </ul>
      {ungrouped.length > 0 && (
        <p className="mt-3 text-[15px] text-ink-3">No site address, not in a job: {ungrouped.map((p, i) => (
          <span key={`${p.jurisdiction}|${p.id}`}>{i ? ", " : ""}<Link href={permitHref(p)} className="font-mono text-sm text-ink-2 underline">{p.id}</Link></span>
        ))}</p>
      )}
    </section>
  );
}

function JobEdit({ job, others, error, save }: { job: Job; others: Job[]; error: string; save: (path: string, body: object) => Promise<void> }) {
  const [name, setName] = useState(job.name);
  const [into, setInto] = useState(others[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const go = (path: string, body: object) => async (e: FormEvent) => { e.preventDefault(); setBusy(true); await save(path, body); setBusy(false); };
  const field = "min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-panel-2 px-3 text-[15px] text-ink";
  return (
    <div className="mt-4 grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-2">
      <form onSubmit={go("/jobs/rename", { job: job.id, name })} className="min-w-0">
        <label htmlFor={`n-${job.id}`} className="text-xs font-medium uppercase tracking-wide text-ink-3">Job name</label>
        <div className="mt-1 flex gap-2">
          <input id={`n-${job.id}`} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} className={field} />
          <button type="submit" disabled={busy || !name.trim()} className={darkBtn}>Save</button>
        </div>
      </form>
      {others.length > 0 && (
        <form onSubmit={go("/jobs/merge", { from: job.id, into })} className="min-w-0">
          <label htmlFor={`m-${job.id}`} className="text-xs font-medium uppercase tracking-wide text-ink-3">Same site as</label>
          <div className="mt-1 flex gap-2">
            <select id={`m-${job.id}`} value={into} onChange={(e) => setInto(e.target.value)} className={field}>
              {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <button type="submit" disabled={busy || !into} className={darkBtn}>Merge</button>
          </div>
        </form>
      )}
      {error && <p className="text-[15px] text-bad sm:col-span-2" role="alert">{error}</p>}
    </div>
  );
}
