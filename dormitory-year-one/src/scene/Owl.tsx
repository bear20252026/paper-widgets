import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { featherTexture } from "./textures";

type OwlProps = {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  body?: string;
  belly?: string;
  speck?: string;
  tufts?: boolean;
  wingsOpen?: boolean;
  flap?: boolean;
  letter?: boolean;
  lookAround?: boolean;
  seed?: number;
};

export default function Owl({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  body = "#8a6a4a",
  belly = "#efe6d6",
  speck = "#5a4030",
  tufts = true,
  wingsOpen = false,
  flap = false,
  letter = false,
  lookAround = true,
  seed = 0,
}: OwlProps) {
  const head = useRef<THREE.Group>(null);
  const lw = useRef<THREE.Group>(null);
  const rw = useRef<THREE.Group>(null);
  const root = useRef<THREE.Group>(null);
  const lid = useRef<THREE.Group>(null);

  const bodyTex = featherTexture(body, speck);
  const bellyTex = featherTexture(belly, speck);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + seed;
    if (head.current && lookAround) {
      // occasional snappy head turns like a real owl
      const phase = Math.floor(t / 2.6) % 4;
      const targets = [0, 0.7, 0, -0.55];
      const target = targets[phase];
      head.current.rotation.y = THREE.MathUtils.lerp(head.current.rotation.y, target, 0.08);
      head.current.rotation.z = Math.sin(t * 0.7) * 0.06;
    }
    if (lid.current) {
      const blink = (t % 3.7) < 0.12 ? 1 : 0.0001;
      lid.current.scale.y = THREE.MathUtils.lerp(lid.current.scale.y, blink, 0.5);
    }
    if (root.current) root.current.position.y = Math.sin(t * 2) * 0.004;
    if (flap && lw.current && rw.current) {
      const a = Math.sin(t * 7) * 0.45;
      lw.current.rotation.z = 0.9 + a;
      rw.current.rotation.z = -0.9 - a;
      if (root.current) root.current.position.y = Math.sin(t * 7 + 1) * 0.02;
    }
  });

  const wingOpenZ = wingsOpen ? 0.9 : 0.15;

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <group ref={root}>
        {/* body */}
        <mesh castShadow position={[0, 0.17, 0]} scale={[0.13, 0.17, 0.12]}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshStandardMaterial map={bodyTex} roughness={0.9} />
        </mesh>
        {/* belly */}
        <mesh position={[0, 0.15, 0.05]} scale={[0.105, 0.14, 0.085]}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshStandardMaterial map={bellyTex} roughness={0.95} />
        </mesh>

        {/* wings */}
        <group ref={lw} position={[0.11, 0.25, -0.01]} rotation={[0, 0, wingOpenZ]}>
          <Wing tex={bodyTex} side={1} open={wingsOpen || flap} />
        </group>
        <group ref={rw} position={[-0.11, 0.25, -0.01]} rotation={[0, 0, -wingOpenZ]}>
          <Wing tex={bodyTex} side={-1} open={wingsOpen || flap} />
        </group>

        {/* tail */}
        <mesh position={[0, 0.03, -0.09]} rotation={[0.9, 0, 0]} scale={[0.07, 0.09, 0.02]}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshStandardMaterial map={bodyTex} roughness={0.9} />
        </mesh>

        {/* feet */}
        {[-0.045, 0.045].map((x) => (
          <group key={x} position={[x, 0.01, 0.05]}>
            {[-0.4, 0, 0.4].map((a) => (
              <mesh key={a} rotation={[Math.PI / 2, 0, a]} position={[0, 0, 0.012]}>
                <coneGeometry args={[0.008, 0.035, 6]} />
                <meshStandardMaterial color="#3a2a1a" />
              </mesh>
            ))}
            <mesh position={[0, 0.015, 0]} scale={[0.025, 0.02, 0.022]}>
              <sphereGeometry args={[1, 10, 10]} />
              <meshStandardMaterial map={bellyTex} />
            </mesh>
          </group>
        ))}

        {/* head */}
        <group ref={head} position={[0, 0.38, 0.01]}>
          <mesh castShadow scale={[0.12, 0.105, 0.1]}>
            <sphereGeometry args={[1, 24, 24]} />
            <meshStandardMaterial map={bodyTex} roughness={0.9} />
          </mesh>
          {/* facial disc */}
          <mesh position={[0, -0.005, 0.055]} scale={[0.1, 0.08, 0.05]}>
            <sphereGeometry args={[1, 24, 24]} />
            <meshStandardMaterial map={bellyTex} roughness={0.95} />
          </mesh>
          {/* eyes */}
          {[-0.042, 0.042].map((x) => (
            <group key={x} position={[x, 0.01, 0.095]}>
              <mesh>
                <sphereGeometry args={[0.032, 20, 20]} />
                <meshStandardMaterial color="#1a120a" />
              </mesh>
              <mesh position={[0, 0, 0.008]}>
                <sphereGeometry args={[0.028, 20, 20]} />
                <meshStandardMaterial color="#f5c718" emissive="#6a4a00" emissiveIntensity={0.4} roughness={0.2} />
              </mesh>
              <mesh position={[0, 0, 0.022]}>
                <sphereGeometry args={[0.015, 16, 16]} />
                <meshStandardMaterial color="#0a0604" roughness={0.1} />
              </mesh>
              <mesh position={[0.007, 0.008, 0.034]}>
                <sphereGeometry args={[0.004, 8, 8]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>
          ))}
          {/* eyelids for blinking */}
          <group ref={lid} position={[0, 0.03, 0.1]} scale={[1, 0.0001, 1]}>
            {[-0.042, 0.042].map((x) => (
              <mesh key={x} position={[x, -0.02, 0]} scale={[1, 1, 0.6]}>
                <sphereGeometry args={[0.034, 16, 16]} />
                <meshStandardMaterial map={bodyTex} />
              </mesh>
            ))}
          </group>
          {/* brows */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.045, 0.045, 0.09]} rotation={[0, 0, s * -0.35]} scale={[0.04, 0.008, 0.01]}>
              <boxGeometry />
              <meshStandardMaterial color={speck} />
            </mesh>
          ))}
          {/* beak */}
          <mesh position={[0, -0.025, 0.11]} rotation={[Math.PI / 2 + 0.3, 0, 0]}>
            <coneGeometry args={[0.014, 0.045, 8]} />
            <meshStandardMaterial color="#3d3020" roughness={0.4} />
          </mesh>
          {/* ear tufts */}
          {tufts &&
            [-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.075, 0.09, 0.01]} rotation={[0, 0, s * -0.45]}>
                <coneGeometry args={[0.025, 0.09, 8]} />
                <meshStandardMaterial map={bodyTex} />
              </mesh>
            ))}
        </group>

        {/* letter in beak/feet */}
        {letter && (
          <group position={[0, 0.2, 0.13]} rotation={[0.1, 0, 0.05]}>
            <mesh castShadow>
              <boxGeometry args={[0.16, 0.11, 0.008]} />
              <meshStandardMaterial color="#e8d8b5" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.015, 0.005]} rotation={[0, 0, Math.PI / 4]}>
              <boxGeometry args={[0.08, 0.08, 0.002]} />
              <meshStandardMaterial color="#d8c69e" />
            </mesh>
            <mesh position={[0, -0.005, 0.008]}>
              <cylinderGeometry args={[0.015, 0.015, 0.006, 16]} />
              <meshStandardMaterial color="#9a1f1a" roughness={0.3} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}

function Wing({ tex, side, open }: { tex: THREE.Texture; side: number; open: boolean }) {
  return (
    <group>
      <mesh castShadow position={[side * (open ? 0.12 : 0.01), open ? 0 : -0.1, 0]} scale={open ? [0.16, 0.06, 0.03] : [0.04, 0.13, 0.08]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial map={tex} roughness={0.9} />
      </mesh>
      {open &&
        [0, 1, 2, 3, 4].map((i) => (
          <mesh
            key={i}
            castShadow
            position={[side * (0.12 + i * 0.045), -0.04 - i * 0.008, 0]}
            rotation={[0, 0, side * (-0.4 - i * 0.12)]}
            scale={[0.025, 0.09, 0.012]}
          >
            <sphereGeometry args={[1, 10, 10]} />
            <meshStandardMaterial map={tex} roughness={0.9} />
          </mesh>
        ))}
    </group>
  );
}
