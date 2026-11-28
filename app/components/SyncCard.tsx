"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  title: string;
  description: string;
  recordCount: number;
  syncing: boolean;
  ready: boolean;
  error: string;
  onSync: () => void;
};

export default function SyncCard({ icon, title, description, recordCount, syncing, ready, error, onSync }: Props) {
  return (
    <section className="panel sync-card">
      <div className="sync-main">
        <span className="sync-icon">{icon}</span>
        <div className="sync-copy">
          <strong>{title}</strong>
          <small>{description}</small>
          <small className="sync-meta">
            {!ready ? "Loading records from Neon…" : syncing ? "Refreshing records from Neon…" : `${recordCount.toLocaleString("en-US")} records currently available in Neon`}
          </small>
        </div>
        <button className="button button-primary" onClick={onSync} disabled={syncing || !ready}>
          <RefreshCw size={15} className={syncing ? "spin" : ""} /> {syncing ? "Refreshing…" : "Refresh from Neon"}
        </button>
      </div>
      {error && <div className="sync-error"><AlertTriangle size={14} /> {error}</div>}
    </section>
  );
}
