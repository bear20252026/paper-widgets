import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { discoveries, portraitPoints, type DiscoveryId, type Lighting } from '../sceneData';
import { Icon } from './Icons';

export interface SceneHandle {
  reset: () => void;
  focusOn: (id: DiscoveryId) => void;
  zoomBy: (amount: number) => void;
  nudge: (x: number, y: number) => void;
  photograph: () => string | null;
}

interface Props {
  lighting: Lighting;
  motion: boolean;
  showDiscoveries: boolean;
  found: DiscoveryId[];
  onDiscover: (id: DiscoveryId) => void;
  onZoom: (zoom: number) => void;
}

interface Camera { x: number; y: number; zoom: number; leanX: number; leanY: number; dawn: number; dusk: number }
interface Frame { camera: Camera; spanX: number; spanY: number; width: number; height: number }
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const PORTRAIT_QUERY = '(max-aspect-ratio: 4/5)';
const home = (): Camera => ({ x: .5, y: .5, zoom: 1.015, leanX: 0, leanY: 0, dawn: 0, dusk: 0 });

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url; });
}

function makeRenderer(canvas: HTMLCanvasElement, scene: HTMLImageElement, depth: HTMLImageElement) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  if (!gl) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas is unavailable');
    return {
      draw: ({ camera: c, spanX, spanY }: Frame) => {
        ctx.filter = `brightness(${1 + c.dawn * .12 - c.dusk * .47}) saturate(${1 - c.dawn * .3 - c.dusk * .65})`;
        ctx.drawImage(scene, (c.x - spanX / 2) * scene.width, (c.y - spanY / 2) * scene.height, spanX * scene.width, spanY * scene.height, 0, 0, canvas.width, canvas.height);
        if (c.dusk > .01) { ctx.filter = 'none'; ctx.fillStyle = `rgba(41,70,131,${c.dusk * .31})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      },
      dispose: () => {},
    };
  }

  const vertex = gl.createShader(gl.VERTEX_SHADER)!;
  gl.shaderSource(vertex, 'attribute vec2 a_pos; varying vec2 v_uv; void main(){v_uv=vec2(a_pos.x*.5+.5,.5-a_pos.y*.5);gl_Position=vec4(a_pos,0.,1.);}');
  gl.compileShader(vertex);
  // Separate depth artwork lets the owl and witch shift independently of the room.
  const fragment = gl.createShader(gl.FRAGMENT_SHADER)!;
  gl.shaderSource(fragment, `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_art;
    uniform sampler2D u_depth;
    uniform vec2 u_center, u_span, u_lean, u_light;
    void main() {
      vec2 uv = (v_uv - .5) * u_span + u_center;
      float depth = texture2D(u_depth, uv).r;
      uv += (depth - .38) * u_lean * vec2(.006, .009);
      vec3 color = texture2D(u_art, clamp(uv, .0001, .9999)).rgb;
      float lum = dot(color, vec3(.299, .587, .114));
      vec3 morning = mix(vec3(lum), color, .72) * vec3(.96, 1.055, 1.18) + vec3(.025, .031, .04);
      vec3 moon = mix(vec3(lum), color, .22) * vec3(.41, .55, .8) + vec3(.008, .014, .036);
      color = mix(mix(color, morning, u_light.x), moon, u_light.y);
      gl_FragColor = vec4(color, 1.);
    }
  `);
  gl.compileShader(fragment);
  const program = gl.createProgram()!;
  gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Scene shader is unavailable');
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  const textures = [scene, depth].map((image, i) => {
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    return texture;
  });
  gl.uniform1i(gl.getUniformLocation(program, 'u_art'), 0);
  gl.uniform1i(gl.getUniformLocation(program, 'u_depth'), 1);
  const uniforms = ['u_center', 'u_span', 'u_lean', 'u_light'].map(name => gl.getUniformLocation(program, name));
  return {
    draw: ({ camera: c, spanX, spanY }: Frame) => {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uniforms[0], c.x, c.y); gl.uniform2f(uniforms[1], spanX, spanY);
      gl.uniform2f(uniforms[2], c.leanX, c.leanY); gl.uniform2f(uniforms[3], c.dawn, c.dusk);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose: () => { textures.forEach(t => gl.deleteTexture(t)); gl.deleteBuffer(buffer); gl.deleteProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment); },
  };
}

export const Scene = forwardRef<SceneHandle, Props>(function Scene(props, ref) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const markerLayer = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [portrait, setPortrait] = useState(() => window.matchMedia(PORTRAIT_QUERY).matches);
  const artUrl = `./images/dormitory-${portrait ? 'portrait' : 'golden-hour'}.webp`;
  const target = useRef<Camera>(home());
  const camera = useRef<Camera>(home());
  const currentProps = useRef(props);
  currentProps.current = props;
  const invalidated = useRef(true);
  const lastFrame = useRef<Frame | null>(null);
  const snapshot = useRef<() => string | null>(() => null);

  useImperativeHandle(ref, () => ({
    reset: () => { const next = home(); Object.assign(target.current, { x: next.x, y: next.y, zoom: next.zoom, leanX: 0, leanY: 0 }); invalidated.current = true; },
    focusOn: id => { const [x, y, zoom] = portrait ? portraitPoints[id].focus : discoveries.find(n => n.id === id)!.focus; Object.assign(target.current, { x, y, zoom, leanX: 0, leanY: 0 }); invalidated.current = true; },
    zoomBy: amount => { target.current.zoom = clamp(target.current.zoom + amount, 1.015, 2.4); },
    nudge: (x, y) => { target.current.zoom = Math.max(1.12, target.current.zoom); target.current.x += x; target.current.y += y; },
    photograph: () => snapshot.current(),
  }), [portrait]);

  useEffect(() => {
    const media = window.matchMedia(PORTRAIT_QUERY);
    const change = () => setPortrait(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  useEffect(() => {
    target.current.dawn = props.lighting === 'daybreak' ? 1 : 0;
    target.current.dusk = props.lighting === 'moonlit' ? 1 : 0;
    if (!props.motion) { target.current.leanX = 0; target.current.leanY = 0; }
    invalidated.current = true;
  }, [props.lighting, props.motion, props.showDiscoveries]);

  useEffect(() => {
    const el = root.current!;
    const output = canvas.current!;
    setReady(false);
    const imageAspect = portrait ? 9 / 16 : 16 / 9;
    for (const c of [camera.current, target.current]) Object.assign(c, { x: .5, y: .5, zoom: 1.015, leanX: 0, leanY: 0 });
    let disposed = false;
    let raf = 0;
    let renderer: ReturnType<typeof makeRenderer> | null = null;
    let previousTime = 0;
    let width = el.clientWidth, height = el.clientHeight;
    let lastZoom = 0;
    let isReady = false;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchDistance = 0;
    const distance = () => { const p = [...pointers.values()]; return p.length > 1 ? Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y) : 0; };

    const resize = () => {
      width = el.clientWidth; height = el.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.7);
      output.width = Math.round(width * ratio); output.height = Math.round(height * ratio);
      invalidated.current = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el); resize();

    const updateMarkers = (frame: Frame) => {
      if (!currentProps.current.showDiscoveries) return;
      markerLayer.current?.querySelectorAll<HTMLButtonElement>('[data-point]').forEach((marker, i) => {
        const note = portrait ? portraitPoints[discoveries[i].id] : discoveries[i];
        const x = (note.x - frame.camera.x) / frame.spanX + .5;
        const y = (note.y - frame.camera.y) / frame.spanY + .5;
        marker.style.left = `${x * 100}%`; marker.style.top = `${y * 100}%`;
        marker.style.visibility = x < .025 || x > .975 || y < .1 || y > .88 ? 'hidden' : 'visible';
      });
    };

    const render = (time: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(render);
      if (document.hidden || time - previousTime < 1000 / 40) return;
      const dt = Math.min(70, time - previousTime); previousTime = time;
      const c = camera.current, t = target.current;
      const aspect = width / height;
      const baseX = Math.min(1, aspect / imageAspect), baseY = Math.min(1, imageAspect / aspect);
      t.x = clamp(t.x, baseX / t.zoom / 2, 1 - baseX / t.zoom / 2);
      t.y = clamp(t.y, baseY / t.zoom / 2, 1 - baseY / t.zoom / 2);
      let changed = invalidated.current;
      const smooth = currentProps.current.motion ? 1 - Math.exp(-dt / 115) : 1;
      for (const key of Object.keys(c) as (keyof Camera)[]) {
        const delta = t[key] - c[key];
        if (Math.abs(delta) > .00002) { c[key] += delta * smooth; changed = true; }
      }
      if (!changed || !renderer) return;
      const frame: Frame = { camera: c, spanX: baseX / c.zoom, spanY: baseY / c.zoom, width, height };
      lastFrame.current = frame;
      renderer.draw(frame); updateMarkers(frame); invalidated.current = false;
      if (!isReady) { isReady = true; setReady(true); }
      if (Math.abs(lastZoom - t.zoom) > .015) { lastZoom = t.zoom; currentProps.current.onZoom(t.zoom); }
    };

    Promise.all([loadImage(artUrl), loadImage(`./images/${portrait ? 'portrait' : 'scene'}-depth.svg`)]).then(([art, depth]) => {
      if (disposed) return;
      try {
        renderer = makeRenderer(output, art, depth);
        snapshot.current = () => { if (lastFrame.current) renderer?.draw(lastFrame.current); return output.toDataURL('image/jpeg', .96); };
      } catch {
        // The full-resolution poster remains available on devices without a canvas renderer.
        snapshot.current = () => { const copy = document.createElement('canvas'); copy.width = art.width; copy.height = art.height; copy.getContext('2d')?.drawImage(art, 0, 0); return copy.toDataURL('image/jpeg', .96); };
      }
      invalidated.current = true; render(performance.now());
    }).catch(() => { /* The HTML scene image is also an accessible rendering fallback. */ });

    const pointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || (e.target as Element).closest('button')) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); pinchDistance = distance();
      el.setPointerCapture(e.pointerId); setDragging(true);
    };
    const pointerMove = (e: PointerEvent) => {
      const t = target.current, last = pointers.get(e.pointerId);
      if (last) {
        const dx = e.clientX - last.x, dy = e.clientY - last.y;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size > 1) {
          const next = distance(); if (pinchDistance > 0) t.zoom = clamp(t.zoom * next / pinchDistance, 1.015, 2.4); pinchDistance = next;
        } else {
          const frame = lastFrame.current;
          if (Math.abs(dx) + Math.abs(dy) > 1) t.zoom = Math.max(t.zoom, 1.07);
          t.x -= dx / width * (frame?.spanX ?? 1); t.y -= dy / height * (frame?.spanY ?? 1);
        }
      }
      if (currentProps.current.motion) { t.leanX = (e.clientX / width - .5) * 1.7; t.leanY = (e.clientY / height - .5) * 1.7; }
    };
    const pointerUp = (e: PointerEvent) => { pointers.delete(e.pointerId); if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId); setDragging(pointers.size > 0); pinchDistance = distance(); };
    const wheel = (e: WheelEvent) => { e.preventDefault(); target.current.zoom = clamp(target.current.zoom * Math.exp(-e.deltaY * .0008), 1.015, 2.4); };
    const leave = () => { if (!pointers.size) { target.current.leanX = 0; target.current.leanY = 0; } };
    el.addEventListener('pointerdown', pointerDown); el.addEventListener('pointermove', pointerMove);
    el.addEventListener('pointerup', pointerUp); el.addEventListener('pointercancel', pointerUp);
    el.addEventListener('pointerleave', leave); el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      disposed = true; cancelAnimationFrame(raf); observer.disconnect(); renderer?.dispose();
      el.removeEventListener('pointerdown', pointerDown); el.removeEventListener('pointermove', pointerMove);
      el.removeEventListener('pointerup', pointerUp); el.removeEventListener('pointercancel', pointerUp);
      el.removeEventListener('pointerleave', leave); el.removeEventListener('wheel', wheel);
    };
  }, [portrait, artUrl]);

  return <div className={`scene-stage ${dragging ? 'is-dragging' : ''} light-${props.lighting}`} ref={root}>
    <img className="scene-poster" src={artUrl} alt="Elara, an auburn-haired witch in a crimson robe, holds her white owl in a sunlit wooden dormitory with bunk beds and a writing desk." fetchPriority="high" draggable={false} />
    <canvas ref={canvas} className={`scene-canvas ${ready ? 'is-ready' : ''}`} aria-hidden="true" />
    {props.motion && <div className="dust-layer" aria-hidden="true">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ '--x': `${(i * 37 + 7) % 100}%`, '--y': `${(i * 23 + 15) % 100}%`, '--drift': `${(i % 3 - 1) * 32 + 14}px`, '--duration': `${11 + i % 8}s`, '--delay': `${-i * 2.71}s`, '--size': `${i % 4 === 0 ? 2.4 : 1.5}px` } as CSSProperties} />)}</div>}
    {props.showDiscoveries && <div className="discovery-markers" ref={markerLayer}>{discoveries.map(note => <button key={note.id} data-point={note.id} className={`discovery-marker ${props.found.includes(note.id) ? 'is-found' : ''}`} style={{ left: `${note.x * 100}%`, top: `${note.y * 100}%` }} onClick={() => props.onDiscover(note.id)} aria-label={`Examine ${note.shortName}`}>
      <span className="marker-gem"><Icon name={props.found.includes(note.id) ? 'check' : 'sparkle'} size={17} /></span><span className="marker-label">{note.shortName}</span>
    </button>)}</div>}
  </div>;
});