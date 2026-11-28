/**
 * src/assets/assetLoader.js — Parallel Binary Asset Preloader (Public GCS + Same-Origin Fallback)
 * Project: Parking Bench · 6×6 Race
 *
 * Preloads externalized `.glb` and `.mp3` binaries in parallel at module evaluation time from
 * Google Cloud Storage (`Access-Control-Allow-Origin: *`, `Cache-Control: immutable`) with
 * same-origin `./assets/...` fallback so all 3D die-cast vehicles, wooden trays, kitchen props,
 * and Lyria 3.5 lo-fi audio resolve before Frame 0 with zero pop-in and zero 404 console noise.
 */

export const GCS_ASSET_BASE_URL =
  "https://storage.googleapis.com/aistudio-applet-demos-assets/parking-bench/";

const GLB_MAGIC_LE = 0x46546c67; // "glTF" in little-endian

function isValidBinaryBuffer(buf, { expectGlbMagic = false, minBytes = 1024 } = {}) {
  if (!(buf instanceof ArrayBuffer) || buf.byteLength < minBytes) {
    return false;
  }
  const view = new DataView(buf);
  if (expectGlbMagic) {
    return view.getUint32(0, true) === GLB_MAGIC_LE;
  }
  const b0 = view.getUint8(0);
  const b1 = view.getUint8(1);
  if (b0 === 0x3c || (b0 === 0x20 && b1 === 0x3c)) {
    return false;
  }
  return true;
}

export function createPreloadedAssetFetcher({
  localUrl,
  remoteFileName,
  expectGlbMagic = false,
  minBytes = 1024,
}) {
  const remoteUrl = `${GCS_ASSET_BASE_URL}${remoteFileName}`;
  let inflightPromise = null;

  const loadOnce = async () => {
    if (typeof fetch !== "function") {
      return null;
    }

    // 1. Stream directly from public CORS-enabled Google Cloud Storage CDN (`200 OK`, zero 404s)
    try {
      const remoteRes = await fetch(remoteUrl, {
        mode: "cors",
        credentials: "omit",
      });
      if (remoteRes.ok) {
        const remoteBuf = await remoteRes.arrayBuffer();
        if (isValidBinaryBuffer(remoteBuf, { expectGlbMagic, minBytes })) {
          return remoteBuf;
        }
      }
    } catch {
      // Fall through to same-origin `public/assets/...` populated by `tools/download-assets.mjs`.
    }

    // 2. Fallback to same-origin `./assets/...` pre-cached on container disk
    if (localUrl) {
      const localRes = await fetch(localUrl, { credentials: "same-origin" });
      if (localRes.ok) {
        const ct = String(localRes.headers.get("content-type") || "").toLowerCase();
        if (!ct.includes("text/html")) {
          const localBuf = await localRes.arrayBuffer();
          if (isValidBinaryBuffer(localBuf, { expectGlbMagic, minBytes })) {
            return localBuf;
          }
        }
      }
    }

    throw new Error(`Asset fetch failed for ${remoteUrl}`);
  };

  const fetchBuffer = () => {
    if (!inflightPromise) {
      inflightPromise = loadOnce().catch((err) => {
        inflightPromise = null;
        console.error(`[assetLoader] Failed to load ${remoteFileName}:`, err);
        throw err;
      });
    }
    return inflightPromise;
  };

  // Start parallel preload immediately in browser environments
  if (typeof window !== "undefined" && typeof fetch === "function") {
    fetchBuffer().catch(() => {});
  }

  return { remoteUrl, fetchBuffer };
}
