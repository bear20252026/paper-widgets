/**
 * src/assets/kitchenPropsGlb.js — Externalized Sunlit Kitchen Tabletop Props GLB Loader
 */

import { createPreloadedAssetFetcher } from "./assetLoader.js";

export const GLB_META = {
  rawBytes: 3571744,
  gzBytes: 2296587,
  compressed: true,
};

const { remoteUrl, fetchBuffer } = createPreloadedAssetFetcher({
  localUrl: "./assets/glb/kitchen_props.glb",
  remoteFileName: "kitchen_props.glb",
  expectGlbMagic: true,
  minBytes: 100000,
});

export const KITCHEN_PROPS_GLB_URL = remoteUrl;

export async function decodeKitchenPropsGlbBuffer() {
  return fetchBuffer();
}
