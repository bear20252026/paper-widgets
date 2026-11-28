import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sparkles } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, BrightnessContrast, HueSaturation } from "@react-three/postprocessing";
import * as THREE from "three";
import Room from "./scene/Room";
import Witch from "./scene/Witch";
import { BunkBed, CanopyBed, Chair, Desk, Nightstand, OwlPerch, SideTable, Trunk } from "./scene/Furniture";
import HUD from "./components/HUD";

const WITCH_POS: [number, number, number] = [0.2, 0, 3.0];

function Lights({ sunset }: { sunset: boolean }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const { scene } = useThree();
  const sunColor = sunset ? "#ff9a55" : "#ffd59a";

  useEffect(() => {
    scene.fog = new THREE.Fog(sunset ? "#3a1c10" : "#4a2e1a", 11, 24);
    scene.background = new THREE.Color(sunset ? "#24120a" : "#2c1b10");
  }, [sunset, scene]);

  useFrame(() => {
    if (sun.current) sun.current.target.position.set(-1, 0, 2);
    sun.current?.target.updateMatrixWorld();
  });

  return (
    <>
      <ambientLight color="#ffdcb0" intensity={sunset ? 0.25 : 0.4} />
      <hemisphereLight args={[sunset ? "#ffb880" : "#ffe6c0", "#5a3420", sunset ? 0.5 : 0.75]} />
      <directionalLight
        ref={sun}
        position={[7.5, 6.5, -2]}
        color={sunColor}
        intensity={sunset ? 3.2 : 3.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
      />
      {/* back gothic window */}
      <directionalLight position={[0, 6, -9]} color={sunColor} intensity={1.3} />
      {/* soft front fill on character */}
      <pointLight position={[0.8, 2.4, 5.2]} color="#ffd8a8" intensity={5} distance={7} decay={2} />
      <pointLight position={[-4, 2.5, 0]} color="#ffc88a" intensity={4} distance={8} decay={2} />
      <spotLight position={[0, 5.2, 0]} angle={0.9} penumbra={1} color="#ffcf8a" intensity={14} distance={10} decay={2} />
    </>
  );
}

function SpellBurst({ trigger }: { trigger: number }) {
  const [active, setActive] = useState(false);
  const ref = useRef<THREE.Group>(null);
  useEffect(() => {
    if (!trigger) return;
    setActive(true);
    const t = setTimeout(() => setActive(false), 2200);
    return () => clearTimeout(t);
  }, [trigger]);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 1.5;
  });
  if (!active) return null;
  return (
    <group ref={ref} position={[WITCH_POS[0], 1.1, WITCH_POS[2]]}>
      <Sparkles count={120} scale={[1.6, 2.2, 1.6]} size={6} speed={1.5} color="#ffe2a0" />
      <pointLight color="#ffcf70" intensity={6} distance={4} />
    </group>
  );
}

function Scene({ sunset, spell, autoRotate }: { sunset: boolean; spell: number; autoRotate: boolean }) {
  return (
    <>
      <Lights sunset={sunset} />
      <Room />

      {/* back canopy beds */}
      <CanopyBed position={[-2.7, 0, -4.4]} rotation={[0, 0.3, 0]} />
      <CanopyBed position={[2.7, 0, -4.4]} rotation={[0, -0.3, 0]} quilt="#e9d6b4" />
      {/* side bunks */}
      <BunkBed position={[-5.4, 0, 0.4]} rotation={[0, 0, 0]} />
      <BunkBed position={[5.4, 0, 0.4]} rotation={[0, Math.PI, 0]} />
      <Nightstand position={[-1.3, 0, -3.4]} rotation={[0, 0.3, 0]} />
      <Nightstand position={[3.9, 0, -2.3]} rotation={[0, -0.6, 0]} />
      <Nightstand position={[-4.6, 0, -1.6]} rotation={[0, Math.PI / 2, 0]} />
      <Trunk position={[-2.2, 0, -2.6]} rotation={[0, 0.3, 0]} />
      <Trunk position={[4.6, 0, 2.6]} rotation={[0, -Math.PI / 2, 0]} />

      {/* central work desk with cauldron */}
      <Desk position={[0.5, 0, -1.9]} rotation={[0, -0.05, 0]} cauldron />
      <Desk position={[-3.6, 0, 3.6]} rotation={[0, 0.9, 0]} />

      {/* foreground */}
      <Chair position={[1.35, 0, 2.3]} rotation={[0, -0.35, 0]} />
      <SideTable position={[-1.95, 0, 3.15]} rotation={[0, 0.45, 0]} />
      <OwlPerch position={[-0.75, 0, 3.95]} rotation={[0, 0.2, 0]} />

      <Witch position={WITCH_POS} rotation={[0, -0.12, 0]} />

      {/* dust motes in the sunbeams */}
      <Sparkles count={160} scale={[10, 4.5, 10]} position={[0, 2.4, -0.5]} size={2.2} speed={0.25} opacity={0.6} color="#fff0c8" />
      <Sparkles count={40} scale={[1.6, 1.6, 1.6]} position={[2.6, 2.8, -3.6]} size={4} speed={0.4} color="#ffd27a" />
      <SpellBurst trigger={spell} />

      <OrbitControls
        target={[0.1, 1.3, 1.6]}
        enablePan={false}
        minDistance={2.2}
        maxDistance={7.5}
        minPolarAngle={1.05}
        maxPolarAngle={1.72}
        minAzimuthAngle={-1.0}
        maxAzimuthAngle={1.0}
        enableDamping
        dampingFactor={0.06}
        autoRotate={autoRotate}
        autoRotateSpeed={0.6}
      />

      <EffectComposer multisampling={4}>
        <Bloom luminanceThreshold={0.85} luminanceSmoothing={0.3} intensity={0.9} mipmapBlur />
        <HueSaturation saturation={-0.08} hue={0} />
        <BrightnessContrast brightness={0.02} contrast={0.08} />
        <Vignette eskil={false} offset={0.22} darkness={0.75} />
      </EffectComposer>
    </>
  );
}

export default function App() {
  const [sunset, setSunset] = useState(false);
  const [spell, setSpell] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const [ready, setReady] = useState(false);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#1a0f08]">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0.15, 1.6, 5.8], fov: 46, near: 0.05, far: 60 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        onCreated={() => setTimeout(() => setReady(true), 300)}
      >
        <Suspense fallback={null}>
          <Scene sunset={sunset} spell={spell} autoRotate={autoRotate} />
        </Suspense>
      </Canvas>

      <HUD
        sunset={sunset}
        onToggleTime={() => setSunset((s) => !s)}
        onSpell={() => setSpell((s) => s + 1)}
        autoRotate={autoRotate}
        onToggleRotate={() => setAutoRotate((a) => !a)}
      />

      {/* loading veil */}
      <div
        className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-[#1a0f08] transition-opacity duration-1000 ${
          ready ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="font-serif text-2xl tracking-[0.3em] text-[#e8c88a]">Entering the dormitory…</div>
      </div>
    </div>
  );
}
