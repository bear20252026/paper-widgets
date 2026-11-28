/**
 * src/assets/vehiclesGlb.js — Externalized 10-Model Collector Die-Cast Fleet GLB Loader
 */

import { createPreloadedAssetFetcher } from "./assetLoader.js";

export const GLB_META = {
  rawBytes: 10635728,
  gzBytes: 8512910,
  compressed: true,
};

const { remoteUrl, fetchBuffer } = createPreloadedAssetFetcher({
  localUrl: "./assets/glb/vehicles_fleet_10models.glb",
  remoteFileName: "vehicles_fleet_10models.glb",
  expectGlbMagic: true,
  minBytes: 500000,
});

export const VEHICLES_GLB_URL = remoteUrl;

export async function decodeVehiclesGlbBuffer() {
  return fetchBuffer();
}
