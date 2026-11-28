/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sphere, Torus, Cylinder, Stars, Box } from '@react-three/drei';
import * as THREE from 'three';

/* A small guard around WebGL. The article still has to read on phones, older WebViews,
   and machines where the GPU cannot create a context. */
function canUseWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function useWebGL() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    /* On phones the decorative 3D sphere sits behind the title and hurts readability.
       Use the light CSS version there; keep the full scene for larger screens with a GPU. */
    const wide = window.matchMedia('(min-width: 768px)').matches;
    setOk(wide && canUseWebGL());
  }, []);
  return ok;
}

export const StaticHeroScene = () => (
  <div className="scene-static scene-static--hero" aria-hidden="true">
    <span className="scene-ring scene-ring--outer" />
    <span className="scene-ring scene-ring--inner" />
    <span className="scene-core" />
    <span className="scene-dot scene-dot--a" />
    <span className="scene-dot scene-dot--b" />
    <span className="scene-dot scene-dot--c" />
  </div>
);

export const StaticQuantumComputer = () => (
  <div className="scene-static scene-static--computer" aria-hidden="true">
    <span className="computer-glow" />
    <span className="computer-plate computer-plate--1" />
    <span className="computer-plate computer-plate--2" />
    <span className="computer-plate computer-plate--3" />
    <span className="computer-rod computer-rod--1" />
    <span className="computer-rod computer-rod--2" />
    <span className="computer-rod computer-rod--3" />
    <span className="computer-chip" />
  </div>
);

const QuantumParticle = ({ position, color, scale = 1 }: { position: [number, number, number]; color: string; scale?: number }) => {
  const ref = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (ref.current) {
      const t = state.clock.getElapsedTime();
      ref.current.position.y = position[1] + Math.sin(t * 2 + position[0]) * 0.2;
      ref.current.rotation.x = t * 0.5;
      ref.current.rotation.z = t * 0.3;
    }
  });

  return (
    <Sphere ref={ref} args={[1, 32, 32]} position={position} scale={scale}>
      <MeshDistortMaterial
        color={color}
        envMapIntensity={1}
        clearcoat={1}
        clearcoatRoughness={0}
        metalness={0.5}
        distort={0.4}
        speed={2}
      />
    </Sphere>
  );
};

const MacroscopicWave = () => {
  const ref = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (ref.current) {
       const t = state.clock.getElapsedTime();
       ref.current.rotation.x = Math.sin(t * 0.2) * 0.2;
       ref.current.rotation.y = t * 0.1;
    }
  });

  return (
    <Torus ref={ref} args={[3, 0.1, 16, 100]} rotation={[Math.PI / 2, 0, 0]}>
      <meshStandardMaterial color="#C5A059" emissive="#C5A059" emissiveIntensity={0.5} transparent opacity={0.6} wireframe />
    </Torus>
  );
}

export const HeroScene: React.FC = () => {
  /* The hero's particle field was decorative but fragile in WebViews and sat on top of
     the title on narrow screens. Keep it as a quiet CSS composition instead. */
  return <StaticHeroScene />;
};

export const QuantumComputerScene: React.FC = () => {
  const ok = useWebGL();
  if (!ok) return <StaticQuantumComputer />;

  return (
    <div className="w-full h-full absolute inset-0">
      <Canvas dpr={[1, 1.4]} camera={{ position: [0, 0, 4.5], fov: 45 }}>
        <ambientLight intensity={1} />
        <spotLight position={[5, 5, 5]} angle={0.3} penumbra={1} intensity={2} color="#C5A059" />
        <pointLight position={[-5, -5, -5]} intensity={0.5} />
        <hemisphereLight intensity={0.45} color="#fff8e8" groundColor="#b8a27c" />
        
        <Float rotationIntensity={0.4} floatIntensity={0.2} speed={1}>
          <group rotation={[0, 0, 0]} position={[0, 0.5, 0]}>
            {/* Main Cryostat Structure (Gold Chandelier) */}
            
            {/* Top Plate */}
            <Cylinder args={[1.2, 1.2, 0.1, 64]} position={[0, 1, 0]}>
              <meshStandardMaterial color="#C5A059" metalness={1} roughness={0.15} />
            </Cylinder>
            
            {/* Middle Stage */}
            <Cylinder args={[1, 1, 0.1, 64]} position={[0, 0.2, 0]}>
              <meshStandardMaterial color="#C5A059" metalness={1} roughness={0.15} />
            </Cylinder>
            
            {/* Bottom Stage (Mixing Chamber) */}
            <Cylinder args={[0.6, 0.6, 0.1, 64]} position={[0, -0.6, 0]}>
              <meshStandardMaterial color="#C5A059" metalness={1} roughness={0.15} />
            </Cylinder>

            {/* Connecting Rods */}
            <Cylinder args={[0.04, 0.04, 0.8, 16]} position={[0.5, 0.6, 0]}>
               <meshStandardMaterial color="#D1D5DB" metalness={0.8} roughness={0.2} />
            </Cylinder>
            <Cylinder args={[0.04, 0.04, 0.8, 16]} position={[-0.5, 0.6, 0]}>
               <meshStandardMaterial color="#D1D5DB" metalness={0.8} roughness={0.2} />
            </Cylinder>
             <Cylinder args={[0.04, 0.04, 0.8, 16]} position={[0, 0.6, 0.5]}>
               <meshStandardMaterial color="#D1D5DB" metalness={0.8} roughness={0.2} />
            </Cylinder>
             <Cylinder args={[0.04, 0.04, 0.8, 16]} position={[0, 0.6, -0.5]}>
               <meshStandardMaterial color="#D1D5DB" metalness={0.8} roughness={0.2} />
            </Cylinder>

             {/* Lower Rods */}
             <Cylinder args={[0.03, 0.03, 0.8, 16]} position={[0.2, -0.2, 0]}>
               <meshStandardMaterial color="#D1D5DB" metalness={0.8} roughness={0.2} />
            </Cylinder>
            <Cylinder args={[0.03, 0.03, 0.8, 16]} position={[-0.2, -0.2, 0]}>
               <meshStandardMaterial color="#D1D5DB" metalness={0.8} roughness={0.2} />
            </Cylinder>

            {/* Coils/Wires - Copper colored */}
            <Torus args={[0.7, 0.015, 16, 64]} position={[0, -0.2, 0]} rotation={[Math.PI/2, 0, 0]}>
               <meshStandardMaterial color="#B87333" metalness={0.8} roughness={0.3} />
            </Torus>
             <Torus args={[0.3, 0.015, 16, 64]} position={[0, -1, 0]} rotation={[Math.PI/2, 0, 0]}>
               <meshStandardMaterial color="#B87333" metalness={0.8} roughness={0.3} />
            </Torus>
            
            {/* Central processor chip simulation at bottom */}
            <Box args={[0.2, 0.05, 0.2]} position={[0, -0.7, 0]}>
                <meshStandardMaterial color="#111" metalness={0.9} roughness={0.1} />
            </Box>
          </group>
        </Float>
      </Canvas>
    </div>
  );
}