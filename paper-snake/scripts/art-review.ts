import { createCanvas } from "@napi-rs/canvas";
import { mkdirSync, writeFileSync } from "node:fs";
import { CURIOUS_SKINS } from "../src/game/skins";
import { setArtCanvasFactory } from "../src/render/skinArt";
import { drawSkinPreview } from "../src/render/skinPreview";

// Optional visual QA; this script and its native canvas backend are not bundled.
setArtCanvasFactory((w, h) => createCanvas(w, h) as unknown as HTMLCanvasElement);
mkdirSync("artifacts", { recursive: true });
const w = 600, h = 550;
const sheet = createCanvas(w * 2, h * 2);
const ctx = sheet.getContext("2d") as unknown as CanvasRenderingContext2D;
ctx.fillStyle = "#f8f7f2"; ctx.fillRect(0, 0, w * 2, h * 2);
ctx.strokeStyle = "rgba(120,145,110,.09)";
for (let x = 0; x < w * 2; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h * 2); ctx.stroke(); }
for (let y = 0; y < h * 2; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w * 2, y); ctx.stroke(); }
CURIOUS_SKINS.forEach((skin, i) => {
  ctx.save(); ctx.translate(i % 2 * w, Math.floor(i / 2) * h);
  ctx.fillStyle = "#283e35"; ctx.font = "600 20px sans-serif"; ctx.fillText(skin.englishName ?? skin.name, 28, 35);
  ctx.fillStyle = "#839176"; ctx.font = "11px sans-serif"; ctx.fillText(`CURIOUS OBJECTS / ${skin.form}`, 28, 58);
  ctx.translate(0, 55);
  drawSkinPreview(ctx, skin, { width: w, height: h - 70, time: .9, pose: "portrait", orbs: false });
  ctx.restore();
});
writeFileSync("artifacts/curious-objects.png", sheet.toBuffer("image/png"));
console.log("Rendered all four curious-object structures with production artwork.");