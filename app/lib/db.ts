import { neon } from "@neondatabase/serverless";
import { getDatabaseUrl } from "./env";

/** Get a Neon HTTP query function for the configured pooled database URL. */
export function getSql() {
  return neon(getDatabaseUrl());
}
