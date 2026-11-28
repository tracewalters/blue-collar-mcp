"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ago, api, pendingCities, type Fresh, type Inspections, type Me, type Permits, type Result, type Tone } from "@/lib/dash";
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
      <h1 className="display text-5xl sm:text-7xl">Sign in to see your <span className="text-lime">permits</span></h1>
      <p className="mx-auto mt-6 max-w-md text-lg text-ink-2">Your dashboard is private to your company.</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/signin" className={limeBtn}>Sign in</Link>
        <Link href="/signup" className={darkBtn}>Start free</Link>
      </div>
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
      <p className="flex flex-wrap items-center gap-2 text-[15px] text-ink-2" role="status" aria-live="polite">
        {busy ? <><Spinner />Checking the city portal…</> : at ? <>Checked with the city {ago(at)}</> : <>Not checked with the city yet</>}
        {!busy && error && <span className="flex items-center gap-2 text-ink-3"><span className="h-2 w-2 rounded-full bg-warn" aria-hidden />Last check failed</span>}
      </p>
      <button type="button" onClick={onRefresh} disabled={busy} className={darkBtn}>{busy ? "Refreshing…" : "Refresh"}</button>
    </div>
  );
}

export const Spinner = () => <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/20 border-t-white" aria-hidden />;

/**
 * Page frame for every dashboard page: loads /api/me, handles signed-out and server-down,
 * draws the header, the tab row (Permits, Jobs, Cities) and the "city needs a login" banner.
 * Pages put their content in the same order: freshness row, summary, lists, Ask Claude.
 */
export function DashShell({ children, title }: { title?: ReactNode; children: (me: Me, reloadMe: () => void) => ReactNode }) {
  const { res, reload } = useApi<Me>("/me");
  const [out, setOut] = useState(false);
  const path = usePathname();
  if (out || (res && !res.ok && res.signedOut)) return <SignedOut />;
  if (!res) return <Loading />;
  if (!res.ok) return <Problem message={res.message} retry={reload} />;
  const signOut = async () => { await api("/signout", {}); setOut(true); };
  const pending = pendingCities(res.data).length;
  const tabs: [string, string, boolean][] = [
    ["/dashboard", "Permits", path === "/dashboard" || path.startsWith("/dashboard/permit")],
    ["/dashboard/jobs", "Jobs", path.startsWith("/dashboard/jobs")],
    ["/dashboard/connect", "Cities", path.startsWith("/dashboard/connect")],
  ];
  return (
    <div className="pt-8 sm:pt-12">
      <header className="min-w-0">
        <p className="text-sm uppercase tracking-wide text-ink-3">{res.data.userName ? `${res.data.userName} · ` : ""}{res.data.company}</p>
        <h1 className="display mt-2 break-words text-4xl sm:text-6xl">{title ?? "Permits"}</h1>
      </header>
      <nav aria-label="Dashboard" className="mt-6 flex items-center justify-between gap-2 border-b border-line">
        <ul className="no-scrollbar flex min-w-0 gap-5 overflow-x-auto sm:gap-7">
          {tabs.map(([href, label, on]) => (
            <li key={href}>
              <Link href={href} aria-current={on ? "page" : undefined}
                className={`-mb-px flex min-h-11 items-center border-b-2 text-[15px] font-medium ${on ? "border-white text-ink" : "border-transparent text-ink-3 hover:text-ink-2"}`}>
                {label}
                {label === "Cities" && pending > 0 && <span className="ml-2 h-2 w-2 rounded-full bg-warn" aria-label={`${pending} need a login`} />}
              </Link>
            </li>
          ))}
        </ul>
        <button type="button" onClick={signOut} className="min-h-11 shrink-0 text-[15px] text-ink-3 hover:text-ink-2">Sign out</button>
      </nav>
      {pending > 0 && !path.startsWith("/dashboard/connect") && <NeedsLogin n={pending} />}
      {children(res.data, reload)}
    </div>
  );
}

function NeedsLogin({ n }: { n: number }) {
  return (
    <Link href="/dashboard/connect" className="mt-6 flex min-h-12 items-center justify-between gap-3 rounded-xl border border-warn/40 bg-panel px-4 py-3 hover:bg-panel-2">
      <span className="flex items-center gap-2 text-[15px]"><span className="h-2 w-2 shrink-0 rounded-full bg-warn" aria-hidden />{n} {n === 1 ? "city still needs" : "cities still need"} a login</span>
      <span className="shrink-0 text-[15px] font-semibold">Connect →</span>
    </Link>
  );
}

/** Permits and inspections for the whole company, each kept fresh, with one freshness row for both. */
export function useBoard() {
  const permits = useFresh<Permits>("/permits?includeHidden=1");
  const insp = useFresh<Inspections>("/inspections");
  const signedOut = [permits.res, insp.res].some((r) => r && !r.ok && r.signedOut);
  const p = permits.res?.ok ? permits.res.data : null;
  const i = insp.res?.ok ? insp.res.data : null;
  return {
    signedOut,
    res: permits.res,
    permits: p?.permits ?? [],
    hidden: p?.hidden ?? [],
    inspections: i?.inspections ?? [],
    inspLoading: !insp.res,
    inspFailed: insp.res?.ok === false,
    fresh: {
      at: [p?.fetchedAt, i?.fetchedAt].filter((x): x is string => !!x).sort()[0] ?? null, // the older of the two
      busy: permits.busy || insp.busy,
      error: p?.refreshError ?? i?.refreshError,
      onRefresh: () => { permits.refresh(); insp.refresh(); },
    },
  };
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
