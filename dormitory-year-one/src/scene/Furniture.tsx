import * as THREE from "three";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { woodTexture } from "./textures";
import Owl from "./Owl";

type P = { position?: [number, number, number]; rotation?: [number, number, number]; scale?: number };

function Wood({ color = "#6b4428", dark = false }: { color?: string; dark?: boolean }) {
  return <meshStandardMaterial map={woodTexture(dark)} color={color} roughness={0.75} />;
}

function Box({ args, position, rotation, color, dark }: {
  args: [number, number, number];
  position: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
  dark?: boolean;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={args} />
      <Wood color={color} dark={dark} />
    </mesh>
  );
}

function Mattress({ w, l, y, quilt = "#e6d2ad" }: { w: number; l: number; y: number; quilt?: string }) {
  return (
    <group position={[0, y, 0]}>
      <mesh castShadow receiveShadow position={[0, 0.08, 0]}>
        <boxGeometry args={[w - 0.08, 0.18, l - 0.1]} />
        <meshStandardMaterial color="#efe3cb" roughness={1} />
      </mesh>
      {/* quilt */}
      <mesh castShadow receiveShadow position={[0, 0.19, 0.18]}>
        <boxGeometry args={[w - 0.02, 0.06, l - 0.55]} />
        <meshStandardMaterial color={quilt} roughness={1} />
      </mesh>
      {/* folded edge */}
      <mesh castShadow position={[0, 0.23, -l / 2 + 0.55]}>
        <boxGeometry args={[w - 0.02, 0.06, 0.2]} />
        <meshStandardMaterial color="#8c3424" roughness={1} />
      </mesh>
      {/* pillow */}
      <mesh castShadow position={[0, 0.26, -l / 2 + 0.25]} scale={[w * 0.38, 0.08, 0.17]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color="#f6efe0" roughness={1} />
      </mesh>
    </group>
  );
}

function CarvedArch({ w, y }: { w: number; y: number }) {
  return (
    <group position={[0, y, 0]}>
      <mesh rotation={[0, 0, 0]} scale={[1, 0.55, 1]} castShadow>
        <torusGeometry args={[w / 2 - 0.08, 0.06, 8, 32, Math.PI]} />
        <Wood color="#5a3820" />
      </mesh>
      {/* greek-key frieze */}
      <mesh position={[0, w * 0.28 + 0.15, 0]} castShadow>
        <boxGeometry args={[w, 0.24, 0.07]} />
        <Wood color="#6d4529" />
      </mesh>
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={i} position={[-w / 2 + 0.12 + i * ((w - 0.24) / 7), w * 0.28 + 0.15, 0.04]}>
          <boxGeometry args={[0.07, 0.14, 0.02]} />
          <Wood color="#3f2614" dark />
        </mesh>
      ))}
    </group>
  );
}

export function CanopyBed({ position, rotation, quilt }: P & { quilt?: string }) {
  const w = 1.5;
  const l = 2.2;
  const h = 2.9;
  return (
    <group position={position} rotation={rotation}>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <Box key={i} args={[0.13, h, 0.13]} position={[(sx * w) / 2, h / 2, (sz * l) / 2]} color="#5d3b22" />
      ))}
      <Box args={[w, 0.3, l]} position={[0, 0.35, 0]} color="#6b4428" />
      <Mattress w={w} l={l} y={0.5} quilt={quilt} />
      {/* headboard with shelves */}
      <Box args={[w, 1.9, 0.08]} position={[0, 1.15, -l / 2]} color="#5a3820" />
      {[1.25, 1.75].map((y) => (
        <Box key={y} args={[w - 0.1, 0.05, 0.28]} position={[0, y, -l / 2 + 0.16]} color="#7a5032" />
      ))}
      {/* books on shelf */}
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={i} position={[-0.5 + i * 0.12, 1.39, -l / 2 + 0.16]} castShadow>
          <boxGeometry args={[0.08, 0.24 + (i % 3) * 0.03, 0.2]} />
          <meshStandardMaterial color={["#7a2a1e", "#3b4a3a", "#8a6a3a", "#5a2a3a", "#2e3a5a", "#a07040"][i]} roughness={0.8} />
        </mesh>
      ))}
      {/* footboard */}
      <Box args={[w, 0.7, 0.07]} position={[0, 0.65, l / 2]} color="#5a3820" />
      {/* canopy frame + sloped roof */}
      <Box args={[w + 0.2, 0.12, l + 0.2]} position={[0, h, 0]} color="#4f321d" />
      <mesh position={[0, h + 0.28, 0]} castShadow>
        <cylinderGeometry args={[0.55, (w + 0.6) * 0.72, 0.45, 4, 1, false, Math.PI / 4]} />
        <Wood color="#5a3820" />
      </mesh>
      <mesh position={[0, h + 0.12, 0]} castShadow>
        <boxGeometry args={[w + 0.6, 0.06, l + 0.5]} />
        <Wood color="#4a2c18" dark />
      </mesh>
      {/* carved arches on open sides */}
      <group position={[0, 0, l / 2]}>
        <CarvedArch w={w} y={h - 0.6} />
      </group>
      <group position={[w / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <CarvedArch w={l} y={h - 0.65} />
      </group>
      <group position={[-w / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <CarvedArch w={l} y={h - 0.65} />
      </group>
      {/* curtain tied to post */}
      <mesh position={[-w / 2 - 0.05, 1.7, l / 2 - 0.05]} scale={[0.12, 1.1, 0.12]} castShadow>
        <cylinderGeometry args={[1, 1.6, 1, 10]} />
        <meshStandardMaterial color="#8a2c20" roughness={0.9} />
      </mesh>
      {/* stuff on canopy roof */}
      <mesh position={[0.2, h + 0.62, 0.1]} castShadow>
        <boxGeometry args={[0.5, 0.3, 0.4]} />
        <Wood color="#7a5032" />
      </mesh>
    </group>
  );
}

export function BunkBed({ position, rotation }: P) {
  const w = 1.3;
  const l = 2.2;
  return (
    <group position={position} rotation={rotation}>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <Box key={i} args={[0.14, 3.2, 0.14]} position={[(sx * w) / 2, 1.6, (sz * l) / 2]} color="#4f321d" />
      ))}
      <Box args={[w, 0.25, l]} position={[0, 0.3, 0]} color="#6b4428" />
      <Mattress w={w} l={l} y={0.42} quilt="#e2c79a" />
      <Box args={[w, 0.25, l]} position={[0, 1.9, 0]} color="#6b4428" />
      <Mattress w={w} l={l} y={2.02} quilt="#d8b98a" />
      {/* guard rail on top */}
      <Box args={[0.07, 0.07, l]} position={[w / 2, 2.55, 0]} color="#5a3820" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Box key={i} args={[0.04, 0.4, 0.04]} position={[w / 2, 2.35, -l / 2 + 0.2 + i * 0.36]} color="#5a3820" />
      ))}
      {/* ladder */}
      <group position={[w / 2 + 0.05, 0, l / 2 - 0.35]}>
        {[-0.2, 0.2].map((z) => (
          <Box key={z} args={[0.05, 2.5, 0.05]} position={[0, 1.25, z]} color="#5a3820" />
        ))}
        {[0.5, 0.95, 1.4, 1.85, 2.3].map((y) => (
          <Box key={y} args={[0.04, 0.04, 0.4]} position={[0, y, 0]} color="#7a5032" />
        ))}
      </group>
      {/* roof */}
      <mesh position={[0, 3.35, 0]} castShadow>
        <boxGeometry args={[w + 0.4, 0.12, l + 0.4]} />
        <Wood color="#4a2c18" dark />
      </mesh>
      <mesh position={[0, 3.6, 0]} castShadow>
        <cylinderGeometry args={[0.4, (w + 0.4) * 0.72, 0.4, 4, 1, false, Math.PI / 4]} />
        <Wood color="#5a3820" />
      </mesh>
      <group position={[w / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <CarvedArch w={l} y={2.75} />
      </group>
      {/* headboard */}
      <Box args={[w, 3.0, 0.07]} position={[0, 1.6, -l / 2]} color="#5a3820" />
    </group>
  );
}

export function Nightstand({ position, rotation }: P) {
  return (
    <group position={position} rotation={rotation}>
      <Box args={[0.6, 0.65, 0.5]} position={[0, 0.42, 0]} color="#7a5032" />
      <Box args={[0.68, 0.05, 0.56]} position={[0, 0.77, 0]} color="#5a3820" />
      <Box args={[0.5, 0.2, 0.02]} position={[0, 0.55, 0.26]} color="#5a3820" />
      <mesh position={[0, 0.55, 0.28]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#c9a15a" metalness={0.7} roughness={0.3} />
      </mesh>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <Box key={i} args={[0.06, 0.12, 0.06]} position={[sx * 0.26, 0.05, sz * 0.2]} color="#3f2614" />
      ))}
      {/* parchment note + frame */}
      <mesh position={[0.05, 0.98, -0.1]} rotation={[-0.2, 0.2, 0]} castShadow>
        <boxGeometry args={[0.28, 0.36, 0.02]} />
        <meshStandardMaterial color="#5a3820" />
      </mesh>
      <mesh position={[0.05, 0.98, -0.088]} rotation={[-0.2, 0.2, 0]}>
        <planeGeometry args={[0.22, 0.3]} />
        <meshStandardMaterial color="#e9dcc0" />
      </mesh>
    </group>
  );
}

function Candle({ position }: { position: [number, number, number] }) {
  const flame = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (flame.current) {
      const t = clock.getElapsedTime();
      flame.current.scale.y = 1 + Math.sin(t * 13 + position[0] * 10) * 0.15;
    }
  });
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.18, 12]} />
        <meshStandardMaterial color="#f3e6c8" roughness={0.6} />
      </mesh>
      <mesh ref={flame} position={[0, 0.13, 0]} scale={[0.6, 1, 0.6]}>
        <sphereGeometry args={[0.03, 10, 10]} />
        <meshBasicMaterial color={[5, 3, 1.2]} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 0.2, 0]} color="#ffb060" intensity={0.8} distance={3} decay={2} />
    </group>
  );
}

export function Desk({ position, rotation, cauldron = false }: P & { cauldron?: boolean }) {
  return (
    <group position={position} rotation={rotation}>
      <Box args={[2.0, 0.08, 1.0]} position={[0, 0.82, 0]} color="#7a5032" />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <Box key={i} args={[0.08, 0.8, 0.08]} position={[sx * 0.9, 0.4, sz * 0.42]} color="#4f321d" />
      ))}
      <Box args={[1.8, 0.1, 0.04]} position={[0, 0.73, 0.44]} color="#5a3820" />
      {/* jars */}
      {[
        [-0.7, "#7a9a6a"],
        [-0.55, "#b88a4a"],
        [-0.4, "#8a6aa0"],
        [0.55, "#6a8aa0"],
      ].map(([x, c], i) => (
        <group key={i} position={[x as number, 0.94, 0.25 - (i % 2) * 0.12]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.055, 0.06, 0.18, 14]} />
            <meshStandardMaterial color={c as string} transparent opacity={0.8} roughness={0.1} metalness={0.1} />
          </mesh>
          <mesh position={[0, 0.11, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.05, 10]} />
            <meshStandardMaterial color="#8a6040" />
          </mesh>
        </group>
      ))}
      {/* books */}
      <group position={[0.75, 0.86, -0.2]}>
        {["#7a2a1e", "#3b4a3a", "#8a6a3a"].map((c, i) => (
          <mesh key={i} position={[0, i * 0.06 + 0.03, 0]} rotation={[0, i * 0.3, 0]} castShadow>
            <boxGeometry args={[0.36, 0.055, 0.26]} />
            <meshStandardMaterial color={c} roughness={0.8} />
          </mesh>
        ))}
      </group>
      {/* open scroll */}
      <mesh position={[-0.1, 0.865, 0.15]} rotation={[-Math.PI / 2, 0, 0.15]} receiveShadow>
        <planeGeometry args={[0.5, 0.34]} />
        <meshStandardMaterial color="#eadbb8" roughness={1} />
      </mesh>
      {/* quill */}
      <mesh position={[0.05, 0.95, 0.1]} rotation={[0.3, 0, -0.8]}>
        <coneGeometry args={[0.02, 0.28, 6]} />
        <meshStandardMaterial color="#f5f0e6" />
      </mesh>
      <Candle position={[-0.85, 0.95, -0.3]} />
      {cauldron && (
        <group position={[0.05, 0.86, -0.15]}>
          <mesh castShadow position={[0, 0.2, 0]}>
            <sphereGeometry args={[0.28, 24, 18, 0, Math.PI * 2, Math.PI * 0.28, Math.PI * 0.72]} />
            <meshStandardMaterial color="#3a3a36" metalness={0.6} roughness={0.45} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.18, 0.025, 8, 24]} />
            <meshStandardMaterial color="#2a2a26" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.36, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.19, 24]} />
            <meshStandardMaterial color="#6fd08a" emissive="#2a8a4a" emissiveIntensity={0.9} />
          </mesh>
          {/* ladle */}
          <mesh position={[0.08, 0.5, 0]} rotation={[0, 0, -0.45]}>
            <cylinderGeometry args={[0.012, 0.012, 0.42]} />
            <meshStandardMaterial color="#5a3a20" />
          </mesh>
        </group>
      )}
    </group>
  );
}

export function Chair({ position, rotation }: P) {
  return (
    <group position={position} rotation={rotation}>
      <Box args={[0.55, 0.06, 0.5]} position={[0, 0.5, 0]} color="#3d2616" dark />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * 0.24, 0.25, sz * 0.21]} castShadow>
          <cylinderGeometry args={[0.025, 0.02, 0.5, 8]} />
          <Wood dark color="#3d2616" />
        </mesh>
      ))}
      {/* tall spindle back */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.25, 1.05, -0.23]} rotation={[-0.08, 0, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.028, 1.1, 8]} />
          <Wood dark color="#3d2616" />
        </mesh>
      ))}
      {[-0.15, -0.05, 0.05, 0.15].map((x) => (
        <mesh key={x} position={[x, 1.0, -0.23]} rotation={[-0.08, 0, 0]} castShadow>
          <cylinderGeometry args={[0.012, 0.012, 0.85, 6]} />
          <Wood dark color="#3d2616" />
        </mesh>
      ))}
      <Box args={[0.6, 0.12, 0.05]} position={[0, 1.57, -0.27]} color="#3d2616" dark />
      <Box args={[0.5, 0.04, 0.04]} position={[0, 0.2, 0]} color="#3d2616" dark />
    </group>
  );
}

export function Trunk({ position, rotation }: P) {
  return (
    <group position={position} rotation={rotation}>
      <Box args={[1.0, 0.5, 0.55]} position={[0, 0.25, 0]} color="#6a3a22" />
      <mesh position={[0, 0.5, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 1]} castShadow>
        <cylinderGeometry args={[0.27, 0.27, 1.0, 16, 1, false, 0, Math.PI]} />
        <Wood color="#5a3020" />
      </mesh>
      {[-0.35, 0.35].map((x) => (
        <mesh key={x} position={[x, 0.4, 0]} castShadow>
          <boxGeometry args={[0.06, 0.82, 0.57]} />
          <meshStandardMaterial color="#b08a4a" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

export function SideTable({ position, rotation }: P) {
  return (
    <group position={position} rotation={rotation}>
      <Box args={[1.3, 0.7, 0.75]} position={[0, 0.45, 0]} color="#5d3b22" />
      <Box args={[1.4, 0.06, 0.82]} position={[0, 0.83, 0]} color="#4a2c18" dark />
      <Box args={[1.1, 0.22, 0.02]} position={[0, 0.5, 0.38]} color="#3f2614" dark />
      {/* plant pot */}
      <group position={[-0.5, 0.86, 0.1]}>
        <mesh castShadow position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.16, 0.12, 0.24, 16]} />
          <meshStandardMaterial color="#6e2a22" roughness={0.7} />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[Math.cos(i * 1.3) * 0.1, 0.32, Math.sin(i * 1.3) * 0.1]} rotation={[Math.sin(i) * 0.6, i, Math.cos(i) * 0.6]} scale={[0.05, 0.14, 0.02]}>
            <sphereGeometry args={[1, 8, 8]} />
            <meshStandardMaterial color="#6a8a3a" roughness={0.8} />
          </mesh>
        ))}
      </group>
      {/* picture frame of the witch */}
      <group position={[0.35, 1.06, 0.05]} rotation={[-0.15, -0.35, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.32, 0.42, 0.03]} />
          <meshStandardMaterial color="#c9a674" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.017]}>
          <planeGeometry args={[0.25, 0.35]} />
          <meshStandardMaterial color="#e8d8bc" />
        </mesh>
        <mesh position={[0, -0.06, 0.02]} scale={[0.07, 0.09, 0.01]}>
          <sphereGeometry args={[1, 10, 10]} />
          <meshStandardMaterial color="#8e2620" />
        </mesh>
        <mesh position={[0, 0.06, 0.02]} scale={[0.045, 0.05, 0.01]}>
          <sphereGeometry args={[1, 10, 10]} />
          <meshStandardMaterial color="#7b3b22" />
        </mesh>
      </group>
      {/* owl with spread wings */}
      <Owl position={[-0.02, 0.88, 0.05]} rotation={[0, 0.4, 0]} scale={1.05} body="#cfcac0" belly="#f4f2ee" speck="#6a6a68" tufts={false} flap seed={4} />
    </group>
  );
}

export function OwlPerch({ position, rotation }: P) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.03, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.25, 0.06, 16]} />
        <Wood dark color="#3d2616" />
      </mesh>
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.85, 8]} />
        <Wood dark color="#3d2616" />
      </mesh>
      <mesh position={[0, 0.88, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.6, 8]} />
        <Wood dark color="#3d2616" />
      </mesh>
      <Owl position={[0, 0.9, 0]} scale={1.0} body="#8a6a48" belly="#efe7d8" speck="#4a3424" letter seed={2.2} />
    </group>
  );
}
