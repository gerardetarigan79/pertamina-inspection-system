import type { RegisteredAsset } from "./types";

/** Resolve an asset only from the current asset register returned by Neon. */
export function getAsset(assets: readonly RegisteredAsset[], id: string | null | undefined) {
  if (!id) return undefined;
  return assets.find((asset) => asset.id === id);
}
