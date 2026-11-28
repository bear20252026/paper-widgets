// Minimal orbit camera with scripted moves.
// Mouse: drag to orbit, wheel to zoom. Touch: one-finger horizontal drag orbits,
// vertical swipes are left to the page (touch-action: pan-y), two fingers pinch to zoom.
import * as THREE from 'three';

export class Orbit {
  constructor(camera, el) {
    this.camera = camera; this.el = el;
    this.target = new THREE.Vector3();
    this.radius = 260; this.theta = 0.55; this.phi = 1.25; // theta: azimuth around y, phi: polar from +y
    this.want = { radius: this.radius, theta: this.theta, phi: this.phi };
    this.offset = new THREE.Vector3(); // target offset in world units
    this.wantOffset = new THREE.Vector3();
    this.tween = null; this.minR = 12; this.maxR = 4000;
    this.userActive = 0;
    const pointers = new Map();
    let pinch0 = 0, r0 = 0, lastX = 0, lastY = 0, mode = null;
    el.addEventListener('pointerdown', (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
      if (e.pointerType === 'mouse') { el.setPointerCapture(e.pointerId); mode = 'orbit'; }
      else mode = pointers.size === 2 ? 'pinch' : 'pending';
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); r0 = this.want.radius; mode = 'pinch'; }
      lastX = e.clientX; lastY = e.clientY;
    });
    el.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX; p.y = e.clientY;
      if (mode === 'pending') {
        const dx = Math.abs(p.x - p.x0), dy = Math.abs(p.y - p.y0);
        if (dx > 6 && dx > dy) { mode = 'orbit'; try { el.setPointerCapture(e.pointerId); } catch (_) {} }
        else if (dy > 6) { mode = null; }
      }
      if (mode === 'orbit') {
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        this.want.theta -= dx * 0.006;
        if (e.pointerType === 'mouse') this.want.phi = Math.max(0.12, Math.min(Math.PI - 0.08, this.want.phi - dy * 0.005));
        this.tween = null; this.userActive = 1.5;
      } else if (mode === 'pinch' && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch0 > 0) this.want.radius = THREE.MathUtils.clamp(r0 * pinch0 / d, this.minR, this.maxR);
        this.tween = null; this.userActive = 1.5;
        e.preventDefault();
      }
      lastX = e.clientX; lastY = e.clientY;
    });
    const up = (e) => { pointers.delete(e.pointerId); if (pointers.size === 0) mode = null; else if (pointers.size === 1) mode = null; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.want.radius = THREE.MathUtils.clamp(this.want.radius * Math.exp(e.deltaY * 0.0012), this.minR, this.maxR);
      this.tween = null; this.userActive = 1.0;
    }, { passive: false });
  }
  moveTo({ radius, theta, phi, offset }, dur = 1.6) {
    const from = { radius: this.want.radius, theta: this.want.theta, phi: this.want.phi, offset: this.wantOffset.clone() };
    // shortest azimuth path
    let th = theta ?? from.theta;
    while (th - from.theta > Math.PI) th -= Math.PI * 2;
    while (th - from.theta < -Math.PI) th += Math.PI * 2;
    this.tween = { t: 0, dur, from, to: { radius: radius ?? from.radius, theta: th, phi: phi ?? from.phi, offset: offset ? offset.clone() : from.offset } };
  }
  update(dt) {
    if (this.userActive > 0) this.userActive -= dt;
    if (this.tween) {
      const tw = this.tween; tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      this.want.radius = tw.from.radius + (tw.to.radius - tw.from.radius) * e;
      this.want.theta = tw.from.theta + (tw.to.theta - tw.from.theta) * e;
      this.want.phi = tw.from.phi + (tw.to.phi - tw.from.phi) * e;
      this.wantOffset.lerpVectors(tw.from.offset, tw.to.offset, e);
      if (k >= 1) this.tween = null;
    }
    const a = 1 - Math.exp(-dt * 9);
    this.radius += (this.want.radius - this.radius) * a;
    this.theta += (this.want.theta - this.theta) * a;
    this.phi += (this.want.phi - this.phi) * a;
    this.offset.lerp(this.wantOffset, a);
    const t = this.target.clone().add(this.offset);
    const sp = Math.sin(this.phi);
    this.camera.position.set(t.x + this.radius * sp * Math.sin(this.theta), t.y + this.radius * Math.cos(this.phi), t.z + this.radius * sp * Math.cos(this.theta));
    this.camera.lookAt(t);
  }
}
