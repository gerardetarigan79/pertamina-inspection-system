"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, ChevronDown,
  ChevronLeft, ChevronRight, CircleHelp, Clock3, Command, Download, FileSpreadsheet,
  Filter, Gauge, LayoutDashboard, LifeBuoy, Menu, MoreHorizontal, Plus, Search,
  Settings2, ShieldCheck, SlidersHorizontal, Waves, Wrench, X, Database, CalendarDays,
  CheckCircle2, CircleDot, ArrowUpRight as ExternalLink, Layers3, PanelLeftClose
} from "lucide-react";
import ProductionView from "./components/ProductionView";
import InspectionView from "./components/InspectionView";
import AssetConditionView from "./components/AssetConditionView";
import InspectionImport from "./components/InspectionImport";
import MonitoringView from "./components/MonitoringView";

type Asset = { id: string; name: string; area: string; department: string; thickness: string; pressure: string; status: string; date: string; };


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
          <div className="system-status"><span className="status-pulse"/><div><strong>System operational</strong><small>All services running</small></div><ChevronRight size={14}/></div>
          <button className="nav-item"><Settings2 size={17}/><span>Settings</span></button>
          <button className="nav-item"><CircleHelp size={17}/><span>Help & support</span></button>
          <div className="profile"><div className="profile-avatar">GT</div><div className="profile-copy"><strong>Gerard Tarigan</strong><span>Inspection planning</span></div><MoreHorizontal size={18}/></div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="topbar-left"><button className="icon-button menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={19}/></button><div className="breadcrumb">Workspace <ChevronRight size={13}/> <strong>{title}</strong></div></div>
          <div className="topbar-right"><div className="topbar-date"><CalendarDays size={15}/> Friday, 13 November 2026</div><button className="icon-button notification" onClick={() => notify("You're all caught up. No new notifications.")} aria-label="Notifications"><Bell size={18}/><i/></button><div className="top-avatar">GT</div></div>
        </header>

        <div className="page-content">
          <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> ASSET INTEGRITY / COMMAND CENTER</div><h1>{title === "Overview" ? <>Good afternoon, Gerard<span className="wave">.</span></> : title}</h1><p className="page-subtitle">{active === "Overview" ? "A consolidated view of asset health, inspection activity, and operating conditions." : `Explore and manage ${active.toLowerCase()} across the inspection workspace.`}</p></div><div className="welcome-actions"><button className="button button-quiet" onClick={() => notify("Report export is a frontend demo for now.")}><Download size={16}/> Export report</button><button className="button button-primary" onClick={() => notify("New record flow will be connected to the backend later.")}><Plus size={17}/> New record</button></div></div>

          <div className="filter-row"><div className="filter-context"><span className="live-indicator"/> LIVE WORKSPACE SNAPSHOT <span className="filter-separator">/</span> <span>Updated just now</span></div><div className="filters"><label className="select-wrap"><Filter size={14}/><select value={department} onChange={e => setDepartment(e.target.value)}><option>All departments</option><option>Pipeline</option><option>Surface Facility</option></select><ChevronDown size={13}/></label><label className="select-wrap"><CalendarDays size={14}/><select value={period} onChange={e => setPeriod(e.target.value)}><option>Last 30 days</option><option>Last 7 days</option><option>Last 90 days</option></select><ChevronDown size={13}/></label></div></div>

          {active === "Overview" ? <>
            <div className="metric-grid">
              <Metric label="Registered assets" value="1,284" change="+12 this month" icon={<Database size={18}/>} tone="blue" trend="up"/>
              <Metric label="Inspections completed" value="368" change="+8.4% vs last period" icon={<ShieldCheck size={18}/>} tone="green" trend="up"/>
              <Metric label="Assets need attention" value="24" change="6 critical findings" icon={<AlertTriangle size={18}/>} tone="amber" trend="down"/>
              <Metric label="Data coverage" value="92.6%" change="Across 4 disciplines" icon={<Activity size={18}/>} tone="violet" trend="up"/>
            </div>

            <div className="content-grid">
              <section className="panel health-panel"><div className="panel-heading"><div><div className="panel-kicker">ASSET CONDITION</div><h2>Inspection health overview</h2><p>Current condition distribution across registered assets</p></div><button className="more-button" onClick={() => notify("Detailed analytics will be available in a later iteration.")}><MoreHorizontal size={19}/></button></div>
                <div className="health-content"><div className="donut-wrap"><div className="donut"><div className="donut-center"><strong>1,284</strong><span>Total assets</span></div></div></div><div className="legend"><Legend color="green" label="Healthy" value="72%" count="924 assets" onOpen={openCondition}/><Legend color="amber" label="Monitoring" value="18%" count="231 assets" onOpen={openCondition}/><Legend color="red" label="Attention" value="8%" count="103 assets" onOpen={openCondition}/><Legend color="slate" label="Critical" value="2%" count="26 assets" onOpen={openCondition}/></div></div>
                <div className="panel-foot"><span><span className="tiny-dot green-dot"/> Based on latest available inspection records</span><span className="panel-link" role="button" tabIndex={0} onClick={() => openCondition("All")} onKeyDown={e => { if (e.key === "Enter") openCondition("All"); }}>View details <ChevronRight size={13}/></span></div>
              </section>
              <section className="panel activity-panel"><div className="panel-heading"><div><div className="panel-kicker">INSPECTION ACTIVITY</div><h2>Inspection trends</h2><p>Completed inspections over the past 6 months</p></div><button className="select-compact" onClick={() => setPeriod(period === "Last 30 days" ? "Last 90 days" : "Last 30 days")}>{period === "Last 30 days" ? "6 months" : "90 days"} <ChevronDown size={13}/></button></div><div className="chart-area"><div className="chart-y"><span>120</span><span>80</span><span>40</span><span>0</span></div><div className="chart-main"><div className="chart-gridlines"><i/><i/><i/><i/></div><div className="bars">{[48,66,57,82,71,94].map((h,i)=><div className="bar-column" key={i}><div className="bar-pair"><i style={{height:`${h}%`}}/><i style={{height:`${Math.max(15,h-24)}%`}}/></div><span>{["Jun","Jul","Aug","Sep","Oct","Nov"][i]}</span></div>)}</div></div></div><div className="chart-legend"><span><i className="legend-bar primary-bar"/> Completed</span><span><i className="legend-bar secondary-bar"/> Planned</span></div></section>
            </div>

            <section className="panel table-panel"><div className="panel-heading table-heading"><div><div className="panel-kicker">ASSET REGISTER</div><h2>Recently monitored assets</h2><p>Latest records across your inspection disciplines</p></div><button className="button button-outline" onClick={() => setActive("Asset register")}>View asset register <ExternalLink size={14}/></button></div><div className="table-toolbar"><div className="search-box"><Search size={15}/><input placeholder="Search asset name or ID..." value={query} onChange={e => setQuery(e.target.value)}/>{query && <button onClick={() => setQuery("")} aria-label="Clear search"><X size={14}/></button>}</div><button className="toolbar-filter" onClick={() => notify("Use the department filter above to narrow this table.")}><SlidersHorizontal size={15}/> Filters</button><span className="result-count">{filtered.length} assets</span></div><div className="table-scroll"><table><thead><tr><th>ASSET / PIPELINE</th><th>AREA</th><th>DISCIPLINE</th><th>WALL THICKNESS</th><th>OPERATING PRESSURE</th><th>CONDITION</th><th>LAST INSPECTION</th><th/></tr></thead><tbody>{filtered.map(asset=><tr key={asset.id}><td><div className="asset-name">{asset.name}</div><div className="asset-id">{asset.id}</div></td><td>{asset.area}</td><td><span className="discipline-tag">{asset.department}</span></td><td className="numeric">{asset.thickness}</td><td className="numeric">{asset.pressure}</td><td><Status status={asset.status}/></td><td className="date-cell">{asset.date}</td><td><button className="row-more" onClick={() => notify(`Opening asset ${asset.id} — detail view is coming soon.`)} aria-label={`Open ${asset.id}`}><MoreHorizontal size={17}/></button></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="empty-state">No assets match your search.</div>}</div><div className="table-footer"><span>Showing <strong>{filtered.length}</strong> of 1,284 registered assets <span className="demo-note">· Sample interface data</span></span><div className="pagination"><button disabled><ChevronLeft size={15}/></button><button className="current-page">1</button><button onClick={() => notify("Pagination will be connected to live data later.")}>2</button><button onClick={() => notify("Pagination will be connected to live data later.")}>3</button><span>…</span><button onClick={() => notify("Pagination will be connected to live data later.")}>→</button></div></div></section>

            <div className="bottom-grid"><section className="panel source-panel"><div className="panel-heading"><div><div className="panel-kicker">CONNECTED SOURCES</div><h2>Data source status</h2><p>Integration health by source system</p></div><span className="source-count">4 SOURCES</span></div><div className="source-list"><Source icon={<Database size={17}/>} name="SAP" detail="Surface facility inspection" status="Connected" tone="green"/><Source icon={<Waves size={17}/>} name="Pipeline database" detail="Pipeline inspection records" status="Connected" tone="green"/><Source icon={<FileSpreadsheet size={17}/>} name="Excel workbooks" detail="Corrosion monitoring" status="Manual import" tone="amber"/><Source icon={<Gauge size={17}/>} name="Direct Viewer" detail="Production parameters" status="Pending" tone="slate"/></div></section><section className="panel attention-panel"><div className="panel-heading"><div><div className="panel-kicker">NEEDS REVIEW</div><h2>Priority follow-ups</h2><p>Items that may require your attention</p></div><span className="attention-number">03</span></div><div className="followup-list"><Followup color="red" title="Critical wall thickness reading" detail="Attaka Offshore Flowline · PHM-PL-008" time="2 hours ago"/><Followup color="amber" title="Inspection record awaiting review" detail="Handil Export Line · PHM-PL-001" time="Yesterday"/><Followup color="blue" title="Production data not synchronized" detail="Direct Viewer · 4 assets affected" time="12 Nov 2026"/></div></section></div>
          </> : active === "Asset register" ? (
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
          : active === "Inspection records" ? (department === "Pipeline" ? <InspectionImport knownAssetIds={assets.map(a => a.id)} onImported={n => notify(`${n} pipeline inspection records saved to Neon.`)}/> : <InspectionView department={department} period={period} notify={notify}/>)          : active === "Corrosion monitoring" ? <MonitoringView department={department} notify={notify}/>
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
