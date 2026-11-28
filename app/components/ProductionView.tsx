"use client";

import { useMemo, useState } from "react";
import { Activity, ChevronDown, Database, Droplets, Gauge, Search, X } from "lucide-react";
import { getAsset } from "../lib/assets";
import { formatDate, periodStart } from "../lib/dates";
import { PARAMS, type ParamKey } from "../lib/params";
import type { ProductionRecord, RegisteredAsset } from "../lib/types";
import { useProductionSource } from "../lib/useSources";
import LineChart from "./LineChart";
import Pager from "./Pager";
import SyncCard from "./SyncCard";

const PAGE_SIZE = 12;

const fmt = (n: number, d: number) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function ProductionView({ assets, department, period, notify }: { assets: RegisteredAsset[]; department: string; period: string; notify: (m: string) => void }) {
  const { state, ready, syncing, error, sync } = useProductionSource(notify);
  const [param, setParam] = useState<ParamKey>("pressure");
  const [assetPick, setAssetPick] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const start = periodStart(period);
  const scoped = useMemo(
    () => state.records.filter(r => r.date >= start && (department === "All departments" || getAsset(assets, r.assetId)?.department === department)),
    [state.records, start, department, assets],
  );
  const assetIds = useMemo(() => [...new Set(scoped.map(r => r.assetId))].sort(), [scoped]);
  const selected = assetIds.includes(assetPick) ? assetPick : assetIds[0] ?? "";
  const meta = PARAMS.find(p => p.key === param)!;

  const series = useMemo(
    () => scoped.filter(r => r.assetId === selected).sort((a, b) => a.date.localeCompare(b.date)).map(r => ({ date: r.date, value: r[param] })),
    [scoped, selected, param],
  );
  const stats = useMemo(() => {
    if (!series.length) return null;
    const v = series.map(s => s.value);
    return { min: Math.min(...v), max: Math.max(...v), avg: v.reduce((a, b) => a + b, 0) / v.length, latest: series[series.length - 1] };
  }, [series]);

  const summary = useMemo(() => {
    const latestByAsset = new Map<string, ProductionRecord>();
    for (const r of scoped) { const p = latestByAsset.get(r.assetId); if (!p || r.date > p.date) latestByAsset.set(r.assetId, r); }
    const avgP = scoped.length ? scoped.reduce((s, r) => s + r.pressure, 0) / scoped.length : null;
    const oil = [...latestByAsset.values()].reduce((s, r) => s + r.oil, 0);
    return { avgP, oil };
  }, [scoped]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped
      .filter(r => !q || r.assetId.toLowerCase().includes(q) || (getAsset(assets, r.assetId)?.name.toLowerCase().includes(q) ?? false))
      .sort((a, b) => b.date.localeCompare(a.date) || a.assetId.localeCompare(b.assetId));
  }, [scoped, query, assets]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const selectedAsset = getAsset(assets, selected);

  return (
    <>
      <SyncCard
        icon={<Gauge size={19} />}
        title="Production readings · Neon"
        description="Pressure, temperature and flowrate records currently stored in the Neon database."
        recordCount={state.records.length}
        syncing={syncing}
        ready={ready}
        error={error}
        onSync={() => void sync(false)}
      />

      <div className="metric-grid">
        <div className="metric-card"><div className="metric-top"><span>Assets reporting</span><span className="metric-icon blue"><Database size={18} /></span></div><div className="metric-value">{assetIds.length}</div><div className="metric-change">linked by asset_id</div></div>
        <div className="metric-card"><div className="metric-top"><span>Daily records in period</span><span className="metric-icon green"><Activity size={18} /></span></div><div className="metric-value">{scoped.length.toLocaleString("en-US")}</div><div className="metric-change">{period.toLowerCase()}</div></div>
        <div className="metric-card"><div className="metric-top"><span>Average pressure</span><span className="metric-icon violet"><Gauge size={18} /></span></div><div className="metric-value">{summary.avgP === null ? "—" : fmt(summary.avgP, 1)}<small className="metric-unit"> bar</small></div><div className="metric-change">across selected assets</div></div>
        <div className="metric-card"><div className="metric-top"><span>Oil rate, latest day</span><span className="metric-icon amber"><Droplets size={18} /></span></div><div className="metric-value">{scoped.length ? fmt(summary.oil, 0) : "—"}<small className="metric-unit"> BOPD</small></div><div className="metric-change">sum of latest reading per asset</div></div>
      </div>

      <section className="panel chart-panel">
        <div className="panel-heading">
          <div><div className="panel-kicker">OPERATING TREND</div><h2>{selectedAsset ? selectedAsset.name : "Operating parameters"}</h2><p>{selectedAsset ? `${selectedAsset.id} · ${selectedAsset.area} · ${meta.label} (${meta.unit})` : "No production data in the selected period"}</p></div>
          <label className="select-wrap asset-select"><Database size={14} />
            <select value={selected} onChange={e => setAssetPick(e.target.value)} aria-label="Select asset" disabled={!assetIds.length}>
              {assetIds.map(id => <option key={id} value={id}>{id} — {getAsset(assets, id)?.name}</option>)}
            </select><ChevronDown size={13} />
          </label>
        </div>
        <div className="param-tabs" role="tablist">
          {PARAMS.map(p => <button key={p.key} role="tab" aria-selected={p.key === param} className={p.key === param ? "active" : ""} onClick={() => setParam(p.key)}>{p.label}</button>)}
        </div>
        {stats ? (
          <>
            <div className="stat-strip">
              <div><span>Latest ({formatDate(stats.latest.date)})</span><strong>{fmt(stats.latest.value, meta.digits)} {meta.unit}</strong></div>
              <div><span>Average</span><strong>{fmt(stats.avg, meta.digits)} {meta.unit}</strong></div>
              <div><span>Minimum</span><strong>{fmt(stats.min, meta.digits)} {meta.unit}</strong></div>
              <div><span>Maximum</span><strong>{fmt(stats.max, meta.digits)} {meta.unit}</strong></div>
            </div>
            <LineChart points={series} unit={meta.unit} digits={meta.digits} />
          </>
        ) : <div className="empty-state">{ready && !syncing ? "No production data for this filter and period." : "Loading production data…"}</div>}
      </section>

      <section className="panel table-panel">
        <div className="panel-heading table-heading"><div><div className="panel-kicker">PRODUCTION DATA</div><h2>Daily operating parameters</h2><p>Records are stored once per asset_id and date; re-syncing never creates duplicates</p></div></div>
        <div className="table-toolbar">
          <div className="search-box"><Search size={15} /><input placeholder="Search asset name or ID..." value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} />{query && <button onClick={() => { setQuery(""); setPage(1); }} aria-label="Clear search"><X size={14} /></button>}</div>
          <span className="result-count">{rows.length.toLocaleString("en-US")} records</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>DATE</th><th>ASSET / ASSET ID</th><th>DISCIPLINE</th><th className="num-h">PRESSURE (BAR)</th><th className="num-h">TEMP (°C)</th><th className="num-h">GAS (MMSCFD)</th><th className="num-h">WATER (BWPD)</th><th className="num-h">OIL (BOPD)</th><th>SOURCE</th></tr></thead>
            <tbody>
              {visible.map(r => { const a = getAsset(assets, r.assetId); return (
                <tr key={`${r.assetId}|${r.date}`}>
                  <td className="date-cell">{formatDate(r.date)}</td>
                  <td><div className="asset-name">{a?.name}</div><div className="asset-id">{r.assetId}</div></td>
                  <td><span className="discipline-tag">{a?.department}</span></td>
                  <td className="numeric">{fmt(r.pressure, 1)}</td><td className="numeric">{fmt(r.temperature, 1)}</td><td className="numeric">{fmt(r.gas, 2)}</td><td className="numeric">{fmt(r.water, 0)}</td><td className="numeric">{fmt(r.oil, 0)}</td>
                  <td><span className="discipline-tag">{r.source}</span></td>
                </tr>); })}
            </tbody>
          </table>
          {!visible.length && <div className="empty-state">{ready && !syncing ? "No records match your filters." : "Loading…"}</div>}
        </div>
        <div className="table-footer"><span>Showing <strong>{visible.length}</strong> of {rows.length.toLocaleString("en-US")} records <span className="demo-note">· Records read from Neon</span></span><Pager page={current} pageCount={pageCount} onChange={setPage} /></div>
      </section>
    </>
  );
}
