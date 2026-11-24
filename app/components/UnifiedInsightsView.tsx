"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import LineChart from "./LineChart";
import { Activity, AlertTriangle, Download, FileSpreadsheet, Printer, Search, ShieldCheck } from "lucide-react";

type Asset = { asset_id:string; asset_name:string; asset_type:string; area:string; department:string; nominal_thickness:number|null; latest_thickness:number|null; operating_pressure:number|null; condition:string|null; last_inspection_date:string|null };
type Inspection = { assetId:string; date:string; tml:string; nominalMm:number; measuredMm:number; corrosionType:string };
type Production = { assetId:string; date:string; pressure:number; temperature:number; gas:number; water:number; oil:number };

const dateLabel=(value:string)=>new Date(value+"T00:00:00").toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
const csvCell=(value:unknown)=>'"'+String(value??"").replace(/"/g,'""')+'"';

export default function UnifiedInsightsView({ department, notify }: { department:string; notify:(message:string)=>void }) {
  const [assets,setAssets]=useState<Asset[]>([]);
  const [inspections,setInspections]=useState<Inspection[]>([]);
  const [production,setProduction]=useState<Production[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [selected,setSelected]=useState("");
  const [directoryOpen,setDirectoryOpen]=useState(false);
  const [previewOpen,setPreviewOpen]=useState(false);
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");

  useEffect(()=>{ let live=true; (async()=>{
    try {
      const [a,i,p]=await Promise.all([fetch("/api/assets"),fetch("/api/inspections"),fetch("/api/production")]);
      if(!a.ok||!i.ok||!p.ok) throw new Error("Unable to load consolidated database records.");
      const [aj,ij,pj]=await Promise.all([a.json(),i.json(),p.json()]);
      if(!aj.success||!ij.success||!pj.success) throw new Error("The database returned an incomplete response.");
      if(live){setAssets(aj.data??[]);setInspections(ij.records??[]);setProduction(pj.records??[]);}
    } catch(e){if(live)setError(e instanceof Error?e.message:"Failed to load data.");}
    finally{if(live)setLoading(false);}
  })(); return ()=>{live=false;};},[]);

  const filtered=useMemo(()=>assets.filter(a=>department==="All departments"||a.department===department),[assets,department]);
  const selectedAsset=filtered.find(a=>a.asset_id===selected)??filtered[0];
  const assetInspections=useMemo(()=>inspections.filter(r=>r.assetId===selectedAsset?.asset_id&&(!from||r.date>=from)&&(!to||r.date<=to)).sort((a,b)=>a.date.localeCompare(b.date)),[inspections,selectedAsset,from,to]);
  const assetProduction=useMemo(()=>production.filter(r=>r.assetId===selectedAsset?.asset_id&&(!from||r.date>=from)&&(!to||r.date<=to)).sort((a,b)=>a.date.localeCompare(b.date)),[production,selectedAsset,from,to]);
  const thicknessTrend=useMemo(()=>{const byDate=new Map<string,number[]>();for(const r of assetInspections){const values=byDate.get(r.date)??[];values.push(Number(r.measuredMm));byDate.set(r.date,values);}return Array.from(byDate,([date,values])=>({date,value:Math.min(...values)})).sort((a,b)=>a.date.localeCompare(b.date));},[assetInspections]);
  const pressureTrend=useMemo(()=>assetProduction.map(r=>({date:r.date,value:Number(r.pressure)})),[assetProduction]);
  // Keep each chart on a shared scale across assets so selecting another asset
  // changes the line's vertical position instead of rescaling every trend.
  const thicknessAxisMax=Math.max(5,Math.ceil(Math.max(0,...inspections.flatMap(r=>[Number(r.nominalMm),Number(r.measuredMm)]),...assets.map(a=>Number(a.nominal_thickness??0)))/5)*5);
  const pressureAxisMax=Math.max(10,Math.ceil(Math.max(0,...production.map(r=>Number(r.pressure)))/10)*10);
  const alerts=useMemo(()=>assets.map(a=>{
    const nominal=Number(a.nominal_thickness??0), measured=Number(a.latest_thickness??0);
    const loss=nominal>0&&measured>0?(nominal-measured)/nominal*100:0;
    return {...a,loss};
  }).filter(a=>a.latest_thickness!=null&&a.nominal_thickness!=null&&a.loss>=20).sort((a,b)=>b.loss-a.loss),[assets]);
  const areaOptions=Array.from(new Set(assets.map(a=>a.area).filter(Boolean))).sort();
  const typeOptions=Array.from(new Set(assets.map(a=>a.asset_type).filter(Boolean))).sort();

  const exportCsv=()=>{
    const rows=[["Asset ID","Asset name","Area","Department","Asset type","Nominal thickness (mm)","Latest thickness (mm)","Wall loss (%)","Condition","Last inspection","Operating pressure (bar)"],
      ...filtered.map(a=>{const nominal=Number(a.nominal_thickness??0),actual=Number(a.latest_thickness??0);return [a.asset_id,a.asset_name,a.area,a.department,a.asset_type,a.nominal_thickness,a.latest_thickness,nominal>0?((nominal-actual)/nominal*100).toFixed(2):"",a.condition,a.last_inspection_date,a.operating_pressure];})];
    const inspectionRows=inspections.filter(r=>filtered.some(a=>a.asset_id===r.assetId)&&(!from||r.date>=from)&&(!to||r.date<=to));
    const productionRows=production.filter(r=>filtered.some(a=>a.asset_id===r.assetId)&&(!from||r.date>=from)&&(!to||r.date<=to));
    rows.push([],["INSPECTION RECORDS"],["Asset ID","Date","TML","Nominal thickness (mm)","Measured thickness (mm)","Corrosion type"],...inspectionRows.map(r=>[r.assetId,r.date,r.tml,r.nominalMm,r.measuredMm,r.corrosionType]),[],["PRODUCTION READINGS"],["Asset ID","Date","Pressure (bar)","Temperature (°C)","Gas (MMSCFD)","Water (BWPD)","Oil (BOPD)"],...productionRows.map(r=>[r.assetId,r.date,r.pressure,r.temperature,r.gas,r.water,r.oil]));
    const csv="\uFEFF"+rows.map(r=>r.map(csvCell).join(",")).join("\r\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    const link=document.createElement("a");link.href=url;link.download="pertamina-asset-evaluation.csv";link.click();URL.revokeObjectURL(url);
    notify("CSV evaluation exported.");
  };

  if(loading)return <section className="panel"><div className="empty-state">Loading consolidated asset, inspection and production data…</div></section>;
  if(error)return <section className="panel"><div className="empty-state">{error}</div></section>;

  return <div className="insights-page">
    <section className="panel" style={{padding:24,marginBottom:18}}>
      <div className="panel-heading"><div><div className="panel-kicker">US-05 / CONSOLIDATED DATA</div><h2>Unified asset evaluation</h2><p>Inspection measurements and operating parameters linked through the unified Asset ID</p></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="button button-outline" onClick={exportCsv}><FileSpreadsheet size={15}/> Export Excel-compatible CSV</button><button className="button button-primary" onClick={()=>window.print()}><Printer size={15}/> Save as PDF</button></div></div>
      <div className="metric-grid" style={{marginTop:20}}>
        <InsightMetric label="Registered assets" value={assets.length} icon={<Activity size={18}/>} />
        <InsightMetric label="Inspection records" value={inspections.length} icon={<ShieldCheck size={18}/>} />
        <InsightMetric label="Production readings" value={production.length} icon={<Activity size={18}/>} />
        <InsightMetric label="Screening alerts" value={alerts.length} icon={<AlertTriangle size={18}/>} />
      </div>
    </section>

    {selectedAsset&&<section className="panel" style={{padding:22,marginBottom:18,position:"relative",isolation:"isolate",overflow:"visible"}}>
      <div className="panel-heading" style={{alignItems:"flex-start",gap:16,flexWrap:"wrap"}}><div><div className="panel-kicker">US-05 / US-09 · ASSET OVERVIEW</div><h2>Asset evaluation</h2><p>Select an asset to view its inspection history and production context</p></div><span className="source-count">{filtered.length} REGISTERED ASSETS</span></div>
      <div style={{display:"flex",gap:10,alignItems:"flex-start",flexWrap:"wrap",margin:"16px 0 10px",position:"relative",zIndex:20}}>
        <div style={{flex:"1 1 320px",minWidth:0,maxWidth:"100%",position:"relative"}} onMouseEnter={()=>setPreviewOpen(true)} onMouseLeave={()=>setPreviewOpen(false)} onFocus={()=>setPreviewOpen(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setPreviewOpen(false);}}>
          <label className="panel-kicker" htmlFor="asset-selector">FIND AN ASSET</label>
          <select id="asset-selector" value={selectedAsset.asset_id} onChange={e=>setSelected(e.target.value)} style={{width:"100%",marginTop:7}}>
            {filtered.map(a=><option key={a.asset_id} value={a.asset_id}>{a.asset_id} — {a.asset_name}</option>)}
          </select>
          {previewOpen&&<div role="status" className="sub-panel" style={{position:"absolute",zIndex:100,top:"100%",left:0,right:0,marginTop:6,padding:14,background:"#fff",backgroundColor:"#fff",border:"1px solid #dce4ed",boxShadow:"0 16px 36px rgba(16,36,58,.22)",opacity:1,backdropFilter:"none",WebkitBackdropFilter:"none",isolation:"isolate",overflowX:"auto",maxWidth:"min(620px, calc(100vw - 48px))"}}>
            <table style={{width:"100%",minWidth:0,tableLayout:"auto",whiteSpace:"normal",background:"#fff"}}><thead><tr><th style={{padding:"8px 10px"}}>AREA</th><th style={{padding:"8px 10px"}}>TYPE</th><th style={{padding:"8px 10px"}}>DEPARTMENT</th><th style={{padding:"8px 10px"}}>CONDITION</th></tr></thead><tbody><tr><td style={{padding:"10px"}}>{selectedAsset.area}</td><td style={{padding:"10px"}}>{selectedAsset.asset_type}</td><td style={{padding:"10px"}}>{selectedAsset.department}</td><td style={{padding:"10px"}}>{selectedAsset.condition??"Unknown"}</td></tr></tbody></table>
          </div>}
        </div>
        <button className="button button-outline" style={{marginTop:22,flex:"0 0 auto",maxWidth:"100%",whiteSpace:"nowrap"}} onClick={()=>setDirectoryOpen(v=>!v)}>{directoryOpen?"Hide asset list":"View all assets"}</button>
      </div>
      {directoryOpen&&<div className="sub-panel" style={{margin:"12px 0 18px",padding:14}}>
        <div className="panel-kicker">REGISTERED ASSETS · {filtered.length}</div>
        <div className="table-scroll"><table><thead><tr><th>ASSET ID / NAME</th><th>AREA</th><th>TYPE</th><th>DEPARTMENT</th><th>CONDITION</th><th></th></tr></thead><tbody>{filtered.map(a=><tr key={a.asset_id}><td><div className="asset-name">{a.asset_id}</div><div className="asset-id">{a.asset_name}</div></td><td>{a.area}</td><td>{a.asset_type}</td><td>{a.department}</td><td>{a.condition??"Unknown"}</td><td><button className="button button-outline" onClick={()=>{setSelected(a.asset_id);setDirectoryOpen(false);}}>Select</button></td></tr>)}</tbody></table></div>
      </div>}
      <div className="panel-heading" style={{marginTop:16}}><div><div className="panel-kicker">SELECTED ASSET</div><h2>{selectedAsset.asset_name}</h2><p>{selectedAsset.asset_id} · {selectedAsset.area} · {selectedAsset.department}</p></div><span className="discipline-tag">{selectedAsset.condition??"Condition unavailable"}</span></div>
      <div className="filters" style={{margin:"14px 0 20px",display:"flex",gap:10,flexWrap:"wrap"}}><label className="select-wrap">From <input aria-label="From date" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="select-wrap">To <input aria-label="To date" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><button className="button button-quiet" onClick={()=>{setFrom("");setTo("");}}>Clear dates</button></div>
      <div className="metric-grid">
        <InsightMetric label="Nominal wall thickness" value={selectedAsset.nominal_thickness!=null?Number(selectedAsset.nominal_thickness).toFixed(2)+" mm":"—"}/>
        <InsightMetric label="Latest measured thickness" value={selectedAsset.latest_thickness!=null?Number(selectedAsset.latest_thickness).toFixed(2)+" mm":"—"}/>
        <InsightMetric label="Operating pressure" value={selectedAsset.operating_pressure!=null?Number(selectedAsset.operating_pressure).toFixed(1)+" bar":"—"}/>
        <InsightMetric label="Inspection readings" value={assetInspections.length}/>
      </div>
      <div className="content-grid" style={{marginTop:18}}>
        <div><div className="panel-kicker">WALL THICKNESS HISTORY</div><div className="table-scroll"><table><thead><tr><th>DATE</th><th>TML</th><th>NOMINAL (MM)</th><th>ACTUAL (MM)</th><th>WALL LOSS</th></tr></thead><tbody>{assetInspections.map((r,i)=><tr key={r.date+"-"+r.tml+"-"+i}><td>{dateLabel(r.date)}</td><td>{r.tml}</td><td>{Number(r.nominalMm).toFixed(2)}</td><td>{Number(r.measuredMm).toFixed(2)}</td><td>{r.nominalMm>0?(((r.nominalMm-r.measuredMm)/r.nominalMm)*100).toFixed(1)+"%":"—"}</td></tr>)}</tbody></table>{assetInspections.length===0&&<div className="empty-state">No inspection records in this date range.</div>}</div></div>
        <div><div className="panel-kicker">PRODUCTION CONTEXT</div><div className="table-scroll"><table><thead><tr><th>DATE</th><th>PRESSURE</th><th>TEMP.</th><th>GAS</th><th>WATER</th><th>OIL</th></tr></thead><tbody>{assetProduction.slice(0,12).map((r,i)=><tr key={r.date+"-"+i}><td>{dateLabel(r.date)}</td><td>{Number(r.pressure).toFixed(1)} bar</td><td>{Number(r.temperature).toFixed(1)} °C</td><td>{Number(r.gas).toFixed(2)}</td><td>{Number(r.water).toFixed(0)}</td><td>{Number(r.oil).toFixed(0)}</td></tr>)}</tbody></table>{assetProduction.length===0&&<div className="empty-state">No production readings in this date range.</div>}</div></div>
      </div>
 
      <div className="detail-grid" style={{marginTop:18}}><div className="sub-panel"><h3>Wall thickness trend</h3><p>Lowest measured thickness per inspection date; nominal reference is shown above</p><LineChart points={thicknessTrend} unit="mm" digits={2} min={0} max={thicknessAxisMax}/></div><div className="sub-panel"><h3>Operating pressure trend</h3><p>Pressure readings for the selected asset</p><LineChart points={pressureTrend} unit="bar" digits={1} min={0} max={pressureAxisMax}/></div></div>
   </section>}

    <section className="panel" style={{padding:22}}>
      <div className="panel-heading"><div><div className="panel-kicker">US-07 / THICKNESS SCREENING</div><h2>Assets requiring review</h2><p>Prototype screening flags wall loss of 20% or more against nominal thickness. This is not an engineering minimum allowable thickness.</p></div><span className="attention-number">{alerts.length.toString().padStart(2,"0")}</span></div>
      <div className="table-scroll"><table><thead><tr><th>ASSET</th><th>AREA</th><th>NOMINAL</th><th>ACTUAL</th><th>WALL LOSS</th><th>REVIEW</th></tr></thead><tbody>{alerts.map(a=><tr key={a.asset_id}><td><div className="asset-name">{a.asset_name}</div><div className="asset-id">{a.asset_id}</div></td><td>{a.area}</td><td>{Number(a.nominal_thickness).toFixed(2)} mm</td><td>{Number(a.latest_thickness).toFixed(2)} mm</td><td>{a.loss.toFixed(1)}%</td><td><span className="status-badge status-critical">Review</span></td></tr>)}</tbody></table>{alerts.length===0&&<div className="empty-state">No assets meet the current screening threshold.</div>}</div>
    </section>
    <p className="demo-note" style={{marginTop:12}}>Data shown comes from the connected project database and includes prototype/sample records. External SAP and Direct Viewer integrations are not active.</p>
  </div>;
}

function InsightMetric({label,value,icon}:{label:string;value:string|number;icon?:ReactNode}) {
  return <div className="metric-card"><div className="metric-label">{label}</div><div className="metric-value">{value}</div>{icon&&<div className="metric-icon">{icon}</div>}</div>;
}
