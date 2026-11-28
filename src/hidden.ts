import { join } from "node:path";
import { editJson, readJson } from "./store.ts";
import { home } from "./vault.ts";

/** Permits a Company has hidden because the city never archives them. Per company, saved as "city|permitId". */
const file = () => join(home(), "hidden.json");
export const permitKey = (city: string, id: string) => `${city}|${id}`;
export const readHidden = (): string[] => readJson<{ keys: string[] }>(file(), { keys: [] }).keys;
export const setHidden = (city: string, id: string, hidden: boolean) =>
  editJson<{ keys: string[] }>(file(), { keys: [] }, (s) => {
    const k = permitKey(city, id), rest = s.keys.filter((x) => x !== k);
    s.keys = hidden ? [...rest, k] : rest;
  });
