import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS, CONFIG } from '../constants';

interface LuxuryTreeProps {
  mode: 'CHAOS' | 'FORMED';
  rotationSpeed: number;
  focused: boolean;
  focusedPhotoIndex: number | null;
  photos: string[];
}

const PhotoOrnament: React.FC<{ data: any, url: string }> = ({ data, url }) => {
    const texture = useTexture(url);
    return (
        <mesh position={data.position} scale={[0.8, 0.8, 0.05]} lookAt={() => new THREE.Vector3(0,0,0)}>
            <boxGeometry />
            <meshStandardMaterial color={COLORS.gold} metalness={1} />
            <mesh position={[0, 0, 0.51]}>
                <planeGeometry args={[0.7, 0.7]} />
                <meshBasicMaterial map={texture} />
            </mesh>
        </mesh>
    );
};

export const LuxuryTree: React.FC<LuxuryTreeProps> = ({ mode, rotationSpeed, focused, focusedPhotoIndex, photos }) => {
  const treeGroup = useRef<THREE.Group>(null);
  const needlesRef = useRef<THREE.Points>(null);
  const trunkRef = useRef<THREE.Points>(null);
  const dustRef = useRef<THREE.Points>(null);
  
  // -- Shader Material for Needles --
  const needleMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
        colorBottom: { value: new THREE.Color(COLORS.emeraldDark) },
        colorTop: { value: new THREE.Color(COLORS.emeraldBright) },
        time: { value: 0 },
        pointSize: { value: 3.5 }
    },
    vertexShader: `
      uniform float time;
      uniform float pointSize;
      attribute float randomOffset;
      varying vec3 vColor;
      uniform vec3 colorBottom;
      uniform vec3 colorTop;

      void main() {
        vec3 pos = position; 
        float h = (pos.y + 6.0) / 12.0;
        vColor = mix(colorBottom, colorTop, h);
        float sparkle = sin(time * 2.0 + randomOffset * 10.0);
        if(sparkle > 0.9) vColor += vec3(0.2, 0.2, 0.0);
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = pointSize * (30.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        if (length(gl_PointCoord - vec2(0.5, 0.5)) > 0.5) discard;
        gl_FragColor = vec4(vColor, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
  }), []);

  // -- Star Geometry --
  const starGeo = useMemo(() => {
    const shape = new THREE.Shape();
    const points = 5;
    const outerRadius = 0.3;
    const innerRadius = 0.15;
    for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outerRadius : innerRadius;
        const a = (i / (points * 2)) * Math.PI * 2;
        if(i===0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
  }, []);

  // -- 1. Generate Particles (Needles & Trunk) --
  const { needleData, trunkData, dustData } = useMemo(() => {
    // Needles
    const nData = {
        chaos: new Float32Array(CONFIG.particleCount * 3),
        formed: new Float32Array(CONFIG.particleCount * 3),
        current: new Float32Array(CONFIG.particleCount * 3),
        random: new Float32Array(CONFIG.particleCount)
    };
    
    for (let i = 0; i < CONFIG.particleCount; i++) {
        const r = 8 * Math.cbrt(Math.random());
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);
        nData.chaos[i*3] = r * Math.sin(phi) * Math.cos(theta);
        nData.chaos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
        nData.chaos[i*3+2] = r * Math.cos(phi);

        const h = Math.random() * CONFIG.treeHeight;
        const y = h - CONFIG.treeHeight / 2;
        const tierFactor = (h % 2) / 2;
        let radius = (1 - h / CONFIG.treeHeight) * CONFIG.treeRadius;
        radius += tierFactor * 0.5;
        radius *= (0.8 + Math.random() * 0.4);

        const angle = Math.random() * Math.PI * 2;
        nData.formed[i*3] = Math.cos(angle) * radius;
        nData.formed[i*3+1] = y;
        nData.formed[i*3+2] = Math.sin(angle) * radius;
        
        nData.current[i*3] = nData.chaos[i*3];
        nData.current[i*3+1] = nData.chaos[i*3+1];
        nData.current[i*3+2] = nData.chaos[i*3+2];
        nData.random[i] = Math.random();
    }

    // Trunk
    const tData = {
        formed: new Float32Array(CONFIG.trunkCount * 3),
        current: new Float32Array(CONFIG.trunkCount * 3)
    };
    for(let i=0; i<CONFIG.trunkCount; i++) {
        const h = Math.random() * CONFIG.treeHeight;
        const y = h - CONFIG.treeHeight / 2;
        let r = 0.4 * (1 - h/CONFIG.treeHeight) + 0.1;
        if (y < -CONFIG.treeHeight/2 + 2) {
             r *= 1 + (2 - (y + CONFIG.treeHeight/2)) * 0.5;
        }
        const angle = Math.random() * Math.PI * 2;
        tData.formed[i*3] = Math.cos(angle) * r;
        tData.formed[i*3+1] = y;
        tData.formed[i*3+2] = Math.sin(angle) * r;
        
        tData.current[i*3] = (Math.random()-0.5) * 2;
        tData.current[i*3+1] = (Math.random()-0.5) * 10;
        tData.current[i*3+2] = (Math.random()-0.5) * 2;
    }

    // Gold Dust
    const dustCount = 2000;
    const dData = {
        chaos: new Float32Array(dustCount * 3),
        formed: new Float32Array(dustCount * 3),
        current: new Float32Array(dustCount * 3),
    };

    for (let i = 0; i < dustCount; i++) {
        // Chaos: Wide Sphere
        const r = 10 * Math.cbrt(Math.random());
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);
        dData.chaos[i*3] = r * Math.sin(phi) * Math.cos(theta);
        dData.chaos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
        dData.chaos[i*3+2] = r * Math.cos(phi);

        // Formed: Swirling Vortex
        const h = Math.random() * CONFIG.treeHeight;
        const y = h - CONFIG.treeHeight / 2;
        const radius = ((1 - h / CONFIG.treeHeight) * CONFIG.treeRadius) * 1.5; 
        const angle = i * 0.1;
        
        dData.formed[i*3] = Math.cos(angle) * radius;
        dData.formed[i*3+1] = y;
        dData.formed[i*3+2] = Math.sin(angle) * radius;

        dData.current[i*3] = dData.chaos[i*3];
        dData.current[i*3+1] = dData.chaos[i*3+1];
        dData.current[i*3+2] = dData.chaos[i*3+2];
    }

    return { needleData: nData, trunkData: tData, dustData: dData };
  }, []);

  // -- 2. Generate Photo Ornaments Only (Attached to Tree) --
  const photoOrnaments = useMemo(() => {
      // Safety check: if no photos, don't generate ornaments
      if (photos.length === 0) return [];

      const items = [];
      const count = 12; // Number of photos on the tree
      
      for(let i=0; i<count; i++) {
         const t = i / count; 
         // Distribute vertically and radially
         const h = 0.2 + t * 0.6; // Keep away from extreme top/bottom
         const y = (h * CONFIG.treeHeight) - CONFIG.treeHeight/2;
         const r = ((1 - h) * CONFIG.treeRadius) * 0.8; // Slightly embedded in needles
         const angle = t * Math.PI * 4; // 2 turns
         
         const x = Math.cos(angle) * r;
         const z = Math.sin(angle) * r;

         items.push({
             position: new THREE.Vector3(x, y, z),
             photoIndex: i % photos.length,
             id: i
         });
      }
      return items;
  }, [photos.length]);

  // -- 3. Animation Loop --
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    
    if (treeGroup.current) {
        if (!focused) {
             treeGroup.current.rotation.y += rotationSpeed * 0.1;
        } else {
             treeGroup.current.rotation.y = THREE.MathUtils.lerp(treeGroup.current.rotation.y, 0, 0.05);
        }
    }

    const lerpSpeed = 0.03;
    const isFormed = mode === 'FORMED';

    // Update Needles
    if (needlesRef.current) {
        const positions = needlesRef.current.geometry.attributes.position.array as Float32Array;
        for(let i=0; i<CONFIG.particleCount; i++) {
            const tx = isFormed ? needleData.formed[i*3] : needleData.chaos[i*3];
            const ty = isFormed ? needleData.formed[i*3+1] : needleData.chaos[i*3+1];
            const tz = isFormed ? needleData.formed[i*3+2] : needleData.chaos[i*3+2];
            const noise = isFormed ? 0 : Math.sin(t + i) * 0.05;
            positions[i*3] = THREE.MathUtils.lerp(positions[i*3], tx + noise, lerpSpeed);
            positions[i*3+1] = THREE.MathUtils.lerp(positions[i*3+1], ty + noise, lerpSpeed);
            positions[i*3+2] = THREE.MathUtils.lerp(positions[i*3+2], tz + noise, lerpSpeed);
        }
        needlesRef.current.geometry.attributes.position.needsUpdate = true;
        needleMaterial.uniforms.time.value = t;
    }

    // Update Trunk
    if (trunkRef.current) {
         const positions = trunkRef.current.geometry.attributes.position.array as Float32Array;
         for(let i=0; i<CONFIG.trunkCount; i++) {
            const tx = isFormed ? trunkData.formed[i*3] : trunkData.formed[i*3] * 5; 
            const ty = isFormed ? trunkData.formed[i*3+1] : trunkData.formed[i*3+1] * 0.1; 
            const tz = isFormed ? trunkData.formed[i*3+2] : trunkData.formed[i*3+2] * 5;
            positions[i*3] = THREE.MathUtils.lerp(positions[i*3], tx, lerpSpeed);
            positions[i*3+1] = THREE.MathUtils.lerp(positions[i*3+1], ty, lerpSpeed);
            positions[i*3+2] = THREE.MathUtils.lerp(positions[i*3+2], tz, lerpSpeed);
         }
         trunkRef.current.geometry.attributes.position.needsUpdate = true;
    }

    // Update Gold Dust (Fluid Spring Motion)
    if (dustRef.current) {
        const positions = dustRef.current.geometry.attributes.position.array as Float32Array;
        for(let i=0; i<2000; i++) {
            let tx, ty, tz;
            
            if (isFormed) {
                // Add spin to formed state
                const angleOffset = t * 0.5;
                const baseX = dustData.formed[i*3];
                const baseZ = dustData.formed[i*3+2];
                // Rotate vector
                tx = baseX * Math.cos(angleOffset) - baseZ * Math.sin(angleOffset);
                ty = dustData.formed[i*3+1] + Math.sin(t + i)*0.2; // Bobbing
                tz = baseX * Math.sin(angleOffset) + baseZ * Math.cos(angleOffset);
            } else {
                 tx = dustData.chaos[i*3];
                 ty = dustData.chaos[i*3+1];
                 tz = dustData.chaos[i*3+2];
            }

            // Smooth damping
            positions[i*3] = THREE.MathUtils.lerp(positions[i*3], tx, 0.02);
            positions[i*3+1] = THREE.MathUtils.lerp(positions[i*3+1], ty, 0.02);
            positions[i*3+2] = THREE.MathUtils.lerp(positions[i*3+2], tz, 0.02);
        }
        dustRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group ref={treeGroup}>
      {/* Needles */}
      <points ref={needlesRef} material={needleMaterial}>
         <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={CONFIG.particleCount} array={needleData.current} itemSize={3} />
            <bufferAttribute attach="attributes-randomOffset" count={CONFIG.particleCount} array={needleData.random} itemSize={1} />
         </bufferGeometry>
      </points>

      {/* Trunk - Transformed from Dark Dots to Inner Gold Glow */}
      <points ref={trunkRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={CONFIG.trunkCount} array={trunkData.current} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial 
            color={COLORS.goldDark} 
            size={0.10} 
            transparent
            opacity={0.4}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            sizeAttenuation
          />
      </points>

      {/* Gold Dust */}
      <points ref={dustRef}>
          <bufferGeometry>
             <bufferAttribute attach="attributes-position" count={2000} array={dustData.current} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial 
             color={COLORS.gold} 
             size={0.1} 
             transparent 
             opacity={0.8} 
             blending={THREE.AdditiveBlending} 
             depthWrite={false}
          />
      </points>

      {/* Photo Ornaments Only */}
      <group>
        {photoOrnaments.map((o) => {
             // Redundant check, but safe: ensure photos exists
             if (!photos.length) return null;
             const url = photos[o.photoIndex % photos.length];
             return (
               <group key={o.id} lookAt={new THREE.Vector3(0, o.position.y, 0)}>
                 <PhotoOrnament data={o} url={url} />
               </group>
             );
        })}
      </group>

      {/* Top Star - Massive */}
      <mesh position={[0, CONFIG.treeHeight/2 + 0.5, 0]}>
         <primitive object={starGeo} scale={[5,5,5]} rotation={[0,0,0]} />
         <meshPhysicalMaterial color={COLORS.gold} emissive={COLORS.gold} emissiveIntensity={5} toneMapped={false} />
         <pointLight distance={10} intensity={5} color={COLORS.gold} />
      </mesh>

    </group>
  );
};