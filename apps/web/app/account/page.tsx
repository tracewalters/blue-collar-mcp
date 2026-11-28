"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Loading, Problem, SignedOut, darkBtn, limeBtn, useApi } from "@/components/Dash";
import { api, type Me } from "@/lib/dash";

// Settings: who you are, the link that connects Claude, and sign out. The connector link is shown once (we only store its hash).

export default function Account() {
  const { res, reload } = useApi<Me>("/me");
  if (!res) return <Loading />;
  if (!res.ok) return res.signedOut ? <SignedOut /> : <Problem message={res.message} retry={reload} />;
  const me = res.data;
  return (
    <div className="pt-8 sm:pt-12">
      <p className="text-sm uppercase tracking-wide text-ink-3">{me.company}</p>
      <h1 className="display mt-2 text-4xl sm:text-6xl">Settings</h1>
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Connector />
        <Sign me={me} reload={reload} />
      </div>
    </div>
  );
}

const card = "rounded-2xl border border-line bg-panel p-6";
const field = "mt-1 min-h-12 w-full rounded-xl border border-line bg-panel-2 px-4 text-[16px] text-ink";
const label = "text-xs font-medium uppercase tracking-wide text-ink-3";

const tools = [
  ["Claude", ["Open Settings, then Connectors.", "Choose Add custom connector and paste the link.", "Sign in when asked, then start a new chat and say “set up my permits”."]],
  ["ChatGPT", ["Open Settings, then Connectors. Turn on Developer mode if you see it.", "Create a connector, paste the link, and choose OAuth for authentication.", "Sign in when asked, then ask about your permits."]],
  ["Other", ["Any AI app that supports remote MCP servers works.", "Paste the link as the server URL and choose OAuth or sign-in if it asks.", "Sign in with the account you just made."]],
] as const;

function Connector() {
  const [tool, setTool] = useState(0);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [priv, setPriv] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { setUrl(`${window.location.origin}/mcp`); setPriv(sessionStorage.getItem("bc-connector") ?? ""); }, []);
  const copy = async (v: string) => { await navigator.clipboard.writeText(v); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const reset = async () => {
    if (!window.confirm("Make a new private link? The old one stops working.")) return;
    setErr("");
    const r = await api<{ connectorUrl: string }>("/connector/reset", {});
    if (r.ok) { sessionStorage.setItem("bc-connector", r.data.connectorUrl); setPriv(r.data.connectorUrl); } else setErr(r.message);
  };
  return (
    <section className={card} aria-labelledby="conn">
      <h2 id="conn" className="text-xl font-semibold">Connect your AI</h2>
      <p className="mt-2 text-ink-2">One link for every AI app. You sign in with this account when asked.</p>
      <p className="mt-4 break-all rounded-xl border border-line bg-panel-2 p-4 font-mono text-sm">{url}</p>
      <button type="button" onClick={() => copy(url)} className={`${limeBtn} mt-4`}>{copied ? "Copied" : "Copy link"}</button>
      <div className="no-scrollbar mt-6 flex gap-1 overflow-x-auto" role="tablist">
        {tools.map(([n], i) => (
          <button key={n} type="button" role="tab" aria-selected={tool === i} onClick={() => setTool(i)} className={`min-h-11 rounded-full px-4 text-[15px] ${tool === i ? "bg-white/10 text-ink" : "text-ink-3 hover:text-ink-2"}`}>{n}</button>
        ))}
      </div>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] text-ink-2">{tools[tool][1].map((t) => <li key={t}>{t}</li>)}</ol>
      <details className="mt-6 border-t border-line pt-4">
        <summary className="cursor-pointer text-[15px] text-ink-3">Private link, for apps with no sign-in</summary>
        <p className="mt-3 text-[15px] text-ink-2">Works without signing in, so treat it like a password. We only keep a scrambled copy, so a lost one needs a new link.</p>
        {priv && <p className="mt-3 break-all rounded-xl border border-line bg-panel-2 p-4 font-mono text-sm">{priv}</p>}
        <div className="mt-3 flex gap-2">
          {priv && <button type="button" onClick={() => copy(priv)} className={darkBtn}>Copy</button>}
          <button type="button" onClick={reset} className={darkBtn}>Make a new private link</button>
        </div>
        {err && <p className="mt-3 text-[15px] text-bad" role="alert">{err}</p>}
      </details>
    </section>
  );
}

function Sign({ me, reload }: { me: Me; reload: () => void }) {
  const email = me.account?.email;
  const [v, setV] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const add = async (e: FormEvent) => {
    e.preventDefault(); setErr("");
    const r = await api("/account", v);
    if (r.ok) reload(); else setErr(r.message);
  };
  const signOut = async () => { await api("/signout", {}); window.location.href = "/"; };
  return (
    <section className={card} aria-labelledby="who">
      <h2 id="who" className="text-xl font-semibold">Your account</h2>
      <dl className="mt-4 space-y-3 text-[15px]">
        <div><dt className={label}>Company</dt><dd className="mt-1">{me.company}</dd></div>
        {me.userName && <div><dt className={label}>Name</dt><dd className="mt-1">{me.userName}</dd></div>}
        {email && <div><dt className={label}>Email</dt><dd className="mt-1">{email}</dd></div>}
        <div><dt className={label}>Cities</dt><dd className="mt-1">{me.connections.length ? me.connections.map((c) => c.name).join(", ") : "None connected yet"} · <Link href="/dashboard/connect" className="underline">Manage</Link></dd></div>
      </dl>
      {me.account && !email && (
        <form onSubmit={add} className="mt-6 space-y-3 border-t border-line pt-6">
          <p className="text-ink-2">Add an email and password so you can sign in from any browser.</p>
          <div><label htmlFor="e" className={label}>Email</label><input id="e" type="email" required autoComplete="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} className={field} /></div>
          <div><label htmlFor="p" className={label}>Password</label><input id="p" type="password" required minLength={10} autoComplete="new-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} className={field} /></div>
          {err && <p className="text-[15px] text-bad" role="alert">{err}</p>}
          <button type="submit" className={limeBtn}>Save sign-in</button>
        </form>
      )}
      <button type="button" onClick={signOut} className={`${darkBtn} mt-6`}>Sign out</button>
    </section>
  );
}
