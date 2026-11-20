// Writes spec/schemas/*.json from the zod schemas in src/schemas.ts.
import { mkdirSync, writeFileSync } from "node:fs";
import { z } from "zod";
import * as s from "../src/schemas.ts";

mkdirSync("spec/schemas", { recursive: true });
for (const name of ["Permit", "Inspection", "Jurisdiction", "Plan"] as const) {
  writeFileSync(`spec/schemas/${name.toLowerCase()}.json`, JSON.stringify(z.toJSONSchema(s[name]), null, 2) + "\n");
}
