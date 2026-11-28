import { describe, expect, it } from "vitest";
import type { Vec2 } from "@/game/types";
import { SKINS, FORM_INFO, type SkinForm } from "@/game/skins";
import { createSnake } from "@/game/snake";
import {
  ALL_ART_IDS,
  ART_SPECS,
  FORM_ARTS,
  HEAD_SPECS,
  LayoutBuffer,
  headRotationFor,
  headBreathFor,
  layoutSnake,
} from "@/render/skinLayout";

const FORMS = Object.keys(HEAD_SPECS) as SkinForm[];

/** A curved, evenly spaced body (head first) like the engine produces. */
function curvedBody(radius: number, count = 120): Vec2[] {
  const pts: Vec2[] = [];
  const spacing = radius * 0.8;
  let x = 2000;
  let y = 2000;
  let a = 0;
  for (let i = 0; i < count; i++) {
    pts.push({ x, y });
    a += 0.05;
    x -= Math.cos(a) * spacing;
    y -= Math.sin(a) * spacing;
  }
  return pts;
}

describe("structural skin layout engine", () => {
  it("has art specs, head specs and labels for every form", () => {
    for (const form of FORMS) {
      expect(FORM_INFO[form].label.length).toBeGreaterThan(0);
      expect(ART_SPECS[HEAD_SPECS[form].art]).toBeDefined();
      expect(FORM_ARTS[form]).toContain(HEAD_SPECS[form].art);
      for (const art of FORM_ARTS[form]) expect(ALL_ART_IDS).toContain(art);
    }
    for (const skin of SKINS) expect(FORMS).toContain(skin.form);
  });

  it("emits valid, finite placements using only the form's own art", () => {
    const pts = curvedBody(14);
    for (const form of FORMS) {
      const buf = new LayoutBuffer();
      const n = layoutSnake(form, { points: pts, radius: 14, angle: 0, time: 1.7, boosting: false }, buf);
      expect(n, form).toBeGreaterThan(5);
      for (let i = 0; i < n; i++) {
        const p = buf.items[i];
        expect(FORM_ARTS[form], `${form}:${p.art}`).toContain(p.art);
        for (const v of [p.x, p.y, p.rot, p.w, p.h, p.alpha]) expect(Number.isFinite(v)).toBe(true);
        expect(p.w).toBeGreaterThan(0);
        expect(p.h).toBeGreaterThan(0);
        expect(p.alpha).toBeGreaterThan(0);
        expect(p.alpha).toBeLessThanOrEqual(1.0001);
      }
    }
  });

  it("keeps pixel blocks axis-aligned and snaps the pixel head to 4 directions", () => {
    const buf = new LayoutBuffer();
    const n = layoutSnake("pixel", { points: curvedBody(12), radius: 12, angle: 0.3, time: 0, boosting: false }, buf);
    for (let i = 0; i < n; i++) expect(buf.items[i].rot).toBe(0);
    for (const a of [0.3, 1.2, 2.9, -2.0]) {
      const snapped = headRotationFor("pixel", a);
      expect(Math.abs((snapped / (Math.PI / 2)) % 1)).toBeLessThan(1e-9);
    }
    expect(headRotationFor("train", 0.37)).toBeCloseTo(0.37);
  });

  it("articulates train carriages through a bend and ends with a caboose", () => {
    const buf = new LayoutBuffer();
    const n = layoutSnake("train", { points: curvedBody(14), radius: 14, angle: 0, time: 0, boosting: false }, buf);
    const cars = buf.items.slice(0, n).filter((p) => p.art !== "train.link");
    const rots = new Set(cars.map((c) => c.rot.toFixed(2)));
    expect(rots.size).toBeGreaterThan(3);
    expect(cars[0].art).toBe("train.caboose");
    expect(buf.items.slice(0, n).some((p) => p.art === "train.link")).toBe(true);
  });

  it("builds two interleaved helix strands plus rungs", () => {
    const buf = new LayoutBuffer();
    const n = layoutSnake("helix", { points: curvedBody(14), radius: 14, angle: 0, time: 0.9, boosting: false }, buf);
    const items = buf.items.slice(0, n);
    const dots = items.filter((p) => p.art.startsWith("helix.a") || p.art.startsWith("helix.b"));
    const strandA = dots.filter((p) => p.art.startsWith("helix.a")).length;
    const strandB = dots.filter((p) => p.art.startsWith("helix.b")).length;
    expect(strandA).toBeGreaterThan(10);
    expect(strandB).toBeGreaterThan(10);
    expect(items.some((p) => p.art === "helix.rung")).toBe(true);
  });

  it("returns nothing for degenerate bodies instead of throwing", () => {
    const buf = new LayoutBuffer();
    for (const form of FORMS) {
      expect(layoutSnake(form, { points: [{ x: 0, y: 0 }], radius: 10, angle: 0, time: 0, boosting: false }, buf)).toBe(0);
      expect(layoutSnake(form, { points: curvedBody(10, 3), radius: 0, angle: 0, time: 0, boosting: false }, buf)).toBe(0);
    }
  });

  it("never changes physics: every skin builds an identical snake body", () => {
    const base = createSnake({ id: 1, name: "a", x: 500, y: 500, angle: 0.4, skin: "mint", isPlayer: true, length: 220 });
    for (const skin of SKINS) {
      const s = createSnake({ id: 1, name: "a", x: 500, y: 500, angle: 0.4, skin: skin.id, isPlayer: true, length: 220 });
      expect(s.radius).toBe(base.radius);
      expect(s.points).toEqual(base.points);
    }
  });

  it("new paper objects replace gummy segments with four distinct structures", () => {
    const forms: SkinForm[] = ["koi", "jellyfish", "cinema", "kite"];
    const pts = curvedBody(14);
    for (const form of forms) {
      const buffer = new LayoutBuffer();
      const n = layoutSnake(form, { points: pts, radius: 14, angle: 0.4, time: 0.7, boosting: false }, buffer);
      expect(n).toBeGreaterThan(10);
      expect(buffer.items.slice(0, n).every((p) => !p.art.startsWith("classic."))).toBe(true);
    }
  });

  it("paper fins and fluid ribbons animate without moving the physical spine", () => {
    const pts = curvedBody(14);
    const before = JSON.stringify(pts);
    for (const form of ["koi", "jellyfish", "kite"] as SkinForm[]) {
      const buffer = new LayoutBuffer();
      layoutSnake(form, { points: pts, radius: 14, angle: 0, time: 0, boosting: false }, buffer);
      const a = JSON.stringify(buffer.items.slice(0, buffer.count));
      layoutSnake(form, { points: pts, radius: 14, angle: 0, time: 1.8, boosting: false }, buffer);
      expect(JSON.stringify(buffer.items.slice(0, buffer.count))).not.toBe(a);
    }
    expect(JSON.stringify(pts)).toBe(before);
    expect(headBreathFor("jellyfish", 0.7)).not.toBe(headBreathFor("jellyfish", 1.9));
    expect(headBreathFor("classic", 1.9)).toBe(1);
  });

  it("the cinema body contains every film frame and koi end in a fan tail", () => {
    const buffer = new LayoutBuffer();
    const input = { points: curvedBody(14), radius: 14, angle: 0, time: 0, boosting: false };
    layoutSnake("cinema", input, buffer);
    const arts = new Set(buffer.items.slice(0, buffer.count).map((p) => p.art));
    expect(arts).toEqual(new Set(["film.frame0", "film.frame1", "film.frame2"]));
    layoutSnake("koi", input, buffer);
    expect(buffer.items[0].art).toBe("koi.tail");
    expect(buffer.items.some((p) => p.art === "koi.fin")).toBe(true);
  });

  it("interleaves two zipper rails with matching teeth and an articulated pull tab", () => {
    const buf = new LayoutBuffer();
    layoutSnake("zipper", { points: curvedBody(14), radius: 14, angle: 0, time: .7, boosting: false }, buf);
    const items = buf.items.slice(0, buf.count);
    expect(items.filter((p) => p.art === "zip.fabric").length).toBeGreaterThan(items.filter((p) => p.art === "zip.teeth").length);
    expect(items.filter((p) => p.art === "zip.teeth").length).toBeGreaterThan(10);
    expect(items.at(-1)?.art).toBe("zip.pull");
  });

  it("rotates adjacent clockwork wheels in opposite directions", () => {
    const buf = new LayoutBuffer();
    const input = { points: curvedBody(14), radius: 14, angle: 0, time: 0, boosting: false };
    layoutSnake("clockwork", input, buf);
    const a = buf.items.slice(0, buf.count).filter((p) => p.art.startsWith("clock.gear")).map((p) => ({ ...p }));
    layoutSnake("clockwork", { ...input, time: 1 }, buf);
    const b = buf.items.slice(0, buf.count).filter((p) => p.art.startsWith("clock.gear"));
    expect(a.length).toBeGreaterThan(8);
    a.forEach((item, i) => {
      expect(b[i].x).toBe(item.x); expect(b[i].y).toBe(item.y);
      expect(Math.sign(b[i].rot - item.rot)).toBe(item.art === "clock.gear0" ? 1 : -1);
    });
    layoutSnake("clockwork", { ...input, time: 20, motionTime: 8, boosting: false }, buf);
    const beforeBoost = buf.items.slice(0, buf.count).map((p) => p.rot);
    layoutSnake("clockwork", { ...input, time: 20, motionTime: 8, boosting: true }, buf);
    expect(buf.items.slice(0, buf.count).map((p) => p.rot)).toEqual(beforeBoost);
  });

  it("builds a branching garden and moving satellites instead of gummy circles", () => {
    const points = curvedBody(14); const original = JSON.stringify(points); const buf = new LayoutBuffer();
    for (const form of ["botanical", "orbital"] as SkinForm[]) {
      layoutSnake(form, { points, radius: 14, angle: 0, time: 0, boosting: false }, buf);
      const a = JSON.stringify(buf.items.slice(0, buf.count));
      expect(buf.items.slice(0, buf.count).every((p) => !p.art.startsWith("classic."))).toBe(true);
      layoutSnake(form, { points, radius: 14, angle: 0, time: 1.7, boosting: false }, buf);
      expect(JSON.stringify(buf.items.slice(0, buf.count))).not.toBe(a);
    }
    expect(JSON.stringify(points)).toBe(original);
  });
});
