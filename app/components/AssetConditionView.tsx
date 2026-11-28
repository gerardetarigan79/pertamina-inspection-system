"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Info } from "lucide-react";
import { CONDITIONS, CONDITION_RULE, SEVERITY, buildAssetConditions, type Condition } from "../lib/condition";
import { formatDate, periodStart } from "../lib/dates";
import type { RegisteredAsset } from "../lib/types";
import { PARAMS, type ParamKey } from "../lib/params";
import { useInspectionSource, useProductionSource } from "../lib/useSources";
import LineChart from "./LineChart";

const fmt = (n: number, d: number) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const ALL_CONDITIONS: Condition[] = [...CONDITIONS, "No data"];
const pillClass = (c: Condition) => c.toLowerCase().replace(" ", "-");

function Pill({ condition }: { condition: Condition }) {
  return <span className={`status-pill cond-pill ${pillClass(condition)}`}><i />{condition}</span>;
}

type Props = { assets: RegisteredAsset[]; assetsLoading: boolean; assetsError: string; department: string; period: string; notify: (m: string) => void; initialCondition: string; onBack: () => void };

export default function AssetConditionView({ assets: registeredAssets, assetsLoading, assetsError, department, period, notify, initialCondition, onBack }: Props) {
  const insp = useInspectionSource(notify);
  const prod = useProductionSource(notify);
  const [filter, setFilter] = useState<string>(initialCondition);
  const [pick, setPick] = useState("");
  const [param, setParam] = useState<ParamKey>("pressure");

  const loading = assetsLoading || !insp.ready || !prod.ready || insp.syncing || prod.syncing;
  const sourceError = insp.error || prod.error;

  const assets = useMemo(
    () => buildAssetConditions(insp.state.records, registeredAssets).filter(a => department === "All departments" || a.asset.department === department),
    [insp.state.records, registeredAssets, department],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of assets) c[a.condition] = (c[a.condition] ?? 0) + 1;
    return c;
  }, [assets]);
  const rows = useMemo(
    () => assets
      .filter(a => filter === "All" || a.condition === filter)
      .sort((a, b) => SEVERITY[a.condition] - SEVERITY[b.condition] || (b.wallLossPct ?? 0) - (a.wallLossPct ?? 0) || a.asset.id.localeCompare(b.asset.id)),
    [assets, filter],
  );
  const selected = rows.find(a => a.asset.id === pick) ?? rows[0];

  const meta = PARAMS.find(p => p.key === param)!;
  const start = periodStart(period);
  const series = useMemo(
    () => !selected ? [] : prod.state.records
      .filter(r => r.assetId === selected.asset.id && r.date >= start)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(r => ({ date: r.date, value: r[param] })),
    [prod.state.records, selected, start, param],
  );
  const latestProd = useMemo(() => {
    if (!selected) return null;
    return prod.state.records.filter(r => r.assetId === selected.asset.id).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  }, [prod.state.records, selected]);

  const toggle = (c: string) => setFilter(filter === c ? "All" : c);

  return (
    <>
      <button className="back-link" onClick={onBack}><ArrowLeft size={14} /> Back to overview</button>

      {assetsError && <div className="sync-error" role="alert">{assetsError}</div>}
      {sourceError && <div className="sync-error" role="alert">Unable to load inspection or production records from Neon: {sourceError}</div>}
      <div className="rule-note">
        <Info size={15} />
        <div>
          <strong>Condition screening logic (provisional; requires engineering approval)</strong>
          <span>
            Worst wall loss at the latest available inspection: Healthy &lt; {CONDITION_RULE.monitoring}% · Monitoring {CONDITION_RULE.monitoring}–{CONDITION_RULE.attention}% · Attention {CONDITION_RULE.attention}–{CONDITION_RULE.critical}% · Critical ≥ {CONDITION_RULE.critical}%. These thresholds are provisional and require engineering approval. This view uses the {registeredAssets.length} assets currently returned by Neon. Pipeline inspection records are not included in the SAP inspection endpoint.
          </span>
        </div>
      </div>

      <div className="cond-cards">
        {ALL_CONDITIONS.map(c => (
          <button key={c} className={`cond-card ${pillClass(c)} ${filter === c ? "selected" : ""}`} aria-pressed={filter === c} onClick={() => toggle(c)}>
            <span className="cond-card-label"><i />{c}</span>
            <strong>{loading ? "…" : counts[c] ?? 0}</strong>
            <small>{(counts[c] ?? 0) === 1 ? "asset" : "assets"}</small>
          </button>
        ))}
      </div>

      <section className="panel table-panel">
        <div className="panel-heading table-heading">
          <div><div className="panel-kicker">ASSET CONDITION</div><h2>{filter === "All" ? "All assets" : `${filter} assets`}</h2><p>Worst findings first. Select an asset to see its thickness history and operating context.</p></div>
          {filter !== "All" && <button className="button button-outline" onClick={() => setFilter("All")}>Show all assets</button>}
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>ASSET / ASSET ID</th><th>DISCIPLINE</th><th>CONDITION</th><th className="num-h">LOWEST THICKNESS (MM)</th><th className="num-h">WALL LOSS</th><th className="num-h">CORROSION RATE (MM/YR)</th><th>LAST INSPECTION</th></tr></thead>
            <tbody>
              {rows.map(a => (
                <tr key={a.asset.id} className={`clickable ${selected?.asset.id === a.asset.id ? "row-selected" : ""}`} onClick={() => setPick(a.asset.id)} tabIndex={0} onKeyDown={e => { if (e.key === "Enter") setPick(a.asset.id); }} aria-selected={selected?.asset.id === a.asset.id}>
                  <td><div className="asset-name">{a.asset.name}</div><div className="asset-id">{a.asset.id}</div></td>
                  <td><span className="discipline-tag">{a.asset.department}</span></td>
                  <td><Pill condition={a.condition} /></td>
                  <td className="numeric">{a.minThicknessMm === null ? "—" : fmt(a.minThicknessMm, 2)}</td>
                  <td className="numeric">{a.wallLossPct === null ? "—" : `${fmt(a.wallLossPct, 1)}%`}</td>
                  <td className="numeric">{a.corrosionRate === null ? "—" : fmt(a.corrosionRate, 2)}</td>
                  <td className="date-cell">{a.latestDate ? formatDate(a.latestDate) : "No inspection data"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <div className="empty-state">{loading ? "Loading asset condition…" : "No assets in this condition for the selected department."}</div>}
        </div>
      </section>

      {selected && (
        <section className="panel detail-panel">
          <div className="panel-heading">
            <div><div className="panel-kicker">ASSET DETAIL</div><h2>{selected.asset.name}</h2><p>{selected.asset.id} · {selected.asset.area} · {selected.asset.type}</p></div>
            <Pill condition={selected.condition} />
          </div>

          {selected.condition === "No data" ? (
            <div className="rule-note inline"><Info size={15} /><div><span>No inspection records are currently available for this asset in the Neon inspection dataset. {selected.asset.department === "Pipeline" ? "Pipeline inspection imports are stored separately and are not yet mapped into this condition calculation." : "The SAP PM connector is not configured; no simulated inspection records are used."}</span></div></div>
          ) : (
            <>
              <div className="stat-strip">
                <div><span>Lowest thickness ({selected.latestDate && formatDate(selected.latestDate)})</span><strong>{fmt(selected.minThicknessMm!, 2)} mm</strong></div>
                <div><span>Nominal thickness</span><strong>{fmt(selected.nominalMm!, 2)} mm</strong></div>
                <div><span>Worst wall loss</span><strong>{fmt(selected.wallLossPct!, 1)}%</strong></div>
                <div><span>Corrosion rate (worst TML)</span><strong>{selected.corrosionRate === null ? "—" : `${fmt(selected.corrosionRate, 2)} mm/yr`}</strong></div>
              </div>
            </>
          )}

          <div className="detail-grid">
            {selected.condition !== "No data" && (
              <div className="sub-panel">
                <h3>Lowest thickness per inspection</h3>
                <p>mm, across all TMLs of each campaign</p>
                <LineChart points={selected.history} unit="mm" digits={2} />
              </div>
            )}
            <div className="sub-panel">
              <h3>Operating context · {meta.label}</h3>
              <p>{latestProd ? `Latest ${fmt(latestProd[param], meta.digits)} ${meta.unit} on ${formatDate(latestProd.date)}` : "No production data for this asset"}</p>
              <div className="param-tabs compact" role="tablist">
                {PARAMS.map(p => <button key={p.key} role="tab" aria-selected={p.key === param} className={p.key === param ? "active" : ""} onClick={() => setParam(p.key)}>{p.label}</button>)}
              </div>
              <LineChart points={series} unit={meta.unit} digits={meta.digits} />
            </div>
          </div>

          {selected.readings.length > 0 && (
            <div className="table-scroll tml-table">
              <table>
                <thead><tr><th>TML (LATEST INSPECTION)</th><th className="num-h">NOMINAL (MM)</th><th className="num-h">MEASURED (MM)</th><th className="num-h">WALL LOSS</th><th>CORROSION TYPE</th></tr></thead>
                <tbody>
                  {selected.readings.map(r => (
                    <tr key={r.tml}>
                      <td>{r.tml}</td><td className="numeric">{fmt(r.nominalMm, 2)}</td><td className="numeric strong-cell">{fmt(r.measuredMm, 2)}</td><td className="numeric">{fmt(r.lossPct, 1)}%</td>
                      <td><span className="discipline-tag">{r.corrosionType}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
