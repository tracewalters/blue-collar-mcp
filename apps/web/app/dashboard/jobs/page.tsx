"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AskClaude, DashShell, Freshness, Loading, Note, Problem, SignedOut, darkBtn, dot, limeBtn, useApi, useBoard } from "@/components/Dash";
import { api, isRecent, lastActivity, fmtDay, permitHref, permitLabel, problem, type Inspection, type Job, type Jobs as JobList, type Permit } from "@/lib/dash";

// Jobs: a company's permits grouped by site address. Rename and merge are saved for the whole company.

export default function JobsPage() {
  return (
    <DashShell title="Jobs">
      {(me) => (me.connections.length ? <Board /> : (
        <div className="mt-10 rounded-2xl border border-line bg-panel p-8 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">No jobs yet</h2>
          <p className="mx-auto mt-2 max-w-md text-ink-2">Connect a city first. Your permits then show up here, grouped by job site.</p>
          <Link href="/dashboard/connect" className={`${limeBtn} mt-6`}>Connect a city</Link>
        </div>
      ))}
    </DashShell>
  );
}

function Board() {
  const board = useBoard();
  if (board.signedOut) return <SignedOut />;
  if (!board.res) return <Loading slow />;
  if (!board.res.ok) return <Problem message={board.res.message} retry={board.fresh.onRefresh} />;
  return (
    <div className="mt-8 space-y-14">
      <Freshness {...board.fresh} />
      <JobList permits={board.permits} inspections={board.inspections} />
      <AskClaude prompts={["How is the job on Oak St going?", "Which job needs me first?", "What inspections are left on 48 Pine Ave?"]} />
    </div>
  );
}

function JobList({ permits, inspections }: { permits: Permit[]; inspections: Inspection[] }) {
  const { res, reload } = useApi<JobList>("/jobs");
  const [data, setData] = useState<JobList | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [older, setOlder] = useState(false);
  if (!res) return <p className="text-ink-2" role="status">Loading your jobs…</p>;
  if (!res.ok) return res.signedOut ? <SignedOut /> : <Problem message="We couldn't load your jobs right now." retry={reload} />;
  const { jobs, ungrouped } = data ?? res.data;
  const full = (id: string, city: string) => permits.find((p) => p.id === id && p.jurisdiction === city);
  const worst = (j: Job) => j.permits.map((jp) => { const p = full(jp.id, jp.jurisdiction); return p ? { p, x: problem(p, inspections) } : null; })
    .filter((v) => v !== null).sort((a, b) => a.x.rank - b.x.rank)[0];
  const last = (j: Job) => j.permits.map((jp) => { const p = full(jp.id, jp.jurisdiction); return p ? lastActivity(p, inspections) : ""; }).sort().pop() ?? "";
  const all = jobs.map((j) => ({ j, w: worst(j), last: last(j) })).sort((a, b) => b.last.localeCompare(a.last) || a.j.name.localeCompare(b.j.name));
  const ranked = older ? all : all.filter((r) => isRecent(r.last));
  const hidden = all.length - all.filter((r) => isRecent(r.last)).length;
  const save = async (path: string, body: object) => {
    setErr("");
    const r = await api<JobList>(path, body);
    if (r.ok) { setData(r.data); setOpen(null); } else setErr(r.message);
  };

  return (
    <section aria-labelledby="jobs" className="min-w-0">
      <h2 id="jobs" className="text-2xl font-semibold tracking-tight">Jobs <span className="text-ink-3">{jobs.length}</span></h2>
      <p className="mt-1 text-ink-2">Your permits grouped by job site. Most recent first. Tap a permit for the full story.</p>
      <ul className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
        {ranked.length === 0 && <li className="p-6 text-ink-2">{jobs.length ? "Nothing recent. Older jobs are below." : "No jobs yet. Permits with a site address show up here."}</li>}
        {ranked.map(({ j, w, last }) => (
          <li key={j.id} className="p-5">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div className="min-w-0">
                <p className="text-lg font-semibold">{j.name}</p>
                <p className="mt-0.5 text-[15px] text-ink-2">{j.permits.length} permit{j.permits.length === 1 ? "" : "s"}{last ? ` · last activity ${fmtDay(last)}` : ""}</p>
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
      {hidden > 0 && <button type="button" className={`${darkBtn} mt-3`} onClick={() => setOlder(!older)}>{older ? "Hide older jobs" : `Show ${hidden} older job${hidden === 1 ? "" : "s"}`}</button>}
      {ungrouped.length > 0 && (
        <p className="mt-3 text-[15px] text-ink-3">No site address, so not in a job: {ungrouped.map((p, i) => (
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
