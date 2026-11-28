import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { feesDue, holds, inspStatus, parseInspectionDetails, parseInspections, parseRecordList, permitStatus } from "../src/adapters/accela.ts";

const fx = (f: string) => readFileSync(new URL(`./fixtures/accela/${f}`, import.meta.url), "utf8");

test("accela: reads the record grid (number, type, status, address, record link)", () => {
  const rows = parseRecordList(fx("record-list.html"));
  assert.deepEqual(rows.map((r) => r.num), ["26TMP-000123", "TCP-26-0001", "ENG-26-0002"]);
  const [tmp, tcp, eng] = rows;
  assert.equal(tmp.detailUrl, undefined); // unfinished application: no record page
  assert.equal(permitStatus(tmp.status, tmp.num), "draft");
  assert.equal(tcp.type, "Traffic Control Permit");
  assert.equal(tcp.status, "Info Received");
  assert.equal(tcp.date, "11/25/2026");
  assert.match(tcp.detailUrl!, /^\/AVONDALE\/Cap\/CapDetail\.aspx\?Module=Engineering&TabName=Engineering&capID1=26CAP&capID2=00000&capID3=00001&agencyCode=AVONDALE/);
  assert.equal(eng.address, "100 S SAMPLE AVE AVONDALE AZ 85323");
  assert.equal(permitStatus(eng.status), "issued");
});

test("accela: reads upcoming and completed inspections with ids, dates and inspector", () => {
  const ins = parseInspections(fx("inspections.html"), "ENG-26-0002");
  assert.equal(ins.length, 3);
  assert.deepEqual(ins[0], {
    id: "100001", permitId: "ENG-26-0002", type: "Final Walk-thru", status: "scheduled", scheduledFor: "2026-12-03",
    notes: "Scheduled. Inspector: Sam Inspector",
    detailUrl: "/AVONDALE/Inspection/InspectionDetails.aspx?agencyCode=AVONDALE&RecordAltID=ENG-26-0002&RecordID1=26CAP&RecordID2=00000&RecordID3=00003&Module=Engineering&PublicUserID=PUBLICUSER0&ScheduledType=Unknown&Action=ViewDetails&ID=100001&IsFromWizardPage=False&RequestDayOption=0&ContactChangeOption=Unknown&isPopup=Y&Status=Unknown&NavigationBeginPage=ViewDetails&TimeOption=Unknow",
  });
  assert.deepEqual(ins.slice(1).map((i) => [i.id, i.type, i.status, i.scheduledFor]), [
    ["100000", "Underground Utilities", "passed", "2026-11-20"],
    ["99999", "Backfill and Compaction", "failed", "2026-11-18"],
  ]);
});

test("accela: maps portal wording", () => {
  assert.equal(permitStatus("Resubmittal Required"), "corrections_required");
  assert.equal(permitStatus("Finaled"), "finaled");
  assert.equal(permitStatus("In Review"), "in_review");
  assert.equal(inspStatus("Disapproved", false), "failed"); // not "approved"
  assert.equal(inspStatus("Approved", false), "passed");
  assert.equal(inspStatus("Pending", true), "scheduled");
  assert.equal(inspStatus("Cancelled", true), "cancelled");
});

// Made-up text in ACA's usual shape: logged out, Avondale shows no fees, conditions or inspection details.
test("accela: fees due counts only the Outstanding part", () => {
  assert.equal(feesDue("Fees\nOutstanding:\nDate Invoice Number Amount\n11/20/2026 1001 $150.00\n11/21/2026 1002 $1,025.50\nPaid:\n11/01/2026 999 $80.00"), 1175.5);
  assert.equal(feesDue("Fees\nOutstanding:\n11/20/2026 1001 $150.00\nTotal outstanding fees: $150.00\nPaid:\n$80.00"), 150);
  assert.equal(feesDue("Fees\nPaid:\n$80.00"), 0);
});

test("accela: holds are conditions with Hold or Lock severity", () => {
  const h = `<span id="x_lblConditionName">Fire flow test</span><span id="x_lblSeverity">Hold</span>
    <span id="y_lblConditionName">Dust permit on site</span><span id="y_lblSeverity">Notice</span>`;
  assert.deepEqual(holds(h), ["Fire flow test"]);
});

test("accela: inspection details popup: status, date and result comments", () => {
  assert.deepEqual(parseInspectionDetails(fx("inspection-details.html")), {
    status: "Scheduled", date: "2026-12-03", comments: "Install cleanout cap.\nRetest after repair.",
  });
});
