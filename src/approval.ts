import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { brainDir } from "./brain.ts";
import { home } from "./vault.ts";

/**
 * Hosted HTTP is stateless and cannot pop a prompt, so writes are two steps:
 * 1) the call returns a preview and a token bound to this tenant and this exact content,
 * 2) the same call repeated with the token executes. Content cannot change between steps.
 * Limit: this proves "what was previewed is what is saved", not that a human said yes.
 * The human gate is the Claude app's own tool-approval prompt plus the instruction to ask first.
 */
const key = () => {
  const f = join(home(), "approval.key");
  if (!existsSync(f)) writeFileSync(f, randomBytes(32).toString("base64"), { mode: 0o600 });
  return Buffer.from(readFileSync(f, "utf8"), "base64");
};
const sign = (exp: number, payload: unknown) =>
  createHmac("sha256", key()).update(`${brainDir()}|${exp}|${JSON.stringify(payload)}`).digest("base64url");

export const issue = (payload: unknown, ttlMs = 10 * 60_000) => { const exp = Date.now() + ttlMs; return `${exp}.${sign(exp, payload)}`; };
export const valid = (payload: unknown, token?: string) => {
  const [exp, sig] = (token ?? "").split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const want = Buffer.from(sign(Number(exp), payload)), got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
};

/** Returns null when approved, else a "show the user first" response. */
export const gate = (payload: unknown, preview: unknown, token?: string) =>
  valid(payload, token) ? null : {
    needsApproval: true, preview, approvalToken: issue(payload),
    instruction: "NOT done yet. Show the preview to the user in plain English. Only after they say yes, call this tool again with exactly the same fields plus this approvalToken. If they change anything, start over.",
  };
