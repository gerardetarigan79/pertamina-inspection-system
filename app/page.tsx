"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, CalendarDays, CheckCircle2, ChevronDown, ChevronRight,
  CircleHelp, Command, Database, FileSpreadsheet, Filter, Gauge, Layers3,
  LayoutDashboard, Menu, MoreHorizontal, Search, Settings2, ShieldCheck,
  Waves, Wrench, X,
} from "lucide-react";
import ProductionView from "./components/ProductionView";
import InspectionView from "./components/InspectionView";
import AssetConditionView from "./components/AssetConditionView";
import InspectionImport from "./components/InspectionImport";
import MonitoringView from "./components/MonitoringView";
import UnifiedInsightsView from "./components/UnifiedInsightsView";
import type { RegisteredAsset } from "./lib/types";

type Asset = {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  material_type?: string | null;
  area: string;
  department: string;
  nominal_thickness: number | null;
  latest_thickness: number | null;
  operating_pressure: number | null;
  condition: string | null;
  last_inspection_date: string | null;
  is_sample: boolean;
};


const navGroups = [
  { label: "WORKSPACE", items: [{ name: "Overview", icon: LayoutDashboard }, { name: "Asset register", icon: Database }, { name: "Inspection records", icon: ShieldCheck }, { name: "Corrosion monitoring", icon: Waves }, { name: "Production data", icon: Gauge }] },
  { label: "MANAGE", items: [{ name: "Data integration", icon: Layers3 }, { name: "Reports", icon: FileSpreadsheet }, { name: "Work programs", icon: Wrench }] },
];

export default function Home() {
  const [active, setActive] = useState("Overview");
  const [assets, setAssets] = useState<Asset[]>([]);
const [assetsLoading, setAssetsLoading] = useState(true);
const [assetsError, setAssetsError] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
  async function fetchAssets() {
    try {
      const response = await fetch("/api/assets");

      if (!response.ok) {
        throw new Error("Failed to fetch assets");
      }

      const result = await response.json();
      if (!result.success || !Array.isArray(result.data)) {
        throw new Error(result.message ?? "Invalid asset response");
      }

      const databaseAssets = result.data as Asset[];
      setAssets(databaseAssets);

    } catch (error) {
      console.error("Asset loading error:", error);
      setAssetsError("Unable to load assets from Neon.");
    } finally {
      setAssetsLoading(false);
    }
  }

  fetchAssets();
}, []);
  const [department, setDepartment] = useState("All departments");
  const [period, setPeriod] = useState("Last 30 days");
  const [notice, setNotice] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const filtered = useMemo(
  () =>
    assets.filter(
      (a) =>
        (department === "All departments" ||
          a.department === department) &&
        (a.asset_name.toLowerCase().includes(query.toLowerCase()) ||
          a.asset_id.toLowerCase().includes(query.toLowerCase()))
    ),
  [assets, department, query]
);
  const registeredAssets = useMemo<RegisteredAsset[]>(() => assets.map((asset) => ({
    id: asset.asset_id,
    name: asset.asset_name,
    area: asset.area ?? "—",
    department: asset.department,
    type: asset.asset_type,
    materialType: asset.material_type ?? null,
  })), [assets]);

  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2800); };
  const title = active === "Overview" ? "Overview" : active;
  return (
    <main className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Activity size={19} strokeWidth={2.5}/></div>
          <div><div className="brand-name">PHM<span> / INTELLIGENCE</span></div><div className="brand-sub">ASSET INTEGRITY PLATFORM</div></div>
          <button className="icon-button mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X size={18}/></button>
        </div>
        <div className="workspace-switch"><div className="workspace-avatar">P</div><div className="workspace-copy"><strong>Pertamina Hulu Mahakam</strong><span>Inspection workspace</span></div><ChevronDown size={15}/></div>
        <div className="nav-scroll">
          {navGroups.map(group => <div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div>{group.items.map(item => <button key={item.name} className={`nav-item ${active === item.name ? "active" : ""}`} onClick={() => { setActive(item.name); setSidebarOpen(false); }}><item.icon size={17}/><span>{item.name}</span>{item.name === "Data integration" && <span className="nav-dot"/>}</button>)}</div>)}
        </div>
        <div className="sidebar-bottom">
          <div className="system-status"><span className={`status-pulse ${assetsLoading ? "checking" : assetsError ? "offline" : "online"}`}/><div><strong>Database status</strong><small>{assetsLoading ? "Checking Neon…" : assetsError ? "Unavailable" : "Neon connected"}</small></div><ChevronRight size={14}/></div>
          <button className="nav-item"><Settings2 size={17}/><span>Settings</span></button>
          <button className="nav-item"><CircleHelp size={17}/><span>Help & support</span></button>
          <div className="profile"><div className="profile-avatar">GT</div><div className="profile-copy"><strong>Gerard Tarigan</strong><span>Inspection planning</span></div><MoreHorizontal size={18}/></div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="topbar-left"><button className="icon-button menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={19}/></button><div className="breadcrumb">Workspace <ChevronRight size={13}/> <strong>{title}</strong></div></div>
          <div className="topbar-right"><div className="topbar-date"><CalendarDays size={15}/> {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</div><button className="icon-button" type="button" disabled aria-label="Notifications are not configured" title="Notifications are not configured"><Bell size={18}/></button><div className="top-avatar">GT</div></div>
        </header>

        <div className="page-content">
          <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> ASSET INTEGRITY / COMMAND CENTER</div><h1>{title === "Overview" ? <>Asset integrity overview<span className="wave">.</span></> : title}</h1><p className="page-subtitle">{active === "Overview" ? "A consolidated view of asset health, inspection activity, and operating conditions." : `Explore and manage ${active.toLowerCase()} across the inspection workspace.`}</p></div></div>

          <div className="filter-row"><div className="filter-context"><span className="live-indicator"/> DATABASE-BACKED WORKSPACE <span className="filter-separator">/</span> <span>Values retrieved from Neon</span></div><div className="filters"><label className="select-wrap"><Filter size={14}/><select aria-label="Facility type" value={department} onChange={e => setDepartment(e.target.value)}><option value="All departments">All facility types</option><option value="Pipeline">Pipeline</option><option value="Surface Facility">Surface Facility</option></select><ChevronDown size={13}/></label><label className="select-wrap"><CalendarDays size={14}/><select value={period} onChange={e => setPeriod(e.target.value)}><option>Last 30 days</option><option>Last 7 days</option><option>Last 90 days</option></select><ChevronDown size={13}/></label></div></div>

          {active === "Overview" ? <UnifiedInsightsView department={department} notify={notify}/> : active === "Reports" ? <UnifiedInsightsView department={department} notify={notify}/> : active === "Asset register" ? (
  <section className="panel table-panel">

    <div className="panel-heading table-heading">
      <div>
        <div className="panel-kicker">DATABASE / ASSET REGISTER</div>
        <h2>All registered assets</h2>
        <p>Assets retrieved directly from the Neon database</p>
      </div>

      <span className="source-count">
        {assets.length} TOTAL ASSETS
      </span>
    </div>

    <div className="table-toolbar">
      <div className="search-box">
        <Search size={15} />

        <input
          placeholder="Search asset name or ID..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <span className="result-count">
        {filtered.length} assets found
      </span>
    </div>

    <div className="table-scroll">

      {assetsLoading ? (
        <div className="empty-state">Loading assets...</div>

      ) : assetsError ? (
        <div className="empty-state">{assetsError}</div>

      ) : (
        <table>
          <thead>
            <tr>
              <th>ASSET / PIPELINE</th>
              <th>AREA</th>
              <th>DISCIPLINE</th>
              <th>MATERIAL</th>
              <th>WALL THICKNESS</th>
              <th>OPERATING PRESSURE</th>
              <th>CONDITION</th>
              <th>LAST INSPECTION</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((asset) => (
              <tr key={asset.asset_id}>
                <td>
                  <div className="asset-name">{asset.asset_name}</div>
                  <div className="asset-id">{asset.asset_id}</div>
                </td>

                <td>{asset.area ?? "—"}</td>

                <td>
                  <span className="discipline-tag">
                    {asset.department}
                  </span>
                </td>

                <td>{asset.material_type ?? "—"}</td>

                <td className="numeric">{asset.latest_thickness != null ? `${Number(asset.latest_thickness).toFixed(2)} mm` : "—"}</td>

                <td className="numeric">{asset.operating_pressure != null ? `${Number(asset.operating_pressure).toFixed(1)} bar` : "—"}</td>

                <td>
                  <Status status={asset.condition ?? "Unknown"} />
                </td>

                <td className="date-cell">{asset.last_inspection_date ? new Date(asset.last_inspection_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!assetsLoading && !assetsError && filtered.length === 0 && (
        <div className="empty-state">No assets found.</div>
      )}

    </div>

    <div className="table-footer">
      <span>
        Showing <strong>{filtered.length}</strong> of{" "}
        <strong>{assets.length}</strong> database records
      </span>
    </div>

  </section>
) : active === "Production data" ? <ProductionView assets={registeredAssets} department={department} period={period} notify={notify}/>
          : active === "Inspection records" ? (department === "Pipeline" ? <InspectionImport knownAssetIds={assets.map(a => a.asset_id)} onImported={n => notify(`${n} pipeline inspection records saved to Neon.`)}/> : <InspectionView assets={registeredAssets} department={department} period={period} notify={notify}/>)          : active === "Corrosion monitoring" ? <MonitoringView assets={registeredAssets} department={department} notify={notify}/>
          : active === "Asset condition" ? <AssetConditionView assets={registeredAssets} assetsLoading={assetsLoading} assetsError={assetsError} department={department} period={period} notify={notify} initialCondition="All" onBack={() => setActive("Overview")}/>
          : <section className="panel placeholder-panel"><div className="placeholder-icon"><Command size={25}/></div><div className="panel-kicker">{active.toUpperCase()}</div><h2>{active} workspace</h2><p>This section is not connected to an active backend workflow yet. No sample records are generated for this view.</p><button className="button button-primary" onClick={() => setActive("Overview")}>Back to overview</button></section>}
          <footer className="footer"><span>PHM INTELLIGENCE <span className="footer-sep">/</span> INTERNAL WORKSPACE</span><span>Database-backed workspace · Neon records</span><span>v0.1.0</span></footer>
        </div>
      </section>
      {notice && <div className="toast"><CheckCircle2 size={17}/>{notice}</div>}
    </main>
  );
}

function Metric({label,value,change,icon,tone,trend}:{label:string;value:string;change:string;icon:React.ReactNode;tone:string;trend:string}) { return <div className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}>{icon}</span></div><div className="metric-value">{value}</div><div className="metric-change"><span className={trend==="up"?"trend-up":"trend-down"}>{trend==="up"?<ArrowUpRight size={14}/>:<ArrowDownRight size={14}/>}</span>{change}</div></div>; }
function Legend({color,label,value,count,onOpen}:{color:string;label:string;value:string;count:string;onOpen?:(condition:string)=>void}) { return <div className={`legend-row ${onOpen?"clickable":""}`} {...(onOpen?{role:"button",tabIndex:0,onClick:()=>onOpen(label),onKeyDown:(e:React.KeyboardEvent)=>{if(e.key==="Enter")onOpen(label);}}:{})}><span className={`legend-dot ${color}`}/><span className="legend-label">{label}<small>{count}</small></span><strong>{value}</strong></div>; }
function Status({status}:{status:string}) { const cls=status.toLowerCase().replace(" ","-"); return <span className={`status-pill ${cls}`}><i/>{status}</span>; }
function Source({icon,name,detail,status,tone}:{icon:React.ReactNode;name:string;detail:string;status:string;tone:string}) { return <div className="source-row"><span className="source-icon">{icon}</span><span className="source-copy"><strong>{name}</strong><small>{detail}</small></span><span className={`source-status ${tone}`}><i/>{status}</span></div>; }
function Followup({color,title,detail,time}:{color:string;title:string;detail:string;time:string}) { return <div className="followup-row"><span className={`followup-icon ${color}`}><AlertTriangle size={15}/></span><span className="followup-copy"><strong>{title}</strong><small>{detail}</small></span><span className="followup-time">{time}</span></div>; }
