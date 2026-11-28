"use client";

import Link from "next/link";
import { useState } from "react";
import { AskClaude, DashShell, Freshness, Loading, Note, Pill, Problem, SignedOut, StatusChip, limeBtn, useBoard } from "@/components/Dash";
import { api, CLOSED, daysFrom, fmtDay, inspLabel, isRecent, lastActivity, money, permitHref, permitLabel, problem, type Inspection, type Me, type Permit } from "@/lib/dash";

const views = [["recent", "Recent"], ["action", "Needs you"], ["open", "Open"], ["older", "Older"], ["hidden", "Hidden"], ["all", "All"]] as const;

export default function Dashboard() {
  return (
    <DashShell>
      {(me) => (me.connections.length ? <Board me={me} /> : <NoCities />)}
    </DashShell>
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
  const board = useBoard();
  const [city, setCity] = useState("all");
  const [view, setView] = useState<(typeof views)[number][0]>("recent");
  const [hid, setHid] = useState<Set<string> | null>(null);
  const [err, setErr] = useState("");

  if (board.signedOut) return <SignedOut />;
  if (!board.res) return <Loading slow />;
  if (!board.res.ok) return <Problem message={board.res.message} retry={board.fresh.onRefresh} />;
  const { permits: everything, inspections } = board;
  const key = (p: Permit) => `${p.jurisdiction}|${p.id}`;
  const hiddenSet = hid ?? new Set(board.hidden);
  const list = everything.filter((p) => !hiddenSet.has(key(p)));
  const hiddenCount = everything.length - list.length;
  const toggle = async (p: Permit, hidden: boolean) => {
    setErr("");
    const next = new Set(hiddenSet);
    if (hidden) next.add(key(p)); else next.delete(key(p));
    setHid(next);
    if (!hidden && view === "hidden" && everything.filter((x) => next.has(key(x))).length === 0) setView("recent");
    const r = await api("/hide", { city: p.jurisdiction, id: p.id, hidden });
    if (!r.ok) { setHid(hiddenSet); setErr(r.message); }
  };
  const cityName = (id: string) => { const c = me.cities.find((x) => x.id === id); return c ? `${c.name}, ${c.state}` : id; };

  const open = list.filter((p) => !CLOSED.includes(p.status));
  const fixes = list.filter((p) => p.status === "corrections_required").length;
  const week = inspections.filter((i) => i.status === "scheduled" && i.scheduledFor && daysFrom(i.scheduledFor) >= 0 && daysFrom(i.scheduledFor) < 7).length;
  const fees = list.reduce((s, p) => s + (p.feesDue ?? 0), 0);

  const ranked = (view === "hidden" ? everything.filter((p) => hiddenSet.has(key(p))) : list)
    .map((p) => ({ p, x: problem(p, inspections), last: lastActivity(p, inspections) }))
    .filter(({ p }) => city === "all" || p.jurisdiction === city)
    .filter(({ p, x, last }) => view === "all" || view === "hidden" || (view === "recent" ? isRecent(last) : view === "older" ? !isRecent(last) : view === "action" ? x.rank < 9 : !CLOSED.includes(p.status)))
    .sort((a, b) => b.last.localeCompare(a.last) || a.x.rank - b.x.rank);

  const tiles: [string, string, boolean][] = [
    ["Open permits", String(open.length), false],
    ["Corrections needed", String(fixes), fixes > 0],
    ["Inspections this week", String(week), false],
    ["Fees due", money(fees), fees > 0],
  ];

  return (
    <div className="mt-8 space-y-14">
      <div className="space-y-4">
        <Freshness {...board.fresh} />
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
      </div>

      <section aria-labelledby="permits" className="min-w-0">
        <h2 id="permits" className="text-2xl font-semibold tracking-tight">Permits <span className="text-ink-3">{list.length}</span></h2>
        <p className="mt-1 text-ink-2">Most recent first. Anything quiet for 3 months is under Older.</p>
        <div className="no-scrollbar -mx-1 mt-5 flex gap-1 overflow-x-auto px-1">
          {views.filter(([v]) => v !== "hidden" || hiddenCount > 0).map(([v, l]) => <Pill key={v} active={view === v} onClick={() => setView(v)}>{l}{v === "hidden" ? ` ${hiddenCount}` : ""}</Pill>)}
        </div>
        <div className="no-scrollbar -mx-1 mt-1 flex gap-1 overflow-x-auto px-1" aria-label="City">
          {me.connections.length > 1 && <Pill active={city === "all"} onClick={() => setCity("all")}>All cities {list.length}</Pill>}
          {me.connections.map((c) => <Pill key={c.id} active={city === c.id || me.connections.length === 1} onClick={() => setCity(c.id)}>{c.name} {list.filter((p) => p.jurisdiction === c.id).length}</Pill>)}
        </div>
        {err && <div className="mt-3" role="alert"><Note tone="bad">{err}</Note></div>}
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
          {ranked.length === 0 && <li className="p-6 text-ink-2">Nothing here. Try another filter.</li>}
          {ranked.map(({ p, x, last }) => {
            const [label, tone] = permitLabel[p.status];
            return (
              <li key={key(p)} className="flex items-stretch">
                <Link href={permitHref(p)} className="grid min-w-0 flex-1 gap-3 p-5 hover:bg-panel-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold uppercase tracking-wide text-lime">{cityName(p.jurisdiction)}</p>
                    <p className="mt-1 text-lg font-semibold">{p.address || "No site address"}</p>
                    <p className="mt-0.5 text-[15px] text-ink-2">{p.type} · <span className="font-mono text-sm">{p.id}</span></p>
                    {x.why && x.tone && <div className="mt-2"><Note tone={x.tone}>{x.why}</Note></div>}
                  </div>
                  <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                    <StatusChip label={label} tone={tone} />
                    {last && <span className="text-sm text-ink-3">{fmtDay(last).replace(/, \d{4}$/, "")}</span>}
                  </div>
                </Link>
                <button type="button" onClick={() => toggle(p, view !== "hidden")} className="shrink-0 px-5 text-[15px] text-ink-3 hover:bg-panel-2 hover:text-ink" aria-label={`${view === "hidden" ? "Unhide" : "Hide"} ${p.id}`}>{view === "hidden" ? "Unhide" : "Hide"}</button>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Timeline inspections={inspections} permits={list} failed={board.inspFailed} loading={board.inspLoading} />
        <AskClaude prompts={["Which permits need me this week?", "What does the city want fixed on my electrical permit?", "What fees do I owe the city?"]} />
      </div>
    </div>
  );
}

function Timeline({ inspections, permits, failed, loading }: { inspections: Inspection[]; permits: Permit[]; failed: boolean; loading: boolean }) {
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
      {loading ? <p className="mt-5 rounded-2xl border border-line bg-panel p-5 text-ink-2" role="status">Reading inspections from the city portal. The first time takes about a minute.</p> : (
      <div className="mt-5 space-y-6">
        {block("Coming up", upcoming, "Nothing booked yet.")}
        {block("Recent", recent, "No past inspections.")}
      </div>
      )}
    </section>
  );
}
