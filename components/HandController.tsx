import React, { useEffect, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import * as THREE from 'three';

interface HandControllerProps {
  setTreeState: (state: 'CHAOS' | 'FORMED') => void;
  setFocusMode: (active: boolean) => void;
  setCameraZoom: (delta: number) => void;
  setRotation: (delta: number) => void;
  onSwipe?: (direction: 'left' | 'right') => void;
}

export const HandController: React.FC<HandControllerProps> = ({ 
  setTreeState, 
  setFocusMode,
  setCameraZoom,
  setRotation,
  onSwipe
}) => {
  const videoRef = useRef<HTMLVideoElement>(document.createElement('video'));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const [debugVisible, setDebugVisible] = useState(true);
  
  const lastHandX = useRef<number | null>(null);
  const lastSwipeTime = useRef(0);
  const lastVictoryTime = useRef(0);
  
  const { camera } = useThree();

  useEffect(() => {
    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
        );
        landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        
        // Start Camera
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener("loadeddata", () => {
          videoRef.current.play();
        });
      } catch (err) {
        console.warn("Hand tracking failed to initialize:", err);
      }
    };
    init();
  }, []);

  // Frame Loop for Detection
  useFrame((state) => {
    if (!landmarkerRef.current || !videoRef.current || videoRef.current.readyState !== 4) return;

    const startTimeMs = performance.now();
    const result = landmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);

    // Draw Debug
    if (canvasRef.current && debugVisible) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            
            if (result.landmarks && result.landmarks.length > 0) {
               const landmarks = result.landmarks[0];
               ctx.strokeStyle = '#00FF00';
               ctx.lineWidth = 2;
               ctx.beginPath();
               
               // Simple wireframe
               for(let i=0; i<landmarks.length; i++) {
                   const x = landmarks[i].x * canvasRef.current.width;
                   const y = landmarks[i].y * canvasRef.current.height;
                   if (i===0) ctx.moveTo(x, y);
                   else ctx.lineTo(x, y);
                   ctx.fillRect(x-2, y-2, 4, 4);
               }
               ctx.stroke();
            }
        }
    }

    if (result.landmarks && result.landmarks.length > 0) {
      const landmarks = result.landmarks[0];
      
      // Use middle finger MCP as a stable center point for hand position
      const currentHandX = landmarks[9].x; 
      
      // --- Helper: Check finger extension ---
      // Assuming upright hand: Tip y < PIP y (screen coordinates, 0 is top)
      const isExtended = (tipIdx: number, pipIdx: number) => landmarks[tipIdx].y < landmarks[pipIdx].y;
      
      const indexExt = isExtended(8, 6);
      const middleExt = isExtended(12, 10);
      const ringExt = isExtended(16, 14);
      const pinkyExt = isExtended(20, 18);

      const fingersExtendedCount = [indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length;

      // --- 1. Fist vs Spread (Formed vs Chaos) ---
      // Logic: Less than 2 fingers extended = Fist (FORMED)
      // Otherwise = Open/Interacting (CHAOS)
      const isFist = fingersExtendedCount < 2;

      if (isFist) {
          setTreeState('FORMED');
      } else {
          setTreeState('CHAOS');
      }

      // --- 2. Victory Gesture (Selection & Swipe) ---
      // Logic: Index & Middle Extended, Ring & Pinky Closed (Scissors / Peace Sign)
      const isVictory = indexExt && middleExt && !ringExt && !pinkyExt;

      if (isVictory) {
          const now = Date.now();
          // Trigger Selection (Open Slideshow)
          if (now - lastVictoryTime.current > 800) {
              setFocusMode(true);
              lastVictoryTime.current = now;
          }
      }

      // --- 3. Swipe Detection (Only when Victory held) ---
      const now = Date.now();
      if (isVictory && lastHandX.current !== null && onSwipe) {
          const dx = currentHandX - lastHandX.current;
          const SWIPE_THRESHOLD = 0.03; // Movement speed threshold
          const SWIPE_COOLDOWN = 500;   // Time between swipes

          if (Math.abs(dx) > SWIPE_THRESHOLD && (now - lastSwipeTime.current > SWIPE_COOLDOWN)) {
              // Direct Mapping: Moving Right (dx > 0) -> Swipe Right (Next)
              if (dx > 0) {
                  onSwipe('right');
                  lastSwipeTime.current = now;
              } else {
                  onSwipe('left');
                  lastSwipeTime.current = now;
              }
          }
      }
      lastHandX.current = currentHandX;


      // --- 4. Movement (Rotate / Zoom) ---
      // Normalize X to -1 to 1
      const handX = (landmarks[9].x - 0.5) * 2; 
      const handY = (landmarks[9].y - 0.5) * 2;

      setRotation(handX * 0.05);
      
      // Vertical movement for zoom
      setCameraZoom(handY); 
    }
  });

  return (
    <group>
        <Html position={[-1, 1, 0]} style={{ width: '120px', height: '100px', transform: 'translate3d(-50%, -50%, 0)' }} zIndexRange={[100, 0]}>
            {/* Moved to Bottom Right via Fixed positioning CSS */}
            <div className="hand-tracker-container border border-arix-gold/30 bg-black/50 p-1 rounded-sm fixed bottom-8 right-8 pointer-events-none w-[120px]">
                <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', transform: 'scaleX(-1)' }} />
                <div className="text-[9px] text-arix-gold uppercase tracking-widest text-center mt-1">Hand Tracker</div>
            </div>
        </Html>
    </group>
  );
};