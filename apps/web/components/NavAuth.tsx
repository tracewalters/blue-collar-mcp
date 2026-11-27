"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Me } from "@/lib/dash";

/** Right side of the header: Sign in / Start free when signed out, a profile menu when signed in. */
export function NavAuth() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => { api<Me>("/me").then((r) => setMe(r.ok ? r.data : null)); }, []);
  if (me === undefined) return <span className="h-9 w-24" aria-hidden />;
  if (!me) {
    return (
      <>
        <Link href="/signin" className="hidden rounded-xl border border-line px-3.5 py-2 text-sm text-ink-2 hover:text-ink sm:block">Sign in</Link>
        <Link href="/signup" className="rounded-xl bg-lime px-3.5 py-2 text-sm font-semibold text-lime-ink">Start free</Link>
      </>
    );
  }
  const email = me.account?.email;
  const initial = (me.userName || me.company || "?").trim().charAt(0).toUpperCase();
  const signOut = async () => { await api("/signout", {}); window.location.href = "/"; };
  const item = "block w-full rounded-xl px-4 py-3 text-left hover:bg-panel-2";
  return (
    <>
      <Link href="/dashboard" className="hidden rounded-xl border border-line px-3.5 py-2 text-sm text-ink-2 hover:text-ink sm:block">Dashboard</Link>
      <details className="relative">
        <summary aria-label="Your profile" className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full bg-lime font-bold text-lime-ink">{initial}</summary>
        <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-line bg-panel p-2 shadow-2xl">
          <div className="px-4 py-3">
            <p className="truncate font-semibold">{me.company}</p>
            {email && <p className="truncate text-sm text-ink-3">{email}</p>}
          </div>
          <Link href="/dashboard" className={item}>Dashboard</Link>
          <Link href="/account" className={item}>Settings</Link>
          <button type="button" onClick={signOut} className={`${item} text-ink-2`}>Sign out</button>
        </div>
      </details>
    </>
  );
}
