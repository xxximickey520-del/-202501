import React, { useRef } from 'react';

interface OverlayProps {
  onInteract: () => void;
  audioPlaying: boolean;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAudioUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Overlay: React.FC<OverlayProps> = ({ onInteract, audioPlaying, onUpload, onAudioUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 z-10">
      {/* Header - Shrink Title Range & Minimal */}
      <header className="flex flex-col items-center pt-4">
        <h1 className="font-script text-4xl md:text-5xl text-liquid-gold drop-shadow-lg">
            Merry Christmas
        </h1>
        <span className="font-display text-arix-gold tracking-[0.3em] text-[10px] mt-1 opacity-80 uppercase border-b border-arix-gold pb-1">
            Arix Signature Collection
        </span>
      </header>

      {/* Top Left - Upload Controls */}
      <div className="absolute top-8 left-8 pointer-events-auto z-50">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            multiple 
            onChange={onUpload}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="group flex items-center gap-2 bg-black/40 backdrop-blur-md border border-arix-gold/50 px-4 py-2 rounded-sm hover:bg-arix-gold/20 transition-all cursor-pointer"
          >
             <div className="w-1.5 h-1.5 bg-arix-gold rounded-full animate-pulse" />
             <span className="font-sans text-[10px] uppercase tracking-widest text-arix-gold group-hover:text-white">
                 Upload Memory
             </span>
          </button>
      </div>

      {/* Top Right Info */}
      <div className="absolute top-8 right-8 hidden md:block text-right opacity-60">
         <div className="font-display text-[9px] tracking-widest uppercase mb-1 text-arix-silver">Gesture Controls</div>
         <ul className="text-[9px] font-sans text-arix-gold/70 space-y-1">
             <li>Open Hand: Chaos</li>
             <li>Fist: Form</li>
             <li>Victory: Select / Swipe</li>
         </ul>
      </div>

      {/* Bottom Right - Audio Controls */}
      <div className="absolute bottom-8 right-8 pointer-events-auto z-50 flex items-end flex-col gap-2">
         <span className="font-sans text-[9px] tracking-widest text-arix-gold/50 uppercase hidden md:block mb-1">
            {audioPlaying ? 'Now Playing' : 'Soundtrack'}
         </span>
         
         <div className="flex items-center gap-3">
             {/* Audio Upload Button */}
            <input 
                type="file" 
                ref={audioInputRef} 
                className="hidden" 
                accept="audio/*" 
                onChange={onAudioUpload}
            />
            <button
                onClick={() => audioInputRef.current?.click()}
                className="group flex items-center justify-center h-8 px-3 border border-arix-gold/30 bg-black/40 backdrop-blur-md rounded-sm hover:bg-arix-gold/10 transition-all cursor-pointer"
                title="Upload Custom Music"
            >
                <span className="font-sans text-[8px] uppercase tracking-widest text-arix-gold group-hover:text-white">
                    Change Track
                </span>
            </button>

            {/* Play/Pause Button */}
            <button 
            onClick={(e) => {
                e.stopPropagation(); // Prevent event bubbling issues
                onInteract();
            }}
            className={`flex items-center justify-center w-12 h-12 border backdrop-blur-md rounded-full transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                audioPlaying 
                ? 'border-arix-gold bg-arix-gold/10' 
                : 'border-arix-gold/30 bg-black/40'
            }`}
            >
                {audioPlaying ? (
                    <div className="flex gap-1 h-3 items-end">
                        <div className="w-0.5 h-full bg-arix-gold animate-[pulse_1s_ease-in-out_infinite]" />
                        <div className="w-0.5 h-2/3 bg-arix-gold animate-[pulse_1.2s_ease-in-out_infinite]" />
                        <div className="w-0.5 h-full bg-arix-gold animate-[pulse_0.8s_ease-in-out_infinite]" />
                    </div>
                ) : (
                     <div className="w-0 h-0 border-l-[8px] border-l-arix-gold border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent ml-0.5" />
                )}
            </button>
         </div>
      </div>
    </div>
  );
};