import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { capIdOf, hiddenFields, inspStatus, parseDelta, parseFeesDue, parseInspectionDetail, parseInspectionList, parseRecord, parseRecordList, permitStatus } from "../src/adapters/accela.ts";

// Fixtures are real Queen Creek ACA pages (public, logged out), trimmed and anonymized: fake address, numbers and names.
const fx = (f: string) => readFileSync(new URL(`./fixtures/accela/${f}`, import.meta.url), "utf8");

test("accela: record page gives number, type, status, address, description", () => {
  const r = parseRecord(fx("record.html"));
  assert.equal(r.id, "B26-0001");
  assert.equal(r.type, "Residential");
  assert.equal(r.status, "Finaled");
  assert.equal(r.address, "123 E FAKE ST");
  assert.match(r.description ?? "", /^PATIO WALL, LOT 6 SAMPLE ESTATES FREESTANDING/);
});

test("accela: inspections postback (delta) gives completed rows and the next page", () => {
  const d = parseDelta(fx("inspections-delta.txt"));
  assert.equal(d.hidden.__VIEWSTATE, "fixture-__VIEWSTATE");
  const r = parseInspectionList(Object.values(d.panels).join(""), "B26-0001");
  assert.equal(r.items.length, 5);
  assert.deepEqual(r.items[0], { id: "10008603", permitId: "B26-0001", type: "101 Footing Trench and Rebar", status: "failed", scheduledFor: "2026-03-18", notes: "Rejected, 03/18/2026 at 12:00 AM" });
  assert.equal(r.items[1].status, "passed");
  assert.equal(r.items[4].type, "107 Reinforced Masonry Pre-Grout");
  assert.equal(r.items[4].status, "failed"); // Partial
  assert.equal(r.nextCompleted, "ctl00$PlaceHolderMain$InspectionList$gvListCompleted$ctl08$ctl04");
});

test("accela: inspection detail gives status, date and the inspector's comments", () => {
  const i = parseInspectionDetail(fx("inspection-detail.html"), "B26-0001", "10000001");
  assert.ok(i);
  assert.equal(i.type, "101 Footing Trench and Rebar");
  assert.equal(i.status, "failed");
  assert.equal(i.scheduledFor, "2026-03-18");
  assert.equal(i.comments, "Posts not shown on plans.\nCorner rebar not per section C-C.");
});

test("accela: record list reads columns by header and finds the next page", () => {
  const html = `<table id="ctl00_PlaceHolderMain_dgvPermitList_gdvPermitList">
    <tr class="ACA_TabRow_Header"><th>Date</th><th>Record #</th><th>Record Type</th><th>Address</th><th>Description</th><th>Status</th><th>Action</th></tr>
    <tr class="ACA_TabRow_Odd"><td>11/02/2026</td><td><a href="../Cap/CapDetail.aspx?Module=Permits&amp;TabName=Permits&amp;capID1=PMT99&amp;capID2=00000&amp;capID3=00007&amp;agencyCode=QC"><span>B26-0007</span></a></td>
      <td>Residential</td><td>123 E FAKE ST, QUEEN CREEK AZ 85142</td><td>NEW POOL</td><td>Issued</td><td><a href="#">Schedule an Inspection</a></td></tr>
    <tr class="ACA_Table_Pages"><td><a href="javascript:__doPostBack(&#39;ctl00$PlaceHolderMain$dgvPermitList$gdvPermitList$ctl13$ctl12&#39;,&#39;&#39;)">Next &gt;</a></td></tr></table>`;
  const r = parseRecordList(html);
  assert.deepEqual(r.rows, [{ id: "B26-0007", capId: "PMT99-00000-00007", date: "2026-11-02", type: "Residential", address: "123 E FAKE ST, QUEEN CREEK AZ 85142", description: "NEW POOL", status: "Issued", actions: ["Schedule an Inspection"] }]);
  assert.equal(r.next, "ctl00$PlaceHolderMain$dgvPermitList$gdvPermitList$ctl13$ctl12");
});

test("accela: fees due, hidden fields, capID, statuses", () => {
  assert.equal(parseFeesDue(""), 0);
  assert.equal(parseFeesDue(`<table><tr class="ACA_TabRow_Odd"><td>01/02/2026</td><td>1</td><td>$91.00</td></tr><tr class="ACA_TabRow_Even"><td>x</td><td>2</td><td>$1,059.15</td></tr></table>`), 1150.15);
  assert.equal(parseFeesDue(`<i>Total outstanding fees: $150.15</i>`), 150.15);
  assert.deepEqual(hiddenFields(`<input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="a&amp;b" /><input type="text" name="x" value="no" />`), { __VIEWSTATE: "a&b" });
  assert.equal(capIdOf("/QC/Cap/CapDetail.aspx?Module=Permits&capID1=PMT26&capID2=00000&capID3=00220&agencyCode=QC"), "PMT26-00000-00220");
  assert.equal(parseDelta("1|#||4|67|pageRedirect||%2fQC%2fCap%2fCapDetail.aspx%3fcapID1%3dA%26capID2%3dB%26capID3%3dC|").redirect, "/QC/Cap/CapDetail.aspx?capID1=A&capID2=B&capID3=C");
  assert.equal(permitStatus("Finaled"), "finaled");
  assert.equal(permitStatus("Issued"), "issued");
  assert.equal(permitStatus("Resubmittal Required"), "corrections_required");
  assert.equal(permitStatus("Plan Review"), "in_review");
  assert.equal(inspStatus("Scheduled", true), "scheduled");
  assert.equal(inspStatus("Cancelled", false), "cancelled");
});
