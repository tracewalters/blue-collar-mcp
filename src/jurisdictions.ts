import { readFileSync } from "node:fs";
import { Jurisdiction } from "./schemas.ts";

const url = new URL("../data/jurisdictions.json", import.meta.url);
const all = Jurisdiction.array().parse(JSON.parse(readFileSync(url, "utf8")));

export const listJurisdictions = () => all;
export const getJurisdiction = (id: string) => {
  const j = all.find((x) => x.id === id);
  if (!j) throw new Error(`Unknown jurisdiction "${id}". Run: permit cities`);
  return j;
};
