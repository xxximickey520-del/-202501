
export const COLORS = {
  bg: "#000502",
  emeraldDark: "#001A0F",
  emerald: "#003311",
  emeraldBright: "#005522",
  gold: "#FFD700",
  goldDark: "#AA771C",
  red: "#FF0022", // Changed from Deep Red to Vibrant Bright Red
  silver: "#E0E0E0",
  white: "#FFFFFF",
};

export const CONFIG = {
  treeHeight: 14,
  treeRadius: 4.5,
  particleCount: 40000,
  trunkCount: 6000,
  bloomThreshold: 0.6, 
  bloomStrength: 1.2,
  cameraPosition: [0, 4, 18] as [number, number, number],
};

// Empty default images array as requested. User must upload to see photos.
export const IMAGES: string[] = [];

// Reliable Archive.org Source for Jingle Bells (Public Domain)
export const AUDIO_URL = "https://ia800504.us.archive.org/17/items/ChristmasMusic_662/Jingle%20Bells.mp3";