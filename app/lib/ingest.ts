import { getAsset } from "./assets";
import type { InspectionRecord, ProductionRecord, RawInspection, RawProduction, RegisteredAsset, SyncResult } from "./types";

type Merged<T> = { records: T[]; result: SyncResult };

function upsert<T>(
  existing: T[],
  incoming: { key: string; record: T }[],
  keyOf: (r: T) => string,
  unlinked: Set<string>,
  fetched: number,
  window: { from: string; to: string },
): Merged<T> {
  const map = new Map(existing.map(r => [keyOf(r), r]));
  let added = 0, updated = 0, unchanged = 0;
  for (const { key, record } of incoming) {
    const prev = map.get(key);
    if (!prev) added++;
    else if (JSON.stringify(prev) !== JSON.stringify(record)) updated++;
    else unchanged++;
    map.set(key, record);
  }
  return {
    records: [...map.values()],
    result: { at: new Date().toISOString(), window, fetched, added, updated, unchanged, unlinked: [...unlinked].sort() },
  };
}

const productionKey = (r: ProductionRecord) => `${r.assetId}|${r.date}`;
const inspectionKey = (r: InspectionRecord) => `${r.assetId}|${r.date}|${r.tml}`;

/** US-02: one production record per asset_id and date; unknown tags are not stored. */
export function mergeProduction(existing: ProductionRecord[], raw: RawProduction[], window: { from: string; to: string }, assets: readonly RegisteredAsset[]) {
  const unlinked = new Set<string>();
  const incoming: { key: string; record: ProductionRecord }[] = [];
  for (const r of raw) {
    if (!getAsset(assets, r.asset_tag)) { unlinked.add(r.asset_tag); continue; }
    const record: ProductionRecord = {
      assetId: r.asset_tag, date: r.reading_date, pressure: r.pressure_bar, temperature: r.temperature_c,
      gas: r.gas_mmscfd, water: r.water_bwpd, oil: r.oil_bopd, source: "Direct Viewer",
    };
    incoming.push({ key: productionKey(record), record });
  }
  return upsert(existing, incoming, productionKey, unlinked, raw.length, window);
}

/** US-03: SAP inspection records of Surface Facility assets, linked by asset_id. */
export function mergeInspections(existing: InspectionRecord[], raw: RawInspection[], window: { from: string; to: string }, assets: readonly RegisteredAsset[]) {
  const unlinked = new Set<string>();
  const incoming: { key: string; record: InspectionRecord }[] = [];
  for (const r of raw) {
    const asset = getAsset(assets, r.equipment_id);
    if (!asset || asset.department !== "Surface Facility") { unlinked.add(r.equipment_id); continue; }
    const record: InspectionRecord = {
      assetId: r.equipment_id, date: r.inspection_date, tml: r.tml_id, method: r.method,
      nominalMm: r.nominal_wt_mm, measuredMm: r.measured_wt_mm, corrosionType: r.corrosion_type,
      depthMm: r.corrosion_depth_mm, lengthMm: r.corrosion_length_mm, widthMm: r.corrosion_width_mm,
      notification: r.notification_no, team: r.inspector_team, source: "SAP",
    };
    incoming.push({ key: inspectionKey(record), record });
  }
  return upsert(existing, incoming, inspectionKey, unlinked, raw.length, window);
}
