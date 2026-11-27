"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { limeBtn } from "@/components/Dash";

/** Sign in or sign up. Signing up shows the Claude connector link on the Settings page. */
export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const up = mode === "signup";
  const [v, setV] = useState({ company: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const r = await fetch(up ? "/auth/signup" : "/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-bc": "1" }, body: JSON.stringify(up ? v : { email: v.email, password: v.password }) });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d) { setErr(d?.error ?? "We can't reach the server. Try again in a minute."); setBusy(false); return; }
      if (d.connectorUrl) sessionStorage.setItem("bc-connector", d.connectorUrl);
      window.location.href = up ? "/account?welcome=1" : "/dashboard";
    } catch { setErr("We can't reach the server. Try again in a minute."); setBusy(false); }
  };
  const field = "mt-1 min-h-12 w-full rounded-xl border border-line bg-panel-2 px-4 text-[16px] text-ink";
  const label = "text-xs font-medium uppercase tracking-wide text-ink-3";
  return (
    <section className="relative mx-auto max-w-md py-16 sm:py-24">
      <div className="blueprint absolute inset-0 -z-10" aria-hidden />
      <h1 className="display text-5xl sm:text-6xl">{up ? "Start " : "Sign "}<span className="text-lime">{up ? "free" : "in"}</span></h1>
      <p className="mt-4 text-ink-2">{up ? "Make your account, then add the link it gives you to Claude." : "Welcome back."}</p>
      <form onSubmit={submit} className="mt-8 space-y-4 rounded-2xl border border-line bg-panel p-6">
        {up && (<div><label htmlFor="company" className={label}>Company name</label><input id="company" required maxLength={80} autoComplete="organization" value={v.company} onChange={set("company")} className={field} /></div>)}
        <div><label htmlFor="email" className={label}>Email</label><input id="email" type="email" required autoComplete="email" value={v.email} onChange={set("email")} className={field} /></div>
        <div><label htmlFor="password" className={label}>Password</label><input id="password" type="password" required minLength={up ? 10 : 1} autoComplete={up ? "new-password" : "current-password"} value={v.password} onChange={set("password")} className={field} />
          {up && <p className="mt-1 text-sm text-ink-3">At least 10 characters.</p>}</div>
        {err && <p className="text-[15px] text-bad" role="alert">{err}</p>}
        <button type="submit" disabled={busy} className={`${limeBtn} w-full`}>{busy ? "One moment…" : up ? "Create account" : "Sign in"}</button>
      </form>
      <p className="mt-6 text-center text-[15px] text-ink-3">
        {up ? <>Already have an account? <Link href="/signin" className="text-ink underline">Sign in</Link></> : <>New here? <Link href="/signup" className="text-ink underline">Start free</Link></>}
      </p>
    </section>
  );
}
