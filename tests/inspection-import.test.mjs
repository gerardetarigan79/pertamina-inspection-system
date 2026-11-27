import assert from "node:assert/strict";
import test from "node:test";

import { parseCsv, validateInspectionCsv } from "../app/lib/inspection-import.ts";

test("parseCsv supports a UTF-8 BOM, semicolon delimiter, quoted separators, and CRLF", () => {
  const csv = '\uFEFFasset_id;remarks\r\nPHM-PL-001;"Near valve; north line, KP 1"\r\n';

  assert.deepEqual(parseCsv(csv), [
    ["asset_id", "remarks"],
    ["PHM-PL-001", "Near valve; north line, KP 1"],
  ]);
});

test("validateInspectionCsv accepts DD/MM/YYYY and converts imperial units", () => {
  const csv = [
    "asset_id,inspection_date,method,measured_thickness,thickness_unit,pressure,pressure_unit,inspector,remarks",
    "PHM-PL-001,13/11/2026,UT,0.31,in,740,psi,Budi Santoso,Historical inspection",
  ].join("\n");

  const result = validateInspectionCsv(csv, ["PHM-PL-001"]);

  assert.deepEqual(result.fileErrors, []);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].status, "warning");
  assert.equal(result.rows[0].clean?.inspectionDate, "2026-11-13");
  assert.equal(result.rows[0].clean?.thicknessMm, 7.87);
  assert.equal(result.rows[0].clean?.pressureBar, 51.02);
});
