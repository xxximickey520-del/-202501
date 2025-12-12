import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Scene } from './components/Scene';
import { Overlay } from './components/Overlay';
import { IMAGES, AUDIO_URL } from './constants';

const App: React.FC = () => {
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [userPhotos, setUserPhotos] = useState<string[]>(IMAGES);
  const [currentAudioSrc, setCurrentAudioSrc] = useState<string>(AUDIO_URL);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const toggleAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
        // Attempt to play
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn("Audio playback failed:", error?.message || "Unknown error");
                // Only retry loading if it's the default URL (network issues). 
                // Local blobs usually play instantly.
                if (currentAudioSrc === AUDIO_URL && audio) {
                    audio.load();
                    // Don't auto-retry immediately to avoid loops if source is dead
                }
            });
        }
    } else {
        audio.pause();
    }
  };

  const handlePhotoUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newPhotos = Array.from(files).map(file => URL.createObjectURL(file as File));
      setUserPhotos(prev => [...newPhotos, ...prev]);
    }
  }, []);

  const handleAudioUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file && audioRef.current) {
          const url = URL.createObjectURL(file);
          setCurrentAudioSrc(url);
          // Auto-play after upload since it's a direct user interaction
          // We need a slight timeout to ensure React updates the src prop
          setTimeout(() => {
              if (audioRef.current) {
                  audioRef.current.play().catch(e => console.error("Auto-play failed:", e));
              }
          }, 100);
      }
  }, []);

  return (
    <main className="relative w-full h-full bg-black overflow-hidden selection:bg-arix-gold selection:text-black">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-radial from-arix-dark via-black to-black opacity-80 z-0 pointer-events-none" />
        
        {/* Audio Element in DOM */}
        <audio 
            ref={audioRef} 
            src={currentAudioSrc} 
            loop 
            preload="auto" 
            playsInline
            // State is updated by event listeners to ensure Truth
            onPlay={() => setAudioPlaying(true)}
            onPause={() => setAudioPlaying(false)}
            onError={(e) => {
                const err = e.currentTarget.error;
                // Suppress Code 4 (Source Not Supported) console spam for default audio
                if (err && err.code === 4) {
                    console.warn("Default audio source not supported or blocked. User upload required.");
                    setAudioPlaying(false);
                } else {
                    console.error("Audio tag error:", err ? `Code: ${err.code}, Message: ${err.message}` : "Unknown Error");
                }
            }}
        />

        {/* 3D Scene */}
        <div className="absolute inset-0 z-0">
            <Scene photos={userPhotos} />
        </div>

        {/* UI Overlay */}
        <Overlay 
            onInteract={toggleAudio} 
            audioPlaying={audioPlaying} 
            onUpload={handlePhotoUpload}
            onAudioUpload={handleAudioUpload}
        />
    </main>
  );
};

export default App;