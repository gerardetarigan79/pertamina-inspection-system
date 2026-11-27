"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, ChevronDown,
  ChevronLeft, ChevronRight, CircleHelp, Clock3, Command, Download, FileSpreadsheet,
  Filter, Gauge, LayoutDashboard, LifeBuoy, Menu, MoreHorizontal, Plus, Search,
  Settings2, ShieldCheck, SlidersHorizontal, Waves, Wrench, X, LogOut, Database, CalendarDays,
  CheckCircle2, CircleDot, ArrowUpRight as ExternalLink, Layers3, PanelLeftClose
} from "lucide-react";
import ProductionView from "./components/ProductionView";
import InspectionView from "./components/InspectionView";
import AssetConditionView from "./components/AssetConditionView";
import InspectionImport from "./components/InspectionImport";
import MonitoringView from "./components/MonitoringView";
import UnifiedInsightsView from "./components/UnifiedInsightsView";

type Asset = { id: string; name: string; area: string; department: string; thickness: string; pressure: string; status: string; date: string; };
type CurrentUser = { id: string; name: string; email: string; role: "admin" | "inspector" | "viewer"; mustChangePassword: boolean };


const navGroups = [
  { label: "WORKSPACE", items: [{ name: "Overview", icon: LayoutDashboard }, { name: "Asset register", icon: Database }, { name: "Inspection records", icon: ShieldCheck }, { name: "Corrosion monitoring", icon: Waves }, { name: "Production data", icon: Gauge }] },
  { label: "MANAGE", items: [{ name: "Data integration", icon: Layers3 }, { name: "Reports", icon: FileSpreadsheet }, { name: "Work programs", icon: Wrench }] },
];

export default function Home() {
  const [active, setActive] = useState("Overview");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(payload => { if (payload?.success) setCurrentUser(payload.user as CurrentUser); })
      .catch(() => setCurrentUser(null));
  }, []);
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

      const formattedAssets: Asset[] = result.data.map((item: any) => ({
        id: item.asset_id,
        name: item.asset_name,
        area: item.area ?? "—",
        department: item.department ?? "—",

        thickness:
          item.latest_thickness != null
            ? `${Number(item.latest_thickness).toFixed(2)} mm`
            : "—",

        pressure:
          item.operating_pressure != null
            ? `${Number(item.operating_pressure).toFixed(1)} bar`
            : "—",

        status: item.condition ?? "Unknown",

        date: item.last_inspection_date
          ? new Date(item.last_inspection_date).toLocaleDateString(
              "en-GB",
              { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }
            )
          : "—",
      }));

      setAssets(formattedAssets);

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
        (a.name.toLowerCase().includes(query.toLowerCase()) ||
          a.id.toLowerCase().includes(query.toLowerCase()))
    ),
  [assets, department, query]
);
  const [conditionFilter, setConditionFilter] = useState("All");
  const openCondition = (condition: string) => { setConditionFilter(condition); setActive("Asset condition"); };

  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2800); };
  const title = active === "Overview" ? "Overview" : active;
  const canWrite = currentUser?.role === "admin" || currentUser?.role === "inspector";
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
          {currentUser?.role === "admin" && <button className="nav-item" onClick={() => window.location.assign("/admin/users")}><ShieldCheck size={17}/><span>User management</span></button>}
        </div>
        <div className="sidebar-bottom">
          <div className="system-status"><span className="status-pulse"/><div><strong>System operational</strong><small>All services running</small></div><ChevronRight size={14}/></div>
          <button className="nav-item"><Settings2 size={17}/><span>Settings</span></button>
          <button className="nav-item"><CircleHelp size={17}/><span>Help & support</span></button>
          <div className="profile"><div className="profile-avatar">{currentUser?.name?.slice(0, 2).toUpperCase() ?? "PH"}</div><div className="profile-copy"><strong>{currentUser?.name ?? "Signed in user"}</strong><span>{currentUser?.role ?? "Loading account"}</span></div><button className="icon-button" aria-label="Log out" title="Log out" onClick={async () => { try { await fetch("/api/auth/logout", { method: "POST" }); } finally { window.location.assign("/login"); } }}><LogOut size={16}/></button></div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="topbar-left"><button className="icon-button menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={19}/></button><div className="breadcrumb">Workspace <ChevronRight size={13}/> <strong>{title}</strong></div></div>
          <div className="topbar-right"><div className="topbar-date"><CalendarDays size={15}/> {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</div><button className="icon-button notification" onClick={() => notify("You're all caught up. No new notifications.")} aria-label="Notifications"><Bell size={18}/><i/></button><div className="top-avatar">{currentUser?.name?.slice(0, 2).toUpperCase() ?? "PH"}</div></div>
        </header>

        <div className="page-content">
          <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> ASSET INTEGRITY / COMMAND CENTER</div><h1>{title === "Overview" ? <>Good afternoon, {currentUser?.name ?? "there"}<span className="wave">.</span></> : title}</h1><p className="page-subtitle">{active === "Overview" ? "A consolidated view of asset health, inspection activity, and operating conditions." : `Explore and manage ${active.toLowerCase()} across the inspection workspace.`}</p></div><div className="welcome-actions"><button className="button button-quiet" onClick={() => notify("Report export is a frontend demo for now.")}><Download size={16}/> Export report</button>{canWrite && <button className="button button-primary" onClick={() => notify("New record flow will be connected in the manual inspection phase.")}><Plus size={17}/> New record</button>}</div></div>

          <div className="filter-row"><div className="filter-context"><span className="live-indicator"/> LIVE WORKSPACE SNAPSHOT <span className="filter-separator">/</span> <span>Updated just now</span></div><div className="filters"><label className="select-wrap"><Filter size={14}/><select value={department} onChange={e => setDepartment(e.target.value)}><option>All departments</option><option>Pipeline</option><option>Surface Facility</option></select><ChevronDown size={13}/></label><label className="select-wrap"><CalendarDays size={14}/><select value={period} onChange={e => setPeriod(e.target.value)}><option>Last 30 days</option><option>Last 7 days</option><option>Last 90 days</option></select><ChevronDown size={13}/></label></div></div>

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
              <th>WALL THICKNESS</th>
              <th>OPERATING PRESSURE</th>
              <th>CONDITION</th>
              <th>LAST INSPECTION</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((asset) => (
              <tr key={asset.id}>
                <td>
                  <div className="asset-name">{asset.name}</div>
                  <div className="asset-id">{asset.id}</div>
                </td>

                <td>{asset.area}</td>

                <td>
                  <span className="discipline-tag">
                    {asset.department}
                  </span>
                </td>

                <td className="numeric">{asset.thickness}</td>

                <td className="numeric">{asset.pressure}</td>

                <td>
                  <Status status={asset.status} />
                </td>

                <td className="date-cell">{asset.date}</td>
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
) : active === "Production data" ? <ProductionView department={department} period={period} notify={notify}/>
          : active === "Inspection records" ? (department === "Pipeline" ? <InspectionImport knownAssetIds={assets.map(a => a.id)} readOnly={!canWrite} onImported={n => notify(`${n} pipeline inspection records saved to Neon.`)}/> : <InspectionView department={department} period={period} notify={notify}/>)          : active === "Corrosion monitoring" ? <MonitoringView department={department} notify={notify} readOnly={!canWrite}/>
          : active === "Asset condition" ? <AssetConditionView department={department} period={period} notify={notify} initialCondition={conditionFilter} onBack={() => setActive("Overview")}/>
          : <section className="panel placeholder-panel"><div className="placeholder-icon"><Command size={25}/></div><div className="panel-kicker">{active.toUpperCase()}</div><h2>{active} workspace</h2><p>This section is part of the frontend prototype. The dashboard currently uses illustrative sample data; workflows and backend integrations will be developed in later iterations.</p><button className="button button-primary" onClick={() => setActive("Overview")}>Back to overview</button></section>}
          <footer className="footer"><span>PHM INTELLIGENCE <span className="footer-sep">/</span> INTERNAL WORKSPACE</span><span>Frontend prototype · Sample data only</span><span>v0.1.0</span></footer>
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
