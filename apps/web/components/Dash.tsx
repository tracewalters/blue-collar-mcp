"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ago, api, type Fresh, type Me, type Result, type Tone } from "@/lib/dash";
import { Chip } from "@/components/ui";

// Dashboard building blocks. Follows /TASTE.md: status = small dot + words.

export const dot: Record<Tone, string> = { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad", idle: "bg-white/35" };
const ring: Record<Tone, string> = { ok: "border-line", warn: "border-warn/40", bad: "border-bad/50", idle: "border-line" };

export function StatusChip({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span className={`inline-flex w-fit shrink-0 items-center gap-2 rounded-full border bg-panel-2 px-3 py-1 text-sm font-medium text-ink ${ring[tone]}`}>
      <span className={`h-2 w-2 rounded-full ${dot[tone]}`} aria-hidden />{label}
    </span>
  );
}

export function Note({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-[15px] text-ink-2">
      <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${dot[tone]}`} aria-hidden />{children}
    </p>
  );
}

export function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`min-h-11 shrink-0 rounded-full px-4 text-[15px] ${active ? "bg-white/10 text-ink" : "text-ink-3 hover:text-ink-2"}`}>
      {children}
    </button>
  );
}

export const darkBtn = "inline-flex min-h-11 items-center justify-center rounded-xl bg-panel-2 px-4 text-[15px] font-semibold text-ink hover:bg-white/10 disabled:opacity-50";
export const limeBtn = "inline-flex min-h-11 items-center justify-center rounded-xl bg-lime px-5 text-[15px] font-semibold text-lime-ink hover:brightness-95 disabled:opacity-50";

export function SignedOut() {
  return (
    <section className="relative mx-auto max-w-2xl py-24 text-center sm:py-32">
      <div className="blueprint absolute inset-0 -z-10" aria-hidden />
      <h1 className="display text-5xl sm:text-7xl">Ask Claude to open your <span className="text-lime">dashboard</span></h1>
      <p className="mx-auto mt-6 max-w-md text-lg text-ink-2">Your dashboard is private. Claude gives you a fresh link each time. In Claude, say:</p>
      <p className="mx-auto mt-6 w-fit rounded-full border border-line bg-panel px-5 py-3 font-mono text-lg">open my permit dashboard</p>
      <p className="mx-auto mt-6 max-w-sm text-[15px] text-ink-3">Links work once and last 10 minutes. No password needed.</p>
    </section>
  );
}

export function Problem({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="my-16 rounded-2xl border border-line bg-panel p-6 text-center">
      <p className="text-lg">{message}</p>
      {retry && <button type="button" onClick={retry} className={`${darkBtn} mt-5`}>Try again</button>}
    </div>
  );
}

export function Loading({ slow }: { slow?: boolean }) {
  return (
    <div className="py-24 text-center" role="status">
      <p className="text-ink-2">Loading your permits…</p>
      {slow && <p className="mx-auto mt-2 max-w-sm text-[15px] text-ink-3">The first read from a city portal can take about a minute. After that it's quick.</p>}
    </div>
  );
}

/** Loads one API path. Any 401 flips the whole page to the signed-out view. */
export function useApi<T>(path: string | null) {
  const [res, setRes] = useState<Result<T> | null>(null);
  const load = useCallback(() => { if (path) { setRes(null); api<T>(path).then(setRes); } }, [path]);
  useEffect(load, [load]);
  return { res, reload: load };
}

/**
 * Loads a portal read and keeps it fresh. The server answers at once from its cache; when it says a refresh
 * is running, we ask our server again every few seconds until the new data lands. `refresh()` forces a portal read.
 * Old data stays on screen the whole time.
 */
export function useFresh<T extends Fresh>(path: string) {
  const [res, setRes] = useState<Result<T> | null>(null);
  const [forcing, setForcing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const load = useCallback(async (force = false) => {
    clearTimeout(timer.current);
    if (force) setForcing(true);
    const r = await api<T>(`${path}${force ? `${path.includes("?") ? "&" : "?"}refresh=1` : ""}`);
    setForcing(false);
    setRes((old) => (!r.ok && old?.ok && !r.signedOut ? old : r)); // keep old data if a refresh call fails
    if (r.ok && r.data.refreshing) timer.current = setTimeout(() => load(), 5000);
  }, [path]);
  useEffect(() => { load(); return () => clearTimeout(timer.current); }, [load]);
  const busy = forcing || (res?.ok === true && res.data.refreshing);
  return { res, busy, refresh: () => load(true) };
}

/** "Updated 4 min ago" plus the refresh button. A dark button: the page's one lime button is elsewhere. */
export function Freshness({ at, busy, error, onRefresh }: { at: string | null; busy: boolean; error?: string; onRefresh: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-[15px] text-ink-2" role="status" aria-live="polite">
        {busy ? <><Spinner />Checking the city portal…</> : at ? <>Updated {ago(at)}</> : null}
        {!busy && error && <span className="flex items-center gap-2 text-ink-3"><span className="h-2 w-2 rounded-full bg-warn" aria-hidden />Last check failed</span>}
      </p>
      <button type="button" onClick={onRefresh} disabled={busy} className={darkBtn}>{busy ? "Refreshing…" : "Refresh"}</button>
    </div>
  );
}

export const Spinner = () => <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/20 border-t-white" aria-hidden />;

/** Page frame: loads /api/me, handles signed-out and server-down, draws the header. */
export function DashShell({ children, title }: { title?: ReactNode; children: (me: Me, reloadMe: () => void) => ReactNode }) {
  const { res, reload } = useApi<Me>("/me");
  const [out, setOut] = useState(false);
  if (out || (res && !res.ok && res.signedOut)) return <SignedOut />;
  if (!res) return <Loading />;
  if (!res.ok) return <Problem message={res.message} retry={reload} />;
  const signOut = async () => { await api("/signout", {}); setOut(true); };
  return (
    <div className="pt-8 sm:pt-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm uppercase tracking-wide text-ink-3">{res.data.userName ? `${res.data.userName} · ` : ""}Permit dashboard</p>
          <h1 className="display mt-2 break-words text-4xl sm:text-6xl">{title ?? res.data.company}</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/connect" className={darkBtn}>Cities</Link>
          <button type="button" onClick={signOut} className={darkBtn}>Sign out</button>
        </div>
      </header>
      {children(res.data, reload)}
    </div>
  );
}

export function AskClaude({ prompts }: { prompts: string[] }) {
  return (
    <section aria-labelledby="ask" className="rounded-2xl border border-line bg-panel p-6">
      <h2 id="ask" className="text-xl font-semibold tracking-tight">Ask Claude</h2>
      <p className="mt-1 text-ink-2">Claude reads the same permits. Try one of these in chat:</p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {prompts.map((p) => <li key={p} className="min-w-0"><Chip>{p}</Chip></li>)}
      </ul>
    </section>
  );
}
