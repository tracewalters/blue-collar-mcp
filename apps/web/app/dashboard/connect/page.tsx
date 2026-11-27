"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { DashShell, Note, Spinner, darkBtn, limeBtn } from "@/components/Dash";
import { api, fmtDay, isBuilt, type City, type Connection, type Me, type Profile } from "@/lib/dash";

// Setup checklist: one card per city the user picked in Claude. Logins happen here, never in chat.

export default function Connect() {
  return <DashShell title="Connect your cities">{(me) => (me.profile ? <Checklist me={me} profile={me.profile} /> : <NotSetUp />)}</DashShell>;
}

const input = "mt-2 block min-h-12 w-full rounded-xl border border-line bg-panel-2 px-4 text-base text-ink placeholder:text-ink-3";
const signedOutMsg = "You were signed out. Ask Claude to open your dashboard again.";

function NotSetUp() {
  return (
    <div className="mt-10 rounded-2xl border border-line bg-panel p-8 text-center">
      <h2 className="text-2xl font-semibold tracking-tight">Let's set up your company first</h2>
      <p className="mx-auto mt-2 max-w-md text-ink-2">Claude asks a few quick questions: your company, your trade and the cities you work in. In Claude, say:</p>
      <p className="mx-auto mt-5 w-fit max-w-full rounded-full border border-line bg-panel-2 px-5 py-3 font-mono text-base">set up my company</p>
    </div>
  );
}

function Checklist({ me, profile: first }: { me: Me; profile: Profile }) {
  const [profile, setProfile] = useState(first);
  const [conns, setConns] = useState(me.connections);
  const [opened, setOpened] = useState(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("city")));
  const [adding, setAdding] = useState("");
  const [msg, setMsg] = useState("");

  const byId = new Map(me.cities.map((c) => [c.id, c]));
  const mine = profile.cities.map((id) => byId.get(id)).filter((c): c is City => !!c);
  const ready = mine.filter(isBuilt);
  const done = ready.filter((c) => conns.some((x) => x.id === c.id)).length;
  const soon = mine.length - ready.length;
  const allDone = ready.length > 0 && done === ready.length;
  const others = me.cities.filter((c) => c.id !== "demo-city" && !profile.cities.includes(c.id));

  const add = async (c: City) => {
    setAdding(c.id); setMsg("");
    const r = await api<Profile>("/profile", { addCity: c.id });
    setAdding("");
    if (!r.ok) return setMsg(r.signedOut ? signedOutMsg : r.message);
    setProfile(r.data);
    if (isBuilt(c)) setOpened(c.id);
  };

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-12">
        <section aria-labelledby="list">
          <p className="text-lg">Welcome, {profile.userName} at {profile.company}.</p>
          <p className="mt-1 text-ink-2" role="status">
            {ready.length ? `${done} of ${ready.length} ${ready.length === 1 ? "city" : "cities"} connected` : "No cities to connect yet"}
            {soon > 0 && <span className="text-ink-3"> · {soon} coming soon</span>}
          </p>
          <h2 id="list" className="sr-only">Your cities</h2>

          {allDone && (
            <div className="mt-6 rounded-2xl border border-lime/40 bg-panel p-6 sm:p-8">
              <p className="flex items-center gap-3 text-2xl font-semibold tracking-tight"><Check />You're all set</p>
              <p className="mt-2 text-ink-2">Go back to Claude. It checks on its own and can read your permits now. Or say:</p>
              <p className="mt-3 w-fit max-w-full rounded-full border border-line bg-panel-2 px-4 py-2 font-mono text-[15px]">check my cities</p>
              <Link href="/dashboard" className={`${limeBtn} mt-6 min-h-14 w-full px-8 text-lg sm:w-auto`}>Open my dashboard</Link>
            </div>
          )}

          <ul className="mt-6 space-y-3">
            {mine.map((c) => (
              <CityCard key={c.id} city={c} conn={conns.find((x) => x.id === c.id)} open={opened === c.id} setOpen={(o) => setOpened(o ? c.id : null)}
                onConnected={(x) => setConns((all) => [...all.filter((y) => y.id !== x.id), x])}
                onDropped={() => setConns((all) => all.filter((y) => y.id !== c.id))} />
            ))}
          </ul>
          {mine.length === 0 && <p className="mt-4 text-ink-2">Add the cities you pull permits in below.</p>}
        </section>

        {others.length > 0 && (
          <section aria-labelledby="more">
            <h2 id="more" className="text-xl font-semibold tracking-tight">Add more cities</h2>
            {msg && <div className="mt-3" role="alert"><Note tone="bad">{msg}</Note></div>}
            <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
              {others.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="text-ink-2">{c.name}, {c.state}</span>
                    {!isBuilt(c) && <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-semibold text-ink-3">Coming soon</span>}
                  </span>
                  <button type="button" disabled={!!adding} onClick={() => add(c)} className={darkBtn}>{adding === c.id ? "Adding…" : "Add"}</button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <aside className="h-fit rounded-2xl border border-line bg-panel p-6 lg:sticky lg:top-8">
        <h2 className="text-lg font-semibold">Your login stays private</h2>
        <ul className="mt-3 space-y-2 text-[15px] text-ink-2">
          <li>It goes straight to your private vault over HTTPS.</li>
          <li>Claude never sees it. Never type it in chat.</li>
          <li>Remove it any time with Disconnect.</li>
        </ul>
      </aside>
    </div>
  );
}

function CityCard({ city, conn, open, setOpen, onConnected, onDropped }: {
  city: City; conn?: Connection; open: boolean; setOpen: (o: boolean) => void;
  onConnected: (c: Connection) => void; onDropped: () => void;
}) {
  const [busy, setBusy] = useState<"" | "in" | "out">("");
  const [msg, setMsg] = useState("");
  const [key, setKey] = useState("");
  const built = isBuilt(city);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy("in"); setMsg("");
    const r = await api<{ key?: string }>("/connect", { city: city.id, username: f.get("username"), password: f.get("password") });
    setBusy("");
    if (!r.ok) return setMsg(r.signedOut ? signedOutMsg : r.message);
    setKey(r.data.key ?? "");
    setOpen(false);
    onConnected({ id: city.id, name: city.name, platform: city.platform, connectedAt: new Date().toISOString() });
  };
  const drop = async () => {
    setBusy("out"); setMsg("");
    const r = await api("/disconnect", { city: city.id });
    setBusy("");
    if (r.ok) { setKey(""); onDropped(); } else setMsg(r.signedOut ? signedOutMsg : r.message);
  };

  const status = conn
    ? <span className="text-sm text-ink-3">Connected {fmtDay(conn.connectedAt)}</span>
    : built ? <span className="flex items-center gap-2 text-sm text-ink-2"><span className="h-2 w-2 rounded-full bg-warn" aria-hidden />Needs login</span>
    : <span className="text-sm text-ink-3">Coming soon</span>;

  return (
    <li className={`rounded-2xl border bg-panel ${open && !conn ? "border-white/20" : "border-line"} ${built ? "" : "opacity-70"}`}>
      <div className="flex items-center gap-4 p-5">
        {conn ? <Check /> : <span className={`h-7 w-7 shrink-0 rounded-full border-2 ${built ? "border-white/35" : "border-dashed border-white/15"}`} aria-hidden />}
        <div className="min-w-0 flex-1">
          <p className={`text-lg font-semibold ${built ? "" : "text-ink-2"}`}>{city.name}, {city.state}</p>
          <p className="mt-0.5">{status}</p>
        </div>
        {conn && <button type="button" disabled={!!busy} onClick={drop} className="min-h-11 shrink-0 px-2 text-[15px] text-ink-3 hover:text-ink-2 disabled:opacity-50">{busy === "out" ? "Removing…" : "Disconnect"}</button>}
        {!conn && built && !open && <button type="button" onClick={() => setOpen(true)} className={`${limeBtn} shrink-0`}>Connect</button>}
      </div>

      {!built && <p className="-mt-2 px-5 pb-5 pl-16 text-[15px] text-ink-3">We're building this portal. We'll tell you when it's ready.</p>}
      {conn && msg && <div className="px-5 pb-5" role="alert"><Note tone="bad">{msg}</Note></div>}
      {conn && key && (
        <div className="border-t border-line p-5" role="status">
          <p className="font-semibold">Connected. Go back to Claude.</p>
          <p className="mt-1 text-[15px] text-ink-2">Claude checks on its own. Only if it asks, paste this key in the chat:</p>
          <p className="mt-3 flex flex-wrap items-center gap-3">
            <span className="w-fit rounded-full border border-line bg-panel-2 px-4 py-2 font-mono text-lg tracking-wider">{key}</span>
            <span className="text-sm text-ink-3">Works once, for 10 minutes. It is not your password.</span>
          </p>
        </div>
      )}

      {!conn && built && open && (
        <form onSubmit={submit} className="border-t border-line p-5">
          {busy === "in" ? (
            <div role="status" className="py-4">
              <p className="flex items-center gap-3 font-semibold"><Spinner />Signing in to {city.name}…</p>
              <p className="mt-1 text-[15px] text-ink-2">This takes about 30 seconds. Keep this page open.</p>
              <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full w-full origin-left animate-[fill_30s_ease-out_forwards] bg-white/60" /></div>
            </div>
          ) : (
            <>
              <p className="text-[15px] text-ink-2">
                {city.platform === "demo"
                  ? <>Demo login: <span className="font-mono text-ink">demo</span> / <span className="font-mono text-ink">demo</span></>
                  : <>Use the login you use on the {city.name} permit portal.</>}
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-[15px] text-ink-2">Portal username
                  <input name="username" required autoFocus autoComplete="username" autoCapitalize="none" className={input} />
                </label>
                <label className="block text-[15px] text-ink-2">Portal password
                  <input name="password" type="password" required autoComplete="current-password" className={input} />
                </label>
              </div>
              {msg && <div className="mt-4" role="alert"><Note tone="bad">{msg}</Note></div>}
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="submit" className={`${limeBtn} flex-1 sm:flex-none`}>Connect {city.name}</button>
                <button type="button" onClick={() => { setOpen(false); setMsg(""); }} className={darkBtn}>Cancel</button>
              </div>
            </>
          )}
        </form>
      )}
    </li>
  );
}

const Check = () => (
  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ok text-black" aria-label="Connected">
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M3.5 8.5l3 3 6-7" /></svg>
  </span>
);

