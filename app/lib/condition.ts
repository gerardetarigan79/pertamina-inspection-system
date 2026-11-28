import { daysBetween } from "./dates";
import type { InspectionRecord, RegisteredAsset } from "./types";

export const CONDITIONS = ["Healthy", "Monitoring", "Attention", "Critical"] as const;
export type Condition = (typeof CONDITIONS)[number] | "No data";

/**
 * PROTOTYPE ASSUMPTION - not yet confirmed with the partner (Mr. WLT).
 * Condition is derived from the worst wall loss (% of nominal thickness) among
 * the thickness measurement locations of an asset's latest inspection.
 */
export const CONDITION_RULE = { monitoring: 10, attention: 15, critical: 20 } as const;

export function classify(wallLossPct: number): (typeof CONDITIONS)[number] {
  if (wallLossPct >= CONDITION_RULE.critical) return "Critical";
  if (wallLossPct >= CONDITION_RULE.attention) return "Attention";
  if (wallLossPct >= CONDITION_RULE.monitoring) return "Monitoring";
  return "Healthy";
}

export const SEVERITY: Record<Condition, number> = { Critical: 0, Attention: 1, Monitoring: 2, Healthy: 3, "No data": 4 };

export type TmlReading = { tml: string; nominalMm: number; measuredMm: number; lossPct: number; corrosionType: string };

export type AssetCondition = {
  asset: RegisteredAsset;
  condition: Condition;
  latestDate: string | null;
  nominalMm: number | null;
  minThicknessMm: number | null;
  wallLossPct: number | null;
  corrosionRate: number | null; // mm/year, worst TML between first and latest campaign
  readings: TmlReading[]; // latest campaign
  history: { date: string; value: number }[]; // lowest thickness per campaign
};

const loss = (r: InspectionRecord) =>
  r.nominalMm > 0 && Number.isFinite(r.measuredMm)
    ? ((r.nominalMm - r.measuredMm) / r.nominalMm) * 100
    : Number.NaN;

export function buildAssetConditions(
  records: InspectionRecord[],
  registeredAssets: readonly RegisteredAsset[],
): AssetCondition[] {
  return registeredAssets.map((asset): AssetCondition => {
    const recs = records.filter(r => r.assetId === asset.id);
    if (!recs.length) {
      return { asset, condition: "No data", latestDate: null, nominalMm: null, minThicknessMm: null, wallLossPct: null, corrosionRate: null, readings: [], history: [] };
    }
    const dates = [...new Set(recs.map(r => r.date))].sort();
    const latestDate = dates[dates.length - 1];
    const latest = recs
      .filter(r => r.date === latestDate && r.nominalMm > 0 && Number.isFinite(r.measuredMm))
      .sort((a, b) => a.tml.localeCompare(b.tml));
    if (!latest.length) {
      return { asset, condition: "No data", latestDate: null, nominalMm: null, minThicknessMm: null, wallLossPct: null, corrosionRate: null, readings: [], history: [] };
    }
    const validLosses = latest.map(loss).filter(Number.isFinite);
    if (!validLosses.length) {
      return { asset, condition: "No data", latestDate: null, nominalMm: null, minThicknessMm: null, wallLossPct: null, corrosionRate: null, readings: [], history: [] };
    }
    const wallLossPct = Math.max(...validLosses);

    let corrosionRate: number | null = null;
    for (const tml of new Set(recs.map(r => r.tml))) {
      const series = recs
        .filter(r => r.tml === tml && r.nominalMm > 0 && Number.isFinite(r.measuredMm))
        .sort((a, b) => a.date.localeCompare(b.date));
      if (series.length < 2) continue;
      const first = series[0], last = series[series.length - 1];
      const years = daysBetween(first.date, last.date) / 365.25;
      if (years <= 0) continue;
      const rate = (first.measuredMm - last.measuredMm) / years;
      corrosionRate = corrosionRate === null ? rate : Math.max(corrosionRate, rate);
    }

    return {
      asset,
      condition: classify(wallLossPct),
      latestDate,
      nominalMm: latest[0].nominalMm,
      minThicknessMm: Math.min(...latest.map(r => r.measuredMm)),
      wallLossPct,
      corrosionRate,
      readings: latest.map(r => ({ tml: r.tml, nominalMm: r.nominalMm, measuredMm: r.measuredMm, lossPct: loss(r), corrosionType: r.corrosionType })),
      history: dates
        .map(date => ({
          date,
          value: Math.min(...recs.filter(r => r.date === date && r.nominalMm > 0 && Number.isFinite(r.measuredMm)).map(r => r.measuredMm)),
        }))
        .filter(point => Number.isFinite(point.value)),
    };
  });
}
