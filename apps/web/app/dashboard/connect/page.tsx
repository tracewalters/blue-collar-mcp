"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { DashShell, Note, darkBtn, limeBtn } from "@/components/Dash";
import { api, fmtDay, isBuilt, type City, type Me } from "@/lib/dash";

export default function Connect() {
  return <DashShell title="Connect a city">{(me, reload) => <Body me={me} reload={reload} />}</DashShell>;
}

const input = "mt-2 block min-h-12 w-full rounded-xl border border-line bg-panel-2 px-4 text-base text-ink placeholder:text-ink-3";

function Body({ me, reload }: { me: Me; reload: () => void }) {
  const connected = new Set(me.connections.map((c) => c.id));
  const choices = me.cities.filter((c) => !connected.has(c.id));
  const asked = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("city");
  const [pick, setPick] = useState(choices.find((c) => c.id === asked)?.id ?? choices.find(isBuilt)?.id ?? choices[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const city = me.cities.find((c) => c.id === pick);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setMsg("");
    const r = await api("/connect", { city: pick, username: f.get("username"), password: f.get("password") });
    setBusy(false);
    if (r.ok) window.location.assign("/dashboard"); else setMsg(r.signedOut ? "You were signed out. Ask Claude to open your dashboard again." : r.message);
  };
  const drop = async (id: string) => {
    setBusy(true);
    const r = await api("/disconnect", { city: id });
    setBusy(false);
    if (r.ok) window.location.assign("/dashboard"); else setMsg(r.message);
  };

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-10">
        {me.connections.length > 0 && (
          <section aria-labelledby="on">
            <h2 id="on" className="text-2xl font-semibold tracking-tight">Connected <span className="text-ink-3">{me.connections.length}</span></h2>
            <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
              {me.connections.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <p className="flex items-center gap-2 font-semibold"><span className="h-2 w-2 rounded-full bg-ok" aria-hidden />{c.name}</p>
                    <p className="mt-0.5 text-sm text-ink-3">Connected {fmtDay(c.connectedAt)}</p>
                  </div>
                  <button type="button" disabled={busy} onClick={() => drop(c.id)} className={darkBtn}>Disconnect</button>
                </li>
              ))}
            </ul>
            <Link href="/dashboard" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-white px-5 text-[15px] font-semibold text-black hover:bg-white/90">See my permits</Link>
          </section>
        )}

        <section aria-labelledby="add">
          <h2 id="add" className="text-2xl font-semibold tracking-tight">Add a city</h2>
          {choices.length === 0 ? (
            <p className="mt-2 text-ink-2">Every city we support is connected.</p>
          ) : (
            <>
              <p className="mt-1 text-ink-2">Pick your city, then sign in with your portal login.</p>
              <div role="radiogroup" aria-label="City" className="mt-4 grid gap-2 sm:grid-cols-2">
                {choices.map((c) => <CityOption key={c.id} c={c} on={c.id === pick} pick={() => { setPick(c.id); setMsg(""); }} />)}
              </div>
              {city && (isBuilt(city) ? (
                <form onSubmit={submit} className="mt-6 rounded-2xl border border-line bg-panel p-6">
                  <h3 className="text-lg font-semibold">Sign in to {city.name}</h3>
                  {city.platform === "demo" && <p className="mt-1 text-[15px] text-ink-2">Demo login: <span className="font-mono text-ink">demo</span> / <span className="font-mono text-ink">demo</span></p>}
                  <label className="mt-5 block text-[15px] text-ink-2">Portal username
                    <input name="username" required autoComplete="username" autoCapitalize="none" className={input} />
                  </label>
                  <label className="mt-4 block text-[15px] text-ink-2">Portal password
                    <input name="password" type="password" required autoComplete="current-password" className={input} />
                  </label>
                  {msg && <div className="mt-4" role="alert"><Note tone="bad">{msg}</Note></div>}
                  <button type="submit" disabled={busy} className={`${limeBtn} mt-6 w-full sm:w-auto`}>{busy ? "Connecting…" : "Connect"}</button>
                </form>
              ) : (
                <div className="mt-6 rounded-2xl border border-line bg-panel p-6">
                  <h3 className="text-lg font-semibold">{city.name} is coming soon</h3>
                  <p className="mt-1 text-ink-2">We haven't built the connection to this portal yet. Ask Claude to tell you when it's ready.</p>
                </div>
              ))}
            </>
          )}
          {msg && !city && <div className="mt-4" role="alert"><Note tone="bad">{msg}</Note></div>}
        </section>
      </div>

      <aside className="h-fit rounded-2xl border border-line bg-panel p-6">
        <h2 className="text-lg font-semibold">Your login stays private</h2>
        <ul className="mt-3 space-y-2 text-[15px] text-ink-2">
          <li>Sent straight to your private vault over HTTPS.</li>
          <li>Never shown to Claude, and never in chat.</li>
          <li>Remove it any time with Disconnect.</li>
        </ul>
      </aside>
    </div>
  );
}

function CityOption({ c, on, pick }: { c: City; on: boolean; pick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={pick}
      className={`flex min-h-14 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left ${on ? "border-lime/60 bg-lime/10" : "border-line bg-panel hover:bg-panel-2"}`}>
      <span className={on ? "font-semibold text-ink" : "text-ink-2"}>{c.name}, {c.state}</span>
      {!isBuilt(c) && <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-xs font-semibold text-ink-3">Soon</span>}
    </button>
  );
}
