/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sphere, MeshDistortMaterial, Environment, Stars } from '@react-three/drei';
import * as THREE from 'three';

const FloatingBubble = ({ position, color, scale = 1, speed = 1 }: { position: [number, number, number]; color: string; scale?: number, speed?: number }) => {
  const ref = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (ref.current) {
      const t = state.clock.getElapsedTime();
      ref.current.position.y = position[1] + Math.sin(t * 0.5 * speed + position[0]) * 0.3;
      ref.current.rotation.x = t * 0.2;
      ref.current.rotation.z = t * 0.1;
    }
  });

  return (
    <Sphere ref={ref} args={[1, 64, 64]} position={position} scale={scale}>
      <MeshDistortMaterial
        color={color}
        envMapIntensity={1.5}
        clearcoat={1}
        clearcoatRoughness={0.1}
        metalness={0.2}
        roughness={0.2}
        distort={0.3}
        speed={2}
      />
    </Sphere>
  );
};

export const HeroScene: React.FC = () => {
  return (
    <div className="absolute inset-0 z-0 opacity-100 pointer-events-none">
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
        <ambientLight intensity={0.8} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#2563EB" />
        <pointLight position={[-10, -5, -10]} intensity={1.5} color="#2DD4BF" />
        
        <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
          {/* Main Blue Shape */}
          <FloatingBubble position={[2, 0, 0]} color="#3B82F6" scale={1.8} speed={1} />
          {/* Secondary Mint Shape */}
          <FloatingBubble position={[-2, 1, -2]} color="#2DD4BF" scale={1.4} speed={1.2} />
          {/* Distant Shape */}
          <FloatingBubble position={[0, -2, -4]} color="#60A5FA" scale={2} speed={0.8} />
        </Float>

        <Environment preset="city" />
      </Canvas>
    </div>
  );
};

export const QuantumComputerScene: React.FC = () => {
  // Renamed internally to AbstractTechScene for simplicity, kept export name to minimize breaking changes if imported elsewhere
  return (
    <div className="w-full h-full absolute inset-0">
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={1} />
        <spotLight position={[5, 5, 5]} angle={0.3} penumbra={1} intensity={2} color="#2DD4BF" />
        <Environment preset="studio" />
        
        <Float rotationIntensity={0.5} floatIntensity={0.5} speed={2}>
             <mesh rotation={[0.5, 0.5, 0]}>
                <torusKnotGeometry args={[1, 0.3, 128, 16]} />
                <meshStandardMaterial color="#3B82F6" roughness={0.2} metalness={0.8} wireframe />
             </mesh>
        </Float>
        <Stars radius={50} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
      </Canvas>
    </div>
  );
}