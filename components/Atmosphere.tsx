import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS } from '../constants';

// -- CONFIGURATION --
const INSTANCE_CONFIG = {
  gifts: { count: 45, size: 0.35, weight: 0.02 }, 
  balls: { count: 90, size: 0.25, weight: 0.05 }, 
  lights: { count: 150, size: 0.08, weight: 0.15 } 
};

const RIBBON_PARAMS = {
  particleCount: 8000, 
  turns: 6,
  heightSpread: 14,
  radiusBase: 5.0, 
  radiusTip: 0.2   
};

// -- SHADERS --

const SnowMaterial = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
    color: { value: new THREE.Color('#FFFFFF') }
  },
  vertexShader: `
    uniform float time;
    attribute float size;
    attribute float speed;
    varying float vAlpha;
    void main() {
      vec3 pos = position;
      float height = 25.0;
      // Falling animation with wrap-around
      float y = pos.y - (time * speed);
      pos.y = mod(y + 12.5, height) - 12.5;
      
      // Gentle drift (Natural sway)
      pos.x += sin(time * 0.4 + pos.y * 0.5) * 0.3;
      pos.z += cos(time * 0.2 + pos.y * 0.3) * 0.3;

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = size * (300.0 / -mvPosition.z); // Size attenuation
      gl_Position = projectionMatrix * mvPosition;
      
      // Fade at top/bottom edges
      float edge = 1.0 - smoothstep(10.0, 12.5, abs(pos.y));
      // Delicate but visible opacity
      vAlpha = 0.45 * edge;
    }
  `,
  fragmentShader: `
    uniform vec3 color;
    varying float vAlpha;
    void main() {
      vec2 coord = gl_PointCoord - vec2(0.5);
      float dist = length(coord);
      if (dist > 0.5) discard;
      // Soft glow for snow
      float glow = 1.0 - (dist * 2.0);
      gl_FragColor = vec4(color, vAlpha * glow);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});

const GoldSparkleMaterial = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
    color: { value: new THREE.Color(COLORS.gold) }
  },
  vertexShader: `
    uniform float time;
    attribute float size;
    attribute float phase;
    varying float vAlpha;
    void main() {
      vec3 pos = position;
      // Gentle floating up
      pos.y += sin(time * 0.1 + phase) * 1.0; 
      
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = size * (200.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;

      // Twinkle effect
      vAlpha = 0.3 + 0.7 * sin(time * 3.0 + phase * 10.0);
    }
  `,
  fragmentShader: `
    uniform vec3 color;
    varying float vAlpha;
    void main() {
      vec2 coord = gl_PointCoord - vec2(0.5);
      float dist = length(coord);
      if (dist > 0.5) discard;
      // Sharp center, soft glow
      float strength = 1.0 - pow(dist * 2.0, 1.5);
      gl_FragColor = vec4(color, vAlpha * strength);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});


// -- HELPERS --
const tempObj = new THREE.Object3D();
const tempColor = new THREE.Color();

// Shared logic for Ribbon Path
const getRibbonPoint = (t: number, isRibbonA: boolean) => {
    const direction = isRibbonA ? 1 : -1;
    const angle = (t * Math.PI * (RIBBON_PARAMS.turns * 2) * direction) + (isRibbonA ? 0 : Math.PI);
    const heightPercent = t;
    const radius = (RIBBON_PARAMS.radiusBase * (1 - heightPercent)) + RIBBON_PARAMS.radiusTip;
    const y = (heightPercent * RIBBON_PARAMS.heightSpread) - (RIBBON_PARAMS.heightSpread / 2);
    return new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
};

const getSpiralPos = (i: number, total: number) => {
  const isRibbonA = i % 2 === 0;
  const t = i / total;
  const pos = getRibbonPoint(t, isRibbonA);
  const jitterX = (Math.random() - 0.5) * 0.2;
  const jitterY = (Math.random() - 0.5) * 0.2;
  const jitterZ = (Math.random() - 0.5) * 0.2;
  return pos.add(new THREE.Vector3(jitterX, jitterY, jitterZ));
};

const getChaosPos = (originalPos: THREE.Vector3) => {
  return originalPos.clone().multiplyScalar(2.5 + Math.random() * 2).add(
     new THREE.Vector3((Math.random()-0.5)*5, (Math.random()-0.5)*5, (Math.random()-0.5)*5)
  );
};

interface AtmosphereProps {
  mode: 'CHAOS' | 'FORMED';
}

export const Atmosphere: React.FC<AtmosphereProps> = ({ mode }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  // Instanced Meshes
  const giftsRef = useRef<THREE.InstancedMesh>(null);
  const ballsRef = useRef<THREE.InstancedMesh>(null);
  const lightsRef = useRef<THREE.InstancedMesh>(null);
  
  // Ribbon Particles
  const ribbonRef = useRef<THREE.Points>(null);

  // New Particle Systems Refs
  const snowRef = useRef<THREE.Points>(null);
  const sparklesRef = useRef<THREE.Points>(null);
  
  // 1. Generate Ribbon Particles
  const ribbonGeo = useMemo(() => {
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array(RIBBON_PARAMS.particleCount * 3);
      const randoms = new Float32Array(RIBBON_PARAMS.particleCount);

      for(let i=0; i<RIBBON_PARAMS.particleCount; i++) {
          const t = i / RIBBON_PARAMS.particleCount;
          const isRibbonA = i % 2 === 0; 
          const pos = getRibbonPoint(t, isRibbonA);
          const jitter = 0.1;
          positions[i*3] = pos.x + (Math.random()-0.5)*jitter;
          positions[i*3+1] = pos.y + (Math.random()-0.5)*jitter;
          positions[i*3+2] = pos.z + (Math.random()-0.5)*jitter;
          randoms[i] = Math.random();
      }
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
      return geo;
  }, []);

  // 2. Data Storage for Ornaments
  const data = useMemo(() => {
    const generateData = (count: number, type: 'gift' | 'ball' | 'light') => {
      const formed = new Float32Array(count * 3);
      const chaos = new Float32Array(count * 3);
      const current = new Float32Array(count * 3);
      const rotations = new Float32Array(count * 3);
      const rotationSpeeds = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const scales = new Float32Array(count);
      const palette = [COLORS.red, COLORS.red, COLORS.red, COLORS.red, COLORS.gold, COLORS.gold];

      for (let i = 0; i < count; i++) {
        const targetPos = getSpiralPos(i, count);
        const chaosPos = getChaosPos(targetPos);
        
        formed[i*3] = targetPos.x;
        formed[i*3+1] = targetPos.y;
        formed[i*3+2] = targetPos.z;

        chaos[i*3] = chaosPos.x;
        chaos[i*3+1] = chaosPos.y;
        chaos[i*3+2] = chaosPos.z;

        current[i*3] = targetPos.x;
        current[i*3+1] = targetPos.y;
        current[i*3+2] = targetPos.z;

        rotations[i*3] = Math.random() * Math.PI;
        rotations[i*3+1] = Math.random() * Math.PI;
        rotations[i*3+2] = Math.random() * Math.PI;
        rotationSpeeds[i*3] = (Math.random() - 0.5) * 0.02;
        rotationSpeeds[i*3+1] = (Math.random() - 0.5) * 0.02;
        rotationSpeeds[i*3+2] = (Math.random() - 0.5) * 0.02;
        scales[i] = 0.5 + Math.random() * 0.8;

        let c = new THREE.Color(palette[Math.floor(Math.random() * palette.length)]);
        if (type === 'light') c = new THREE.Color(COLORS.gold); 
        colors[i*3] = c.r;
        colors[i*3+1] = c.g;
        colors[i*3+2] = c.b;
      }
      return { formed, chaos, current, rotations, rotationSpeeds, colors, scales };
    };

    return {
      gifts: generateData(INSTANCE_CONFIG.gifts.count, 'gift'),
      balls: generateData(INSTANCE_CONFIG.balls.count, 'ball'),
      lights: generateData(INSTANCE_CONFIG.lights.count, 'light'),
    };
  }, []);

  // 3. Generate Snow & Sparkle Geometry
  const { snowGeo, sparkleGeo } = useMemo(() => {
      // Snow
      const sGeo = new THREE.BufferGeometry();
      const sCount = 2000; // Increased count for finer snow
      const sPos = new Float32Array(sCount * 3);
      const sSpeed = new Float32Array(sCount);
      const sSize = new Float32Array(sCount);

      for(let i=0; i<sCount; i++) {
          sPos[i*3] = (Math.random() - 0.5) * 20;
          sPos[i*3+1] = (Math.random() - 0.5) * 20;
          sPos[i*3+2] = (Math.random() - 0.5) * 20;
          sSpeed[i] = 0.5 + Math.random() * 1.5; // Varied falling speed
          // Slightly increased size range for visibility while keeping it "fine"
          sSize[i] = 0.06 + Math.random() * 0.20; 
      }
      sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
      sGeo.setAttribute('speed', new THREE.BufferAttribute(sSpeed, 1));
      sGeo.setAttribute('size', new THREE.BufferAttribute(sSize, 1));

      // Sparkles (Gold)
      const gGeo = new THREE.BufferGeometry();
      const gCount = 800;
      const gPos = new Float32Array(gCount * 3);
      const gPhase = new Float32Array(gCount);
      const gSize = new Float32Array(gCount);

      for(let i=0; i<gCount; i++) {
          gPos[i*3] = (Math.random() - 0.5) * 25;
          gPos[i*3+1] = (Math.random() - 0.5) * 15;
          gPos[i*3+2] = (Math.random() - 0.5) * 25;
          gPhase[i] = Math.random() * Math.PI * 2;
          gSize[i] = 0.8 + Math.random();
      }
      gGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
      gGeo.setAttribute('phase', new THREE.BufferAttribute(gPhase, 1));
      gGeo.setAttribute('size', new THREE.BufferAttribute(gSize, 1));

      return { snowGeo: sGeo, sparkleGeo: gGeo };
  }, []);

  // Initialize Colors for Instances
  useEffect(() => {
    if (giftsRef.current) {
       for(let i=0; i<INSTANCE_CONFIG.gifts.count; i++) {
           tempColor.setRGB(data.gifts.colors[i*3], data.gifts.colors[i*3+1], data.gifts.colors[i*3+2]);
           giftsRef.current.setColorAt(i, tempColor);
       }
       giftsRef.current.instanceColor!.needsUpdate = true;
    }
    if (ballsRef.current) {
        for(let i=0; i<INSTANCE_CONFIG.balls.count; i++) {
            tempColor.setRGB(data.balls.colors[i*3], data.balls.colors[i*3+1], data.balls.colors[i*3+2]);
            ballsRef.current.setColorAt(i, tempColor);
        }
        ballsRef.current.instanceColor!.needsUpdate = true;
    }
    if (lightsRef.current) {
        for(let i=0; i<INSTANCE_CONFIG.lights.count; i++) {
            tempColor.setRGB(data.lights.colors[i*3], data.lights.colors[i*3+1], data.lights.colors[i*3+2]);
            lightsRef.current.setColorAt(i, tempColor);
        }
        lightsRef.current.instanceColor!.needsUpdate = true;
    }
  }, [data]);

  // Clone materials for uniforms usage (best practice to avoid side effects if reused)
  const snowMat = useMemo(() => SnowMaterial.clone(), []);
  const sparkleMat = useMemo(() => GoldSparkleMaterial.clone(), []);

  // Animation Loop
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const isFormed = mode === 'FORMED';
    
    // Rotate Ribbon Group
    if (groupRef.current) {
        groupRef.current.rotation.y = time * 0.05;
    }

    // Update Particle Shader Uniforms
    snowMat.uniforms.time.value = time;
    sparkleMat.uniforms.time.value = time;

    // Instance Animation Function
    const animateGroup = (
        ref: React.RefObject<THREE.InstancedMesh>, 
        groupData: any, 
        config: { count: number, weight: number, size: number },
        isLight = false
    ) => {
        if (!ref.current) return;

        for (let i = 0; i < config.count; i++) {
            const ix3 = i * 3;
            
            // Target Position
            const targetX = isFormed ? groupData.formed[ix3] : groupData.chaos[ix3];
            const targetY = isFormed ? groupData.formed[ix3+1] : groupData.chaos[ix3+1];
            const targetZ = isFormed ? groupData.formed[ix3+2] : groupData.chaos[ix3+2];

            // Physics Lerp
            const lerpFactor = config.weight;
            groupData.current[ix3] = THREE.MathUtils.lerp(groupData.current[ix3], targetX, lerpFactor);
            groupData.current[ix3+1] = THREE.MathUtils.lerp(groupData.current[ix3+1], targetY, lerpFactor);
            groupData.current[ix3+2] = THREE.MathUtils.lerp(groupData.current[ix3+2], targetZ, lerpFactor);

            // Hover
            const hoverStrength = isLight ? 0.05 : 0.01;
            const yOffset = Math.sin(time * 2 + i) * hoverStrength;

            tempObj.position.set(
                groupData.current[ix3], 
                groupData.current[ix3+1] + yOffset, 
                groupData.current[ix3+2]
            );

            // Rotation
            if (!isLight) {
                groupData.rotations[ix3] += groupData.rotationSpeeds[ix3];
                groupData.rotations[ix3+1] += groupData.rotationSpeeds[ix3+1];
                tempObj.rotation.set(
                    groupData.rotations[ix3],
                    groupData.rotations[ix3+1],
                    groupData.rotations[ix3+2]
                );
            }

            // Scale
            tempObj.scale.setScalar(groupData.scales[i] * config.size);
            if (isLight) {
                tempObj.scale.setScalar(config.size * (0.8 + Math.sin(time * 5 + i)*0.3));
            }

            tempObj.updateMatrix();
            ref.current.setMatrixAt(i, tempObj.matrix);
        }
        ref.current.instanceMatrix.needsUpdate = true;
    };

    animateGroup(giftsRef, data.gifts, INSTANCE_CONFIG.gifts);
    animateGroup(ballsRef, data.balls, INSTANCE_CONFIG.balls);
    animateGroup(lightsRef, data.lights, INSTANCE_CONFIG.lights, true);
  });

  return (
    <group ref={groupRef}>
      {/* 1. Golden Particle Ribbons */}
      <points ref={ribbonRef} geometry={ribbonGeo}>
         <pointsMaterial 
            size={0.12} 
            color={COLORS.gold} 
            transparent 
            opacity={0.8} 
            blending={THREE.AdditiveBlending} 
            depthWrite={false}
         />
      </points>

      {/* 2. Heavy Gifts */}
      <instancedMesh ref={giftsRef} args={[undefined, undefined, INSTANCE_CONFIG.gifts.count]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshPhysicalMaterial 
            metalness={0.2}
            roughness={0.1}
            clearcoat={1.0}
            clearcoatRoughness={0.1}
        />
      </instancedMesh>

      {/* 3. Medium Balls */}
      <instancedMesh ref={ballsRef} args={[undefined, undefined, INSTANCE_CONFIG.balls.count]}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshPhysicalMaterial 
            metalness={0.5}
            roughness={0.1}
            clearcoat={1.0}
            clearcoatRoughness={0.0}
            reflectivity={1}
        />
      </instancedMesh>

      {/* 4. Light Particles */}
      <instancedMesh ref={lightsRef} args={[undefined, undefined, INSTANCE_CONFIG.lights.count]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial 
            emissive={COLORS.gold}
            emissiveIntensity={2}
            toneMapped={false}
            color={COLORS.gold}
        />
      </instancedMesh>
      
      {/* 5. Falling Snow */}
      <points ref={snowRef} geometry={snowGeo} material={snowMat} />

      {/* 6. Floating Golden Sparkles */}
      <points ref={sparklesRef} geometry={sparkleGeo} material={sparkleMat} />

    </group>
  );
};