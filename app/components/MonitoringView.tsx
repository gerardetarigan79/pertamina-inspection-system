"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { Activity, Check, ChevronDown, Database, Droplets, Info, Plus, Scale, Search, Trash2, X } from "lucide-react";
import { ASSETS, getAsset } from "../lib/assets";
import { buildAssetConditions } from "../lib/condition";
import { APP_TODAY, formatDate } from "../lib/dates";
import {
  RATE_UNITS, WEIGHT_UNITS, buildRecord, emptyForm, lossRateMgPerDay, parseNumber, validate, weightLossMg,
  type FormErrors, type FormValues, type RateUnit, type WeightUnit,
} from "../lib/monitoring";
import { useInspectionSource } from "../lib/useSources";
import { useMonitoringStore } from "../lib/useMonitoringStore";
import LineChart from "./LineChart";
import Pager from "./Pager";

const PAGE_SIZE = 10;
const fmt = (n: number, d: number) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const SERIES = [
  { key: "loss", label: "Coupon weight loss", unit: "mg/day", digits: 2 },
  { key: "rate", label: "Injection rate", unit: "L/day", digits: 1 },
  { key: "volume", label: "Injected volume", unit: "L", digits: 1 },
] as const;
type SeriesKey = (typeof SERIES)[number]["key"];

function Field({ label, error, hint, children, htmlFor, required }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor: string; required?: boolean }) {
  return (
    <div className={`field ${error ? "has-error" : ""}`}>
      <label htmlFor={htmlFor}>{label}{required && <b aria-hidden> *</b>}</label>
      {children}
      {error ? <span className="field-error" role="alert">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

export default function MonitoringView({ department, notify }: { department: string; notify: (m: string) => void }) {
  const { records, ready, add, remove } = useMonitoringStore();
  const insp = useInspectionSource(notify);
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${uid}-${name}`;

  const [form, setForm] = useState<FormValues>(emptyForm());
  const [submitted, setSubmitted] = useState(false);
  const [seriesKey, setSeriesKey] = useState<SeriesKey>("loss");
  const [assetPick, setAssetPick] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const errors: FormErrors = submitted ? validate(form, records) : {};
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setForm(f => ({ ...f, [key]: value }));

  // Live preview of what will be stored, in standard units.
  const preview = useMemo(() => {
    const f = WEIGHT_UNITS[form.weightUnit];
    const initial = parseNumber(form.initial) * f, retrieved = parseNumber(form.retrieved) * f, days = parseNumber(form.exposureDays);
    const rate = parseNumber(form.rateValue) * RATE_UNITS[form.rateUnit];
    const lossMg = (initial - retrieved) * 1000;
    return {
      lossMg: Number.isFinite(lossMg) ? lossMg : null,
      lossRate: Number.isFinite(lossMg) && days >= 1 ? lossMg / days : null,
      rateLpd: Number.isFinite(rate) ? rate : null,
    };
  }, [form]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const found = validate(form, records);
    if (Object.keys(found).length) {
      const first = (Object.keys(found) as (keyof FormValues)[])[0];
      document.getElementById(id(first))?.focus();
      return;
    }
    try {
      await add(buildRecord(form));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to save monitoring record to Neon.");
      return;
    }
    const hidden = department !== "All departments" && getAsset(form.assetId)?.department !== department;
    notify(`Monitoring record saved for ${form.assetId}.${hidden ? " It is hidden by the current department filter." : ""}`);
    setForm({ ...emptyForm(form.assetId), date: form.date, weightUnit: form.weightUnit, rateUnit: form.rateUnit, inhibitor: form.inhibitor });
    setSubmitted(false);
    setPage(1);
  };

  const scoped = useMemo(() => records.filter(r => department === "All departments" || getAsset(r.assetId)?.department === department), [records, department]);
  const assetIds = useMemo(() => [...new Set(scoped.map(r => r.assetId))].sort(), [scoped]);
  // Until the user picks one, show the asset whose latest coupon loss rate is highest.
  const defaultAsset = useMemo(() => {
    const latest = new Map<string, (typeof scoped)[number]>();
    for (const r of scoped) { const p = latest.get(r.assetId); if (!p || r.date > p.date) latest.set(r.assetId, r); }
    let best = "", bestRate = -Infinity;
    for (const r of latest.values()) { const v = lossRateMgPerDay(r); if (v > bestRate) { bestRate = v; best = r.assetId; } }
    return best;
  }, [scoped]);
  const selected = assetIds.includes(assetPick) ? assetPick : defaultAsset || assetIds[0] || "";
  const selectedAsset = getAsset(selected);
  const meta = SERIES.find(s => s.key === seriesKey)!;

  const assetRecords = useMemo(() => scoped.filter(r => r.assetId === selected).sort((a, b) => a.date.localeCompare(b.date)), [scoped, selected]);
  const points = useMemo(
    () => assetRecords.map(r => ({ date: r.date, value: seriesKey === "loss" ? lossRateMgPerDay(r) : seriesKey === "rate" ? r.injectionRateLpd : r.injectedL })),
    [assetRecords, seriesKey],
  );
  const assetStats = useMemo(() => {
    if (!assetRecords.length) return null;
    const first = assetRecords[0], last = assetRecords[assetRecords.length - 1];
    const firstLoss = lossRateMgPerDay(first), lastLoss = lossRateMgPerDay(last);
    const avgRate = assetRecords.reduce((s, r) => s + r.injectionRateLpd, 0) / assetRecords.length;
    return { lastLoss, change: firstLoss > 0 ? ((lastLoss - firstLoss) / firstLoss) * 100 : null, lastRate: last.injectionRateLpd, avgRate, since: first.date, count: assetRecords.length };
  }, [assetRecords]);

  const inspection = useMemo(() => buildAssetConditions(insp.state.records).find(a => a.asset.id === selected), [insp.state.records, selected]);

  const summary = useMemo(() => {
    const latest = new Map<string, (typeof scoped)[number]>();
    for (const r of scoped) { const p = latest.get(r.assetId); if (!p || r.date > p.date) latest.set(r.assetId, r); }
    const items = [...latest.values()];
    const top = items.reduce<(typeof items)[number] | null>((m, r) => (!m || lossRateMgPerDay(r) > lossRateMgPerDay(m) ? r : m), null);
    const avgRate = items.length ? items.reduce((s, r) => s + r.injectionRateLpd, 0) / items.length : null;
    return { top, avgRate };
  }, [scoped]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped
      .filter(r => !q || r.assetId.toLowerCase().includes(q) || r.couponId.toLowerCase().includes(q) || (getAsset(r.assetId)?.name.toLowerCase().includes(q) ?? false))
      .sort((a, b) => b.date.localeCompare(a.date) || a.assetId.localeCompare(b.assetId));
  }, [scoped, query]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = rows.slice((current - 1) * PAGE_SIZE, (current - 1) * PAGE_SIZE + PAGE_SIZE);

  return (
    <>
      <section className="panel form-panel">
        <div className="panel-heading">
          <div><div className="panel-kicker">NEW READING</div><h2>Log a corrosion monitoring reading</h2><p>Coupon weights and inhibitor injection in one validated form, replacing the standalone Excel entry (US-08)</p></div>
          <span className="source-count">REQUIRED *</span>
        </div>
        <form onSubmit={submit} noValidate>
          <div className="form-grid">
            <Field label="Asset" htmlFor={id("assetId")} error={errors.assetId} required>
              <select id={id("assetId")} value={form.assetId} onChange={e => set("assetId", e.target.value)} aria-invalid={!!errors.assetId}>
                <option value="">Select asset…</option>
                {ASSETS.map(a => <option key={a.id} value={a.id}>{a.id} — {a.name}</option>)}
              </select>
            </Field>
            <Field label="Reading date" htmlFor={id("date")} error={errors.date} required>
              <input id={id("date")} type="date" max={APP_TODAY} value={form.date} onChange={e => set("date", e.target.value)} aria-invalid={!!errors.date} />
            </Field>
            <Field label="Coupon ID" htmlFor={id("couponId")} error={errors.couponId} hint="e.g. CC-PL-001-11" required>
              <input id={id("couponId")} type="text" value={form.couponId} onChange={e => set("couponId", e.target.value)} aria-invalid={!!errors.couponId} maxLength={40} />
            </Field>
            <Field label="Exposure (days)" htmlFor={id("exposureDays")} error={errors.exposureDays} hint="Time the coupon stayed in service" required>
              <input id={id("exposureDays")} type="text" inputMode="numeric" value={form.exposureDays} onChange={e => set("exposureDays", e.target.value)} aria-invalid={!!errors.exposureDays} />
            </Field>

            <Field label="Initial coupon weight" htmlFor={id("initial")} error={errors.initial} required>
              <div className="input-unit">
                <input id={id("initial")} type="text" inputMode="decimal" value={form.initial} onChange={e => set("initial", e.target.value)} aria-invalid={!!errors.initial} />
                <select aria-label="Weight unit" value={form.weightUnit} onChange={e => set("weightUnit", e.target.value as WeightUnit)}>{Object.keys(WEIGHT_UNITS).map(u => <option key={u}>{u}</option>)}</select>
              </div>
            </Field>
            <Field label="Retrieved coupon weight" htmlFor={id("retrieved")} error={errors.retrieved} hint="Same unit as the initial weight" required>
              <div className="input-unit">
                <input id={id("retrieved")} type="text" inputMode="decimal" value={form.retrieved} onChange={e => set("retrieved", e.target.value)} aria-invalid={!!errors.retrieved} />
                <span className="unit-static">{form.weightUnit}</span>
              </div>
            </Field>
            <Field label="Inhibitor product" htmlFor={id("inhibitor")} hint="Optional">
              <input id={id("inhibitor")} type="text" value={form.inhibitor} onChange={e => set("inhibitor", e.target.value)} maxLength={60} />
            </Field>
            <Field label="Inhibitor injected (L)" htmlFor={id("injectedL")} error={errors.injectedL} required>
              <input id={id("injectedL")} type="text" inputMode="decimal" value={form.injectedL} onChange={e => set("injectedL", e.target.value)} aria-invalid={!!errors.injectedL} />
            </Field>

            <Field label="Measured injection rate" htmlFor={id("rateValue")} error={errors.rateValue} hint="Converted to L/day when saved" required>
              <div className="input-unit">
                <input id={id("rateValue")} type="text" inputMode="decimal" value={form.rateValue} onChange={e => set("rateValue", e.target.value)} aria-invalid={!!errors.rateValue} />
                <select aria-label="Injection rate unit" value={form.rateUnit} onChange={e => set("rateUnit", e.target.value as RateUnit)}>{Object.keys(RATE_UNITS).map(u => <option key={u}>{u}</option>)}</select>
              </div>
            </Field>
            <Field label="Notes" htmlFor={id("notes")} hint="Optional">
              <input id={id("notes")} type="text" value={form.notes} onChange={e => set("notes", e.target.value)} maxLength={200} />
            </Field>
            <div className="form-preview" aria-live="polite">
              <span>Calculated on save</span>
              <div>
                <p><b>{preview.lossMg === null ? "—" : `${fmt(preview.lossMg, 1)} mg`}</b><small>Coupon weight loss</small></p>
                <p><b>{preview.lossRate === null ? "—" : `${fmt(preview.lossRate, 2)} mg/day`}</b><small>Coupon loss rate</small></p>
                <p><b>{preview.rateLpd === null ? "—" : `${fmt(preview.rateLpd, 1)} L/day`}</b><small>Injection rate (standard unit)</small></p>
              </div>
            </div>
          </div>
          {submitted && Object.keys(errors).length > 0 && <div className="sync-error" role="alert"><Info size={14} /> Please fix {Object.keys(errors).length} {Object.keys(errors).length === 1 ? "field" : "fields"} before saving.</div>}
          <div className="form-actions">
            <button type="button" className="button button-quiet" onClick={() => { setForm(emptyForm()); setSubmitted(false); }}><X size={15} /> Clear</button>
            <button type="submit" className="button button-primary"><Plus size={16} /> Save record</button>
          </div>
        </form>
      </section>

      <div className="metric-grid">
        <div className="metric-card"><div className="metric-top"><span>Monitoring records</span><span className="metric-icon blue"><Database size={18} /></span></div><div className="metric-value">{scoped.length}</div><div className="metric-change">{scoped.filter(r => r.source === "Form").length} added through the form</div></div>
        <div className="metric-card"><div className="metric-top"><span>Assets monitored</span><span className="metric-icon green"><Activity size={18} /></span></div><div className="metric-value">{assetIds.length}</div><div className="metric-change">linked by asset_id</div></div>
        <div className="metric-card"><div className="metric-top"><span>Highest coupon loss rate</span><span className="metric-icon amber"><Scale size={18} /></span></div><div className="metric-value">{summary.top ? fmt(lossRateMgPerDay(summary.top), 2) : "—"}<small className="metric-unit"> mg/day</small></div><div className="metric-change">{summary.top ? `${summary.top.assetId} · latest reading` : "no data"}</div></div>
        <div className="metric-card"><div className="metric-top"><span>Average injection rate</span><span className="metric-icon violet"><Droplets size={18} /></span></div><div className="metric-value">{summary.avgRate === null ? "—" : fmt(summary.avgRate, 1)}<small className="metric-unit"> L/day</small></div><div className="metric-change">latest reading per asset</div></div>
      </div>

      <section className="panel chart-panel">
        <div className="panel-heading">
          <div><div className="panel-kicker">MONITORING TREND</div><h2>{selectedAsset ? selectedAsset.name : "Corrosion monitoring"}</h2><p>{selectedAsset ? `${selectedAsset.id} · ${selectedAsset.area} · ${meta.label} (${meta.unit}) · all readings` : "No monitoring readings yet"}</p></div>
          <label className="select-wrap asset-select"><Database size={14} />
            <select value={selected} onChange={e => setAssetPick(e.target.value)} aria-label="Select asset" disabled={!assetIds.length}>
              {assetIds.map(a => <option key={a} value={a}>{a} — {getAsset(a)?.name}</option>)}
            </select><ChevronDown size={13} />
          </label>
        </div>
        <div className="param-tabs" role="tablist">
          {SERIES.map(s => <button key={s.key} role="tab" aria-selected={s.key === seriesKey} className={s.key === seriesKey ? "active" : ""} onClick={() => setSeriesKey(s.key)}>{s.label}</button>)}
        </div>
        {assetStats ? (
          <>
            <div className="stat-strip">
              <div><span>Latest coupon loss rate</span><strong>{fmt(assetStats.lastLoss, 2)} mg/day</strong></div>
              <div><span>Change since first reading ({formatDate(assetStats.since)})</span><strong className={assetStats.change !== null && assetStats.change > 0 ? "up-bad" : ""}>{assetStats.change === null ? "—" : `${assetStats.change > 0 ? "+" : ""}${fmt(assetStats.change, 0)}%`}</strong></div>
              <div><span>Latest injection rate</span><strong>{fmt(assetStats.lastRate, 1)} L/day</strong></div>
              <div><span>Average injection rate ({assetStats.count} readings)</span><strong>{fmt(assetStats.avgRate, 1)} L/day</strong></div>
            </div>
            <LineChart points={points} unit={meta.unit} digits={meta.digits} />
            <div className="rule-note inline">
              <Info size={15} />
              <div>
                <strong>Inspection context (SAP)</strong>
                <span>
                  {inspection && inspection.condition !== "No data"
                    ? <>Lowest thickness {fmt(inspection.minThicknessMm!, 2)} mm of {fmt(inspection.nominalMm!, 2)} mm nominal ({fmt(inspection.wallLossPct!, 1)}% wall loss, inspected {formatDate(inspection.latestDate!)})
                      {inspection.corrosionRate !== null && <> · thickness corrosion rate {fmt(inspection.corrosionRate, 2)} mm/yr between inspections</>}. Compare with the coupon trend above.</>
                    : insp.ready ? "No SAP inspection records for this asset yet, so there is nothing to compare against." : "Loading inspection records…"}
                </span>
              </div>
            </div>
          </>
        ) : <div className="empty-state">{ready ? "No monitoring readings for this department. Log one with the form above." : "Loading…"}</div>}
      </section>

      <section className="panel table-panel">
        <div className="panel-heading table-heading"><div><div className="panel-kicker">MONITORING LOG</div><h2>Coupon and inhibitor readings</h2><p>All readings, newest first. The period filter does not apply because readings are logged periodically.</p></div></div>
        <div className="table-toolbar">
          <div className="search-box"><Search size={15} /><input placeholder="Search asset or coupon ID..." value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} />{query && <button onClick={() => { setQuery(""); setPage(1); }} aria-label="Clear search"><X size={14} /></button>}</div>
          <span className="result-count">{rows.length} records</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>DATE</th><th>ASSET / ASSET ID</th><th>COUPON</th><th className="num-h">INITIAL (G)</th><th className="num-h">RETRIEVED (G)</th><th className="num-h">EXPOSURE (D)</th><th className="num-h">LOSS (MG)</th><th className="num-h">LOSS RATE (MG/DAY)</th><th>INHIBITOR</th><th className="num-h">INJECTED (L)</th><th className="num-h">INJ. RATE (L/DAY)</th><th>SOURCE</th><th /></tr></thead>
            <tbody>
              {visible.map(r => { const a = getAsset(r.assetId); return (
                <tr key={r.id}>
                  <td className="date-cell">{formatDate(r.date)}</td>
                  <td><div className="asset-name">{a?.name}</div><div className="asset-id">{r.assetId}</div></td>
                  <td>{r.couponId}</td>
                  <td className="numeric">{fmt(r.couponInitialG, 3)}</td><td className="numeric">{fmt(r.couponFinalG, 3)}</td><td className="numeric">{r.exposureDays}</td>
                  <td className="numeric">{fmt(weightLossMg(r), 1)}</td><td className="numeric strong-cell">{fmt(lossRateMgPerDay(r), 2)}</td>
                  <td>{r.inhibitor || "—"}</td><td className="numeric">{fmt(r.injectedL, 1)}</td><td className="numeric">{fmt(r.injectionRateLpd, 1)}</td>
                  <td><span className={`discipline-tag ${r.source === "Form" ? "tag-new" : ""}`}>{r.source}</span></td>
                  <td className="row-actions">
                    {confirmId === r.id ? (
                      <>
                        <button className="mini-button danger" onClick={async () => { try { await remove(r.id); setConfirmId(null); notify(`Deleted the reading for ${r.assetId} on ${formatDate(r.date)}.`); } catch (error) { notify(error instanceof Error ? error.message : "Unable to delete monitoring record."); } }}><Check size={13} /> Delete</button>
                        <button className="mini-button" onClick={() => setConfirmId(null)}>Cancel</button>
                      </>
                    ) : <button className="row-more" onClick={() => setConfirmId(r.id)} aria-label={`Delete reading for ${r.assetId} on ${formatDate(r.date)}`}><Trash2 size={15} /></button>}
                  </td>
                </tr>); })}
            </tbody>
          </table>
          {!visible.length && <div className="empty-state">{!ready ? "Loading…" : query ? "No readings match your search." : "No readings logged yet. Use the form above to add the first one."}</div>}
        </div>
        <div className="table-footer"><span>Showing <strong>{visible.length}</strong> of {rows.length} records <span className="demo-note">· Records are stored in the shared Neon database</span></span><Pager page={current} pageCount={pageCount} onChange={setPage} /></div>
      </section>
    </>
  );
}
