/**
 * tools/download-assets.mjs — Pre-downloads externalized 3D GLB & Lyria 3.5 MP3 assets
 * from public Google Cloud Storage into `public/assets/` during `predev` and `prebuild`
 * (matching Pelican Campus Quest's gallery asset bootstrap with SHA-256 verification).
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GCS_BASE_URL = "https://storage.googleapis.com/aistudio-applet-demos-assets/parking-bench/";

const ASSET_MANIFEST = [
  {
    remoteFile: "board_tray_12x12.glb",
    localRelPath: "public/assets/glb/board_tray_12x12.glb",
    expectedBytes: 1906280,
    sha256: "d471c76ad735bb2ff2080ed777d0b20fb7663c53c36296e0bda07812e7be6fed",
  },
  {
    remoteFile: "kitchen_props.glb",
    localRelPath: "public/assets/glb/kitchen_props.glb",
    expectedBytes: 3571744,
    sha256: "451932fef81e3622a680617f136a3da7adb8444148da401ab71e1774c6aa92cd",
  },
  {
    remoteFile: "vehicles_fleet_10models.glb",
    localRelPath: "public/assets/glb/vehicles_fleet_10models.glb",
    expectedBytes: 10635728,
    sha256: "9987d18d3a91e5e67cea49939b2f91fbfe742e31e4ce3158696ec7c9d20ff846",
  },
  {
    remoteFile: "lofi_chillhop_loop.mp3",
    localRelPath: "public/assets/audio/lofi_chillhop_loop.mp3",
    expectedBytes: 481114,
    sha256: "12d693a81d231894394591fb03db3c72a51edfb01d882e482458ca98e4afca69",
  },
];

function sha256Hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function ensureSingleAsset(entry) {
  const destPath = path.join(ROOT_DIR, entry.localRelPath);
  try {
    const existing = await fs.readFile(destPath);
    if (existing.length === entry.expectedBytes && sha256Hex(existing) === entry.sha256) {
      return;
    }
  } catch {
    // File not cached locally yet; proceed to fetch from GCS.
  }

  await fs.mkdir(path.dirname(destPath), { recursive: true });
  const targetUrl = new URL(entry.remoteFile, GCS_BASE_URL).href;

  const res = await fetch(targetUrl, { redirect: "error" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${targetUrl}`);
  }
  const fetched = Buffer.from(await res.arrayBuffer());
  if (fetched.length !== entry.expectedBytes || sha256Hex(fetched) !== entry.sha256) {
    throw new Error(
      `Integrity mismatch on ${entry.remoteFile}: got ${fetched.length} bytes`
    );
  }

  await fs.writeFile(destPath, fetched);
  console.log(`[download-assets] Ready ${entry.localRelPath} (${fetched.length} bytes)`);
}

async function main() {
  try {
    await Promise.all(ASSET_MANIFEST.map((entry) => ensureSingleAsset(entry)));
  } catch (err) {
    console.warn(
      "[download-assets] Local asset pre-cache skipped (browser will stream directly from GCS):",
      err
    );
  }
}

main();
