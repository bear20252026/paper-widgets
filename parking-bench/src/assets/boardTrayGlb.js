/**
 * src/assets/boardTrayGlb.js — Externalized 6×6 Wooden-and-Slate Board Tray GLB Loader
 */

import { createPreloadedAssetFetcher } from "./assetLoader.js";

export const GLB_META = {
  rawBytes: 1906280,
  gzBytes: 1643057,
  compressed: true,
};

const { remoteUrl, fetchBuffer } = createPreloadedAssetFetcher({
  localUrl: "./assets/glb/board_tray_12x12.glb",
  remoteFileName: "board_tray_12x12.glb",
  expectGlbMagic: true,
  minBytes: 100000,
});

export const BOARD_TRAY_GLB_URL = remoteUrl;

export async function decodeBoardTrayGlbBuffer() {
  return fetchBuffer();
}
