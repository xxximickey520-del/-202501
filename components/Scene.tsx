import React, { Suspense, useState, useRef, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, PerspectiveCamera, ContactShadows, BakeShadows, useTexture } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import * as THREE from 'three';
import { LuxuryTree } from './Tree';
import { Atmosphere } from './Atmosphere';
import { HandController } from './HandController';
import { COLORS, CONFIG } from '../constants';

// Component to handle the "Focused Photo" overlay in 3D space
const FocusedPhotoOverlay = ({ active, photoUrl, onClose }: { active: boolean, photoUrl: string, onClose: () => void }) => {
    const meshRef = useRef<THREE.Group>(null);
    // Use key to force re-mount/update texture when URL changes immediately
    const texture = useTexture(photoUrl);

    useFrame((state) => {
        if (!meshRef.current) return;
        
        // Lerp into view
        const targetScale = active ? 1 : 0;
        meshRef.current.scale.setScalar(THREE.MathUtils.lerp(meshRef.current.scale.x, targetScale, 0.1));
        
        // Always face camera
        meshRef.current.lookAt(state.camera.position);
    });

    if (!active && (!meshRef.current || meshRef.current.scale.x < 0.01)) return null;

    return (
        <group ref={meshRef} position={[0, 2, 8]} renderOrder={9999}>
            <mesh onClick={onClose}>
                 <planeGeometry args={[5, 6]} />
                 <meshBasicMaterial color={COLORS.goldDark} />
            </mesh>
             <mesh position={[0, 0, 0.05]}>
                 <planeGeometry args={[4.5, 5.5]} />
                 <meshBasicMaterial map={texture} toneMapped={false} />
            </mesh>
            {/* Glossy overlay */}
             <mesh position={[0, 0, 0.06]}>
                 <planeGeometry args={[4.5, 5.5]} />
                 <meshPhysicalMaterial transmission={1} thickness={2} roughness={0} />
            </mesh>
        </group>
    );
};

interface SceneProps {
    photos: string[];
}

export const Scene: React.FC<SceneProps> = ({ photos }) => {
  const [treeState, setTreeState] = useState<'CHAOS' | 'FORMED'>('FORMED');
  const [focusMode, setFocusMode] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [slideshowIndex, setSlideshowIndex] = useState(0);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  // Auto-play slideshow when focus mode is active
  useEffect(() => {
    if (focusMode && photos.length > 0) {
        const interval = setInterval(() => {
            setSlideshowIndex((prev) => (prev + 1) % photos.length);
        }, 4000); // Switch every 4 seconds
        return () => clearInterval(interval);
    }
  }, [focusMode, photos.length]);

  // Close focus mode (return photo to tree) when tree becomes formed (fist gesture)
  useEffect(() => {
    if (treeState === 'FORMED') {
        setFocusMode(false);
    }
  }, [treeState]);

  const handleZoom = (delta: number) => {
      if (cameraRef.current) {
          // Move camera z based on hand height (simple implementation)
          const targetZ = 18 + delta * 10;
          cameraRef.current.position.z = THREE.MathUtils.lerp(cameraRef.current.position.z, targetZ, 0.05);
      }
  };

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
      if (!focusMode || photos.length === 0) return;
      
      setSlideshowIndex(prev => {
          if (direction === 'right') {
              return (prev + 1) % photos.length;
          } else {
              return (prev - 1 + photos.length) % photos.length;
          }
      });
  }, [focusMode, photos.length]);

  return (
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: false, toneMappingExposure: 1.2 }}>
      <PerspectiveCamera ref={cameraRef} makeDefault position={CONFIG.cameraPosition} fov={45} />
      
      <color attach="background" args={[COLORS.bg]} />
      
      <OrbitControls 
        enablePan={false} 
        minPolarAngle={Math.PI / 3} 
        maxPolarAngle={Math.PI / 1.8}
        minDistance={10}
        maxDistance={25}
        target={[0, 0, 0]} // Center target to visual center of screen
      />

      {/* Cinematic Lighting */}
      <ambientLight intensity={0.1} color={COLORS.emerald} />
      <spotLight position={[10, 20, 10]} angle={0.3} penumbra={0.5} intensity={1500} color={COLORS.gold} castShadow />
      <pointLight position={[-10, 5, -5]} intensity={800} color={COLORS.red} />
      <pointLight position={[0, -5, 5]} intensity={300} color={COLORS.goldDark} />

      <Suspense fallback={null}>
        <Environment preset="city" />
        
        {/* Tree Group centered at World Origin, scaled down slightly */}
        <group position={[0, 0, 0]} scale={0.85}>
            <LuxuryTree 
                mode={treeState} 
                rotationSpeed={rotation + 0.2} 
                focused={focusMode} 
                focusedPhotoIndex={slideshowIndex} 
                photos={photos}
            />
            {/* Pass state to Atmosphere for physics animation */}
            <Atmosphere mode={treeState} />
            <ContactShadows opacity={0.6} scale={30} blur={2} far={4} color="#000000" />
        </group>

        {/* Floating Photo Presentation - Only render if photos exist */}
        {photos.length > 0 && (
            <FocusedPhotoOverlay 
                active={focusMode} 
                photoUrl={photos[slideshowIndex % photos.length]} 
                onClose={() => setFocusMode(false)} 
            />
        )}

        <HandController 
            setTreeState={setTreeState} 
            setFocusMode={setFocusMode}
            setCameraZoom={handleZoom}
            setRotation={setRotation}
            onSwipe={handleSwipe}
        />
      </Suspense>

      <EffectComposer disableNormalPass>
        <Bloom 
            luminanceThreshold={CONFIG.bloomThreshold} 
            mipmapBlur 
            intensity={CONFIG.bloomStrength} 
            radius={0.8}
        />
        <Vignette eskil={false} offset={0.1} darkness={1.0} />
        <Noise opacity={0.02} /> 
      </EffectComposer>
      
      <BakeShadows />
    </Canvas>
  );
};