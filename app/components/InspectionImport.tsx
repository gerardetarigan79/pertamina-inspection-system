"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { validateInspectionCsv, type CleanRecord, type ParseResult, type RowStatus } from "../lib/inspection-import";
type StoredPipelineInspection = {
  assetId: string;
  date: string;
  method: string;
  thicknessMm: number | string;
  pressureBar: number | string | null;
  inspector: string;
  remarks?: string | null;
};

type Props = {
  knownAssetIds: string[]; // from the asset register
  onImported?: (count: number, records: CleanRecord[]) => void;
};

const PILL: Record<RowStatus, { cls: string; label: string }> = {
  valid: { cls: "healthy", label: "Valid" },
  warning: { cls: "attention", label: "Warning" },
  error: { cls: "critical", label: "Error" },
};

export default function InspectionImport({ knownAssetIds, onImported }: Props) {
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [filter, setFilter] = useState<"all" | RowStatus>("all");
  const [imported, setImported] = useState<CleanRecord[]>([]);
  const [importedError, setImportedError] = useState("");
  const [importedLoading, setImportedLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const refreshImported = useCallback(async () => {
    const response = await fetch("/api/pipeline-inspections", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload.success || !Array.isArray(payload.records)) throw new Error(payload.message ?? "Unable to load pipeline inspections from Neon.");
    const records = payload.records as StoredPipelineInspection[];
    setImported(records.map((r) => ({ assetId: r.assetId, inspectionDate: r.date, method: r.method, thicknessMm: Number(r.thicknessMm), pressureBar: r.pressureBar == null ? null : Number(r.pressureBar), inspector: r.inspector, remarks: r.remarks ?? "" })));
  }, []);

  useEffect(() => {
    void refreshImported()
      .catch(error => setImportedError(error instanceof Error ? error.message : "Unable to load pipeline inspections."))
      .finally(() => setImportedLoading(false));
  }, [refreshImported]);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setFileName(file.name);
    setFilter("all");
    setResult(validateInspectionCsv(await file.text(), knownAssetIds));
  };

  const reset = () => { setResult(null); setFileName(""); if (inputRef.current) inputRef.current.value = ""; };

  const counts = useMemo(() => {
    const rows = result?.rows ?? [];
    return {
      total: rows.length,
      valid: rows.filter(r => r.status === "valid").length,
      warning: rows.filter(r => r.status === "warning").length,
      error: rows.filter(r => r.status === "error").length,
    };
  }, [result]);

  const importable = (result?.rows ?? []).filter(r => r.clean).map(r => r.clean!);
  const visible = (result?.rows ?? []).filter(r => filter === "all" || r.status === filter);

  const doImport = async () => {
    try {
      const response = await fetch("/api/pipeline-inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: importable }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message ?? "Import failed.");
      await refreshImported();
      setImportedError("");
      onImported?.(payload.imported, importable);
      reset();
    } catch (error) {
      setImportedError(error instanceof Error ? error.message : "Unable to save records to Neon.");
    }
  };

  return (
    <div className="import-wrap">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="panel-kicker">PIPELINE INSPECTION</div>
            <h2>Import inspection records</h2>
            <p>Upload a CSV. Every row is checked (Asset ID, units, dates) before anything is imported.</p>
          </div>
          <a className="button button-outline" href="/templates/pipeline_inspection_template.csv" download>
            <Download size={15} /> Download template
          </a>
        </div>

        <label
          className="dropzone"
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
        >
          <Upload size={22} />
          <strong>{fileName || "Click to choose a CSV file, or drop it here"}</strong>
          <small>Columns: asset_id, inspection_date, method, measured_thickness, thickness_unit, pressure, pressure_unit, inspector, remarks</small>
          <input ref={inputRef} type="file" accept=".csv,text/csv" hidden onChange={e => handleFile(e.target.files?.[0])} />
        </label>

        {result?.fileErrors.map(msg => <div className="import-error" key={msg}>{msg}</div>)}
        {importedLoading && <div className="empty-state">Loading previously stored pipeline inspections from Neon…</div>}
        {importedError && <div className="sync-error" role="alert">{importedError}</div>}
      </section>

      {result && result.rows.length > 0 && (
        <section className="panel table-panel">
          <div className="panel-heading table-heading">
            <div>
              <div className="panel-kicker">VALIDATION RESULT</div>
              <h2>{counts.total} rows checked</h2>
              <p>Rows with errors are skipped. Warnings are imported but worth a look.</p>
            </div>
            <div className="welcome-actions">
              <button className="button button-quiet" onClick={reset}><X size={15} /> Clear</button>
              <button className="button button-primary" disabled={importable.length === 0} onClick={doImport}>
                <FileSpreadsheet size={16} /> Import {importable.length} valid row{importable.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>

          <div className="table-toolbar">
            {(["all", "valid", "warning", "error"] as const).map(f => (
              <button key={f} className={`toolbar-filter ${filter === f ? "chip-active" : ""}`} onClick={() => setFilter(f)}>
                {f === "all" ? `All (${counts.total})` : `${PILL[f].label} (${counts[f]})`}
              </button>
            ))}
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>LINE</th><th>ASSET ID</th><th>DATE</th><th>METHOD</th><th>THICKNESS</th><th>PRESSURE</th><th>STATUS</th><th>ISSUES</th></tr>
              </thead>
              <tbody>
                {visible.map(r => (
                  <tr key={r.line}>
                    <td className="numeric">{r.line}</td>
                    <td><span className="asset-name">{r.raw.asset_id || "—"}</span></td>
                    <td>{r.raw.inspection_date}</td>
                    <td>{r.raw.method}</td>
                    <td className="numeric">{r.raw.measured_thickness} {r.raw.thickness_unit}</td>
                    <td className="numeric">{r.raw.pressure ? `${r.raw.pressure} ${r.raw.pressure_unit}` : "—"}</td>
                    <td><span className={`status-pill ${PILL[r.status].cls}`}><i />{PILL[r.status].label}</span></td>
                    <td className="issue-cell">
                      {r.issues.length === 0 ? "—" : r.issues.map((i, k) => (
                        <div key={k} className={i.level === "error" ? "issue-error" : "issue-warning"}>{i.message}</div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {imported.length > 0 && (
        <section className="panel table-panel">
          <div className="panel-heading table-heading">
            <div>
              <div className="panel-kicker">IMPORTED TO NEON</div>
              <h2>{imported.length} records in the shared database</h2>
              <p>Thickness is normalised to mm and pressure to bar.</p>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>ASSET ID</th><th>DATE</th><th>METHOD</th><th>THICKNESS (mm)</th><th>PRESSURE (bar)</th><th>INSPECTOR</th></tr></thead>
              <tbody>
                {imported.map((r, i) => (
                  <tr key={i}>
                    <td><span className="asset-name">{r.assetId}</span></td>
                    <td>{r.inspectionDate}</td><td>{r.method}</td>
                    <td className="numeric">{r.thicknessMm}</td>
                    <td className="numeric">{r.pressureBar ?? "—"}</td>
                    <td>{r.inspector}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
