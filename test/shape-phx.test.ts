import assert from "node:assert/strict";
import { test } from "node:test";
import { recordFields } from "../src/adapters/shape-phx.ts";

// Made-up record page text in the shape Stanley's `inspection <P> <INS>` reads (labels, help/edit text, multi-line comments).
test("shape-phx: reads an inspection record's fields and multi-line comments", () => {
  const page = ["Inspection", "Number", "INS-00985207", "Inspection Type", "Help Inspection Type", "Final Building", "Status", "Fail",
    "Inspection Comments", "Edit Inspection Comments", "Install handrail at rear stairs.", "Smoke alarm missing in bedroom 2.",
    "Completed Date", "10/23/2026", "Inspector", "", "Site Contact Name"].join("\n");
  const f = recordFields(page);
  assert.equal(f.Number, "INS-00985207");
  assert.equal(f["Inspection Type"], "Final Building");
  assert.equal(f.Status, "Fail");
  assert.equal(f["Inspection Comments"], "Install handrail at rear stairs.\nSmoke alarm missing in bedroom 2.");
  assert.equal(f["Completed Date"], "10/23/2026");
  assert.equal(f.Inspector, "");
});
