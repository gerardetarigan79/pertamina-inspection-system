import { getAsset } from "./assets";
import { APP_TODAY, addDays, formatDate } from "./dates";
import { round } from "./numbers";
import type { MonitoringRecord, RegisteredAsset } from "./types";

/** Standard units (data dictionary): coupon weight in g, injection in L and L/day. */
export const WEIGHT_UNITS = { g: 1, mg: 0.001 } as const;
export const RATE_UNITS = { "L/day": 1, "L/h": 24, "gal/day": 3.78541 } as const;
export type WeightUnit = keyof typeof WEIGHT_UNITS;
export type RateUnit = keyof typeof RATE_UNITS;

export type FormValues = {
  assetId: string; date: string; couponId: string; weightUnit: WeightUnit;
  initial: string; retrieved: string; exposureDays: string; inhibitor: string;
  injectedL: string; rateValue: string; rateUnit: RateUnit; notes: string;
};

export const emptyForm = (assetId = ""): FormValues => ({
  assetId, date: APP_TODAY, couponId: "", weightUnit: "g", initial: "", retrieved: "",
  exposureDays: "", inhibitor: "", injectedL: "", rateValue: "", rateUnit: "L/day", notes: "",
});

export function parseNumber(text: string): number {
  const t = text.trim().replace(",", ".");
  return t === "" || !/^-?\d*\.?\d+$/.test(t) ? NaN : Number(t);
}

export const weightLossMg = (r: MonitoringRecord) => (r.couponInitialG - r.couponFinalG) * 1000;
export const lossRateMgPerDay = (r: MonitoringRecord) => weightLossMg(r) / r.exposureDays;
export type FormErrors = Partial<Record<keyof FormValues, string>>;

export function validate(v: FormValues, existing: MonitoringRecord[], assets: readonly RegisteredAsset[]): FormErrors {
  const e: FormErrors = {};
  if (!v.assetId) e.assetId = "Select an asset from the register.";
  else if (!getAsset(assets, v.assetId)) e.assetId = "Asset ID is not in the asset register.";
  if (!v.date) e.date = "Date is required.";
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date) || addDays(v.date, 0) !== v.date) e.date = "Enter a valid date.";
  else if (v.date > APP_TODAY) e.date = `Date cannot be after today (${formatDate(APP_TODAY)}).`;
  const coupon = v.couponId.trim();
  if (!coupon) e.couponId = "Coupon ID is required.";
  else if (coupon.length > 30) e.couponId = "Coupon ID is too long (max 30 characters).";
  const f = WEIGHT_UNITS[v.weightUnit], initial = parseNumber(v.initial) * f, retrieved = parseNumber(v.retrieved) * f;
  if (Number.isNaN(initial)) e.initial = "Enter the initial weight as a number.";
  else if (initial <= 0) e.initial = "Initial weight must be greater than 0.";
  if (Number.isNaN(retrieved)) e.retrieved = "Enter the retrieved weight as a number.";
  else if (retrieved < 0) e.retrieved = "Retrieved weight cannot be negative.";
  else if (!Number.isNaN(initial) && retrieved > initial) e.retrieved = "Retrieved weight cannot exceed the initial weight. Check the value and unit.";
  const days = parseNumber(v.exposureDays);
  if (Number.isNaN(days) || !Number.isInteger(days)) e.exposureDays = "Enter whole days.";
  else if (days < 1 || days > 365) e.exposureDays = "Exposure must be between 1 and 365 days.";
  const injected = parseNumber(v.injectedL);
  if (Number.isNaN(injected)) e.injectedL = "Enter the injected volume in litres.";
  else if (injected < 0) e.injectedL = "Injected volume cannot be negative.";
  const rate = parseNumber(v.rateValue);
  if (Number.isNaN(rate)) e.rateValue = "Enter the measured injection rate as a number, e.g. 2.5.";
  else if (rate < 0) e.rateValue = "Injection rate cannot be negative.";
  if (!e.assetId && !e.date && !e.couponId && existing.some(r => r.assetId === v.assetId && r.date === v.date && r.couponId.toLowerCase() === coupon.toLowerCase())) {
    e.couponId = "A record for this asset, date and coupon already exists.";
  }
  return e;
}

export function buildRecord(v: FormValues): MonitoringRecord {
  const f = WEIGHT_UNITS[v.weightUnit];
  return {
    id: "", // The database assigns the canonical record ID on insert.
    assetId: v.assetId, date: v.date, couponId: v.couponId.trim(),
    couponInitialG: round(parseNumber(v.initial) * f, 4),
    couponFinalG: round(parseNumber(v.retrieved) * f, 4),
    exposureDays: parseNumber(v.exposureDays), inhibitor: v.inhibitor.trim(),
    injectedL: round(parseNumber(v.injectedL), 2),
    injectionRateLpd: round(parseNumber(v.rateValue) * RATE_UNITS[v.rateUnit], 2),
    notes: v.notes.trim(), source: "Form",
  };
}
