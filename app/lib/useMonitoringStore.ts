"use client";

import { useCallback, useEffect, useState } from "react";
import type { MonitoringRecord } from "./types";

export function useMonitoringStore() {
  const [records, setRecords] = useState<MonitoringRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/monitoring", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success || !Array.isArray(payload.records)) {
        throw new Error(payload.message ?? "Unable to load corrosion monitoring from Neon.");
      }
      setRecords(payload.records as MonitoringRecord[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load corrosion monitoring.");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const add = useCallback(async (record: MonitoringRecord) => {
    const response = await fetch("/api/monitoring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.message ?? "Unable to save monitoring record.");
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    const response = await fetch(`/api/monitoring?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.message ?? "Unable to delete monitoring record.");
    await refresh();
  }, [refresh]);

  return { records, ready, error, add, remove, refresh };
}
