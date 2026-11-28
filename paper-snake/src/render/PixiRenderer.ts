import {
  Application,
  Container,
  Graphics,
  Sprite,
  Text,
  TilingSprite,
  Rectangle,
  TextStyleOptions,
} from "pixi.js";
import type { GameEvent, GameState, Orb, PowerKind, Snake } from "../game/types";
import { POWER_INFO, powerActive } from "../game/powerups";
import { t } from "../i18n";
import { cameraScaleForLength, displayLength } from "../game/speed";
import { getSkin, type SkinForm } from "../game/skins";
import {
  artTexture,
  arrowTexture,
  colorNumber,
  crownTexture,
  glowTexture,
  gridTexture,
  headTexture,
  orbTexture,
  powerTexture,
  ringTexture,
} from "./textures";
import { HEAD_SPECS, LayoutBuffer, headBreathFor, headRotationFor, layoutSnake } from "./skinLayout";

const ORB_POOL_SIZE = 1200;
const BODY_POOL_SIZE = 4200;
const FX_POOL_SIZE = 140;
const POPUP_POOL_SIZE = 20;
const POWER_POOL_SIZE = 16;

const POWER_POPUP: Record<PowerKind, string> = {
  magnet: "磁铁！",
  shield: "护盾！",
  turbo: "疾风！",
  double: "双倍光点！",
};

const GRID_TILE = 96;
const ARENA_SIZE = 4400;
/** Exact multiple of 96 (23 * 96 = 2208) so cached quadrants join with zero seam. */
const QUAD_SPLIT = 2208;
const QUAD_MARGIN = 384; // 4 * 96 outside the arena walls

/** Custom culling flag used by the manual viewport pass. */
class CullableSprite extends Sprite {
  cullable = true;
  isInterpolated = false;
}

interface SnakeView {
  container: Container;
  head: Sprite;
  aura: Graphics;
  ring: Graphics;
  shield: Graphics;
  magnet: Graphics;
  crown: Sprite;
  arrow: Sprite;
  label: Text;
  skin: string;
  form: SkinForm;
  labelText: string;
}

interface FxParticle {
  sprite: CullableSprite;
  life: number;
  max: number;
  vx: number;
  vy: number;
  startScale: number;
  endScale: number;
  isRing: boolean;
}

interface FloatingPopup {
  text: Text;
  life: number;
  max: number;
  vy: number;
}

export interface RenderSettings {
  showDirectionArrow: boolean;
  showNames: boolean;
}

/**
 * PixiJS 8 commercial presentation layer. Strictly read-only on GameState:
 *  - World-anchored scrolling graph-paper arena in its own RenderGroup, split into
 *    4 static quadrants each cached once with cacheAsTexture(true) & cullable = true
 *  - Dynamic RenderGroup for all snakes, orbs, particles & floating combat popups
 *  - Preallocated Sprite/Text pools with shared textures (zero per-frame allocations)
 *  - Tail-to-head layered plump 2.5D segments, tapered tails, dual-band skins,
 *    Snake King crown, direction guide arrow, gulp bounce & kill burst VFX
 */
export class PixiRenderer {
  readonly app: Application;
  private root = new Container();
  /** isolated RenderGroup for the static paper background quadrants */
  private bgGroup = new Container();
  private bgQuads: { container: Container; left: number; top: number; right: number; bottom: number }[] = [];
  /** isolated RenderGroup for all dynamic snakes / orbs / VFX */
  private dynamicGroup = new Container();
  private world = new Container();
  private border = new Graphics();
  private orbLayer = new Container();
  private fxLayer = new Container();
  private bodyLayer = new Container();
  private headLayer = new Container();
  private popupLayer = new Container();
  private powerLayer = new Container();
  private powerPool: { badge: Sprite; halo: Graphics }[] = [];

  private orbPool: CullableSprite[] = [];
  private bodyPool: CullableSprite[] = [];
  private fxPool: CullableSprite[] = [];
  private fx: (FxParticle | null)[] = new Array(FX_POOL_SIZE).fill(null);
  private fxCursor = 0;

  private popupPool: Text[] = [];
  private popups: (FloatingPopup | null)[] = new Array(POPUP_POOL_SIZE).fill(null);
  private popupCursor = 0;

  private views = new Map<number, SnakeView>();
  private usedOrbs = 0;
  private usedBodies = 0;
  private lastTimeMs = 0;
  private width = 1;
  private height = 1;
  private shakeAmp = 0;
  private focusPos = { x: 0, y: 0 };
  private layout = new LayoutBuffer();
  private playerLayout = new LayoutBuffer();
  private skinMotion = new Map<number, { at: number; time: number }>();

  settings: RenderSettings = {
    showDirectionArrow: true,
    showNames: true,
  };

  camera = { x: 2200, y: 2200, zoom: 0.95 };

  constructor(app: Application) {
    this.app = app;
    this.app.ticker.stop();

    this.bgGroup.label = "static-paper-background-group";
    this.bgGroup.enableRenderGroup();
    this.buildCachedPaperQuadrants();

    this.dynamicGroup.label = "dynamic-snakes-and-orbs";
    this.dynamicGroup.enableRenderGroup();
    this.dynamicGroup.addChild(this.world);
    this.world.addChild(
      this.border,
      this.orbLayer,
      this.powerLayer,
      this.fxLayer,
      this.bodyLayer,
      this.headLayer,
      this.popupLayer
    );

    this.root.addChild(this.bgGroup, this.dynamicGroup);
    this.app.stage.addChild(this.root);

    const orbTex = orbTexture();
    for (let i = 0; i < ORB_POOL_SIZE; i++) {
      const s = new CullableSprite(orbTex);
      s.anchor.set(0.5);
      s.visible = false;
      s.cullable = true;
      this.orbLayer.addChild(s);
      this.orbPool.push(s);
    }

    for (let i = 0; i < POWER_POOL_SIZE; i++) {
      const halo = new Graphics();
      halo.circle(0, 0, 40).fill({ color: 0xffffff, alpha: 0.22 });
      halo.circle(0, 0, 40).stroke({ width: 2.5, color: 0xffffff, alpha: 0.85 });
      halo.visible = false;
      const badge = new Sprite(powerTexture("magnet"));
      badge.anchor.set(0.5);
      badge.visible = false;
      this.powerLayer.addChild(halo, badge);
      this.powerPool.push({ badge, halo });
    }

    const defaultBody = artTexture("mint", "classic.band0");
    for (let i = 0; i < BODY_POOL_SIZE; i++) {
      const s = new CullableSprite(defaultBody);
      s.anchor.set(0.5);
      s.visible = false;
      s.cullable = true;
      this.bodyLayer.addChild(s);
      this.bodyPool.push(s);
    }

    const glowTex = glowTexture();
    for (let i = 0; i < FX_POOL_SIZE; i++) {
      const s = new CullableSprite(glowTex);
      s.anchor.set(0.5);
      s.visible = false;
      s.cullable = true;
      this.fxLayer.addChild(s);
      this.fxPool.push(s);
    }

    const popupStyle: TextStyleOptions = {
      fontFamily: '"Baloo 2", "PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: 24,
      fontWeight: "800",
      fill: 0xfff3a8,
      stroke: { color: 0x173a30, width: 5 },
      align: "center",
    };
    for (let i = 0; i < POPUP_POOL_SIZE; i++) {
      const t = new Text({ text: "", style: popupStyle });
      t.anchor.set(0.5);
      t.visible = false;
      t.cullable = true;
      (t as unknown as { isInterpolated?: boolean }).isInterpolated = false;
      this.popupLayer.addChild(t);
      this.popupPool.push(t);
    }

    this.drawArenaBorder();
    this.resize(app.screen.width, app.screen.height);
  }

  /**
   * Build 4 static world-space graph-paper quadrants inside bgGroup and cache
   * each once as a GPU texture (cacheAsTexture). Because coordinates are exact
   * multiples of GRID_TILE (96), scrolling across quadrant seams is invisible.
   */
  private buildCachedPaperQuadrants(): void {
    const xRanges: [number, number][] = [
      [-QUAD_MARGIN, QUAD_SPLIT],
      [QUAD_SPLIT, ARENA_SIZE + QUAD_MARGIN],
    ];
    const yRanges: [number, number][] = [
      [-QUAD_MARGIN, QUAD_SPLIT],
      [QUAD_SPLIT, ARENA_SIZE + QUAD_MARGIN],
    ];
    const gridTex = gridTexture();

    for (const [x0, x1] of xRanges) {
      for (const [y0, y1] of yRanges) {
        const w = x1 - x0;
        const h = y1 - y0;
        const quad = new Container();
        quad.cullable = true;
        quad.position.set(x0, y0);
        quad.boundsArea = new Rectangle(0, 0, w, h);

        const paper = new TilingSprite({
          texture: gridTex,
          width: w,
          height: h,
        });
        paper.tilePosition.set(
          ((-x0 % GRID_TILE) + GRID_TILE) % GRID_TILE,
          ((-y0 % GRID_TILE) + GRID_TILE) % GRID_TILE
        );
        quad.addChild(paper);

        // Explicit bounds stop a quadrant cache from expanding to the whole arena.
        quad.cacheAsTexture({ resolution: 0.5, antialias: false });
        this.bgGroup.addChild(quad);
        this.bgQuads.push({ container: quad, left: x0, top: y0, right: x1, bottom: y1 });
      }
    }
  }

  private drawArenaBorder(): void {
    const g = this.border;
    const W = ARENA_SIZE;
    const H = ARENA_SIZE;
    g.clear();
    // outer soft danger frame
    g.roundRect(-96, -96, W + 192, H + 192, 86).stroke({
      width: 4,
      color: 0xff7a5c,
      alpha: 0.25,
    });
    g.roundRect(-16, -16, W + 32, H + 32, 54).stroke({
      width: 14,
      color: 0xff9a80,
      alpha: 0.24,
    });
    // crisp double arena boundary
    g.roundRect(0, 0, W, H, 44).stroke({ width: 5, color: 0x2d6e5b, alpha: 0.48 });
    g.roundRect(12, 12, W - 24, H - 24, 36).stroke({ width: 1.8, color: 0x5da18c, alpha: 0.28 });

    // ruler ticks every 384px along edges so speed & position feel tangible
    for (let p = 384; p < W; p += 384) {
      g.moveTo(p, 0).lineTo(p, 22).stroke({ width: 2.5, color: 0x2d6e5b, alpha: 0.32 });
      g.moveTo(p, H).lineTo(p, H - 22).stroke({ width: 2.5, color: 0x2d6e5b, alpha: 0.32 });
      g.moveTo(0, p).lineTo(22, p).stroke({ width: 2.5, color: 0x2d6e5b, alpha: 0.32 });
      g.moveTo(W, p).lineTo(W - 22, p).stroke({ width: 2.5, color: 0x2d6e5b, alpha: 0.32 });
    }
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.app.renderer.resize(this.width, this.height);
    this.app.canvas.style.width = "100%";
    this.app.canvas.style.height = "100%";
  }

  screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.app.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: (sx - this.width / 2) / this.camera.zoom + this.camera.x,
      y: (sy - this.height / 2) / this.camera.zoom + this.camera.y,
    };
  }

  worldToScreen(x: number, y: number): { x: number; y: number } {
    return {
      x: (x - this.camera.x) * this.camera.zoom + this.width / 2,
      y: (y - this.camera.y) * this.camera.zoom + this.height / 2,
    };
  }

  /** Visual-only reactions to GameEvents (never mutates simulation state). */
  triggerEventFx(event: GameEvent): void {
    if (event.type === "eat" && event.player) {
      if (event.tier === "corpse" || event.tier === "large") {
        this.spawnPopup(
          event.x,
          event.y - 10,
          `+${event.value}`,
          event.tier === "corpse" ? 0xffe066 : 0xb8f7d4,
          0.86
        );
        // Magnetic convergence: shards stream from the orb into the player's mouth.
        const dx = this.focusPos.x - event.x;
        const dy = this.focusPos.y - event.y;
        const d = Math.hypot(dx, dy) || 1;
        const speed = Math.min(680, d / 0.16);
        this.emitParticle({
          x: event.x,
          y: event.y,
          vx: 0,
          vy: 0,
          tint: event.tier === "corpse" ? 0xffd76a : 0x9ff7dc,
          life: 340,
          startScale: 0.34,
          endScale: 1.5,
          isRing: true,
        });
        for (let i = 0; i < 8; i++) {
          const spread = (i - 3.5) * 0.16;
          const a = Math.atan2(dy, dx) + spread;
          this.emitParticle({
            x: event.x + (Math.random() - 0.5) * 10,
            y: event.y + (Math.random() - 0.5) * 10,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed,
            tint: event.tier === "corpse" ? 0xffe066 : 0x7ef2d4,
            life: 170 + Math.random() * 90,
            startScale: 0.5,
            endScale: 0.08,
            isRing: false,
          });
        }
      }
      return;
    }
    if (event.type === "death") {
      const dist = Math.hypot(event.x - this.camera.x, event.y - this.camera.y);
      if (dist < 1400) {
        this.emitBurst(event.x, event.y, event.player ? 0xff7a5c : 0xffcf5c, event.player ? 20 : 14);
        if (event.player) this.shakeAmp = Math.max(this.shakeAmp, 11);
        else if (dist < 650) this.shakeAmp = Math.max(this.shakeAmp, 4.5);
      }
      return;
    }
    if (event.type === "tide") {
      this.emitBurst(event.x, event.y, 0xffd24a, 16);
      this.spawnPopup(event.x, event.y - 20, t("能量潮汐"), 0x9ff7dc, 1.05);
      return;
    }
    if (event.type === "power") {
      const color = parseInt(POWER_INFO[event.kind].color.slice(1), 16);
      if (Math.hypot(event.x - this.camera.x, event.y - this.camera.y) < 1400) {
        this.emitBurst(event.x, event.y, color, event.player ? 16 : 8);
      }
      if (event.player) {
        this.spawnPopup(event.x, event.y - 24, t(POWER_POPUP[event.kind]), color, 1.12);
        this.shakeAmp = Math.max(this.shakeAmp, 2.5);
      }
      return;
    }
    if (event.type === "shieldBlock") {
      this.emitParticle({ x: event.x, y: event.y, vx: 0, vy: 0, tint: 0x3ecfae, life: 360, startScale: 0.5, endScale: 2.2, isRing: true });
      return;
    }
    if (event.type === "revive") {
      this.shakeAmp = Math.max(this.shakeAmp, 4);
      return;
    }
    if (event.type === "bossSpawn") {
      this.shakeAmp = Math.max(this.shakeAmp, 3);
      return;
    }
    if (event.type === "bossDefeated") {
      this.emitBurst(event.x, event.y, 0xffd24a, 26);
      this.spawnPopup(event.x, event.y - 26, t("BOSS 击破!"), 0xffe47a, 1.3);
      this.shakeAmp = Math.max(this.shakeAmp, 9);
      return;
    }
    if (event.type === "kill" && event.player) {
      this.shakeAmp = Math.max(this.shakeAmp, event.wasKing ? 9.5 : 6.5);
      this.emitBurst(event.x, event.y, 0xffd76a, 18);
      this.spawnPopup(
        event.x,
        event.y - 24,
        event.wasKing ? t("👑 弑王!") : event.streak >= 2 ? t("{n}连杀!", { n: event.streak }) : t("击败!"),
        0xffe47a,
        1.18
      );
    }
  }

  /** Called from the fixed update step: writes render transforms only. */
  draw(state: GameState): void {
    const dtMs = Math.max(0, Math.min(80, state.timeMs - this.lastTimeMs));
    this.lastTimeMs = state.timeMs;
    const player = state.snakes.find((s) => s.id === state.playerId);
    // While the player is down, the camera drifts over to whoever got them.
    const killer = player && !player.alive && player.killerId !== null
      ? state.snakes.find((s) => s.id === player.killerId && s.alive)
      : undefined;
    const focus = killer ?? player ?? state.snakes[0];
    if (focus) this.focusPos = { x: focus.x, y: focus.y };
    if (focus) {
      const follow = 1 - Math.exp(-dtMs / 65);
      this.camera.x += (focus.x - this.camera.x) * follow;
      this.camera.y += (focus.y - this.camera.y) * follow;
      const want = cameraScaleForLength(focus.length) * (this.width < 760 ? 0.92 : 1);
      this.camera.zoom += (want - this.camera.zoom) * (1 - Math.exp(-dtMs / 400));
    }

    if (this.shakeAmp > 0.1) {
      this.shakeAmp *= Math.exp(-dtMs / 120);
    } else {
      this.shakeAmp = 0;
    }
    const shakeX = this.shakeAmp > 0 ? Math.sin(state.timeMs * 0.09) * this.shakeAmp : 0;
    const shakeY = this.shakeAmp > 0 ? Math.cos(state.timeMs * 0.11) * this.shakeAmp : 0;

    const zoom = this.camera.zoom;
    const halfW = this.width / 2 / zoom;
    const halfH = this.height / 2 / zoom;
    const minX = Math.min(halfW - 110, state.width / 2);
    const maxX = Math.max(state.width - halfW + 110, state.width / 2);
    const minY = Math.min(halfH - 110, state.height / 2);
    const maxY = Math.max(state.height - halfH + 110, state.height / 2);
    this.camera.x = Math.max(minX, Math.min(maxX, this.camera.x));
    this.camera.y = Math.max(minY, Math.min(maxY, this.camera.y));

    const wx = this.width / 2 - this.camera.x * zoom + shakeX;
    const wy = this.height / 2 - this.camera.y * zoom + shakeY;

    this.world.scale.set(zoom);
    this.world.position.set(wx, wy);

    // Move the static RenderGroup in lockstep so cached graph paper scrolls naturally
    this.bgGroup.scale.set(zoom);
    this.bgGroup.position.set(wx, wy);

    const view = {
      left: this.camera.x - halfW - 100,
      top: this.camera.y - halfH - 100,
      right: this.camera.x + halfW + 100,
      bottom: this.camera.y + halfH + 100,
    };

    // Cull offscreen paper quadrants
    for (const q of this.bgQuads) {
      q.container.visible = !(
        q.right < view.left ||
        q.left > view.right ||
        q.bottom < view.top ||
        q.top > view.bottom
      );
    }

    this.syncOrbs(state, view);
    this.syncPowerUps(state, view);
    this.syncBodies(state, view);
    this.syncHeads(state, view);
    this.syncFx(state, dtMs);
    this.syncPopups(dtMs);
  }

  private insideView(
    x: number,
    y: number,
    view: { left: number; top: number; right: number; bottom: number },
    pad = 0
  ): boolean {
    return (
      x >= view.left - pad &&
      x <= view.right + pad &&
      y >= view.top - pad &&
      y <= view.bottom + pad
    );
  }

  private syncOrbs(
    state: GameState,
    view: { left: number; top: number; right: number; bottom: number }
  ): void {
    let used = 0;
    const t = state.timeMs / 1000;
    for (const orb of state.orbs) {
      if (!this.insideView(orb.x, orb.y, view, 36)) continue;
      if (used >= this.orbPool.length) break;
      const sprite = this.orbPool[used++];
      this.placeOrb(sprite, orb, t);
    }
    for (let i = used; i < this.usedOrbs; i++) this.orbPool[i].visible = false;
    this.usedOrbs = used;
  }

  private placeOrb(sprite: Sprite, orb: Orb, t: number): void {
    const isBig = orb.tier !== "small";
    const pulse = isBig
      ? 1 + Math.sin(t * 4.8 + orb.phase) * 0.11
      : 1 + Math.sin(t * 2.8 + orb.phase) * 0.05;
    const bob = Math.sin(t * 2.4 + orb.phase) * (isBig ? 2.1 : 1.0);
    sprite.visible = true;
    sprite.position.set(orb.x, orb.y + bob);
    const scale = ((orb.radius * 3.0) / 72) * pulse;
    sprite.scale.set(scale);
    sprite.tint = colorNumber(orb.color);
    sprite.alpha = orb.tier === "corpse" ? 1 : orb.tier === "large" ? 0.98 : 0.93;
    sprite.rotation = 0;
  }

  private syncPowerUps(
    state: GameState,
    view: { left: number; top: number; right: number; bottom: number }
  ): void {
    const t = state.timeMs / 1000;
    let used = 0;
    for (const p of state.powerUps) {
      if (used >= this.powerPool.length) break;
      if (!this.insideView(p.x, p.y, view, 60)) continue;
      const slot = this.powerPool[used++];
      const tex = powerTexture(p.kind);
      if (slot.badge.texture !== tex) slot.badge.texture = tex;
      const bob = Math.sin(t * 2.6 + p.phase) * 4;
      slot.badge.visible = true;
      slot.badge.position.set(p.x, p.y + bob);
      slot.badge.scale.set(0.46 + Math.sin(t * 3.4 + p.phase) * 0.025);
      slot.badge.rotation = Math.sin(t * 1.7 + p.phase) * 0.12;
      slot.halo.visible = true;
      slot.halo.position.set(p.x, p.y + bob);
      const pulse = (t * 0.9 + p.phase) % 1;
      slot.halo.scale.set(0.5 + pulse * 0.55);
      slot.halo.alpha = (1 - pulse) * 0.75;
      slot.halo.tint = parseInt(POWER_INFO[p.kind].color.slice(1), 16);
    }
    for (let i = used; i < this.powerPool.length; i++) {
      this.powerPool[i].badge.visible = false;
      this.powerPool[i].halo.visible = false;
    }
  }

  /**
   * Structural skin pipeline: every visible snake is laid out by its skin form
   * (classic gummy, carriages, pencil stroke, star links, lanterns, pixels,
   * helix, paper rings, comet flames) into pooled sprites. The player's
   * placements are reserved first so the pool can never starve their body,
   * and they are drawn last so the player always sits on top.
   */
  private syncBodies(
    state: GameState,
    view: { left: number; top: number; right: number; bottom: number }
  ): void {
    const t = state.timeMs / 1000;
    const pool = this.bodyPool;
    let used = 0;
    const player = state.snakes.find((s) => s.alive && s.isPlayer);
    let reserved = 0;
    this.playerLayout.reset();
    if (player && this.snakeVisible(player, view)) {
      layoutSnake(
        getSkin(player.skin).form,
        { points: player.points, radius: player.radius, angle: player.angle, time: t, boosting: player.boosting, motionTime: this.motionTimeFor(player, state.timeMs) },
        this.playerLayout
      );
      reserved = Math.min(this.playerLayout.count, pool.length);
    }
    const botCap = pool.length - reserved;
    for (const snake of state.snakes) {
      if (!snake.alive || snake.isPlayer) continue;
      if (used >= botCap) break;
      if (!this.snakeVisible(snake, view)) continue;
      layoutSnake(
        getSkin(snake.skin).form,
        { points: snake.points, radius: snake.radius, angle: snake.angle, time: t, boosting: snake.boosting, motionTime: this.motionTimeFor(snake, state.timeMs) },
        this.layout
      );
      used = this.emitPlacements(snake, this.layout, view, used, botCap, t);
    }
    if (player && this.playerLayout.count > 0) {
      used = this.emitPlacements(player, this.playerLayout, view, used, pool.length, t);
    }
    for (let i = used; i < this.usedBodies; i++) pool[i].visible = false;
    this.usedBodies = used;
  }

  private motionTimeFor(snake: Snake, timeMs: number): number {
    let sample = this.skinMotion.get(snake.id);
    if (!sample) {
      sample = { at: timeMs, time: timeMs / 1000 };
      this.skinMotion.set(snake.id, sample);
    }
    sample.time += Math.min(.1, Math.max(0, (timeMs - sample.at) / 1000)) * (snake.boosting ? 2 : 1);
    sample.at = timeMs;
    return sample.time;
  }

  private emitPlacements(
    snake: Snake,
    buf: LayoutBuffer,
    view: { left: number; top: number; right: number; bottom: number },
    used: number,
    cap: number,
    t: number
  ): number {
    const blink = snake.spawnGrace > 0 ? 0.8 + Math.sin(t * 16) * 0.16 : 1;
    const items = buf.items;
    for (let i = 0; i < buf.count && used < cap; i++) {
      const p = items[i];
      const half = (p.w > p.h ? p.w : p.h) * 0.5;
      if (p.x < view.left - half || p.x > view.right + half || p.y < view.top - half || p.y > view.bottom + half) continue;
      const sprite = this.bodyPool[used++];
      const texture = artTexture(snake.skin, p.art);
      if (sprite.texture !== texture) sprite.texture = texture;
      sprite.visible = true;
      sprite.position.set(p.x, p.y);
      sprite.rotation = p.rot;
      sprite.scale.set(p.w / texture.width, p.h / texture.height);
      sprite.alpha = p.alpha * blink;
    }
    return used;
  }

  private snakeVisible(snake: Snake, view: { left: number; top: number; right: number; bottom: number }): boolean {
    const pad = snake.radius * 5;
    const pts = snake.points;
    const inside = (x: number, y: number) =>
      x >= view.left - pad && x <= view.right + pad && y >= view.top - pad && y <= view.bottom + pad;
    for (let i = 0; i < pts.length; i += 3) {
      if (inside(pts[i].x, pts[i].y)) return true;
    }
    const last = pts[pts.length - 1];
    return !!last && inside(last.x, last.y);
  }

  private syncHeads(
    state: GameState,
    view: { left: number; top: number; right: number; bottom: number }
  ): void {
    const seen = new Set<number>();
    for (const snake of state.snakes) {
      if (!snake.alive) continue;
      seen.add(snake.id);
      let v = this.views.get(snake.id);
      if (!v || v.skin !== snake.skin) {
        if (v) v.container.destroy({ children: true });
        v = this.createHeadView(snake);
        this.views.set(snake.id, v);
      }
      const visible = this.insideView(snake.x, snake.y, view, 140);
      v.container.visible = visible;
      if (!visible) continue;

      v.container.position.set(snake.x, snake.y);
      const headR = snake.radius * 1.26;
      const sinceEat = state.timeMs - snake.lastEatAt;
      const eatPop =
        sinceEat >= 0 && sinceEat < 150
          ? 1 + Math.sin((sinceEat / 150) * Math.PI) * 0.13
          : 1;

      const headSpec = HEAD_SPECS[v.form];
      v.head.rotation = headRotationFor(v.form, snake.angle);
      const baseHeadScale = (headSpec.size * snake.radius) / v.head.texture.width;
      const breath = headBreathFor(v.form, state.timeMs / 1000);
      v.head.scale.set(baseHeadScale * eatPop * breath, baseHeadScale * (2 - eatPop) * (2 - breath));

      // Neutral boss python: golden aura + heavier nameplate so everyone can find it.
      const isBoss = !!snake.isBoss;
      v.aura.visible = isBoss;
      if (isBoss) {
        const pulse = 1 + Math.sin(state.timeMs / 260) * 0.09;
        v.aura.scale.set((snake.radius * 2.35 * pulse) / 40);
        v.aura.alpha = 0.85;
      }

      // Snake King Golden Crown
      const isKing = snake.id === state.kingId;
      v.crown.visible = isKing;
      if (isKing) {
        const bob = Math.sin(state.timeMs / 220) * 3;
        v.crown.position.set(0, -headR - 34 + bob);
        v.crown.scale.set(Math.max(0.42, Math.min(0.76, (headR * 1.55) / 68)));
        v.crown.rotation = Math.sin(state.timeMs / 420) * 0.08;
      }

      // Name & length plate
      const showLabel = snake.isPlayer || this.settings.showNames;
      v.label.visible = showLabel;
      if (showLabel) {
        v.label.position.set(0, -headR - (isKing ? 15 : 17));
        const nextLabel = snake.isPlayer
          ? `${snake.name} · ${displayLength(snake.length)}m`
          : isBoss
            ? `👑 ${snake.name} · ${displayLength(snake.length)}m`
            : isKing
              ? `👑 ${snake.name}`
              : snake.name;
        if (v.labelText !== nextLabel) {
          v.labelText = nextLabel;
          v.label.text = nextLabel;
        }
        v.label.alpha = snake.isPlayer ? 1 : isBoss ? 1 : 0.84;
      }

      // Direction guide chevron (official Weipai steering helper)
      const showArrow = snake.isPlayer && this.settings.showDirectionArrow;
      v.arrow.visible = showArrow;
      if (showArrow) {
        const orbit = headR + 24;
        v.arrow.position.set(
          Math.cos(snake.targetAngle) * orbit,
          Math.sin(snake.targetAngle) * orbit
        );
        v.arrow.rotation = snake.targetAngle;
        v.arrow.scale.set(snake.boosting ? 0.56 : 0.46);
        v.arrow.tint = snake.boosting ? 0xffd76a : 0x3ecfae;
        v.arrow.alpha = 0.92;
      }

      // Boost / graze halo ring
      v.ring.visible = snake.isPlayer && (snake.boosting || snake.graze);
      if (v.ring.visible) {
        const pulse = 1 + Math.sin(state.timeMs / 130) * 0.08;
        v.ring.scale.set((snake.radius * 2.1 * pulse) / 40);
        v.ring.tint = snake.graze ? 0xff6b57 : 0xffd76a;
        v.ring.alpha = snake.graze ? 0.9 : 0.72;
      }

      // Spawn protection / shield pick-up bubble
      const shielded = powerActive(snake, "shield", state.timeMs);
      v.shield.visible = snake.spawnGrace > 0 || shielded;
      if (v.shield.visible) {
        const left = shielded ? snake.powers.shield - state.timeMs : 0;
        const pulse = 1 + Math.sin(state.timeMs / 110) * 0.06;
        v.shield.scale.set((headR * (shielded ? 1.95 : 1.65) * pulse) / 40);
        // blink in the last 1.5 s so the end of the shield is readable
        const fading = shielded && left < 1500 ? (Math.sin(state.timeMs / 60) > 0 ? 0.85 : 0.3) : 0.85;
        v.shield.alpha = shielded ? fading : Math.min(0.75, snake.spawnGrace / 600);
      }

      // Magnet field (player only — it is the effect you care about reading)
      const magnet = snake.isPlayer && powerActive(snake, "magnet", state.timeMs);
      v.magnet.visible = magnet;
      if (magnet) {
        v.magnet.rotation = state.timeMs / 900;
        v.magnet.scale.set((snake.radius * 2.4 + 190) / 40);
        v.magnet.alpha = 0.5 + Math.sin(state.timeMs / 200) * 0.12;
      }
    }

    for (const [id, v] of this.views) {
      if (!seen.has(id)) {
        v.container.destroy({ children: true });
        this.views.delete(id);
        this.skinMotion.delete(id);
      }
    }
  }

  private createHeadView(snake: Snake): SnakeView {
    const container = new Container();

    const ring = new Graphics();
    ring.circle(0, 0, 40).stroke({ width: 4, color: 0xffffff, alpha: 0.95 });
    ring.visible = false;

    const aura = new Graphics();
    aura.circle(0, 0, 40).fill({ color: 0xffd24a, alpha: 0.14 });
    aura.circle(0, 0, 40).stroke({ width: 3.5, color: 0xffd24a, alpha: 0.95 });
    aura.visible = false;

    const shield = new Graphics();
    shield.circle(0, 0, 40).fill({ color: 0x7ef2d4, alpha: 0.16 });
    shield.circle(0, 0, 40).stroke({ width: 3, color: 0x3ecfae, alpha: 0.85 });
    shield.visible = false;

    const magnet = new Graphics();
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI * 2;
      magnet.arc(0, 0, 40, a0, a0 + 0.3).stroke({ width: 0.7, color: 0x8f7cf0, alpha: 0.9 });
    }
    magnet.visible = false;

    const form = getSkin(snake.skin).form;
    const headSpec = HEAD_SPECS[form];
    const head = new Sprite(headTexture(snake.skin));
    head.anchor.set(headSpec.anchorX, headSpec.anchorY);

    const arrow = new Sprite(arrowTexture());
    arrow.anchor.set(0.5);
    arrow.visible = false;

    const crown = new Sprite(crownTexture());
    crown.anchor.set(0.5);
    crown.visible = false;

    const labelStyle: TextStyleOptions = {
      fontFamily: '"Baloo 2", "PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: snake.isPlayer ? 21 : 19,
      fontWeight: "800",
      fill: snake.isBoss ? 0x8a6410 : snake.isPlayer ? 0x153b30 : 0x3b5950,
      stroke: { color: 0xfdfbf2, width: 5 },
      align: "center",
    };
    const label = new Text({ text: snake.name, style: labelStyle });
    label.anchor.set(0.5);

    container.addChild(magnet, ring, aura, shield, arrow, head, label, crown);
    this.headLayer.addChild(container);
    return {
      container,
      head,
      aura,
      ring,
      shield,
      magnet,
      crown,
      arrow,
      label,
      skin: snake.skin,
      form,
      labelText: snake.name,
    };
  }

  /** Boost trails & death bursts are pure decoration — never touch simulation. */
  private syncFx(state: GameState, dtMs: number): void {
    if (dtMs > 0 && state.status === "playing") {
      const tick = Math.floor(state.timeMs / 16.67);
      for (const s of state.snakes) {
        if (!s.alive) continue;
        if (Math.abs(s.x - this.camera.x) > 1300 || Math.abs(s.y - this.camera.y) > 1300) continue;
        const skin = getSkin(s.skin);
        if (skin.form === "train") {
          // little steam puffs from the chimney; a steady stream while boosting
          if (!s.boosting && (tick + s.id * 5) % 16 !== 0) continue;
          const back = s.radius * 0.6;
          const ca = Math.cos(s.angle);
          const sa = Math.sin(s.angle);
          this.emitParticle({
            x: s.x - ca * back,
            y: s.y - sa * back,
            vx: -ca * 26 + (Math.random() - 0.5) * 18,
            vy: -sa * 26 + (Math.random() - 0.5) * 18,
            tint: 0x9aa4a1,
            life: s.boosting ? 520 : 760,
            startScale: 0.4,
            endScale: s.boosting ? 1.5 : 1.25,
            isRing: false,
          });
          continue;
        }
        if (!s.boosting) continue;
        const tail = s.points[Math.max(0, s.points.length - 2)] ?? s;
        const tint =
          skin.form === "comet"
            ? 0xffa63d
            : skin.form === "pencil"
              ? 0x6b7078
              : skin.form === "starchart"
                ? colorNumber(skin.palette[0])
                : colorNumber(skin.palette[2]);
        this.emitParticle({
          x: tail.x + (Math.random() - 0.5) * s.radius,
          y: tail.y + (Math.random() - 0.5) * s.radius,
          vx: (Math.random() - 0.5) * 44,
          vy: (Math.random() - 0.5) * 44,
          tint,
          life: skin.form === "comet" ? 420 : 320,
          startScale: 0.34,
          endScale: skin.form === "comet" ? 0.6 : 0.9,
          isRing: false,
        });
      }
    }
    const dt = dtMs / 1000;
    for (let i = 0; i < this.fx.length; i++) {
      const p = this.fx[i];
      if (!p) continue;
      p.life -= dtMs;
      p.sprite.position.x += p.vx * dt;
      p.sprite.position.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      const k = Math.max(0, p.life / p.max);
      p.sprite.alpha = k * (p.isRing ? 0.75 : 0.62);
      const sc = p.startScale + (p.endScale - p.startScale) * (1 - k);
      p.sprite.scale.set(sc);
      if (p.life <= 0) {
        p.sprite.visible = false;
        this.fx[i] = null;
      }
    }
  }

  private emitBurst(x: number, y: number, tint: number, count: number): void {
    this.emitParticle({
      x,
      y,
      vx: 0,
      vy: 0,
      tint,
      life: 440,
      startScale: 0.35,
      endScale: 2.3,
      isRing: true,
    });
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const sp = 75 + Math.random() * 170;
      this.emitParticle({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        tint,
        life: 380 + Math.random() * 220,
        startScale: 0.48,
        endScale: 0.12,
        isRing: false,
      });
    }
  }

  private emitParticle(opts: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    tint: number;
    life: number;
    startScale: number;
    endScale: number;
    isRing: boolean;
  }): void {
    const idx = this.fxCursor++ % FX_POOL_SIZE;
    const sprite = this.fxPool[idx];
    sprite.texture = opts.isRing ? ringTexture() : glowTexture();
    sprite.visible = true;
    sprite.position.set(opts.x, opts.y);
    sprite.tint = opts.tint;
    sprite.alpha = 0.7;
    sprite.scale.set(opts.startScale);
    this.fx[idx] = {
      sprite,
      life: opts.life,
      max: opts.life,
      vx: opts.vx,
      vy: opts.vy,
      startScale: opts.startScale,
      endScale: opts.endScale,
      isRing: opts.isRing,
    };
  }

  private spawnPopup(x: number, y: number, label: string, color: number, scale = 1): void {
    const idx = this.popupCursor++ % POPUP_POOL_SIZE;
    const text = this.popupPool[idx];
    text.text = label;
    text.style.fill = color;
    text.position.set(x, y);
    text.scale.set(scale);
    text.alpha = 1;
    text.visible = true;
    this.popups[idx] = {
      text,
      life: 720,
      max: 720,
      vy: -54,
    };
  }

  private syncPopups(dtMs: number): void {
    const dt = dtMs / 1000;
    for (let i = 0; i < this.popups.length; i++) {
      const p = this.popups[i];
      if (!p) continue;
      p.life -= dtMs;
      p.text.position.y += p.vy * dt;
      p.vy *= 0.95;
      const k = Math.max(0, p.life / p.max);
      p.text.alpha = Math.min(1, k * 1.5);
      if (p.life <= 0) {
        p.text.visible = false;
        this.popups[i] = null;
      }
    }
  }

  destroy(): void {
    this.views.clear();
    this.skinMotion.clear();
    this.app.destroy(true, { children: true });
  }
}
