import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import Owl from "./Owl";
import { vestTexture } from "./textures";

const SKIN = "#f2d2bd";
const HAIR = "#7b3b22";
const ROBE = "#8e2620";
const ROBE_DARK = "#6a1a16";
const PINK = "#d9958a";

function lathe(points: [number, number][], segs = 48, phiStart = 0, phiLength = Math.PI * 2) {
  return new THREE.LatheGeometry(
    points.map(([x, y]) => new THREE.Vector2(x, y)),
    segs,
    phiStart,
    phiLength
  );
}

export default function Witch(props: { position?: [number, number, number]; rotation?: [number, number, number] }) {
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const lids = useRef<THREE.Group>(null);
  const pigL = useRef<THREE.Group>(null);
  const pigR = useRef<THREE.Group>(null);

  const robeGeo = useMemo(
    () =>
      lathe(
        [
          [0.47, 0],
          [0.44, 0.15],
          [0.38, 0.4],
          [0.31, 0.7],
          [0.24, 0.95],
          [0.205, 1.1],
          [0.2, 1.2],
          [0.16, 1.27],
          [0.1, 1.31],
        ],
        56,
        0.42,
        Math.PI * 2 - 0.84
      ),
    []
  );
  const dressGeo = useMemo(
    () =>
      lathe([
        [0.4, 0.02],
        [0.36, 0.3],
        [0.28, 0.65],
        [0.2, 0.9],
        [0.16, 0.95],
      ]),
    []
  );
  const vestGeo = useMemo(
    () =>
      lathe([
        [0.16, 0.86],
        [0.2, 0.9],
        [0.175, 1.0],
        [0.165, 1.08],
        [0.18, 1.18],
        [0.15, 1.27],
        [0.06, 1.3],
      ]),
    []
  );
  const sleeveGeo = useMemo(
    () =>
      lathe([
        [0.05, 0],
        [0.065, 0.1],
        [0.085, 0.22],
        [0.11, 0.3],
        [0.1, 0.31],
      ], 24),
    []
  );

  const vest = vestTexture();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (torso.current) {
      const b = Math.sin(t * 1.6) * 0.008;
      torso.current.scale.set(1 + b * 0.5, 1 + b, 1 + b * 0.5);
    }
    if (head.current) {
      head.current.rotation.y = 0.32 + Math.sin(t * 0.4) * 0.12;
      head.current.rotation.x = -0.05 + Math.sin(t * 0.7) * 0.03;
      head.current.rotation.z = -0.06 + Math.sin(t * 0.5) * 0.03;
    }
    if (leftArm.current) leftArm.current.rotation.z = 0.28 + Math.sin(t * 1.1) * 0.03;
    if (lids.current) {
      const blink = t % 4.2 < 0.13 ? 1 : 0.0001;
      lids.current.scale.y = THREE.MathUtils.lerp(lids.current.scale.y, blink, 0.6);
    }
    if (pigL.current && pigR.current) {
      pigL.current.rotation.z = Math.sin(t * 1.3) * 0.05;
      pigR.current.rotation.z = -Math.sin(t * 1.3 + 0.5) * 0.05;
    }
  });

  return (
    <group {...props}>
      {/* ---------- lower body ---------- */}
      <mesh geometry={dressGeo} castShadow receiveShadow>
        <meshStandardMaterial color="#4a2c2a" roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      {/* shoes peeking */}
      {[-0.09, 0.09].map((x) => (
        <mesh key={x} position={[x, 0.03, 0.3]} scale={[0.06, 0.04, 0.1]} castShadow>
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color="#2a1a14" roughness={0.4} />
        </mesh>
      ))}

      <group ref={torso}>
        {/* robe */}
        <mesh geometry={robeGeo} castShadow receiveShadow>
          <meshStandardMaterial color={ROBE} roughness={0.75} side={THREE.DoubleSide} />
        </mesh>
        {/* robe front edge trim */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.135, 0.55, 0.31]} rotation={[-0.22, s * 0.4, s * 0.1]} castShadow>
            <boxGeometry args={[0.05, 1.12, 0.02]} />
            <meshStandardMaterial color={ROBE_DARK} roughness={0.8} />
          </mesh>
        ))}
        {/* pink lapels */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.1, 1.2, 0.13]} rotation={[-0.3, s * 0.5, s * -0.35]}>
            <boxGeometry args={[0.07, 0.18, 0.015]} />
            <meshStandardMaterial color={PINK} roughness={0.8} />
          </mesh>
        ))}
        {/* hood draped behind */}
        <mesh position={[0, 1.27, -0.08]} rotation={[1.25, 0, 0]} castShadow>
          <torusGeometry args={[0.14, 0.05, 12, 24, Math.PI]} />
          <meshStandardMaterial color={ROBE} roughness={0.8} />
        </mesh>

        {/* vest */}
        <mesh geometry={vestGeo} castShadow>
          <meshStandardMaterial map={vest} roughness={0.7} />
        </mesh>
        {/* buttons */}
        {[0.93, 1.0, 1.07, 1.14].map((y) => (
          <mesh key={y} position={[0, y, 0.175]}>
            <sphereGeometry args={[0.011, 10, 10]} />
            <meshStandardMaterial color="#3a1a14" roughness={0.3} />
          </mesh>
        ))}
        {/* blouse lower */}
        <mesh position={[0, 1.255, 0.06]} scale={[0.07, 0.04, 0.08]}>
          <sphereGeometry args={[1, 14, 14]} />
          <meshStandardMaterial color="#f3ece2" roughness={0.9} />
        </mesh>

        {/* cravat ruffles */}
        <group position={[0, 1.27, 0.115]}>
          {[
            [0, 0.04, 0.02, 0.045],
            [-0.03, 0.01, 0.025, 0.035],
            [0.03, 0.01, 0.025, 0.035],
            [0, -0.02, 0.03, 0.04],
            [-0.02, -0.06, 0.025, 0.03],
            [0.02, -0.06, 0.025, 0.03],
            [0, -0.095, 0.02, 0.028],
          ].map(([x, y, z, r], i) => (
            <mesh key={i} position={[x, y, z]} rotation={[0.4, 0, i]} scale={[1, 0.8, 0.55]} castShadow>
              <dodecahedronGeometry args={[r, 1]} />
              <meshStandardMaterial color="#f7f2ea" roughness={0.85} flatShading />
            </mesh>
          ))}
        </group>
        {/* high collar */}
        <mesh position={[0, 1.34, 0.005]}>
          <cylinderGeometry args={[0.058, 0.07, 0.07, 20, 1, true]} />
          <meshStandardMaterial color="#f7f2ea" roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
        {/* neck */}
        <mesh position={[0, 1.37, 0]}>
          <cylinderGeometry args={[0.042, 0.048, 0.1, 16]} />
          <meshStandardMaterial color={SKIN} roughness={0.7} />
        </mesh>

        {/* ---------- right arm (extended, holds owl) ---------- */}
        <mesh position={[-0.2, 1.21, -0.01]} scale={[0.085, 0.09, 0.085]} castShadow>
          <sphereGeometry args={[1, 18, 18]} />
          <meshStandardMaterial color={ROBE} roughness={0.75} />
        </mesh>
        <group position={[-0.21, 1.2, 0]} rotation={[0.25, 0, -0.42]}>
          <mesh position={[0, -0.14, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.055, 0.3, 16]} />
            <meshStandardMaterial color={ROBE} roughness={0.75} />
          </mesh>
        </group>
        {/* forearm pointing forward-out */}
        <group position={[-0.32, 0.95, 0.07]} rotation={[0, -0.75, 0]}>
          <group rotation={[Math.PI / 2, 0, 0]}>
            <mesh geometry={sleeveGeo} castShadow position={[0, 0, 0]}>
              <meshStandardMaterial color={ROBE} roughness={0.75} side={THREE.DoubleSide} />
            </mesh>
          </group>
          {/* lace cuff */}
          <mesh position={[0, 0, 0.31]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.085, 0.03, 18, 1, true]} />
            <meshStandardMaterial color="#f5efe6" side={THREE.DoubleSide} roughness={0.9} />
          </mesh>
          {/* hand, palm up */}
          <group position={[0, 0.0, 0.36]}>
            <mesh scale={[0.045, 0.018, 0.05]} castShadow>
              <sphereGeometry args={[1, 14, 12]} />
              <meshStandardMaterial color={SKIN} roughness={0.7} />
            </mesh>
            {[-0.03, -0.01, 0.01, 0.03].map((x, i) => (
              <mesh key={x} position={[x, 0.005, 0.05 + (i === 1 || i === 2 ? 0.008 : 0)]} rotation={[Math.PI / 2 - 0.3, 0, 0]}>
                <capsuleGeometry args={[0.009, 0.04, 4, 8]} />
                <meshStandardMaterial color={SKIN} roughness={0.7} />
              </mesh>
            ))}
            <mesh position={[0.05, 0.01, 0.0]} rotation={[0.3, 0, -0.9]}>
              <capsuleGeometry args={[0.01, 0.035, 4, 8]} />
              <meshStandardMaterial color={SKIN} roughness={0.7} />
            </mesh>
          </group>
          {/* the owl perched on the forearm */}
          <Owl position={[0, 0.085, 0.19]} rotation={[0, 0.85, 0]} scale={1.15} body="#8b6b4b" belly="#f1ebdf" speck="#5b4232" seed={1.3} />
        </group>

        {/* ---------- left arm (relaxed) ---------- */}
        <mesh position={[0.2, 1.21, -0.01]} scale={[0.085, 0.09, 0.085]} castShadow>
          <sphereGeometry args={[1, 18, 18]} />
          <meshStandardMaterial color={ROBE} roughness={0.75} />
        </mesh>
        <group ref={leftArm} position={[0.21, 1.2, 0]} rotation={[0.08, 0, 0.28]}>
          <mesh position={[0, -0.14, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.055, 0.3, 16]} />
            <meshStandardMaterial color={ROBE} roughness={0.75} />
          </mesh>
          <group position={[0, -0.28, 0]} rotation={[0.25, 0, -0.1]}>
            <group rotation={[Math.PI, 0, 0]}>
              <mesh geometry={sleeveGeo} castShadow>
                <meshStandardMaterial color={ROBE} roughness={0.75} side={THREE.DoubleSide} />
              </mesh>
            </group>
            <mesh position={[0, -0.32, 0]}>
              <cylinderGeometry args={[0.085, 0.07, 0.035, 18, 1, true]} />
              <meshStandardMaterial color="#f5efe6" side={THREE.DoubleSide} roughness={0.9} />
            </mesh>
            <mesh position={[0, -0.39, 0.01]} scale={[0.035, 0.065, 0.025]} castShadow>
              <sphereGeometry args={[1, 14, 12]} />
              <meshStandardMaterial color={SKIN} roughness={0.7} />
            </mesh>
          </group>
        </group>

        {/* ---------- head ---------- */}
        <group ref={head} position={[0, 1.52, 0.005]}>
          {/* face */}
          <mesh castShadow scale={[0.112, 0.13, 0.115]}>
            <sphereGeometry args={[1, 32, 32]} />
            <meshStandardMaterial color={SKIN} roughness={0.65} />
          </mesh>
          {/* chin */}
          <mesh position={[0, -0.075, 0.035]} scale={[0.07, 0.06, 0.07]}>
            <sphereGeometry args={[1, 20, 20]} />
            <meshStandardMaterial color={SKIN} roughness={0.65} />
          </mesh>
          {/* cheeks blush */}
          {[-0.06, 0.06].map((x) => (
            <mesh key={x} position={[x, -0.035, 0.085]} scale={[0.025, 0.015, 0.01]}>
              <sphereGeometry args={[1, 12, 12]} />
              <meshStandardMaterial color="#eaa99a" transparent opacity={0.55} roughness={0.8} />
            </mesh>
          ))}
          {/* eyes */}
          {[-0.045, 0.045].map((x) => (
            <group key={x} position={[x, 0.0, 0.088]}>
              <mesh scale={[0.031, 0.034, 0.018]}>
                <sphereGeometry args={[1, 20, 20]} />
                <meshStandardMaterial color="#fbf8f4" roughness={0.3} />
              </mesh>
              <mesh position={[x > 0 ? 0.006 : 0.004, -0.002, 0.012]} scale={[0.02, 0.023, 0.01]}>
                <sphereGeometry args={[1, 20, 20]} />
                <meshStandardMaterial color="#3a78b8" roughness={0.2} emissive="#123a66" emissiveIntensity={0.3} />
              </mesh>
              <mesh position={[x > 0 ? 0.006 : 0.004, -0.002, 0.019]} scale={[0.01, 0.012, 0.006]}>
                <sphereGeometry args={[1, 14, 14]} />
                <meshStandardMaterial color="#0e1420" roughness={0.1} />
              </mesh>
              <mesh position={[0.01, 0.008, 0.024]}>
                <sphereGeometry args={[0.0045, 8, 8]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
              {/* upper lash line */}
              <mesh position={[0, 0.026, 0.01]} rotation={[0, 0, x > 0 ? -0.12 : 0.12]} scale={[0.034, 0.006, 0.01]}>
                <sphereGeometry args={[1, 12, 8]} />
                <meshStandardMaterial color="#3a1c12" />
              </mesh>
              {/* brow */}
              <mesh position={[0, 0.058, 0.012]} rotation={[0, 0, x > 0 ? -0.15 : 0.15]} scale={[0.03, 0.004, 0.006]}>
                <sphereGeometry args={[1, 12, 8]} />
                <meshStandardMaterial color="#5a2a18" />
              </mesh>
            </group>
          ))}
          {/* eyelids blink */}
          <group ref={lids} position={[0, 0.03, 0.09]} scale={[1, 0.0001, 1]}>
            {[-0.045, 0.045].map((x) => (
              <mesh key={x} position={[x, -0.03, 0.006]} scale={[0.033, 0.036, 0.02]}>
                <sphereGeometry args={[1, 16, 16]} />
                <meshStandardMaterial color={SKIN} />
              </mesh>
            ))}
          </group>
          {/* nose */}
          <mesh position={[0, -0.03, 0.112]} scale={[0.012, 0.016, 0.012]}>
            <sphereGeometry args={[1, 12, 12]} />
            <meshStandardMaterial color="#efc4ae" roughness={0.6} />
          </mesh>
          {/* mouth */}
          <mesh position={[0, -0.068, 0.1]} scale={[0.016, 0.006, 0.006]}>
            <sphereGeometry args={[1, 12, 8]} />
            <meshStandardMaterial color="#b9605a" roughness={0.5} />
          </mesh>
          {/* ears */}
          {[-0.108, 0.108].map((x) => (
            <mesh key={x} position={[x, -0.005, 0]} scale={[0.018, 0.03, 0.022]}>
              <sphereGeometry args={[1, 12, 12]} />
              <meshStandardMaterial color={SKIN} />
            </mesh>
          ))}

          {/* hair cap */}
          <mesh position={[0, 0.02, -0.012]} rotation={[-1.0, 0, 0]} scale={[1.08, 1.06, 1.06]} castShadow>
            <sphereGeometry args={[0.12, 32, 32, 0, Math.PI * 2, 0, 1.95]} />
            <meshStandardMaterial color={HAIR} roughness={0.55} side={THREE.DoubleSide} />
          </mesh>
          {/* back of hair */}
          <mesh position={[0, -0.02, -0.04]} scale={[0.125, 0.13, 0.1]} castShadow>
            <sphereGeometry args={[1, 24, 24]} />
            <meshStandardMaterial color={HAIR} roughness={0.55} />
          </mesh>
          {/* swept bangs */}
          {[
            [-0.06, 0.085, 0.075, 0.6, 0.055],
            [-0.015, 0.1, 0.085, 0.9, 0.05],
            [0.04, 0.095, 0.08, 1.15, 0.05],
            [0.08, 0.06, 0.06, 1.4, 0.045],
            [-0.09, 0.04, 0.05, 0.2, 0.045],
          ].map(([x, y, z, rz, s], i) => (
            <mesh key={i} position={[x, y, z]} rotation={[0.3, 0, rz]} scale={[s, s * 0.45, s * 0.55]} castShadow>
              <sphereGeometry args={[1, 16, 12]} />
              <meshStandardMaterial color={i % 2 ? "#8a4528" : HAIR} roughness={0.55} />
            </mesh>
          ))}
          {/* side locks */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.1, -0.06, 0.02]} rotation={[0.1, 0, s * 0.15]} scale={[0.03, 0.075, 0.05]} castShadow>
              <sphereGeometry args={[1, 14, 14]} />
              <meshStandardMaterial color={HAIR} roughness={0.55} />
            </mesh>
          ))}
          {/* low pigtails */}
          {[-1, 1].map((s) => (
            <group key={s} ref={s < 0 ? pigL : pigR} position={[s * 0.1, -0.11, -0.04]}>
              <mesh position={[0, 0.015, 0]} rotation={[0, 0, Math.PI / 2]}>
                <torusGeometry args={[0.022, 0.008, 8, 16]} />
                <meshStandardMaterial color="#f2ece0" />
              </mesh>
              {[
                [s * 0.02, -0.03, 0.01, 0.045],
                [s * 0.035, -0.075, 0.005, 0.04],
                [s * 0.02, -0.11, 0.0, 0.03],
              ].map(([x, y, z, r], i) => (
                <mesh key={i} position={[x, y, z]} scale={[r, r * 1.1, r]} castShadow>
                  <dodecahedronGeometry args={[1, 1]} />
                  <meshStandardMaterial color={i === 1 ? "#8a4528" : HAIR} roughness={0.55} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}
