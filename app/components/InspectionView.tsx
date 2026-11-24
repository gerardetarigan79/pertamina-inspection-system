"use client";

import { useMemo, useState } from "react";
import { Activity, ArrowDownRight, Database, Layers3, Ruler, Search, ShieldCheck, X } from "lucide-react";
import { getAsset } from "../lib/assets";
import { formatDate, periodStart } from "../lib/dates";
import type { InspectionRecord } from "../lib/types";
import { useInspectionSource } from "../lib/useSources";
import Pager from "./Pager";
import SyncCard from "./SyncCard";

const PAGE_SIZE = 12;

const fmt = (n: number, d: number) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const wallLoss = (r: InspectionRecord) => ((r.nominalMm - r.measuredMm) / r.nominalMm) * 100;

export default function InspectionView({ department, period, notify }: { department: string; period: string; notify: (m: string) => void }) {
  const { state, ready, syncing, error, sync } = useInspectionSource(notify);
  const [assetFilter, setAssetFilter] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  // SAP only holds Surface Facility inspections; pipelines come from their own database.
  const pipelineOnly = department === "Pipeline";
  const all = useMemo(() => (pipelineOnly ? [] : state.records), [state.records, pipelineOnly]);
  const start = periodStart(period);
  const scoped = useMemo(() => all.filter(r => r.date >= start), [all, start]);

  // Consolidated view per asset_id (full history, independent of the period filter).
  const perAsset = useMemo(() => {
    const groups = new Map<string, InspectionRecord[]>();
    for (const r of all) groups.set(r.assetId, [...(groups.get(r.assetId) ?? []), r]);
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, recs]) => {
      const latestDate = recs.reduce((m, r) => (r.date > m ? r.date : m), "");
      const latest = recs.filter(r => r.date === latestDate);
      const weakest = latest.reduce((m, r) => (r.measuredMm < m.measuredMm ? r : m));
      return { id, count: recs.length, latestDate, weakest };
    });
  }, [all]);

  const summary = useMemo(() => {
    if (!scoped.length) return null;
    const lowest = scoped.reduce((m, r) => (r.measuredMm < m.measuredMm ? r : m));
    const worst = scoped.reduce((m, r) => (wallLoss(r) > wallLoss(m) ? r : m));
    return { assets: new Set(scoped.map(r => r.assetId)).size, lowest, worst };
  }, [scoped]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped
      .filter(r => (!assetFilter || r.assetId === assetFilter) && (!q || r.assetId.toLowerCase().includes(q) || (getAsset(r.assetId)?.name.toLowerCase().includes(q) ?? false)))
      .sort((a, b) => b.date.localeCompare(a.date) || a.assetId.localeCompare(b.assetId) || a.tml.localeCompare(b.tml));
  }, [scoped, assetFilter, query]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const emptyText = !ready || syncing ? "Loading…" : pipelineOnly ? "SAP holds Surface Facility inspections only. Pipeline inspection records come from the pipeline database (US-04)." : assetFilter && !query ? "No inspections for this asset in the selected period. Try a longer period." : "No inspection records match your filters in the selected period.";

  return (
    <>
      <SyncCard
        icon={<Database size={19} />}
        title="SAP · Surface Facility inspection"
        description="Wall thickness and corrosion dimensions per TML, linked to asset_id."
        result={state.result}
        recordCount={state.records.length}
        syncing={syncing}
        ready={ready}
        error={error}
        onSync={() => void sync(false)}
      />

      <div className="metric-grid">
        <div className="metric-card"><div className="metric-top"><span>Assets inspected</span><span className="metric-icon blue"><Layers3 size={18} /></span></div><div className="metric-value">{summary?.assets ?? 0}</div><div className="metric-change">{period.toLowerCase()}</div></div>
        <div className="metric-card"><div className="metric-top"><span>Thickness measurements</span><span className="metric-icon green"><ShieldCheck size={18} /></span></div><div className="metric-value">{scoped.length}</div><div className="metric-change">TML readings stored</div></div>
        <div className="metric-card"><div className="metric-top"><span>Lowest measured thickness</span><span className="metric-icon amber"><Ruler size={18} /></span></div><div className="metric-value">{summary ? fmt(summary.lowest.measuredMm, 2) : "—"}<small className="metric-unit"> mm</small></div><div className="metric-change">{summary ? `${summary.lowest.assetId} · ${summary.lowest.tml}` : "no data in period"}</div></div>
        <div className="metric-card"><div className="metric-top"><span>Highest wall loss</span><span className="metric-icon violet"><Activity size={18} /></span></div><div className="metric-value">{summary ? fmt(wallLoss(summary.worst), 1) : "—"}<small className="metric-unit"> %</small></div><div className="metric-change"><span className="trend-down"><ArrowDownRight size={14} /></span>{summary ? `${summary.worst.assetId} · ${summary.worst.tml}` : "no data in period"}</div></div>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div><div className="panel-kicker">CONSOLIDATED BY ASSET_ID</div><h2>Surface facility assets</h2><p>Latest campaign per asset. Select an asset to filter the records below.</p></div>
          {assetFilter && <button className="button button-outline" onClick={() => { setAssetFilter(""); setPage(1); }}><X size={14} /> Clear filter</button>}
        </div>
        {perAsset.length ? (
          <div className="asset-cards">
            {perAsset.map(a => { const info = getAsset(a.id); const nominal = a.weakest.nominalMm; return (
              <button key={a.id} className={`asset-card ${assetFilter === a.id ? "selected" : ""}`} aria-pressed={assetFilter === a.id} onClick={() => { setAssetFilter(assetFilter === a.id ? "" : a.id); setPage(1); }}>
                <span className="asset-card-top"><span className="discipline-tag">{info?.type}</span><span className="asset-id">{a.id}</span></span>
                <strong>{info?.name}</strong>
                <span className="asset-card-value">{fmt(a.weakest.measuredMm, 2)}<small> mm min · nominal {fmt(nominal, 2)}</small></span>
                <span className="asset-card-meta">Wall loss {fmt(wallLoss(a.weakest), 1)}% · {a.count} measurements · last {formatDate(a.latestDate)}</span>
              </button>); })}
          </div>
        ) : <div className="empty-state">{emptyText}</div>}
      </section>

      <section className="panel table-panel table-gap">
        <div className="panel-heading table-heading"><div><div className="panel-kicker">INSPECTION RECORDS</div><h2>Wall thickness and corrosion findings</h2><p>Stored once per asset_id, inspection date and TML; re-syncing never creates duplicates</p></div></div>
        <div className="table-toolbar">
          <div className="search-box"><Search size={15} /><input placeholder="Search asset name or ID..." value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} />{query && <button onClick={() => { setQuery(""); setPage(1); }} aria-label="Clear search"><X size={14} /></button>}</div>
          {assetFilter && <span className="chip blue">Asset: {assetFilter}</span>}
          <span className="result-count">{rows.length} records</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>INSPECTION DATE</th><th>ASSET / ASSET ID</th><th>TML</th><th>METHOD</th><th className="num-h">NOMINAL (MM)</th><th className="num-h">MEASURED (MM)</th><th className="num-h">WALL LOSS</th><th>CORROSION TYPE</th><th className="num-h">DEPTH × LENGTH × WIDTH (MM)</th><th>SAP NOTIF.</th></tr></thead>
            <tbody>
              {visible.map(r => { const a = getAsset(r.assetId); return (
                <tr key={`${r.assetId}|${r.date}|${r.tml}`}>
                  <td className="date-cell">{formatDate(r.date)}</td>
                  <td><div className="asset-name">{a?.name}</div><div className="asset-id">{r.assetId}</div></td>
                  <td>{r.tml}</td><td>{r.method}</td>
                  <td className="numeric">{fmt(r.nominalMm, 2)}</td><td className="numeric strong-cell">{fmt(r.measuredMm, 2)}</td><td className="numeric">{fmt(wallLoss(r), 1)}%</td>
                  <td><span className="discipline-tag">{r.corrosionType}</span></td>
                  <td className="numeric">{fmt(r.depthMm, 2)} × {r.lengthMm} × {r.widthMm}</td>
                  <td className="numeric">{r.notification}</td>
                </tr>); })}
            </tbody>
          </table>
          {!visible.length && <div className="empty-state">{emptyText}</div>}
        </div>
        <div className="table-footer"><span>Showing <strong>{visible.length}</strong> of {rows.length} records <span className="demo-note">· Shared Neon database · sample source records</span></span><Pager page={current} pageCount={pageCount} onChange={setPage} /></div>
      </section>
    </>
  );
}
