import * as THREE from 'three';
import { useMemo, useRef, useState, useEffect } from 'react';
import { CARD_WIDTH, CARD_HEIGHT, GLOBE_RADIUS, LOCATIONS, getClientId } from '../data';
import locationInfoMap from '../locationInfo.json';

interface CardProps {
  index: number;
  position: THREE.Vector3;
  scale?: number;
  userPhoto: string;
  onSelect: (image: string, location: string, info: string) => void;
  onHover?: (info: string) => void;
  onHoverOut?: () => void;
}

const MAX_CONCURRENT_CARD_GENERATIONS = 3;
let activeCardRequests = 0;
let cooldownUntilMs = 0;
let loggedFallbackWarning = false;

interface QueuedCardTask {
  run: () => void;
  cancelled: boolean;
}

const cardTaskQueue: QueuedCardTask[] = [];

function pumpCardQueue(): void {
  if (activeCardRequests >= MAX_CONCURRENT_CARD_GENERATIONS) return;
  const now = Date.now();
  if (cooldownUntilMs > now) {
    window.setTimeout(pumpCardQueue, cooldownUntilMs - now + 25);
    return;
  }

  while (
    activeCardRequests < MAX_CONCURRENT_CARD_GENERATIONS &&
    cardTaskQueue.length > 0
  ) {
    const next = cardTaskQueue.shift();
    if (!next || next.cancelled) continue;
    next.run();
  }
}

function enqueueCardGeneration(
  fn: (signal: AbortSignal) => Promise<void>
): () => void {
  const controller = new AbortController();
  const task: QueuedCardTask = {
    cancelled: false,
    run: () => {
      if (task.cancelled) {
        pumpCardQueue();
        return;
      }
      activeCardRequests += 1;
      void fn(controller.signal).finally(() => {
        activeCardRequests = Math.max(0, activeCardRequests - 1);
        pumpCardQueue();
      });
    },
  };
  cardTaskQueue.push(task);
  pumpCardQueue();

  return () => {
    task.cancelled = true;
    controller.abort();
  };
}

function buildFallbackInfo(location: string): string {
  const map = locationInfoMap as Record<string, string>;
  const paragraph =
    map[location] ||
    (location === 'Serengeti National Park, Tanzania'
      ? map['Serengeti Park, Tanzania']
      : undefined) ||
    `${location} is an iconic global landmark celebrated for its unforgettable scenery and history.`;
  return `# ${location}\n${paragraph}`;
}

function renderCardPlaceholderCanvas(
  location: string,
  index: number,
  isPending: boolean
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 500;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  if (isPending) {
    const pending = ctx.createLinearGradient(0, 0, 0, 500);
    pending.addColorStop(0, '#EFEDE7');
    pending.addColorStop(1, '#DFDAD0');
    ctx.fillStyle = pending;
    ctx.fillRect(0, 0, 400, 500);
    return canvas;
  }

  const palettes = [
    { sky: ['#DCE7EE', '#F5E6D5'], far: '#A8B8C1', near: '#5E7280', sun: '#E8A56A' },
    { sky: ['#E8E2D8', '#F4EFE5'], far: '#B8B1A2', near: '#766E60', sun: '#D58C62' },
    { sky: ['#DFE8E4', '#F3EBDD'], far: '#9FB4AD', near: '#587168', sun: '#E2B36D' },
    { sky: ['#E9DFDC', '#F5E9DE'], far: '#BCA9A4', near: '#846E6A', sun: '#D87D65' },
  ];
  const palette = palettes[index % palettes.length];
  const variant = index % 4;
  const horizon = 305;

  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, palette.sky[0]);
  sky.addColorStop(1, palette.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 400, 500);

  // A small low sun, placed differently on each card.
  const sunX = 86 + ((index * 73) % 230);
  const sunY = 118 + ((index * 29) % 58);
  ctx.fillStyle = palette.sun;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 28 + (index % 3) * 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  if (variant === 0) {
    // Layered mountains.
    ctx.fillStyle = palette.far;
    ctx.beginPath();
    ctx.moveTo(-20, horizon);
    ctx.lineTo(92, 168);
    ctx.lineTo(196, horizon);
    ctx.lineTo(286, 198);
    ctx.lineTo(420, horizon);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = palette.near;
    ctx.beginPath();
    ctx.moveTo(-20, horizon);
    ctx.lineTo(136, 220);
    ctx.lineTo(240, horizon);
    ctx.lineTo(328, 236);
    ctx.lineTo(420, horizon);
    ctx.closePath();
    ctx.fill();
  } else if (variant === 1) {
    // A little skyline.
    const blocks = [
      [28, 238, 46, horizon - 238],
      [84, 210, 38, horizon - 210],
      [130, 252, 52, horizon - 252],
      [190, 188, 44, horizon - 188],
      [242, 228, 58, horizon - 228],
      [308, 204, 64, horizon - 204],
    ];
    ctx.fillStyle = palette.far;
    blocks.forEach(([x, y, w, h]) => ctx.fillRect(x, y, w, h));
    ctx.fillStyle = palette.near;
    ctx.fillRect(0, horizon, 400, 55);
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    blocks.forEach(([x, y, w], blockIndex) => {
      for (let row = 0; row < 3; row += 1) {
        ctx.fillRect(x + 9, y + 16 + row * 20, w - 18, 3);
      }
      if (blockIndex % 2 === 0) ctx.fillRect(x + w / 2 - 2, y - 14, 4, 14);
    });
  } else if (variant === 2) {
    // Coast and horizon.
    const sea = ctx.createLinearGradient(0, horizon, 0, 420);
    sea.addColorStop(0, palette.far);
    sea.addColorStop(1, palette.near);
    ctx.fillStyle = sea;
    ctx.fillRect(0, horizon, 400, 120);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    for (let line = 0; line < 5; line += 1) {
      ctx.beginPath();
      ctx.moveTo(28 + line * 18, 332 + line * 16);
      ctx.bezierCurveTo(140, 322 + line * 16, 260, 344 + line * 16, 372 - line * 12, 332 + line * 16);
      ctx.stroke();
    }
  } else {
    // Desert dunes.
    ctx.fillStyle = palette.far;
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.bezierCurveTo(90, 250, 160, 330, 250, 282);
    ctx.bezierCurveTo(320, 250, 370, 300, 400, 282);
    ctx.lineTo(400, 420);
    ctx.lineTo(0, 420);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = palette.near;
    ctx.beginPath();
    ctx.moveTo(0, 340);
    ctx.bezierCurveTo(110, 300, 200, 370, 300, 322);
    ctx.bezierCurveTo(350, 300, 380, 330, 400, 320);
    ctx.lineTo(400, 430);
    ctx.lineTo(0, 430);
    ctx.closePath();
    ctx.fill();
  }

  // Caption plate.
  ctx.fillStyle = '#FFFCF6';
  ctx.fillRect(0, 360, 400, 140);
  ctx.fillStyle = 'rgba(17, 24, 39, 0.08)';
  ctx.fillRect(0, 360, 400, 1);
  ctx.fillStyle = '#8B8578';
  ctx.textAlign = 'center';
  ctx.font = '500 11px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(`PAPER PLACE ${String(index + 1).padStart(2, '0')}`, 200, 392);

  const words = location.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  ctx.font = '600 19px system-ui, -apple-system, sans-serif';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > 320 && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  ctx.fillStyle = '#111827';
  const startY = 424 - ((lines.length - 1) * 24) / 2;
  lines.forEach((line, idx) => {
    ctx.fillText(line, 200, startY + idx * 24);
  });

  ctx.strokeStyle = 'rgba(17, 24, 39, 0.1)';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, 360, 460);

  return canvas;
}

function loadTextureFromDataUrl(dataUrl: string): Promise<THREE.Texture | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      tex.needsUpdate = true;
      resolve(tex);
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

export default function Card({
  index,
  position,
  scale = 1,
  userPhoto,
  onSelect,
  onHover,
  onHoverOut,
}: CardProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [cardInfo, setCardInfo] = useState<{
    base64: string;
    location: string;
    info: string;
  } | null>(null);

  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [texture]);

  useEffect(() => {
    let active = true;
    const defaultLocation = LOCATIONS[index % LOCATIONS.length];

    const replaceTexture = (nextTex: THREE.Texture) => {
      setTexture(nextTex);
    };

    const initialCanvas = renderCardPlaceholderCanvas(defaultLocation, index, true);
    const initialTex = new THREE.CanvasTexture(initialCanvas);
    initialTex.colorSpace = THREE.SRGBColorSpace;
    initialTex.minFilter = THREE.LinearMipmapLinearFilter;
    initialTex.generateMipmaps = true;
    replaceTexture(initialTex);

    const applyFallbackCard = (locName: string, infoText?: string) => {
      if (!active) return;
      const fallbackCanvas = renderCardPlaceholderCanvas(locName, index, false);
      const fallbackDataUrl = fallbackCanvas.toDataURL('image/jpeg', 0.86);
      const fallbackTex = new THREE.CanvasTexture(fallbackCanvas);
      fallbackTex.colorSpace = THREE.SRGBColorSpace;
      fallbackTex.minFilter = THREE.LinearMipmapLinearFilter;
      fallbackTex.generateMipmaps = true;
      replaceTexture(fallbackTex);
      setCardInfo({
        base64: fallbackDataUrl,
        location: locName,
        info: infoText || buildFallbackInfo(locName),
      });
    };

    // Static shelf cut: no generation server is bundled, so paint the local
    // place card immediately instead of issuing a request that would 404.
    applyFallbackCard(defaultLocation);

    return () => {
      active = false;
    };
  }, [index, userPhoto]);

  useEffect(() => {
    if (hovered && cardInfo && onHover) {
      onHover(cardInfo.info);
    }
  }, [cardInfo, hovered, onHover]);

  const rotationQuaternion = useMemo(() => {
    const dummy = new THREE.Object3D();
    dummy.position.copy(position);
    dummy.lookAt(position.clone().multiplyScalar(2));
    return dummy.quaternion.clone();
  }, [position]);

  const geometry = useMemo(() => {
    const width = CARD_WIDTH * scale;
    const height = CARD_HEIGHT * scale;
    const geo = new THREE.PlaneGeometry(width, height, 32, 32);
    const pos = geo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);

      const theta = x / GLOBE_RADIUS;
      const phi = y / GLOBE_RADIUS;

      const newX = GLOBE_RADIUS * Math.sin(theta) * Math.cos(phi);
      const newY = GLOBE_RADIUS * Math.sin(phi);
      const newZ = GLOBE_RADIUS * Math.cos(theta) * Math.cos(phi) - GLOBE_RADIUS;

      pos.setXYZ(i, newX, newY, newZ);
    }

    geo.computeVertexNormals();
    return geo;
  }, [scale]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <mesh
      position={position}
      quaternion={rotationQuaternion}
      ref={meshRef}
      geometry={geometry}
      onClick={(e) => {
        e.stopPropagation();
        if (cardInfo) {
          onSelect(cardInfo.base64, cardInfo.location, cardInfo.info);
        }
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
        if (cardInfo && onHover) {
          onHover(cardInfo.info);
        }
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
        if (onHoverOut) {
          onHoverOut();
        }
      }}
    >
      {texture && (
        <meshBasicMaterial
          map={texture}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      )}
    </mesh>
  );
}
