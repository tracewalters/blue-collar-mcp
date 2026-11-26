import { createHash } from "node:crypto";
import { join } from "node:path";
import type { Permit } from "./schemas.ts";
import { editJson, readJson } from "./store.ts";
import { home } from "./vault.ts";

/**
 * Jobs: a Company's permits grouped by site address. One site is one job.
 * Renames and merges are the only stored state (per company, jobs.json); the grouping itself is recomputed on every read.
 */

const WORDS: Record<string, string> = {
  north: "n", south: "s", east: "e", west: "w", northeast: "ne", northwest: "nw", southeast: "se", southwest: "sw",
  street: "st", avenue: "ave", av: "ave", road: "rd", drive: "dr", lane: "ln", boulevard: "blvd", court: "ct",
  place: "pl", parkway: "pkwy", circle: "cir", terrace: "ter", trail: "trl", highway: "hwy",
};
const UNIT = new Set(["#", "unit", "suite", "ste", "apt", "apartment", "no", "number", "spc", "space"]);

/** "301 East Camelback Road, #4" and "301 E Camelback Rd Unit 4" both become "301 e camelback rd #4". Empty means no address. */
export const siteKey = (address: string) => {
  const t = address.toLowerCase().replace(/#/g, " # ").replace(/[^a-z0-9#\s]/g, " ").split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < t.length; i++) {
    if (UNIT.has(t[i]) && i > 0 && t[i + 1] && /\d|^[a-z]$/.test(t[i + 1])) { out.push(`#${t[++i]}`); continue; }
    out.push(WORDS[t[i]] ?? t[i]);
  }
  return out.join(" ");
};
const jobId = (key: string) => createHash("sha256").update(key).digest("hex").slice(0, 12);

type Store = { names: Record<string, string>; merged: Record<string, string> };
const file = () => join(home(), "jobs.json");
const empty = (): Store => ({ names: {}, merged: {} });
const read = () => readJson(file(), empty());
/** Renames and merges are atomic and one at a time per Company. */
const edit = (fn: (s: Store) => void) => editJson(file(), empty(), fn);
const root = (s: Store, id: string) => { const seen = new Set<string>(); while (s.merged[id] && !seen.has(id)) { seen.add(id); id = s.merged[id]; } return id; };

export type JobPermit = Pick<Permit, "id" | "jurisdiction" | "type" | "status" | "address">;
export type Job = { id: string; name: string; addresses: string[]; cities: string[]; permits: JobPermit[] };

export const groupJobs = (permits: Permit[]) => {
  const s = read();
  const jobs = new Map<string, Job>();
  const ungrouped: JobPermit[] = [];
  for (const p of permits) {
    const slim = { id: p.id, jurisdiction: p.jurisdiction, type: p.type, status: p.status, address: p.address };
    const key = siteKey(p.address);
    if (!key) { ungrouped.push(slim); continue; }
    const id = root(s, jobId(key));
    const job = jobs.get(id) ?? { id, name: "", addresses: [], cities: [], permits: [] };
    if (!job.addresses.includes(p.address.trim())) job.addresses.push(p.address.trim());
    if (!job.cities.includes(p.jurisdiction)) job.cities.push(p.jurisdiction);
    job.permits.push(slim);
    jobs.set(id, job);
  }
  for (const j of jobs.values()) j.name = s.names[j.id] ?? j.addresses[0];
  return { jobs: [...jobs.values()].sort((a, b) => a.name.localeCompare(b.name)), ungrouped };
};

const known = (ids: string[], id: string) => { if (!ids.includes(id)) throw new Error(`No job "${id}". List jobs first.`); };

export const renameJob = (current: string[], id: string, name: string) => {
  known(current, id);
  return edit((s) => { if (name.trim()) s.names[id] = name.trim(); else delete s.names[id]; });
};

/** Folds job `from` into job `into`. Its permits, and any future permit at its address, show under `into`. */
export const mergeJobs = (current: string[], from: string, into: string) => {
  known(current, from); known(current, into);
  if (from === into) throw new Error("Pick two different jobs to merge.");
  return edit((s) => {
    s.merged[from] = into;
    for (const [k, v] of Object.entries(s.merged)) if (v === from) s.merged[k] = into;
    delete s.names[from];
  });
};
