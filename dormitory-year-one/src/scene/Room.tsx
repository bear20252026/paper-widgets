import { useMemo } from "react";
import * as THREE from "three";
import { bannerTexture, brickTexture, floorTexture, rugTexture, woodTexture } from "./textures";

const R = 7.2; // tower apothem
const SIDES = 8;
const H = 5.4;

export function wallTransform(i: number) {
  const a = (i / SIDES) * Math.PI * 2; // i=0 => back wall (-z)
  const x = Math.sin(a) * R;
  const z = -Math.cos(a) * R;
  return { position: [x, 0, z] as [number, number, number], rotationY: -a };
}

function GlowPane({ w, h, shape }: { w?: number; h?: number; shape?: THREE.Shape }) {
  return (
    <mesh>
      {shape ? <shapeGeometry args={[shape]} /> : <planeGeometry args={[w, h]} />}
      <meshBasicMaterial color={[2.6, 2.2, 1.6]} toneMapped={false} />
    </mesh>
  );
}

function Mullions({ w, h, cols, rows, color = "#e7d3ae" }: { w: number; h: number; cols: number; rows: number; color?: string }) {
  const bars = [];
  for (let c = 1; c < cols; c++)
    bars.push(
      <mesh key={"c" + c} position={[-w / 2 + (c * w) / cols, 0, 0.03]}>
        <boxGeometry args={[0.05, h, 0.05]} />
        <meshStandardMaterial color={color} />
      </mesh>
    );
  for (let r = 1; r < rows; r++)
    bars.push(
      <mesh key={"r" + r} position={[0, -h / 2 + (r * h) / rows, 0.03]}>
        <boxGeometry args={[w, 0.04, 0.04]} />
        <meshStandardMaterial color={color} />
      </mesh>
    );
  return <>{bars}</>;
}

function SideWindow() {
  const w = 2.0;
  const h = 2.6;
  return (
    <group position={[0, 2.6, 0.06]}>
      {/* deep stone reveal */}
      <mesh position={[0, 0, 0.12]}>
        <boxGeometry args={[w + 0.5, h + 0.5, 0.2]} />
        <meshStandardMaterial color="#d6b98c" roughness={0.9} />
      </mesh>
      <group position={[0, 0, 0.23]}>
        <GlowPane w={w} h={h} />
        <Mullions w={w} h={h} cols={3} rows={6} />
      </group>
      {/* sill */}
      <mesh position={[0, -h / 2 - 0.2, 0.35]} castShadow receiveShadow>
        <boxGeometry args={[w + 0.8, 0.12, 0.5]} />
        <meshStandardMaterial color="#c9a674" roughness={0.9} />
      </mesh>
    </group>
  );
}

function GothicWindow() {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const w = 1.1;
    s.moveTo(-w, 0);
    s.lineTo(-w, 2.2);
    s.quadraticCurveTo(-w, 3.3, 0, 4.0);
    s.quadraticCurveTo(w, 3.3, w, 2.2);
    s.lineTo(w, 0);
    s.lineTo(-w, 0);
    return s;
  }, []);
  const frame = useMemo(() => {
    const s = new THREE.Shape();
    const w = 1.45;
    s.moveTo(-w, -0.2);
    s.lineTo(-w, 2.2);
    s.quadraticCurveTo(-w, 3.55, 0, 4.4);
    s.quadraticCurveTo(w, 3.55, w, 2.2);
    s.lineTo(w, -0.2);
    s.lineTo(-w, -0.2);
    return s;
  }, []);
  return (
    <group position={[0, 1.0, 0.08]}>
      <mesh position={[0, 0, 0.02]}>
        <extrudeGeometry args={[frame, { depth: 0.15, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05 }]} />
        <meshStandardMaterial color="#e2c99c" roughness={0.85} />
      </mesh>
      <group position={[0, 0, 0.25]}>
        <GlowPane shape={shape} />
        {/* tracery */}
        <mesh position={[0, 1.9, 0.03]}>
          <boxGeometry args={[0.07, 3.8, 0.06]} />
          <meshStandardMaterial color="#e7d3ae" />
        </mesh>
        {[-0.55, 0.55].map((x) => (
          <mesh key={x} position={[x, 1.2, 0.03]}>
            <boxGeometry args={[0.05, 2.4, 0.05]} />
            <meshStandardMaterial color="#e7d3ae" />
          </mesh>
        ))}
        {[0.6, 1.2, 1.8, 2.4].map((y) => (
          <mesh key={y} position={[0, y, 0.03]}>
            <boxGeometry args={[2.2, 0.04, 0.04]} />
            <meshStandardMaterial color="#e7d3ae" />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.38, 2.9, 0.03]} rotation={[0, 0, s * 0.5]}>
            <torusGeometry args={[0.35, 0.03, 8, 20, Math.PI]} />
            <meshStandardMaterial color="#e7d3ae" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function LightShaft({ position, rotation, length = 7, radius = 1.2, opacity = 0.07 }: {
  position: [number, number, number];
  rotation: [number, number, number];
  length?: number;
  radius?: number;
  opacity?: number;
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <cylinderGeometry args={[radius * 0.7, radius * 1.4, length, 4, 1, true]} />
      <meshBasicMaterial
        color="#ffdca0"
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export default function Room() {
  const brick = brickTexture();
  const floor = floorTexture();
  const wood = woodTexture(true);
  const rug = rugTexture();
  const banner = bannerTexture();
  const wallW = 2 * R * Math.tan(Math.PI / SIDES) + 0.05;

  return (
    <group>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[R / Math.cos(Math.PI / SIDES) + 0.2, SIDES, Math.PI / SIDES]} />
        <meshStandardMaterial map={floor} roughness={0.8} color="#e9cfa6" />
      </mesh>
      {/* rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0.0]} position={[0, 0.012, 0.3]} receiveShadow>
        <planeGeometry args={[5.5, 4.2]} />
        <meshStandardMaterial map={rug} roughness={1} />
      </mesh>

      {/* walls */}
      {Array.from({ length: SIDES }).map((_, i) => {
        const { position, rotationY } = wallTransform(i);
        return (
          <group key={i} position={position} rotation={[0, rotationY, 0]}>
            <mesh position={[0, H / 2, 0]} receiveShadow>
              <planeGeometry args={[wallW, H]} />
              <meshStandardMaterial map={brick} roughness={0.95} color="#f0d9b5" />
            </mesh>
            {/* wainscot */}
            <mesh position={[0, 0.45, 0.04]} receiveShadow>
              <boxGeometry args={[wallW, 0.9, 0.08]} />
              <meshStandardMaterial map={wood} color="#9a6a42" roughness={0.8} />
            </mesh>
            {/* corner pillar */}
            <mesh position={[wallW / 2, H / 2, 0.15]} castShadow>
              <boxGeometry args={[0.35, H, 0.35]} />
              <meshStandardMaterial map={wood} color="#7a5032" roughness={0.8} />
            </mesh>
            {i === 0 && <GothicWindow />}
            {(i === 2 || i === 6 || i === 1 || i === 7) && <SideWindow />}
            {/* top beam ring */}
            <mesh position={[0, H - 0.15, 0.2]} castShadow>
              <boxGeometry args={[wallW, 0.3, 0.4]} />
              <meshStandardMaterial map={wood} color="#6a4228" roughness={0.8} />
            </mesh>
          </group>
        );
      })}

      {/* banner on left wall */}
      {(() => {
        const { position, rotationY } = wallTransform(7);
        return (
          <group position={position} rotation={[0, rotationY, 0]}>
            <mesh position={[-2.05, 3.0, 0.3]} castShadow>
              <planeGeometry args={[1.1, 2.6, 1, 8]} />
              <meshStandardMaterial map={banner} roughness={0.9} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[-2.05, 4.32, 0.32]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.03, 0.03, 1.4, 8]} />
              <meshStandardMaterial color="#c9a15a" metalness={0.6} roughness={0.3} />
            </mesh>
          </group>
        );
      })()}

      {/* ceiling: conical roof with radial beams and swagged drapes */}
      <mesh position={[0, H + 1.6, 0]}>
        <coneGeometry args={[R / Math.cos(Math.PI / SIDES) + 0.3, 3.2, SIDES, 1, true, Math.PI / SIDES]} />
        <meshStandardMaterial color="#5a3420" side={THREE.BackSide} roughness={0.9} map={wood} />
      </mesh>
      {Array.from({ length: SIDES }).map((_, i) => {
        const a = ((i + 0.5) / SIDES) * Math.PI * 2;
        const len = Math.hypot(R / Math.cos(Math.PI / SIDES), 3.2);
        const tilt = Math.atan2(R / Math.cos(Math.PI / SIDES), 3.2);
        return (
          <group key={i} rotation={[0, -a, 0]} position={[0, H + 3.2, 0]}>
            <mesh rotation={[tilt, 0, 0]} position={[0, -1.6, -R / Math.cos(Math.PI / SIDES) / 2]}>
              <boxGeometry args={[0.22, len, 0.22]} />
              <meshStandardMaterial map={wood} color="#4a2c1a" />
            </mesh>
          </group>
        );
      })}
      {/* drapes */}
      {Array.from({ length: SIDES }).map((_, i) => {
        const { position, rotationY } = wallTransform(i);
        return (
          <group key={i} position={[position[0] * 0.93, H + 0.25, position[2] * 0.93]} rotation={[0, rotationY, 0]}>
            {[-1, 0, 1].map((k) => (
              <mesh key={k} position={[k * 1.8, 0, 0]} rotation={[0, 0, Math.PI]} scale={[1, 0.55, 1]}>
                <torusGeometry args={[0.9, 0.12, 8, 24, Math.PI]} />
                <meshStandardMaterial color="#6e2a1e" roughness={0.9} />
              </mesh>
            ))}
          </group>
        );
      })}
      {/* hanging lantern ring */}
      <group position={[0, H + 0.2, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.0, 0.05, 8, 32]} />
          <meshStandardMaterial color="#3a2414" metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.8, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 1.6]} />
          <meshStandardMaterial color="#2a1a10" />
        </mesh>
        {Array.from({ length: 6 }).map((_, i) => {
          const a = (i / 6) * Math.PI * 2;
          return (
            <group key={i} position={[Math.cos(a), 0.1, Math.sin(a)]}>
              <mesh>
                <cylinderGeometry args={[0.03, 0.03, 0.18]} />
                <meshStandardMaterial color="#f1e6cc" />
              </mesh>
              <mesh position={[0, 0.13, 0]}>
                <sphereGeometry args={[0.03, 8, 8]} />
                <meshBasicMaterial color={[4, 2.6, 1]} toneMapped={false} />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* sun shafts */}
      <LightShaft position={[0, 3.2, -4.4]} rotation={[-0.75, 0, 0]} length={7} radius={1.0} opacity={0.06} />
      <LightShaft position={[4.4, 2.4, -1.2]} rotation={[0.2, 0, -0.95]} length={7} radius={1.0} opacity={0.08} />
      <LightShaft position={[-4.4, 2.4, -1.2]} rotation={[0.2, 0, 0.95]} length={7} radius={1.0} opacity={0.05} />
    </group>
  );
}
