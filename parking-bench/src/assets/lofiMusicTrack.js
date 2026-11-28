/**
 * src/assets/lofiMusicTrack.js — Externalized Lyria 3.5 Sunlit Cafe Lo-Fi Chillhop Loop Loader
 */

import { createPreloadedAssetFetcher } from "./assetLoader.js";

export const LOFI_CHILL_MP3_META = {
  rawBytes: 481114,
  bpm: 82,
  model: "lyria-3.5",
};

const { remoteUrl, fetchBuffer } = createPreloadedAssetFetcher({
  localUrl: "./assets/audio/lofi_chillhop_loop.mp3",
  remoteFileName: "lofi_chillhop_loop.mp3",
  expectGlbMagic: false,
  minBytes: 50000,
});

export const LOFI_CHILL_MP3_URL = remoteUrl;

export async function fetchLofiChillMp3Buffer() {
  return fetchBuffer();
}
