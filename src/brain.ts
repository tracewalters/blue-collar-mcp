import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { home } from "./vault.ts";

/** Company brain, v0: plain markdown files with frontmatter. Opens in Obsidian as-is. */
export const NoteType = z.enum(["client", "job", "meeting", "decision", "person", "company", "knowledge", "rule", "payment"]);
export type NoteType = z.infer<typeof NoteType>;
export const Source = z.enum(["human", "ai", "import"]);

export type Note = { type: NoteType; slug: string; title: string; source: string; updated: string; body: string; stale: boolean };

/** Live data older than this is flagged, so nobody trusts an old answer. */
const STALE_DAYS = 90;
const LIVE: NoteType[] = ["client", "job", "meeting"];

/** Hosted mode runs each request inside a tenant, so every company gets its own brain folder. */
export const tenantDir = new AsyncLocalStorage<string>();
export const brainDir = () => tenantDir.getStore() ?? join(process.env.BRAIN_DIR ?? home(), "brain");
export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
const file = (type: NoteType, slug: string) => join(brainDir(), type, `${slugify(slug)}.md`);

const parse = (type: NoteType, slug: string, raw: string): Note => {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const meta: Record<string, string> = {};
  for (const line of (m?.[1] ?? "").split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const updated = meta.updated ?? "unknown";
  const age = Date.parse(updated) ? (Date.now() - Date.parse(updated)) / 864e5 : Infinity;
  return {
    type, slug, title: meta.title ?? slug, source: meta.source ?? "unknown", updated,
    body: (m?.[2] ?? raw).trim(), stale: LIVE.includes(type) && age > STALE_DAYS,
  };
};

export const getNote = (type: NoteType, slug: string): Note => {
  try { return parse(type, slug, readFileSync(file(type, slug), "utf8")); }
  catch { throw new Error(`No ${type} note "${slug}". Search first, or save one.`); }
};

export const saveNote = (n: { type: NoteType; title: string; body: string; source: z.infer<typeof Source> }) => {
  const slug = slugify(n.title);
  if (!slug) throw new Error("Title needed.");
  mkdirSync(join(brainDir(), n.type), { recursive: true });
  const updated = new Date().toISOString().slice(0, 10);
  const text = `---\ntype: ${n.type}\ntitle: ${n.title.replace(/\n/g, " ")}\nsource: ${n.source}\nupdated: ${updated}\n---\n${n.body.trim()}\n`;
  writeFileSync(file(n.type, slug), text);
  return { type: n.type, slug, updated };
};

export const searchNotes = (query: string, type?: NoteType, limit = 10) => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const out: { note: Note; score: number }[] = [];
  for (const t of NoteType.options) {
    if (type && t !== type) continue;
    let files: string[] = [];
    try { files = readdirSync(join(brainDir(), t)).filter((f) => f.endsWith(".md")); } catch { continue; }
    for (const f of files) {
      const note = parse(t, f.slice(0, -3), readFileSync(join(brainDir(), t, f), "utf8"));
      const hay = `${note.title} ${note.body}`.toLowerCase();
      const title = note.title.toLowerCase();
      const score = terms.reduce((s, w) => s + (title.includes(w) ? 3 : 0) + (hay.includes(w) ? 1 : 0), 0);
      if (score > 0) out.push({ note, score });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit).map(({ note }) => ({
    type: note.type, slug: note.slug, title: note.title, updated: note.updated, source: note.source,
    stale: note.stale, snippet: note.body.slice(0, 300),
  }));
};
