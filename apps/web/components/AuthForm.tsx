"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { limeBtn } from "@/components/Dash";

/** Sign in or sign up. Signing up shows the Claude connector link on the Settings page. */
export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const up = mode === "signup";
  const [v, setV] = useState({ company: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [google, setGoogle] = useState(false);
  useEffect(() => {
    fetch("/auth/config").then((r) => r.json()).then((d) => setGoogle(!!d.google)).catch(() => {});
    if (new URLSearchParams(window.location.search).get("error")) setErr("Google sign-in didn't work. Try again, or use email.");
  }, []);
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
      <p className="mt-4 text-ink-2">{up ? "Make your account, then add the link it gives you to Claude." : "Welcome back. No account yet? Create one below."}</p>
      {google && (
        <>
          <a href="/auth/google" className="mt-8 flex min-h-12 items-center justify-center gap-3 rounded-xl bg-white px-5 text-[15px] font-semibold text-black hover:bg-white/90">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.1 5.3-4.5 6.9l7.3 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.6 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
            {up ? "Sign up with Google" : "Continue with Google"}
          </a>
          <p className="mt-4 text-center text-sm text-ink-3">or use email</p>
        </>
      )}
      <form onSubmit={submit} className={`${google ? "mt-4" : "mt-8"} space-y-4 rounded-2xl border border-line bg-panel p-6`}>
        {up && (<div><label htmlFor="company" className={label}>Company name</label><input id="company" required maxLength={80} autoComplete="organization" value={v.company} onChange={set("company")} className={field} /></div>)}
        <div><label htmlFor="email" className={label}>Email</label><input id="email" type="email" required autoComplete="email" value={v.email} onChange={set("email")} className={field} /></div>
        <div><label htmlFor="password" className={label}>Password</label><input id="password" type="password" required minLength={up ? 10 : 1} autoComplete={up ? "new-password" : "current-password"} value={v.password} onChange={set("password")} className={field} />
          {up && <p className="mt-1 text-sm text-ink-3">At least 10 characters.</p>}</div>
        {err && <p className="text-[15px] text-bad" role="alert">{err}</p>}
        <button type="submit" disabled={busy} className={`${limeBtn} w-full`}>{busy ? "One moment…" : up ? "Create account" : "Sign in"}</button>
      </form>
      <div className="mt-6 text-center">
        <p className="text-[15px] text-ink-3">{up ? "Already have an account?" : "New here?"}</p>
        <Link href={up ? "/signin" : "/signup"} className="mt-2 inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-5 text-[15px] font-semibold hover:bg-panel-2">{up ? "Sign in" : "Create an account"}</Link>
      </div>
    </section>
  );
}
