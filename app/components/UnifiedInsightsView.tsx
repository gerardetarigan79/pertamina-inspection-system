"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import LineChart from "./LineChart";
import { Activity, AlertTriangle, FileSpreadsheet, Printer, Search, ShieldCheck, X } from "lucide-react";
import { buildAssetConditions, CONDITION_RULE, type AssetCondition } from "../lib/condition";
import type { InspectionRecord, RegisteredAsset } from "../lib/types";

type Asset = {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  material_type: string | null;
  area: string;
  department: string;
  nominal_thickness: number | null;
  latest_thickness: number | null;
  operating_pressure: number | null;
  condition: string | null;
  last_inspection_date: string | null;
};
type Inspection = InspectionRecord;
type Production = { assetId: string; date: string; pressure: number; temperature: number; gas: number; water: number; oil: number };

const dateLabel = (value: string) => new Date(value + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const csvCell = (value: unknown) => '"' + String(value ?? "").replace(/"/g, '""') + '"';
const formatNumber = (value: number | null | undefined, digits = 2) => value == null || !Number.isFinite(Number(value)) ? "—" : Number(value).toFixed(digits);

export default function UnifiedInsightsView({ department, notify }: { department: string; notify: (message: string) => void }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [production, setProduction] = useState<Production[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [assetQuery, setAssetQuery] = useState("");
  const [assetTypeFilter, setAssetTypeFilter] = useState("");
  const [materialFilter, setMaterialFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [assetResponse, inspectionResponse, productionResponse] = await Promise.all([
          fetch("/api/assets", { cache: "no-store" }),
          fetch("/api/inspections", { cache: "no-store" }),
          fetch("/api/production", { cache: "no-store" }),
        ]);
        if (!assetResponse.ok || !inspectionResponse.ok || !productionResponse.ok) {
          throw new Error("Unable to load consolidated database records.");
        }
        const [assetPayload, inspectionPayload, productionPayload] = await Promise.all([
          assetResponse.json(), inspectionResponse.json(), productionResponse.json(),
        ]);
        if (!assetPayload.success || !inspectionPayload.success || !productionPayload.success ||
          !Array.isArray(assetPayload.data) || !Array.isArray(inspectionPayload.records) || !Array.isArray(productionPayload.records)) {
          throw new Error("The database returned an incomplete response.");
        }
        if (live) {
          setAssets(assetPayload.data as Asset[]);
          setInspections(inspectionPayload.records as Inspection[]);
          setProduction(productionPayload.records as Production[]);
        }
      } catch (cause) {
        if (live) setError(cause instanceof Error ? cause.message : "Failed to load data.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, []);

  const assetTypeOptions = useMemo(
    () => [...new Set(assets.map(asset => asset.asset_type?.trim()).filter((value): value is string => Boolean(value)))].sort(),
    [assets],
  );
  const materialOptions = useMemo(
    () => [...new Set(assets.map(asset => asset.material_type?.trim()).filter((value): value is string => Boolean(value)))].sort(),
    [assets],
  );
  const dateRangeInvalid = Boolean(from && to && from > to);

  // US-09: all asset criteria are applied to the same register before records,
  // tables, charts and the risk list are derived from it.
  const filtered = useMemo(() => {
    const query = assetQuery.trim().toLowerCase();
    return assets.filter(asset =>
      (department === "All departments" || asset.department === department) &&
      (!query || asset.asset_id.toLowerCase().includes(query) || asset.asset_name.toLowerCase().includes(query)) &&
      (!assetTypeFilter || asset.asset_type === assetTypeFilter) &&
      (!materialFilter || asset.material_type === materialFilter),
    );
  }, [assets, department, assetQuery, assetTypeFilter, materialFilter]);

  const filteredIds = useMemo(() => new Set(filtered.map(asset => asset.asset_id)), [filtered]);
  const filteredInspections = useMemo(() => dateRangeInvalid ? [] : inspections.filter(record =>
    filteredIds.has(record.assetId) && (!from || record.date >= from) && (!to || record.date <= to),
  ), [inspections, filteredIds, from, to, dateRangeInvalid]);
  const filteredProduction = useMemo(() => dateRangeInvalid ? [] : production.filter(record =>
    filteredIds.has(record.assetId) && (!from || record.date >= from) && (!to || record.date <= to),
  ), [production, filteredIds, from, to, dateRangeInvalid]);

  const selectedAsset = filtered.find(asset => asset.asset_id === selected) ?? filtered[0];
  const assetInspections = useMemo(
    () => filteredInspections.filter(record => record.assetId === selectedAsset?.asset_id).sort((a, b) => a.date.localeCompare(b.date)),
    [filteredInspections, selectedAsset],
  );
  const assetProduction = useMemo(
    () => filteredProduction.filter(record => record.assetId === selectedAsset?.asset_id).sort((a, b) => a.date.localeCompare(b.date)),
    [filteredProduction, selectedAsset],
  );
  const thicknessTrend = useMemo(() => {
    const byDate = new Map<string, number[]>();
    for (const record of assetInspections) {
      const values = byDate.get(record.date) ?? [];
      values.push(Number(record.measuredMm));
      byDate.set(record.date, values);
    }
    return Array.from(byDate, ([date, values]) => ({ date, value: Math.min(...values) })).sort((a, b) => a.date.localeCompare(b.date));
  }, [assetInspections]);
  const pressureTrend = useMemo(
    () => assetProduction.map(record => ({ date: record.date, value: Number(record.pressure) })),
    [assetProduction],
  );

  const thicknessAxisMax = Math.max(5, Math.ceil(Math.max(
    0,
    ...inspections.flatMap(record => [Number(record.nominalMm), Number(record.measuredMm)]),
    ...assets.map(asset => Number(asset.nominal_thickness ?? 0)),
  ) / 5) * 5);
  const pressureAxisMax = Math.max(10, Math.ceil(Math.max(0, ...production.map(record => Number(record.pressure))) / 10) * 10);

  // US-07: derive flags from actual latest inspection measurements for the
  // selected filters/date range, using the project's existing provisional rule.
  const registeredAssets = useMemo<RegisteredAsset[]>(() => filtered.map(asset => ({
    id: asset.asset_id,
    name: asset.asset_name,
    area: asset.area ?? "—",
    department: asset.department,
    type: asset.asset_type,
    materialType: asset.material_type,
  })), [filtered]);
  const assetConditions = useMemo(
    () => buildAssetConditions(filteredInspections, registeredAssets),
    [filteredInspections, registeredAssets],
  );
  const alerts = useMemo(
    () => assetConditions
      .filter(condition => condition.condition === "Critical" || condition.condition === "Attention" || condition.condition === "Monitoring")
      .sort((a, b) => (b.wallLossPct ?? 0) - (a.wallLossPct ?? 0)),
    [assetConditions],
  );
  const highRiskCount = alerts.filter(item => item.condition === "Critical" || item.condition === "Attention").length;
  const selectedCondition = assetConditions.find(item => item.asset.id === selectedAsset?.asset_id);

  const clearFilters = () => {
    setAssetQuery("");
    setAssetTypeFilter("");
    setMaterialFilter("");
    setFrom("");
    setTo("");
  };

  const exportCsv = () => {
    const rows: unknown[][] = [
      ["Asset ID", "Asset name", "Area", "Department", "Asset type", "Material type", "Nominal thickness (mm)", "Latest thickness (mm)", "Wall loss (%)", "Condition", "Last inspection", "Operating pressure (bar)"],
      ...filtered.map(asset => {
        const nominal = Number(asset.nominal_thickness ?? 0);
        const actual = Number(asset.latest_thickness ?? 0);
        return [asset.asset_id, asset.asset_name, asset.area, asset.department, asset.asset_type, asset.material_type,
          asset.nominal_thickness, asset.latest_thickness, nominal > 0 ? ((nominal - actual) / nominal * 100).toFixed(2) : "",
          asset.condition, asset.last_inspection_date, asset.operating_pressure];
      }),
      [], ["INSPECTION RECORDS"], ["Asset ID", "Date", "TML", "Nominal thickness (mm)", "Measured thickness (mm)", "Corrosion type"],
      ...filteredInspections.map(record => [record.assetId, record.date, record.tml, record.nominalMm, record.measuredMm, record.corrosionType]),
      [], ["PRODUCTION READINGS"], ["Asset ID", "Date", "Pressure (bar)", "Temperature (°C)", "Gas (MMSCFD)", "Water (BWPD)", "Oil (BOPD)"],
      ...filteredProduction.map(record => [record.assetId, record.date, record.pressure, record.temperature, record.gas, record.water, record.oil]),
    ];
    const csv = "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "pertamina-asset-evaluation.csv";
    link.click();
    URL.revokeObjectURL(url);
    notify("CSV evaluation exported.");
  };

  if (loading) return <section className="panel"><div className="empty-state">Loading consolidated asset, inspection and production data…</div></section>;
  if (error) return <section className="panel"><div className="empty-state" role="alert">{error}</div></section>;

  return (
    <div className="insights-page">
      <section className="panel" style={{ padding: 24, marginBottom: 18 }}>
        <div className="panel-heading">
          <div><div className="panel-kicker">US-05 / CONSOLIDATED DATA</div><h2>Unified asset evaluation</h2><p>Inspection measurements and operating parameters linked through the unified Asset ID</p></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="button button-outline" onClick={exportCsv}><FileSpreadsheet size={15} /> Export Excel-compatible CSV</button>
            <button className="button button-primary" onClick={() => window.print()}><Printer size={15} /> Save as PDF</button>
          </div>
        </div>
        <div className="metric-grid" style={{ marginTop: 20 }}>
          <InsightMetric label="Registered assets" value={filtered.length} icon={<Activity size={18} />} />
          <InsightMetric label="Inspection records in range" value={filteredInspections.length} icon={<ShieldCheck size={18} />} />
          <InsightMetric label="Production readings in range" value={filteredProduction.length} icon={<Activity size={18} />} />
          <InsightMetric label="High-risk assets" value={highRiskCount} icon={<AlertTriangle size={18} />} />
        </div>
      </section>

      <section className="panel" style={{ padding: 22, marginBottom: 18 }}>
        <div className="panel-heading" style={{ alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div><div className="panel-kicker">US-09 / MULTI-CRITERIA FILTER</div><h2>Filter asset evaluation</h2><p>Asset ID, facility type, material type and inspection/production date range update the tables and charts below. Facility type is controlled by the workspace filter above.</p></div>
          <button className="button button-quiet" onClick={clearFilters}><X size={14} /> Clear filters</button>
        </div>
        <div className="dashboard-filter-grid">
          <label className="field">
            <span>Asset ID / name</span>
            <div className="search-box"><Search size={15} /><input value={assetQuery} onChange={event => setAssetQuery(event.target.value)} placeholder="Search asset ID or name…" /></div>
          </label>
          <label className="field">
            <span>Asset type</span>
            <select value={assetTypeFilter} onChange={event => setAssetTypeFilter(event.target.value)}>
              <option value="">All types</option>
              {assetTypeOptions.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Material type</span>
            <select value={materialFilter} onChange={event => setMaterialFilter(event.target.value)} disabled={!materialOptions.length}>
              <option value="">{materialOptions.length ? "All materials" : "Not recorded in Neon"}</option>
              {materialOptions.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="field">
            <span>From date</span>
            <input aria-label="Filter from date" type="date" value={from} max={to || undefined} onChange={event => setFrom(event.target.value)} />
          </label>
          <label className="field">
            <span>To date</span>
            <input aria-label="Filter to date" type="date" value={to} min={from || undefined} onChange={event => setTo(event.target.value)} />
          </label>
        </div>
        <div className="filter-result-line">
          <span>{filtered.length} assets · {filteredInspections.length} inspection rows · {filteredProduction.length} production rows</span>
          <span>Asset type uses the existing <code>asset_type</code> field; facility type is the Pipeline / Surface Facility workspace filter.</span>
        </div>
        {!materialOptions.length && <div className="rule-note inline"><AlertTriangle size={15} /><div><strong>Material data is not available</strong><span>The current Neon asset response contains no material type values. The filter will activate automatically once real material_type values are populated; no material values have been guessed or inserted.</span></div></div>}
        {dateRangeInvalid && <div className="sync-error" role="alert">The start date must be on or before the end date.</div>}
        {filtered.length === 0 && <div className="empty-state">No assets match the selected asset filters.</div>}
      </section>

      {selectedAsset && (
        <section className="panel" style={{ padding: 22, marginBottom: 18, position: "relative", isolation: "isolate", overflow: "visible" }}>
          <div className="panel-heading" style={{ alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div><div className="panel-kicker">US-05 / US-09 · ASSET OVERVIEW</div><h2>Asset evaluation</h2><p>Select an asset to view its inspection history and production context</p></div>
            <span className="source-count">{filtered.length} REGISTERED ASSETS</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap", margin: "16px 0 10px", position: "relative", zIndex: 20 }}>
            <div style={{ flex: "1 1 320px", minWidth: 0, maxWidth: "100%", position: "relative" }} onMouseEnter={() => setPreviewOpen(true)} onMouseLeave={() => setPreviewOpen(false)} onFocus={() => setPreviewOpen(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPreviewOpen(false); }}>
              <label className="panel-kicker" htmlFor="asset-selector">FIND AN ASSET</label>
              <select id="asset-selector" value={selectedAsset.asset_id} onChange={event => setSelected(event.target.value)} style={{ width: "100%", marginTop: 7 }}>
                {filtered.map(asset => <option key={asset.asset_id} value={asset.asset_id}>{asset.asset_id} — {asset.asset_name}</option>)}
              </select>
              {previewOpen && (
                <div role="status" aria-label="Selected asset details" style={{ position: "absolute", zIndex: 100, top: "calc(100% + 12px)", left: 0, width: "min(440px, calc(100vw - 48px))", padding: 16, borderRadius: 14, background: "#10243a", color: "#f7fbff", border: "1px solid rgba(255,255,255,.14)", boxShadow: "0 18px 42px rgba(9,24,40,.28)", isolation: "isolate" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                    <div><div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.4px", color: "#91b7d8" }}>ASSET PROFILE</div><div style={{ fontSize: 15, fontWeight: 700, marginTop: 3 }}>Selected asset details</div></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
                    {[
                      { label: "AREA", value: selectedAsset.area },
                      { label: "ASSET TYPE", value: selectedAsset.asset_type },
                      { label: "MATERIAL TYPE", value: selectedAsset.material_type || "Not recorded" },
                      { label: "DEPARTMENT", value: selectedAsset.department },
                      { label: "CONDITION", value: selectedAsset.condition ?? "Unknown" },
                    ].map(item => (
                      <div key={item.label} style={{ minWidth: 0, padding: "11px 12px", borderRadius: 9, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.08)" }}>
                        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "1.1px", color: "#91b7d8", marginBottom: 5 }}>{item.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, overflowWrap: "anywhere", color: "#fff" }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button className="button button-outline" style={{ marginTop: 22, flex: "0 0 auto", maxWidth: "100%", whiteSpace: "nowrap" }} onClick={() => setDirectoryOpen(value => !value)}>{directoryOpen ? "Hide asset list" : "View all assets"}</button>
          </div>
          {directoryOpen && (
            <div className="sub-panel" style={{ margin: "12px 0 18px", padding: 14 }}>
              <div className="panel-kicker">REGISTERED ASSETS · {filtered.length}</div>
              <div className="table-scroll"><table><thead><tr><th>ASSET ID / NAME</th><th>AREA</th><th>TYPE</th><th>MATERIAL</th><th>DEPARTMENT</th><th>CONDITION</th><th /></tr></thead><tbody>
                {filtered.map(asset => <tr key={asset.asset_id}><td><div className="asset-name">{asset.asset_id}</div><div className="asset-id">{asset.asset_name}</div></td><td>{asset.area}</td><td>{asset.asset_type}</td><td>{asset.material_type || "—"}</td><td>{asset.department}</td><td>{asset.condition ?? "Unknown"}</td><td><button className="button button-outline" onClick={() => { setSelected(asset.asset_id); setDirectoryOpen(false); }}>Select</button></td></tr>)}
              </tbody></table></div>
            </div>
          )}
          <div className="panel-heading" style={{ marginTop: 16 }}><div><div className="panel-kicker">SELECTED ASSET</div><h2>{selectedAsset.asset_name}</h2><p>{selectedAsset.asset_id} · {selectedAsset.area} · {selectedAsset.department}</p></div><span className="discipline-tag">{selectedCondition?.condition ?? selectedAsset.condition ?? "Condition unavailable"}</span></div>
          <div className="metric-grid">
            <InsightMetric label="Nominal wall thickness" value={selectedCondition?.nominalMm != null ? `${formatNumber(selectedCondition.nominalMm)} mm` : formatNumber(selectedAsset.nominal_thickness) + (selectedAsset.nominal_thickness == null ? "" : " mm")} />
            <InsightMetric label="Latest lowest thickness" value={selectedCondition?.minThicknessMm != null ? `${formatNumber(selectedCondition.minThicknessMm)} mm` : formatNumber(selectedAsset.latest_thickness) + (selectedAsset.latest_thickness == null ? "" : " mm")} />
            <InsightMetric label="Operating pressure" value={selectedAsset.operating_pressure != null ? `${formatNumber(selectedAsset.operating_pressure, 1)} bar` : "—"} />
            <InsightMetric label="Inspection readings in range" value={assetInspections.length} />
          </div>
          <div className="content-grid" style={{ marginTop: 18 }}>
            <div><div className="panel-kicker">WALL THICKNESS HISTORY</div><div className="table-scroll"><table><thead><tr><th>DATE</th><th>TML</th><th>NOMINAL (MM)</th><th>ACTUAL (MM)</th><th>WALL LOSS</th></tr></thead><tbody>
              {assetInspections.map((record, index) => <tr key={`${record.date}-${record.tml}-${index}`}><td>{dateLabel(record.date)}</td><td>{record.tml}</td><td>{formatNumber(record.nominalMm)}</td><td>{formatNumber(record.measuredMm)}</td><td>{record.nominalMm > 0 ? (((record.nominalMm - record.measuredMm) / record.nominalMm) * 100).toFixed(1) + "%" : "—"}</td></tr>)}
            </tbody></table>{assetInspections.length === 0 && <div className="empty-state">No inspection records in this date range.</div>}</div></div>
            <div><div className="panel-kicker">PRODUCTION CONTEXT</div><div className="table-scroll"><table><thead><tr><th>DATE</th><th>PRESSURE</th><th>TEMP.</th><th>GAS</th><th>WATER</th><th>OIL</th></tr></thead><tbody>
              {assetProduction.slice(0, 12).map((record, index) => <tr key={`${record.date}-${index}`}><td>{dateLabel(record.date)}</td><td>{formatNumber(record.pressure, 1)} bar</td><td>{formatNumber(record.temperature, 1)} °C</td><td>{formatNumber(record.gas)}</td><td>{formatNumber(record.water, 0)}</td><td>{formatNumber(record.oil, 0)}</td></tr>)}
            </tbody></table>{assetProduction.length === 0 && <div className="empty-state">No production readings in this date range.</div>}</div></div>
          </div>
          <div className="detail-grid" style={{ marginTop: 18 }}>
            <div className="sub-panel"><h3>Wall thickness trend</h3><p>Lowest measured thickness per inspection date; nominal reference is shown above</p><LineChart points={thicknessTrend} unit="mm" digits={2} min={0} max={thicknessAxisMax} /></div>
            <div className="sub-panel"><h3>Operating pressure trend</h3><p>Pressure readings for the selected asset</p><LineChart points={pressureTrend} unit="bar" digits={1} min={0} max={pressureAxisMax} /></div>
          </div>
        </section>
      )}

      <section className="panel" style={{ padding: 22 }}>
        <div className="panel-heading">
          <div><div className="panel-kicker">US-07 / THICKNESS SCREENING</div><h2>Assets requiring review</h2><p>Automatic flags are calculated from the latest inspection campaign in the selected date range. Current project screening thresholds: Monitoring ≥ {CONDITION_RULE.monitoring}%, Attention ≥ {CONDITION_RULE.attention}%, Critical ≥ {CONDITION_RULE.critical}% wall loss.</p></div>
          <span className="attention-number">{alerts.length.toString().padStart(2, "0")}</span>
        </div>
        <div className="rule-note inline"><AlertTriangle size={15} /><div><strong>Engineering approval required</strong><span>These are provisional wall-loss screening thresholds already present in the project logic. They are not a verified minimum allowable thickness, remaining strength limit, or operational safety criterion. Confirm thresholds with the corrosion/inspection engineer before operational use. Screening uses inspection records returned by the current SAP inspection endpoint; pipeline records are not yet included in this calculation.</span></div></div>
        <div className="table-scroll"><table><thead><tr><th>ASSET</th><th>AREA</th><th>LATEST INSPECTION</th><th>LOWEST THICKNESS</th><th>NOMINAL</th><th>WALL LOSS</th><th>SCREENING STATUS</th></tr></thead><tbody>
          {alerts.map((item: AssetCondition) => <tr key={item.asset.id}><td><div className="asset-name">{item.asset.name}</div><div className="asset-id">{item.asset.id}</div></td><td>{item.asset.area}</td><td>{item.latestDate ? dateLabel(item.latestDate) : "—"}</td><td>{formatNumber(item.minThicknessMm)} mm</td><td>{formatNumber(item.nominalMm)} mm</td><td>{item.wallLossPct == null ? "—" : `${item.wallLossPct.toFixed(1)}%`}</td><td><span className={`status-pill cond-pill ${item.condition.toLowerCase()}`}><i />{item.condition === "Critical" ? "Critical review" : item.condition === "Attention" ? "Attention" : "Monitor"}</span></td></tr>)}
        </tbody></table>{alerts.length === 0 && <div className="empty-state">No inspection records currently meet a screening threshold for the selected filters.</div>}</div>
      </section>
      <p className="demo-note" style={{ marginTop: 12 }}>This view displays records currently stored in Neon. External SAP PM and Direct Viewer connectors are not configured by this application; no simulated source records are generated.</p>
    </div>
  );
}

function InsightMetric({ label, value, icon }: { label: string; value: string | number; icon?: ReactNode }) {
  return <div className="metric-card"><div className="metric-label">{label}</div><div className="metric-value">{value}</div>{icon && <div className="metric-icon">{icon}</div>}</div>;
}
