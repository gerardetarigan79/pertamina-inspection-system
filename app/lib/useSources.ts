"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InspectionRecord, ProductionRecord, SyncResult } from "./types";

type SourceState<T> = { records: T[]; result: SyncResult | null };

function useDatabaseSource<T>(endpoint: string, label: string, notify: (message: string) => void) {
  const [state, setState] = useState<SourceState<T>>({ records: [], result: null });
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const sync = useCallback(async (silent = false) => {
    setSyncing(true);
    setError("");
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success || !Array.isArray(payload.records)) {
        throw new Error(payload.message ?? `Unable to load ${label.toLowerCase()} from Neon.`);
      }
      setState({ records: payload.records as T[], result: null });
      if (!silent) notifyRef.current(`${label}: loaded ${payload.records.length} records from Neon.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Unable to load ${label.toLowerCase()}.`);
    } finally {
      setReady(true);
      setSyncing(false);
    }
  }, [endpoint, label]);

  useEffect(() => { void sync(true); }, [sync]);

  return { state, ready, syncing, error, sync };
}

export const useProductionSource = (notify: (message: string) => void) =>
  useDatabaseSource<ProductionRecord>("/api/production", "Production data", notify);

export const useInspectionSource = (notify: (message: string) => void) =>
  useDatabaseSource<InspectionRecord>("/api/inspections", "Inspection records", notify);
