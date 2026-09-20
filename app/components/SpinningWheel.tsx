"use client";

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useLayoutEffect,
} from "react";
import {
  trackWheelDragStart,
  trackWheelDragEnd,
  trackSpinInitiated,
  trackSpinCompleted,
  trackWinnerAcknowledged,
  trackFairnessChecked,
  incrementSpinCount,
  trackSpinButtonConversion,
} from "../utils/analytics";
import { generatePaletteFromColor } from "../../lib/utils/palette";

/** ========= CRYPTO RNG  ========= */
const cryptoRandom = (): number => {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const u32 = new Uint32Array(1);
    window.crypto.getRandomValues(u32);
    return u32[0] / 4294967296; // [0,1)
  }
  return Math.random();
};

/** ========= TUNING ========= */
const SPIN_DURATION_MS = 6000;
// Drag release faster than this (radians/second) counts as a flick and starts a real spin
const FLICK_THRESHOLD = 6;
// Velocity at which a flick maps to 100% power
const FLICK_MAX_VELOCITY = 30;
const BLANK_SEGMENTS = 10;
const MUTE_STORAGE_KEY = "wheel_muted";

/** ========= DRAG UTILITIES ========= */
const getAngleFromPoint = (
  centerX: number,
  centerY: number,
  pointX: number,
  pointY: number
): number => {
  const deltaX = pointX - centerX;
  const deltaY = pointY - centerY;
  let angle = Math.atan2(deltaY, deltaX);
  // Convert to 0-2π range
  if (angle < 0) angle += Math.PI * 2;
  return angle;
};

const getCanvasCoordinates = (
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
) => {
  const rect = canvas.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
};

const normalizeAngleDifference = (angleDiff: number): number => {
  // Normalize angle difference to [-π, π] for shortest rotation path
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
  return angleDiff;
};

/** ========= TEXT UTILITIES ========= */

const getSimpleFontSize = (
  segmentCount: number,
  isNumbers: boolean = false
): number => {
  // Numbers are typically shorter (1-3 characters) so we can use larger fonts
  if (isNumbers && segmentCount <= 20) {
    if (segmentCount <= 10) return 20;
    if (segmentCount <= 15) return 18;
    return 16;
  }

  // Original logic for names
  if (segmentCount <= 10) return 16;
  if (segmentCount <= 20) return 14;
  if (segmentCount <= 30) return 12;
  return 10;
};

const simpleTextTruncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
};

/** ========= COLOR UTILITIES ========= */
// Helper function to convert hex to RGB
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

// Helper function to convert RGB to hex
const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (n: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)));
    const hex = clamped.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}ff`;
};

// Lighten a color by a percentage (0-1)
const lightenColor = (hex: string, percent: number): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const r = rgb.r + (255 - rgb.r) * percent;
  const g = rgb.g + (255 - rgb.g) * percent;
  const b = rgb.b + (255 - rgb.b) * percent;

  return rgbToHex(r, g, b);
};

// Darken a color by a percentage (0-1)
const darkenColor = (hex: string, percent: number): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const r = rgb.r * (1 - percent);
  const g = rgb.g * (1 - percent);
  const b = rgb.b * (1 - percent);

  return rgbToHex(r, g, b);
};

// Generate extended color palette (up to 20 unique colors)
const generateExtendedPalette = (baseColors: string[]): string[] => {
  const extended: string[] = [];

  // First 10: Original colors
  baseColors.forEach(color => extended.push(color));

  // Next 10: Variations (alternating lighter/darker)
  for (let i = 0; i < baseColors.length && extended.length < 20; i++) {
    const baseColor = baseColors[i];
    if (i % 2 === 0) {
      // Even index: lighten
      extended.push(lightenColor(baseColor, 0.15));
    } else {
      // Odd index: darken
      extended.push(darkenColor(baseColor, 0.15));
    }
  }

  return extended;
};

// Deterministic shuffle of a palette, seeded by the wheel's names
const seededShuffle = (colors: string[], seedString: string): string[] => {
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    const char = seedString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  // The string hash is a signed 32-bit int. A negative seed made the LCG below produce
  // negative indices, which swapped `undefined` into the palette; every name that landed
  // on one of those slots fell back to orange. Keep the seed non-negative.
  hash = Math.abs(hash);

  const shuffled = [...colors];
  let currentIndex = shuffled.length;
  while (currentIndex !== 0) {
    hash = ((hash * 9301) + 49297) % 233280;
    const randomIndex = Math.floor((hash / 233280) * currentIndex);
    currentIndex--;
    [shuffled[currentIndex], shuffled[randomIndex]] =
      [shuffled[randomIndex], shuffled[currentIndex]];
  }
  return shuffled;
};

const COLOR_THEMES: string[][] = [
  // Vibrant Theme
  [
    "#FF6B35ff", "#E91E63ff", "#FFD23Fff", "#06FFA5ff", "#4ECDC4ff",
    "#45B7D1ff", "#96CEB4ff", "#FFEAA7ff", "#DDA0DDff", "#98D8C8ff"
  ],
  // Ocean Theme
  [
    "#0077BEff", "#00A8CCff", "#40E0D0ff", "#1BA3CDff", "#5DADE2ff",
    "#85C1E9ff", "#A9CCE3ff", "#87CEEBff", "#2E8B57ff", "#20B2AAff"
  ],
  // Sunset Theme
  [
    "#FF4757ff", "#FF6B9Dff", "#FFA502ff", "#FF7675ff", "#FDCB6Eff",
    "#E84393ff", "#F39C12ff", "#E74C3Cff", "#FF5722ff", "#FF8A80ff"
  ],
  // Forest Theme
  [
    "#27AE60ff", "#2ECC71ff", "#58D68Dff", "#82E0AAff", "#A9DFBFff",
    "#52C41Aff", "#73D13Dff", "#95DE64ff", "#B7EB8Fff", "#D9F7BEff"
  ],
  // Royal Theme
  [
    "#8E44ADff", "#9B59B6ff", "#BB8FCEff", "#D2B4DEff", "#E8DAEFff",
    "#6C3483ff", "#7D3C98ff", "#A569BDff", "#CD6155ff", "#F1948Aff"
  ],
  // Tropical Theme
  [
    "#FF6F61ff", "#6B5B95ff", "#88D8B0ff", "#FFEAA7ff", "#DDA0DDff",
    "#FFB07Aff", "#98D8C8ff", "#F093FBff", "#4ECDC4ff", "#45B7D1ff"
  ],
  // Rainbow Theme
  [
    "#FF0000ff", "#FF8000ff", "#FFFF00ff", "#80FF00ff", "#00FF00ff",
    "#00FF80ff", "#00FFFFff", "#0080FFff", "#0000FFff", "#8000FFff"
  ],
  // USA Theme
  [
    "#B22234ff", "#FF0000ff", "#DC143Cff", "#8B0000ff", "#CD5C5Cff",
    "#4169E1ff", "#0000CDff", "#000080ff", "#6495EDff", "#1E90FFff"
  ],
  // Indian Theme
  [
    "#FF9933ff", "#228B22ff", "#32CD32ff", "#FFD700ff", "#4169E1ff",
    "#8B4513ff", "#DC143Cff", "#9370DBff", "#20B2AAff", "#800080ff"
  ],
  // Neon Theme
  [
    "#FF00FFff", "#00FFFFff", "#FFFF00ff", "#FF0080ff", "#80FF00ff",
    "#FF4000ff", "#4000FFff", "#00FF40ff", "#9D00FFff", "#8000FFff"
  ],
  // Nature Theme
  [
    "#228B22ff", "#32CD32ff", "#8FBC8Fff", "#2E8B57ff", "#556B2Fff",
    "#8B4513ff", "#4682B4ff", "#CD853Fff", "#2F4F4Fff", "#6B8E23ff"
  ],
  // Cyberpunk Theme
  [
    "#00FFFFff", "#FF00FFff", "#39FF14ff", "#6600CCff", "#0033FFff",
    "#FFFF00ff", "#FF1493ff", "#FF6600ff", "#9D00FFff", "#FF073Aff"
  ],
  // Pastel Dream Theme
  [
    "#FFD1DCff", "#AEC6CFff", "#FDFD96ff", "#B2D8B2ff", "#E6E6FAff",
    "#FFDAB9ff", "#AAF0D1ff", "#E0BBE4ff", "#FFB5C5ff", "#87CEEBff"
  ],
  // Autumn Harvest Theme
  [
    "#CC5500ff", "#8B0000ff", "#FFD700ff", "#8B4513ff", "#FF7518ff",
    "#800020ff", "#228B22ff", "#B87333ff", "#4B0082ff", "#DC143Cff"
  ],
  // Galaxy Theme
  [
    "#4B0082ff", "#FF1493ff", "#C0C0C0ff", "#000080ff", "#00FF7Fff",
    "#FF4500ff", "#1C1C1Cff", "#008B8Bff", "#DC143Cff", "#8A2BE2ff"
  ]
];

const WINNER_RHYMES = [
  "Winner Winner, Chicken Dinner",
  "The chosen one is...",
  "Victory Royale!",
  "Winner = Declared",
  "Absolute legend pick",
  "Throw some W's in the chat",
  "The Wheel has spoken",
  "Randomly selected winner is...",
  "Jackpot!!!",
  "Shout-Out",
  "The Algorithm was in favor of...",
];

const readStoredMute = (): boolean => {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

interface SpinningWheelProps {
  names?: string[];
  onReset?: () => void;
  /** Show a colourful placeholder wheel with no labels (nothing to spin yet) */
  showBlank?: boolean;
  /** Disable the SPIN / Reset buttons, e.g. while the setup modal is open on top */
  controlsDisabled?: boolean;
  /** User-chosen accent colour (#rrggbb). null = automatic theme */
  accentColor?: string | null;
  isFirefox?: boolean;
  configId?: string | null;
  onRecordSpin?: (configId: string, winner: string, isRespin: boolean, spinPower: number) => Promise<string | null>;
  onUpdateSpinAcknowledgment?: (spinId: string, method: 'button' | 'backdrop' | 'x' | 'remove') => Promise<void>;
  onRemoveWinner?: (newNames: string[]) => Promise<string | null>;
}

const SpinningWheel: React.FC<SpinningWheelProps> = ({
  names,
  onReset,
  showBlank = false,
  controlsDisabled = false,
  accentColor = null,
  isFirefox = false,
  configId,
  onRecordSpin,
  onUpdateSpinAcknowledgment,
  onRemoveWinner,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Layout refs
  const rootRef = useRef<HTMLDivElement>(null);
  const wheelWrapRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const footerContentRef = useRef<HTMLDivElement>(null);

  /** ========= State ========= */
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [selectedName, setSelectedName] = useState<string>("");
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winnerRhyme, setWinnerRhyme] = useState<string>("");
  // Start with a reasonable default to avoid CLS
  const [canvasCSSSize, setCanvasCSSSize] = useState(() => {
    if (typeof window !== "undefined") {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      return Math.min(Math.min(vw - 48, vh * 0.5), 400);
    }
    return 350; // Mobile-first default
  });
  // Spin power 0..1. Drifts on its own until the user drags the slider (locks it).
  const [speedIndicator, setSpeedIndicator] = useState(0.5);
  const [speedLocked, setSpeedLocked] = useState(false);
  const [showFairnessPopup, setShowFairnessPopup] = useState(false);
  const [showHistoryPopup, setShowHistoryPopup] = useState(false);
  const [fairnessText, setFairnessText] = useState("");
  const [winnerHistory, setWinnerHistory] = useState<string[]>([]);
  const [muted, setMuted] = useState<boolean>(readStoredMute);
  const [isIOS16, setIsIOS16] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [currentSpinId, setCurrentSpinId] = useState<string | null>(null);
  const [deviceCapability, setDeviceCapability] = useState<
    "high" | "medium" | "low"
  >("medium");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [ariaAnnouncement, setAriaAnnouncement] = useState<string>("");

  // Drag interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [lastDragAngle, setLastDragAngle] = useState<number | null>(null);
  const [dragVelocity, setDragVelocity] = useState(0);
  const [lastDragTime, setLastDragTime] = useState(0);
  const momentumAnimationRef = useRef<number | null>(null);

  // RAF throttling for drag handlers
  const dragUpdateRef = useRef<number | null>(null);
  const pendingDragUpdate = useRef<{ clientX: number; clientY: number } | null>(
    null
  );

  // Canvas optimization caches
  const pointerGradientCache = useRef<CanvasGradient | null>(null);
  const lastCanvasSize = useRef<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Whether the current winner has already been pushed to history (prevents double entries)
  const historyRecordedRef = useRef(false);
  // Mirror of `muted` for use inside animation closures
  const mutedRef = useRef(muted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // Performance management
  const [performanceMode, setPerformanceMode] = useState<
    "optimal" | "balanced" | "performance"
  >("balanced");

  /** ========= AUDIO (optimized with node pooling) ========= */
  const audioCtxRef = useRef<AudioContext | null>(null);
  const clickBufferRef = useRef<AudioBuffer | null>(null);
  const audioInitPromiseRef = useRef<Promise<void> | null>(null);
  const isAudioInitializingRef = useRef<boolean>(false);

  // Audio node pool for efficient click sounds
  const audioPoolRef = useRef<{
    sources: AudioBufferSourceNode[];
    gains: GainNode[];
    currentIndex: number;
    poolSize: number;
  }>({
    sources: [],
    gains: [],
    currentIndex: 0,
    poolSize: 8,
  });

  // Create audio context only (fast operation)
  const getAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;

    try {
      if (!audioCtxRef.current) {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        audioCtxRef.current = new Ctx();
      }
      return audioCtxRef.current;
    } catch (error) {
      console.warn("Audio context creation failed:", error);
      return null;
    }
  }, []);

  // Async audio buffer creation to avoid blocking main thread
  const createAudioBuffersAsync = useCallback(async (): Promise<void> => {
    if (isAudioInitializingRef.current || typeof window === "undefined") return;

    isAudioInitializingRef.current = true;

    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      // Create click buffer asynchronously
      if (!clickBufferRef.current) {
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            const duration = 0.008; // Shorter for efficiency while maintaining quality
            const sr = ctx.sampleRate;
            const frames = Math.max(1, Math.floor(duration * sr));
            const buffer = ctx.createBuffer(1, frames, sr);
            const data = buffer.getChannelData(0);

            // Create a crisp "tick" sound optimized for rapid playback
            for (let i = 0; i < frames; i++) {
              const t = i / sr;
              const env = Math.exp(-t * 150); // Fast decay for crisp sound

              // Simplified harmonic content for efficiency
              const fundamental = 1800;
              const harmonic2 = fundamental * 2;

              let sample = 0;
              sample += Math.sin(2 * Math.PI * fundamental * t) * 0.7; // Main tone
              sample += Math.sin(2 * Math.PI * harmonic2 * t) * 0.25; // Second harmonic

              data[i] = sample * env * 0.2;
            }

            clickBufferRef.current = buffer;
            resolve();
          }, 0);
        });
      }
    } catch (error) {
      console.warn("Audio buffer creation failed:", error);
    } finally {
      isAudioInitializingRef.current = false;
    }
  }, [getAudioContext]);

  // Ensure audio with async initialization
  const ensureAudio = useCallback(async (): Promise<AudioContext | null> => {
    const ctx = getAudioContext();
    if (!ctx) return null;

    // Start async buffer creation if not already done
    if (!audioInitPromiseRef.current && !clickBufferRef.current) {
      audioInitPromiseRef.current = createAudioBuffersAsync();
    }

    return ctx;
  }, [getAudioContext, createAudioBuffersAsync]);

  // Initialize audio pool
  const initializeAudioPool = useCallback((ctx: AudioContext) => {
    const pool = audioPoolRef.current;

    // Clear existing pool
    pool.sources.forEach((source) => {
      try {
        source.disconnect();
      } catch {}
    });
    pool.gains.forEach((gain) => {
      try {
        gain.disconnect();
      } catch {}
    });

    pool.sources = [];
    pool.gains = [];

    // Create new pool
    for (let i = 0; i < pool.poolSize; i++) {
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      pool.gains.push(gain);
    }
  }, []);

  const playTickSound = useCallback(
    async (v = 0.1) => {
      if (mutedRef.current) return;
      try {
        const ctx = await ensureAudio();
        if (!ctx || !clickBufferRef.current) return;

        if (ctx.state === "suspended") {
          await ctx.resume().catch(() => {});
        }

        // Initialize pool if needed
        const pool = audioPoolRef.current;
        if (pool.gains.length === 0) {
          initializeAudioPool(ctx);
        }

        // Get next available node from pool
        const gain = pool.gains[pool.currentIndex];
        pool.currentIndex = (pool.currentIndex + 1) % pool.poolSize;

        // Set volume
        gain.gain.value = Math.max(0.01, Math.min(0.12, v));

        // Create new source (these are lightweight and disposable)
        const src = ctx.createBufferSource();
        src.buffer = clickBufferRef.current;
        src.connect(gain);

        // Auto-cleanup after sound finishes
        src.onended = () => {
          try {
            src.disconnect();
          } catch {}
        };

        src.start();
      } catch {
        // Silently fail for audio errors
      }
    },
    [ensureAudio, initializeAudioPool]
  );

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(MUTE_STORAGE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }, []);

  /** ========= Names ========= */
  const wheelNames = useMemo(() => {
    // Blank state: coloured placeholder slices with no labels
    if (showBlank) {
      return Array(BLANK_SEGMENTS).fill("");
    }

    return names && names.length
      ? names
      : ["Name 1", "Name 2", "Name 3", "Name 4", "Name 5", "Name 6"];
  }, [names, showBlank]);

  /** ========= Memoized wheel geometry calculations ========= */
  const wheelGeometry = useMemo(() => {
    if (!canvasCSSSize || wheelNames.length === 0) return null;

    const centerX = canvasCSSSize / 2;
    const centerY = canvasCSSSize / 2;
    const radius = Math.min(centerX, centerY) - 18;
    const sliceAngle = (2 * Math.PI) / wheelNames.length;

    return {
      centerX,
      centerY,
      radius,
      sliceAngle,
    };
  }, [canvasCSSSize, wheelNames.length]);

  /** ========= Simple text processing ========= */
  const textInfo = useMemo(() => {
    if (showBlank) return { fontSize: 16, displayTexts: [] };

    // Detect if we're showing numbers (all segments are numeric)
    const isNumbers =
      wheelNames.length > 0 &&
      wheelNames.every((name) => name !== "" && /^\d+$/.test(name));

    const fontSize = getSimpleFontSize(wheelNames.length, isNumbers);

    // Simple truncation based on segment count
    const maxLength =
      wheelNames.length <= 10 ? 20 : wheelNames.length <= 20 ? 15 : 12;

    const displayTexts = wheelNames.map((name) => {
      if (name === "") return name;
      return simpleTextTruncate(name, maxLength);
    });

    return { fontSize, displayTexts };
  }, [wheelNames, showBlank]);

  /** ========= Fairness text ========= */
  useEffect(() => {
    if (showBlank) {
      setFairnessText("");
      return;
    }
    setFairnessText(`Each name ${((1 / wheelNames.length) * 100).toFixed(2)}% chance`);
  }, [wheelNames, showBlank]);

  /** ========= Winner history follows the wheel ========= */
  // A brand-new set of names (no overlap with the previous one) starts a fresh history.
  // Removing winners or adding a name keeps it.
  const previousNamesRef = useRef<string[] | null>(null);
  useEffect(() => {
    if (showBlank || !names || names.length === 0) return;
    const previous = previousNamesRef.current;
    if (previous && previous.length > 0) {
      const overlap = names.some((n) => previous.includes(n));
      if (!overlap) setWinnerHistory([]);
    }
    previousNamesRef.current = names;
  }, [names, showBlank]);

  /** ========= Idle speed indicator (drifts until the user locks a speed) ========= */
  useEffect(() => {
    if (isSpinning || speedLocked) return;

    let animationId: number;
    let lastTime = 0;

    const animate = (currentTime: number) => {
      // Much slower update rate for mobile to improve INP
      const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
      const throttleMs = isMobile ? 100 : (deviceCapability === "high" ? 16.67 : 33.33);

      if (currentTime - lastTime >= throttleMs) {
        const t = currentTime / 1000;
        setSpeedIndicator((Math.sin(t * 1.5) + 1) / 2);
        lastTime = currentTime;
      }
      animationId = requestAnimationFrame(animate);
    };

    // Delay animation start on mobile
    const delay = typeof window !== "undefined" && window.innerWidth < 768 ? 1000 : 0;
    const timeoutId = setTimeout(() => {
      animationId = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [isSpinning, speedLocked, deviceCapability]);

  /** ========= Responsive sizing with ResizeObserver ========= */
  const recomputeSize = useCallback(() => {
    if (typeof window === "undefined") return;

    const vw = window.innerWidth;

    // Simplified viewport height retrieval with clear priority chain
    let vh: number;

    if (window.visualViewport) {
      // Priority 1: visualViewport API (most accurate for mobile)
      vh = window.visualViewport.height;
    } else {
      // Priority 2: CSS custom property (set by useViewportHeight hook)
      const vhProperty = isFirefox ? '--visual-vh' : '--vh';
      const customVhStr = getComputedStyle(document.documentElement)
        .getPropertyValue(vhProperty)
        .replace('px', '');
      const customVh = parseFloat(customVhStr) * 100;

      // Priority 3: Use if valid (not NaN, not zero)
      if (!isNaN(customVh) && customVh > 0) {
        vh = customVh;
      } else {
        // Priority 4: Final fallback
        vh = window.innerHeight;
      }
    }

    // Conservative fallbacks - power meter is now below the wheel
    const speedH = Math.max(speedRef.current?.offsetHeight ?? 0, 40);
    const controlsH = Math.max(controlsRef.current?.offsetHeight ?? 0, 60);
    // Footer fallback matching actual minHeight
    const footerH = Math.max(footerRef.current?.offsetHeight ?? 0, 40);

    const buffers = 12;

    // Available area for the wheel container (flex-1)
    // Subtract: speed meter (40px) + its margins (mt-3=12px + mb-2=8px=20px) + controls + footer + buffers
    const availableH = Math.max(0, vh - speedH - 20 - controlsH - footerH - buffers);

    const sidePadding = vw < 768 ? 24 : 96;
    const availableW = Math.max(0, vw - sidePadding);

    let target = Math.min(availableW, availableH);

    // Optimized VH caps for better space utilization across screen sizes
    const vhCapPercentage =
      vw >= 1536 ? 0.65 :  // XL screens (4K): 65%
      vw >= 1280 ? 0.62 :  // Large screens: 62%
      vw >= 1024 ? 0.60 :  // Desktop: 60%
      vw >= 768 ? 0.62 :   // Tablet: 62%
      0.68;                // Mobile: 68% (better space usage)
    const vhCap = Math.floor(vh * vhCapPercentage);
    target = Math.min(target, vhCap);

    // Improved min/max with screen-responsive scaling
    const minSize = showBlank ? 250 : 280;
    const maxSize = showBlank ? 450 :
      vw >= 1536 ? 650 :  // XL screens: 650px
      vw >= 1280 ? 600 :  // Large screens: 600px
      vw >= 1024 ? 550 :  // Desktop: 550px
      500;                // Mobile/Tablet: 500px
    target = Math.max(minSize, Math.min(maxSize, target));

    setCanvasCSSSize(target);
  }, [isFirefox, showBlank]);

  useLayoutEffect(() => {
    // Initial pass + observers (so when controls gain height, we recalc)
    recomputeSize();

    const ro = new ResizeObserver(() => recomputeSize());
    if (speedRef.current) ro.observe(speedRef.current);
    if (controlsRef.current) ro.observe(controlsRef.current);
    if (footerRef.current) ro.observe(footerRef.current);
    if (wheelWrapRef.current) ro.observe(wheelWrapRef.current);
    if (rootRef.current) ro.observe(rootRef.current);

    const onResize = () => recomputeSize();
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("orientationchange", onResize, { passive: true });

    // Force recalculation after a brief delay to ensure layout is settled
    const timer = setTimeout(() => recomputeSize(), 100);

    return () => {
      clearTimeout(timer);
      ro.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [recomputeSize, wheelNames.length]); // Add dependency on names count

  /** ========= Footer content observer for dynamic layout ========= */
  useEffect(() => {
    // Recalculate layout when footer content changes (e.g., lastWinner appears)
    const timer = setTimeout(() => recomputeSize(), 50);
    return () => clearTimeout(timer);
  }, [winnerHistory, fairnessText, recomputeSize]);

  /** ========= Audio Context Cleanup ========= */
  useEffect(() => {
    return () => {
      // Cleanup audio context on unmount
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        try {
          audioCtxRef.current.close();
        } catch (error) {
          console.warn("Error closing audio context:", error);
        }
      }
    };
  }, []);

  /** ========= Drag Animation Cleanup ========= */
  useEffect(() => {
    const audioPool = audioPoolRef.current;

    return () => {
      // Cleanup momentum animation on unmount
      if (momentumAnimationRef.current) {
        cancelAnimationFrame(momentumAnimationRef.current);
        momentumAnimationRef.current = null;
      }

      // Clear canvas optimization caches
      pointerGradientCache.current = null;
      lastCanvasSize.current = { width: 0, height: 0 };

      // Clear audio pool
      audioPool.sources.forEach((source) => {
        try {
          source.disconnect();
        } catch {}
      });
      audioPool.gains.forEach((gain) => {
        try {
          gain.disconnect();
        } catch {}
      });
      audioPool.sources = [];
      audioPool.gains = [];
      audioPool.currentIndex = 0;
    };
  }, []);

  /** ========= Lazy Audio Initialization ========= */
  useEffect(() => {
    // Defer audio initialization much longer on mobile
    const isMobile = typeof window !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const delay = isMobile ? 5000 : 100; // 5s for mobile, 100ms for desktop

    const timeoutId = setTimeout(() => {
      // Only initialize audio on first user interaction to avoid blocking initial load
      if (typeof window !== "undefined") {
        let audioInitialized = false;

        const initAudioOnInteraction = () => {
          if (!audioInitialized) {
            audioInitialized = true;
            ensureAudio().catch(() => {
              // Silently handle audio initialization failures
            });
            // Remove listeners after first interaction
            document.removeEventListener("click", initAudioOnInteraction);
            document.removeEventListener("touchstart", initAudioOnInteraction);
            document.removeEventListener("keydown", initAudioOnInteraction);
          }
        };

        // Initialize audio on first user interaction
        document.addEventListener("click", initAudioOnInteraction, {
          passive: true,
        });
        document.addEventListener("touchstart", initAudioOnInteraction, {
          passive: true,
        });
        document.addEventListener("keydown", initAudioOnInteraction, {
          passive: true,
        });

        return () => {
          document.removeEventListener("click", initAudioOnInteraction);
          document.removeEventListener("touchstart", initAudioOnInteraction);
          document.removeEventListener("keydown", initAudioOnInteraction);
        };
      }
    }, delay); // Dynamic defer based on device

    return () => {
      clearTimeout(timeoutId);
    };
  }, [ensureAudio]);

  /** ========= Device Detection (Optimized) ========= */
  useEffect(() => {
    // Batch all detection logic to minimize DOM queries
    if (typeof window === "undefined") return;

    // Use requestIdleCallback to run detection when main thread is free
    const runDetection = (callback: IdleRequestCallback) => {
      if ("requestIdleCallback" in window) {
        requestIdleCallback(callback);
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(callback, 50);
      }
    };

    runDetection(() => {
      const userAgent = window.navigator.userAgent;

      // Batch browser detection
      const isIOS = /iPad|iPhone|iPod/.test(userAgent);

      // iOS 16 specific detection
      let isIOS16 = false;
      if (isIOS) {
        const versionMatch = userAgent.match(/OS (\d+)_(\d+)/);
        if (versionMatch) {
          isIOS16 = parseInt(versionMatch[1]) === 16;
        }
      }

      // Device capability detection
      const lowMotion = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)"
      )?.matches;
      const cores = navigator.hardwareConcurrency || 4;

      // Batch state updates
      setIsIOS16(isIOS16);
      setIsIOS(isIOS);
      setPrefersReducedMotion(!!lowMotion);
      setDeviceCapability(lowMotion ? "low" : cores >= 8 ? "high" : "medium");

      // Set up motion preference listener
      const motionMediaQuery = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      );
      const handleMotionChange = (e: MediaQueryListEvent) => {
        setPrefersReducedMotion(e.matches);
        if (e.matches) {
          setDeviceCapability("low");
        }
      };

      if (motionMediaQuery.addEventListener) {
        motionMediaQuery.addEventListener("change", handleMotionChange);
      } else {
        motionMediaQuery.addListener(handleMotionChange);
      }

      // Cleanup function for motion listener
      return () => {
        if (motionMediaQuery.removeEventListener) {
          motionMediaQuery.removeEventListener("change", handleMotionChange);
        } else {
          motionMediaQuery.removeListener(handleMotionChange);
        }
      };
    });
  }, []);

  /** ========= Theme + colours ========= */
  // Store the original configId to maintain theme stability during eliminations
  const originalConfigId = useRef<string | null>(null);
  const currentTheme = useRef<string[]>(COLOR_THEMES[0]);

  // Select a theme based on original wheel configuration - stays stable during eliminations
  const selectedTheme = useMemo(() => {
    if (!wheelNames.length) {
      // Reset when no names
      originalConfigId.current = null;
      const fallback = COLOR_THEMES[0] || [];
      currentTheme.current = fallback;
      return fallback;
    }

    // Track the original configId (first non-elimination config)
    if (configId && originalConfigId.current === null) {
      originalConfigId.current = configId;
    }

    // Use the original configId for theme selection (not the current elimination configId)
    const themeConfigId = originalConfigId.current || configId;

    if (themeConfigId) {
      // Create hash from the original configId to maintain consistent theme
      let hash = 0;
      for (let i = 0; i < themeConfigId.length; i++) {
        const char = themeConfigId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }

      const themeIndex = Math.abs(hash) % COLOR_THEMES.length;
      currentTheme.current = COLOR_THEMES[themeIndex];
    }

    // Ensure we always return a valid theme
    if (!currentTheme.current || currentTheme.current.length === 0) {
      const fallback = COLOR_THEMES[0] || [];
      currentTheme.current = fallback;
      return fallback;
    }

    return currentTheme.current;
  }, [configId, wheelNames.length]);

  // Store the original color assignments to maintain stability during eliminations
  const originalColorMap = useRef<Map<string, string>>(new Map());

  // Reset original configId and color map when wheel is reset/blank
  useEffect(() => {
    if (showBlank) {
      originalConfigId.current = null;
      originalColorMap.current.clear();
    }
  }, [showBlank]);

  // Which colour source the current map was built from (theme id or accent hex)
  const paletteKeyRef = useRef<string>("");

  // Stable colour per name. Existing names keep their colour when the list is edited
  // (winner removed, a name added); a completely new list, or a change of colour
  // source (Auto theme resolved after preview, user picked a colour), starts fresh.
  const wheelColors = useMemo(() => {
    const map = originalColorMap.current;

    if (!wheelNames.length) {
      map.clear();
      return map;
    }

    const theme = selectedTheme && selectedTheme.length ? selectedTheme : COLOR_THEMES[0];
    const palette = accentColor
      ? generatePaletteFromColor(accentColor, Math.max(wheelNames.length, 10))
      : generateExtendedPalette(seededShuffle(theme, wheelNames.join('|')));

    const paletteKey = accentColor ?? `theme:${theme[0]}`;
    if (paletteKeyRef.current !== paletteKey) {
      map.clear();
      paletteKeyRef.current = paletteKey;
    }

    const missing = wheelNames.filter((name) => !map.has(name));
    const isNewWheel = map.size === 0 || missing.length === wheelNames.length;

    if (isNewWheel) {
      map.clear();
      wheelNames.forEach((name, index) => {
        map.set(name, palette[index % palette.length]);
      });
    } else if (missing.length > 0) {
      // Give newly added names colours that aren't already on the wheel where possible
      const used = new Set(wheelNames.map((n) => map.get(n)).filter(Boolean));
      missing.forEach((name, i) => {
        const free = palette.find((c) => !used.has(c));
        const color = free ?? palette[(map.size + i) % palette.length];
        used.add(color);
        map.set(name, color);
      });
    }

    return map;
  }, [wheelNames, selectedTheme, accentColor]);

  // Colours for the label-less placeholder wheel
  const blankPalette = useMemo(
    () => (accentColor ? generatePaletteFromColor(accentColor, BLANK_SEGMENTS) : null),
    [accentColor]
  );

  // Get color for a specific name
  const getColorForName = useCallback((name: string): string => {
    if (!name) {
      return "#FF6B35ff"; // Use vibrant fallback instead of gray
    }
    const color = wheelColors.get(name);
    return color || "#FF6B35ff"; // Use vibrant fallback instead of gray
  }, [wheelColors]);

  // Radial gradient for a segment
  const createGradient = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      centerX: number,
      centerY: number,
      radius: number,
      midAngle: number,
      color?: string
    ): CanvasGradient => {
      const gradient = ctx.createRadialGradient(
        centerX + Math.cos(midAngle) * radius * 0.5,
        centerY + Math.sin(midAngle) * radius * 0.5,
        0,
        centerX,
        centerY,
        radius
      );
      const cleanColor = (color && color.length >= 7) ? color.slice(0, 7) : "#FF6B35"; // Use vibrant fallback
      gradient.addColorStop(0, cleanColor);
      gradient.addColorStop(0.85, cleanColor + "dd");
      gradient.addColorStop(1, cleanColor + "99");
      return gradient;
    },
    []
  );

  // Draw wheel segments with performance-aware rendering
  const drawWheelSegments = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!wheelGeometry) return;

      const { centerX, centerY, radius, sliceAngle } = wheelGeometry;
      const { fontSize, displayTexts } = textInfo;

      // Performance optimizations based on segment count
      const useSimplifiedGradients = performanceMode === "performance";
      const skipInnerGlow = performanceMode === "performance";

      // Draw wheel segments
      wheelNames.forEach((name, i) => {
        const start = i * sliceAngle;
        const end = (i + 1) * sliceAngle;
        const midAngle = start + sliceAngle / 2;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, start, end);
        ctx.closePath();

        // Blank placeholder slices cycle through the palette; real slices use their assigned colour
        const baseColor = showBlank
          ? blankPalette
            ? blankPalette[i % blankPalette.length]
            : selectedTheme[i % selectedTheme.length]
          : getColorForName(name);

        if (useSimplifiedGradients) {
          const cleanColor = (baseColor && baseColor.length >= 7) ? baseColor.slice(0, 7) : "#FF6B35";
          ctx.fillStyle = cleanColor;
        } else {
          ctx.fillStyle = createGradient(ctx, centerX, centerY, radius, midAngle, baseColor);
        }
        ctx.fill();

        // White border with shadow
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner glow (skip in performance mode)
        if (!skipInnerGlow) {
          ctx.save();
          ctx.clip();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
          ctx.lineWidth = 4;
          ctx.stroke();
          ctx.restore();
        }

        // Labels (skip for blank segments)
        if (!showBlank) {
          ctx.save();
          ctx.translate(centerX, centerY);
          ctx.rotate(start + sliceAngle / 2);
          ctx.textAlign = "right";

          // Use simple pre-calculated font size and display text
          const displayText = displayTexts[i] || name;
          const fs = fontSize;

          ctx.fillStyle = "#fff";
          ctx.font = `bold ${fs}px Arial`;

          // Position text consistently from edge, regardless of length
          const paddingFromEdge = 15; // Consistent padding from wheel edge

          // Super thin black outline for better legibility on light colors
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 0.5; // As thin as possible
          ctx.strokeText(displayText, radius - paddingFromEdge, fs / 3);

          ctx.fillText(displayText, radius - paddingFromEdge, fs / 3);
          ctx.restore();
        }
      });

      // Center cap with metallic gradient
      const capGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        25
      );
      capGradient.addColorStop(0, "#4a4a4a");
      capGradient.addColorStop(0.5, "#2a2a2a");
      capGradient.addColorStop(0.8, "#1a1a1a");
      capGradient.addColorStop(1, "#000000");

      ctx.beginPath();
      ctx.arc(centerX, centerY, 25, 0, 2 * Math.PI);
      ctx.fillStyle = capGradient;
      ctx.fill();
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner circle accent
      ctx.beginPath();
      ctx.arc(centerX, centerY, 18, 0, 2 * Math.PI);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1;
      ctx.stroke();
    },
    [
      wheelGeometry,
      textInfo,
      wheelNames,
      getColorForName,
      selectedTheme,
      blankPalette,
      showBlank,
      createGradient,
      performanceMode,
    ]
  );

  /** ========= Performance Mode Detection ========= */
  useEffect(() => {
    const segmentCount = wheelNames.length;

    // Determine performance mode based on segment count
    if (segmentCount <= 8) {
      setPerformanceMode("optimal"); // Full quality rendering
    } else if (segmentCount <= 15) {
      setPerformanceMode("balanced"); // Cached gradients, full features
    } else {
      setPerformanceMode("performance"); // Simplified rendering for high counts
    }
  }, [wheelNames.length]);

  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !wheelGeometry) return;

    const dpr =
      typeof window !== "undefined"
        ? Math.min(2, window.devicePixelRatio || 1)
        : 1; // Cap DPR at 2
    const css = canvasCSSSize;

    // Optimize canvas sizing - only update if changed
    const currentWidth = Math.floor(css * dpr);
    const currentHeight = Math.floor(css * dpr);
    const sizeChanged =
      canvas.width !== currentWidth ||
      canvas.height !== currentHeight ||
      lastCanvasSize.current.width !== currentWidth ||
      lastCanvasSize.current.height !== currentHeight;

    if (sizeChanged) {
      canvas.style.width = `${css}px`;
      canvas.style.height = `${css}px`;
      canvas.width = currentWidth;
      canvas.height = currentHeight;
      lastCanvasSize.current = { width: currentWidth, height: currentHeight };
      // Clear gradient cache when canvas size changes
      pointerGradientCache.current = null;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set transform efficiently
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { centerX, centerY, radius } = wheelGeometry;

    // Clear with optimized method
    ctx.clearRect(0, 0, css, css);

    // Draw wheel segments directly with rotation applied
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    ctx.translate(-centerX, -centerY);
    drawWheelSegments(ctx);
    ctx.restore();

    // Draw pointer with minimal state changes
    const pointerX = centerX + radius;
    const pointerOffsetX = 30;
    const pointerOffsetY = 15;

    // Create path without save/restore for better performance
    ctx.beginPath();
    ctx.moveTo(pointerX - 5, centerY);
    ctx.lineTo(pointerX + pointerOffsetX, centerY - pointerOffsetY);
    ctx.lineTo(pointerX + 25, centerY);
    ctx.lineTo(pointerX + pointerOffsetX, centerY + pointerOffsetY);
    ctx.closePath();

    // Batch style operations
    if (!prefersReducedMotion) {
      ctx.shadowColor = "rgba(255, 0, 0, 0.6)";
      ctx.shadowBlur = 10;
    }

    // Cache pointer gradient for better performance
    if (!pointerGradientCache.current || sizeChanged) {
      const pointerGradient = ctx.createLinearGradient(
        pointerX - 5,
        centerY,
        pointerX + pointerOffsetX,
        centerY
      );
      pointerGradient.addColorStop(0, "#ff3333");
      pointerGradient.addColorStop(0.5, "#ff0000");
      pointerGradient.addColorStop(1, "#cc0000");
      pointerGradientCache.current = pointerGradient;
    }

    ctx.fillStyle = pointerGradientCache.current;
    ctx.fill();

    // Reset shadow efficiently
    if (!prefersReducedMotion) {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    }

    // Single stroke operation
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [
    rotation,
    canvasCSSSize,
    drawWheelSegments,
    prefersReducedMotion,
    wheelGeometry,
  ]);

  useEffect(() => {
    drawWheel();
  }, [drawWheel]);

  /** ========= Winner history ========= */
  const recordWinnerInHistory = useCallback(() => {
    if (historyRecordedRef.current) return;
    if (selectedName) {
      historyRecordedRef.current = true;
      setWinnerHistory((prev) => [...prev, selectedName]);
    }
  }, [selectedName]);

  /** ========= Spin logic ========= */
  const spin = useCallback(
    (powerOverride?: number, direction: 1 | -1 = 1) => {
      if (isSpinning || showBlank) return;

      // If a winner is still on screen (e.g. Space pressed), make sure it lands in history
      if (showWinnerModal && selectedName) {
        recordWinnerInHistory();
      }

      const power = Math.max(0, Math.min(1, powerOverride ?? speedIndicator));
      if (powerOverride !== undefined) setSpeedIndicator(power);

      // Track wheel spin event
      trackSpinInitiated(wheelNames.length, power);
      incrementSpinCount();

      // Track Google Ads conversion for spin button click
      trackSpinButtonConversion();

      setIsSpinning(true);
      setSelectedName("");
      setShowWinnerModal(false);
      setShowFairnessPopup(false);
      setShowHistoryPopup(false);
      historyRecordedRef.current = false;

      // Enhanced aria announcement for spin start
      setAriaAnnouncement(
        `Spinning wheel with ${wheelNames.length} options at ${Math.round(
          power * 100
        )}% power`
      );

      // Dynamic rotations based on number of names - fewer names spin faster (more rotations)
      const extraRotations = wheelNames.length < 5 ? (5 - wheelNames.length) * 1.5 : 0;
      const baseRotations = 2.5 + power * 5 + extraRotations;

      // Where the wheel stops is decided purely by the CSPRNG. The extra two full
      // turns of random make the landing angle uniform regardless of power.
      const finalRotation =
        rotation + direction * Math.PI * 2 * (baseRotations + cryptoRandom() * 2);

      const startTime = Date.now();
      let lastFrameTime = 0;
      const segmentSize = (2 * Math.PI) / wheelNames.length;
      let lastSegment = -1;
      const namesAtSpin = wheelNames;

      const animate = () => {
        const now = Date.now();

        // Much lower frame rate on mobile for better performance
        const isMobile = window.innerWidth < 768;
        const throttleMs = isMobile ? 33.33 : (deviceCapability === "high" ? 16.67 : 25);

        if (now - lastFrameTime < throttleMs) {
          requestAnimationFrame(animate);
          return;
        }
        lastFrameTime = now;

        const elapsed = now - startTime;
        const progress = Math.min(elapsed / SPIN_DURATION_MS, 1);
        const easeOut = 1 - Math.pow(1 - progress, 4);

        const currentRotation = rotation + (finalRotation - rotation) * easeOut;
        setRotation(currentRotation);

        // Which segment is under the pointer right now (same maths as the final result)
        const normalized =
          (2 * Math.PI - (currentRotation % (2 * Math.PI))) % (2 * Math.PI);
        const currentSegment = Math.floor(normalized / segmentSize);

        // Tick on every segment crossing
        if (currentSegment !== lastSegment) {
          const speed = 1 - easeOut;
          const vol = Math.max(0.01, Math.min(0.08, 0.01 + speed * 0.07));
          playTickSound(vol).catch(() => {});
          lastSegment = currentSegment;
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
          return;
        }

        setIsSpinning(false);

        // Calculate winner based on where the wheel actually stopped
        const normalizedRotation =
          (2 * Math.PI - (finalRotation % (2 * Math.PI))) % (2 * Math.PI);
        const selectedIndex = Math.floor(normalizedRotation / segmentSize);
        const winner = namesAtSpin[selectedIndex % namesAtSpin.length];
        setSelectedName(winner);

        // Show winner modal IMMEDIATELY - this is what user sees
        const rhyme = WINNER_RHYMES[Math.floor(cryptoRandom() * WINNER_RHYMES.length)];
        setWinnerRhyme(rhyme);
        setShowWinnerModal(true);

        // Everything else happens asynchronously (non-blocking)
        setTimeout(async () => {
          setAriaAnnouncement(
            `Winner selected: ${winner}. The wheel has stopped spinning.`
          );
          trackSpinCompleted(winner, namesAtSpin.length, false);

          if (onRecordSpin && configId) {
            const spinId = await onRecordSpin(configId, winner, false, power);
            setCurrentSpinId(spinId);
          }
        }, 0);
      };

      requestAnimationFrame(animate);
    },
    [
      isSpinning,
      showBlank,
      showWinnerModal,
      selectedName,
      recordWinnerInHistory,
      speedIndicator,
      wheelNames,
      rotation,
      deviceCapability,
      playTickSound,
      onRecordSpin,
      configId,
    ]
  );

  /** ========= DRAG INTERACTION HANDLERS ========= */
  // Allow drag when wheel is visible and not spinning, even if blank
  const canDrag = !isSpinning && !showWinnerModal;

  const startDrag = useCallback(
    (clientX: number, clientY: number) => {
      if (!canDrag || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const { x, y } = getCanvasCoordinates(canvas, clientX, clientY);

      // Check if click/touch is within wheel area
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      const wheelRadius = Math.min(centerX, centerY) - 18;

      if (distance <= wheelRadius) {
        const angle = getAngleFromPoint(centerX, centerY, x, y);
        setIsDragging(true);
        setLastDragAngle(angle);
        setDragVelocity(0);
        setLastDragTime(Date.now());

        // Cancel any existing momentum
        if (momentumAnimationRef.current) {
          cancelAnimationFrame(momentumAnimationRef.current);
          momentumAnimationRef.current = null;
        }

        // Track drag start
        trackWheelDragStart();
      }
    },
    [canDrag]
  );

  // RAF-throttled drag update for better performance
  const performDragUpdate = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDragging || !canvasRef.current || lastDragAngle === null) return;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const { x, y } = getCanvasCoordinates(canvas, clientX, clientY);

      const currentAngle = getAngleFromPoint(centerX, centerY, x, y);
      const angleDiff = normalizeAngleDifference(currentAngle - lastDragAngle);

      // Calculate velocity for momentum
      const currentTime = Date.now();
      const timeDiff = currentTime - lastDragTime;
      if (timeDiff > 0) {
        setDragVelocity((angleDiff / timeDiff) * 1000); // radians per second
      }

      setRotation((prev) => prev + angleDiff);
      setLastDragAngle(currentAngle);
      setLastDragTime(currentTime);
    },
    [isDragging, lastDragAngle, lastDragTime]
  );

  const updateDrag = useCallback(
    (clientX: number, clientY: number) => {
      // Store the latest coordinates
      pendingDragUpdate.current = { clientX, clientY };

      // Only schedule a new RAF if one isn't already pending
      if (dragUpdateRef.current === null) {
        dragUpdateRef.current = requestAnimationFrame(() => {
          if (pendingDragUpdate.current) {
            const { clientX: x, clientY: y } = pendingDragUpdate.current;
            performDragUpdate(x, y);
            pendingDragUpdate.current = null;
          }
          dragUpdateRef.current = null;
        });
      }
    },
    [performDragUpdate]
  );

  const endDrag = useCallback(() => {
    if (!isDragging) return;

    // Cancel any pending drag updates
    if (dragUpdateRef.current !== null) {
      cancelAnimationFrame(dragUpdateRef.current);
      dragUpdateRef.current = null;
    }
    pendingDragUpdate.current = null;

    setIsDragging(false);
    setLastDragAngle(null);

    // Track drag end with velocity
    trackWheelDragEnd(dragVelocity);

    const speed = Math.abs(dragVelocity);

    // A real flick starts a real spin, in the direction of the flick.
    if (speed >= FLICK_THRESHOLD && !showBlank) {
      const flickPower = Math.min(
        1,
        Math.max(0.2, (speed - FLICK_THRESHOLD) / (FLICK_MAX_VELOCITY - FLICK_THRESHOLD))
      );
      setDragVelocity(0);
      // A locked slider is an explicit choice; otherwise power comes from how hard they flicked
      spin(speedLocked ? undefined : flickPower, dragVelocity > 0 ? 1 : -1);
      return;
    }

    // Gentle release: coast to a stop without picking a winner
    if (speed > 0.5) {
      let currentVelocity = dragVelocity;
      const friction = 0.95; // Friction coefficient
      let prev = performance.now();

      const animateMomentum = (now: number) => {
        const dt = (now - prev) / 1000; // Delta time in seconds
        prev = now;
        currentVelocity *= Math.pow(friction, dt * 60); // Normalized to 60fps equivalent

        // Continue if velocity is significant
        if (Math.abs(currentVelocity) > 0.01 && canDrag) {
          setRotation((r) => r + currentVelocity * dt);
          momentumAnimationRef.current = requestAnimationFrame(animateMomentum);
        } else {
          momentumAnimationRef.current = null;
          setDragVelocity(0);
        }
      };

      momentumAnimationRef.current = requestAnimationFrame(animateMomentum);
    }
  }, [isDragging, dragVelocity, canDrag, showBlank, speedLocked, spin]);

  // Mouse event handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startDrag(e.clientX, e.clientY);
    },
    [startDrag]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        updateDrag(e.clientX, e.clientY);
      }
    },
    [isDragging, updateDrag]
  );

  const handleMouseUp = useCallback(() => {
    endDrag();
  }, [endDrag]);

  // Touch event handlers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        startDrag(touch.clientX, touch.clientY);
      }
    },
    [startDrag]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        updateDrag(touch.clientX, touch.clientY);
      }
    },
    [updateDrag]
  );

  const handleTouchEnd = useCallback(() => {
    endDrag();
  }, [endDrag]);

  // Global mouse event handlers for smooth dragging
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        updateDrag(e.clientX, e.clientY);
      };

      const handleGlobalMouseUp = () => {
        endDrag();
      };

      document.addEventListener("mousemove", handleGlobalMouseMove);
      document.addEventListener("mouseup", handleGlobalMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleGlobalMouseMove);
        document.removeEventListener("mouseup", handleGlobalMouseUp);
      };
    }
  }, [isDragging, updateDrag, endDrag]);

  // Cancel drag when entering restricted states
  useEffect(() => {
    if (!canDrag && isDragging) {
      setIsDragging(false);
      setLastDragAngle(null);
      setDragVelocity(0);
      if (momentumAnimationRef.current) {
        cancelAnimationFrame(momentumAnimationRef.current);
        momentumAnimationRef.current = null;
      }
    }
  }, [canDrag, isDragging]);

  /** ========= Winner acknowledgement (Close / backdrop / Escape / Respin / Remove) ========= */
  const acknowledgeWinner = useCallback(
    (method: "button" | "backdrop" | "x" | "remove") => {
      recordWinnerInHistory();
      setShowWinnerModal(false);
      setWinnerRhyme("");
      trackWinnerAcknowledged(method);
      if (onUpdateSpinAcknowledgment && currentSpinId) {
        onUpdateSpinAcknowledgment(currentSpinId, method);
      }
    },
    [recordWinnerInHistory, currentSpinId, onUpdateSpinAcknowledgment]
  );

  // Escape dismisses popups, then the winner modal
  useEffect(() => {
    if (!showWinnerModal && !showFairnessPopup && !showHistoryPopup) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showFairnessPopup) {
        setShowFairnessPopup(false);
      } else if (showHistoryPopup) {
        setShowHistoryPopup(false);
      } else if (showWinnerModal) {
        acknowledgeWinner("x");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showWinnerModal, showFairnessPopup, showHistoryPopup, acknowledgeWinner]);

  const spinDisabled = isSpinning || showBlank || controlsDisabled;
  const resetDisabled = isSpinning || controlsDisabled;

  /** ========= UI ========= */
  return (
    <div
      ref={rootRef}
      className="flex flex-col items-center w-full h-full justify-center"
      role="application"
      aria-label="Spinning wheel"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !spinDisabled) {
          // Don't hijack Space/Enter when the user is on the slider or a button
          const target = e.target as HTMLElement;
          if (target.tagName === "INPUT" || target.tagName === "BUTTON") return;
          e.preventDefault();
          setAriaAnnouncement("Activating spin with keyboard");
          spin();
        }
      }}
      onFocus={() => {
        if (!showBlank) {
          setAriaAnnouncement(
            `Spinning wheel ready with ${wheelNames.length} options. Press Space or Enter to spin.`
          );
        }
      }}
    >
      <div aria-live="polite" className="sr-only">
        {ariaAnnouncement}
      </div>

      {/* Wheel - Centered */}
      <div className="flex flex-col items-center justify-center flex-1 min-h-0 w-full">
        <div
          ref={wheelWrapRef}
          className="relative flex items-center justify-center"
        >
        <canvas
          ref={canvasRef}
          className="rounded-full shadow-xl border border-white/30"
          style={{
            width: canvasCSSSize,
            height: canvasCSSSize,
            willChange: "transform",
            cursor: canDrag ? (isDragging ? "grabbing" : "grab") : "default",
            touchAction: "none", // Prevent touch scroll stealing drags
            // Remove problematic iOS 16 properties and respect motion preferences
            ...(isIOS16
              ? {}
              : {
                  transform: "translateZ(0)", // Hardware acceleration
                  willChange: prefersReducedMotion ? "auto" : "transform", // Hint browser for optimization, but respect motion preferences
                }),
            // Firefox-specific optimizations
            ...(isFirefox
              ? {
                  imageRendering: "auto",
                  WebkitBackfaceVisibility: "hidden",
                  backfaceVisibility: "hidden",
                  // Enhanced performance for Firefox
                  contain: "layout style paint",
                }
              : {}),
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
        </div>
      </div>

      {/* Spin Power - drifts on its own; drag it to lock a speed */}
      <div
        ref={speedRef}
        className="mt-3 mb-2 w-full max-w-[min(85vw,500px)] flex-shrink-0"
        style={{ minHeight: '40px' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/80 whitespace-nowrap flex-shrink-0">Slow</span>
          <div className="relative flex-1 h-4 bg-gradient-to-r from-blue-400 via-yellow-400 to-red-500 rounded-full shadow-inner">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(speedIndicator * 100)}
              disabled={isSpinning}
              aria-label="Spin power"
              aria-valuetext={`${Math.round(speedIndicator * 100)}% power${speedLocked ? ", locked" : ", drifting"}`}
              title={speedLocked ? "Spin power (locked)" : "Drag to set spin power"}
              onChange={(e) => {
                setSpeedIndicator(Number(e.target.value) / 100);
                setSpeedLocked(true);
              }}
              className="speed-slider absolute inset-0 w-full h-full m-0"
            />
          </div>
          <span className="text-[10px] text-white/80 whitespace-nowrap flex-shrink-0">Fast</span>
          <button
            type="button"
            onClick={() => setSpeedLocked(false)}
            aria-hidden={!speedLocked}
            tabIndex={speedLocked ? 0 : -1}
            className={`text-[9px] text-white/60 hover:text-white underline whitespace-nowrap flex-shrink-0 transition-opacity ${
              speedLocked && !isSpinning ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            style={{ touchAction: "manipulation" }}
          >
            auto
          </button>
        </div>
      </div>

      {/* Controls — width locked to wheel, wrap when needed */}
      <div
        ref={controlsRef}
        className="flex flex-wrap justify-center items-center mx-auto mb-4 sm:mb-6 relative z-[60] flex-shrink-0"
        style={{
          width: `max(${canvasCSSSize}px, 200px)`,
          maxWidth: isFirefox ? "600px" : "95vw",
          // Add safe area padding for iOS to prevent button cutoff
          paddingBottom: isIOS ? 'max(1rem, env(safe-area-inset-bottom))' : undefined,
          // iOS 16 layout fixes
          ...(isIOS16
            ? {
                display: "-webkit-box",
                WebkitBoxPack: "center",
                WebkitBoxAlign: "center",
                WebkitBoxOrient: "horizontal",
              }
            : {}),
          // Firefox-specific layout improvements
          ...(isFirefox
            ? {
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                alignItems: "center",
              }
            : {}),
        }}
      >
        <button
          onClick={() => spin()}
          disabled={spinDisabled}
          className={`
            ${
              isFirefox
                ? "px-4 py-3 text-base min-w-[140px] max-w-[200px] mr-3"
                : "px-[clamp(16px,3vw,22px)] py-[clamp(12px,2.5vw,14px)] text-[clamp(16px,2.2vw,18px)] min-w-[clamp(120px,28vw,156px)] mr-3"
            }
            font-bold text-white rounded-lg shadow-lg transition-all
            ${
              spinDisabled
                ? "bg-green-500"
                : "bg-green-500 hover:bg-green-600 hover:scale-[1.02] active:scale-95 cursor-pointer"
            }
          `}
          style={{
            touchAction: "manipulation",
            opacity: spinDisabled ? "0.5" : "1",
            pointerEvents: spinDisabled ? "none" : "auto",
            // iOS opacity fixes
            ...(isIOS && spinDisabled
              ? {
                  WebkitOpacity: "0.5",
                  filter: "opacity(0.5)",
                  backgroundColor: "rgba(34, 197, 94, 0.5)",
                }
              : {}),
            // iOS 16 button fixes
            ...(isIOS16
              ? {
                  WebkitAppearance: "none",
                  border: "none",
                  outline: "none",
                }
              : {}),
          }}
        >
          {isSpinning ? "Spinning..." : "SPIN!"}
        </button>

        {onReset && (
          <button
            onClick={() => {
              // Reset just closes any open modal and hands control back to the parent
              setShowWinnerModal(false);
              setWinnerRhyme("");
              setSelectedName(""); // Clear selected name
              onReset();
            }}
            disabled={resetDisabled}
            className={`
              ${
                isFirefox
                  ? "px-3 py-3 text-sm min-w-[90px] max-w-[140px]"
                  : "px-[clamp(14px,2.5vw,18px)] py-[clamp(10px,2vw,12px)] text-[clamp(13px,1.8vw,14px)] min-w-[clamp(85px,20vw,110px)]"
              }
              font-bold text-white rounded-lg shadow-lg
              transition-all hover:scale-[1.02] active:scale-95
              ${
                resetDisabled
                  ? "bg-blue-500"
                  : "bg-blue-500 hover:bg-blue-600 cursor-pointer"
              }
            `}
            style={{
              touchAction: "manipulation",
              opacity: resetDisabled ? "0.5" : "1",
              pointerEvents: resetDisabled ? "none" : "auto",
              // iOS opacity fixes
              ...(isIOS && resetDisabled
                ? {
                    WebkitOpacity: "0.5",
                    filter: "opacity(0.5)",
                    backgroundColor: "rgba(59, 130, 246, 0.5)",
                  }
                : {}),
              // iOS 16 button fixes
              ...(isIOS16
                ? {
                    WebkitAppearance: "none",
                    border: "none",
                    outline: "none",
                  }
                : {}),
            }}
          >
            {showBlank ? "Add names" : "Reset"}
          </button>
        )}
      </div>

      {/* Winner Modal */}
      {showWinnerModal && selectedName && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[65] pointer-events-auto p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => {
            // Close modal when clicking backdrop
            if (e.target === e.currentTarget) {
              acknowledgeWinner("backdrop");
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="winner-name"
            className="relative bg-white rounded-2xl px-6 pb-6 pt-12 sm:px-8 sm:pb-8 sm:pt-12 transform scale-100 animate-bounce-in pointer-events-auto text-center max-w-[90vw] w-full max-w-md"
            style={{
              boxShadow:
                "0 0 40px rgba(0, 0, 0, 0.3), 0 0 80px rgba(0, 0, 0, 0.15)",
            }}
            onClick={(e) => {
              // Prevent modal from closing when clicking inside the modal content
              e.stopPropagation();
            }}
          >
            <button
              onClick={() => acknowledgeWinner("x")}
              className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all duration-200 cursor-pointer"
              aria-label="Close"
              style={{ touchAction: "manipulation" }}
              autoFocus
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="text-lg sm:text-xl font-semibold text-gray-500 mb-2 leading-tight">
              {winnerRhyme}
            </h2>
            <p
              id="winner-name"
              className={`font-bold text-green-600 mb-2 leading-tight break-words ${
                selectedName.length > 15
                  ? "text-3xl sm:text-4xl"
                  : selectedName.length > 10
                  ? "text-4xl sm:text-5xl"
                  : "text-5xl sm:text-6xl"
              }`}
              style={{
                wordBreak: "break-word",
                overflowWrap: "break-word",
                hyphens: "auto",
              }}
            >
              {selectedName}
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => {
                  acknowledgeWinner("button");
                  // Automatically spin again
                  setTimeout(() => {
                    spin();
                  }, 100);
                }}
                className="w-full px-6 py-3 bg-green-500 text-white text-lg font-bold rounded-lg hover:bg-green-600 transition-colors cursor-pointer"
                style={{ touchAction: "manipulation" }}
              >
                Spin again
              </button>

              {wheelNames.length > 2 && onRemoveWinner && (
                <button
                  onClick={async () => {
                    // Remove the winner from the wheel
                    const newNames = wheelNames.filter(name => name !== selectedName);
                    acknowledgeWinner("remove");

                    // Create new configuration with remaining names
                    await onRemoveWinner(newNames);
                  }}
                  className="w-full px-6 py-2.5 rounded-lg border-2 border-red-200 text-red-600 font-semibold hover:bg-red-50 hover:border-red-300 transition-colors cursor-pointer truncate"
                  style={{ touchAction: "manipulation" }}
                  title={`Remove ${selectedName} from the wheel`}
                >
                  Remove {selectedName}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Winner history popup */}
      {showHistoryPopup && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[70] pointer-events-auto backdrop-blur-sm bg-black/20 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowHistoryPopup(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-title"
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center relative"
          >
            <button
              onClick={() => setShowHistoryPopup(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
              aria-label="Close"
              style={{ touchAction: "manipulation" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 id="history-title" className="text-lg font-semibold text-gray-900 mb-1">
              Winners
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {winnerHistory.length === 0
                ? "No spins yet"
                : `${winnerHistory.length} ${winnerHistory.length === 1 ? "spin" : "spins"} so far, newest first`}
            </p>

            {winnerHistory.length > 0 && (
              <ol className="max-h-[50vh] overflow-y-auto text-left divide-y divide-gray-100 rounded-lg border border-gray-100 mb-4">
                {[...winnerHistory].reverse().map((winner, i) => {
                  const spinNumber = winnerHistory.length - i;
                  return (
                    <li key={`${spinNumber}-${winner}`} className="flex items-center gap-3 px-3 py-2">
                      <span className="w-6 text-right text-xs text-gray-400 tabular-nums">{spinNumber}</span>
                      <span className={`flex-1 truncate ${i === 0 ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                        {winner}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="flex gap-3">
              {winnerHistory.length > 0 && (
                <button
                  onClick={() => setWinnerHistory([])}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
                  style={{ touchAction: "manipulation" }}
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setShowHistoryPopup(false)}
                className="flex-1 px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors cursor-pointer"
                style={{ touchAction: "manipulation" }}
                autoFocus
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fairness Popup */}
      {showFairnessPopup && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[70] pointer-events-auto backdrop-blur-sm bg-black/20"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowFairnessPopup(false);
          }}
        >
          <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl p-6 max-w-lg w-full mx-4 text-center relative border border-gray-700">
            <button
              onClick={() => setShowFairnessPopup(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-700 rounded-full transition-all duration-200"
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <div className="flex items-center justify-center mb-4">
              <div className="relative">
                <div className="absolute inset-0 animate-pulse bg-green-500/20 rounded-full blur-xl"></div>
                <svg
                  className="w-12 h-12 text-green-400 relative"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white ml-3">
                Fairness Verification
              </h2>
            </div>

            <div className="text-left space-y-3 text-sm">
              <div className="bg-gradient-to-r from-green-500/10 to-green-600/10 border border-green-500/30 p-3 rounded-lg">
                <div className="flex items-center mb-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
                  <strong className="text-green-400 uppercase text-xs tracking-wider">
                    Cryptographically Secure Randomness
                  </strong>
                </div>
                <p className="text-gray-300 text-xs leading-relaxed">
                  Powered by crypto.getRandomValues() - military-grade
                  randomness used by banks, cryptocurrency, and security systems
                  worldwide.
                </p>
              </div>

              <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 border border-blue-500/30 p-3 rounded-lg">
                <div className="flex items-center mb-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse mr-2"></div>
                  <strong className="text-blue-400 uppercase text-xs tracking-wider">
                    Technical Stack
                  </strong>
                </div>
                <div className="space-y-2">
                  <div className="flex items-start">
                    <span className="text-blue-300 mr-2">▸</span>
                    <p className="text-gray-300 text-xs">
                      <span className="text-blue-300 font-mono">CSPRNG:</span>{" "}
                      Hardware entropy from OS kernel
                    </p>
                  </div>
                  <div className="flex items-start">
                    <span className="text-blue-300 mr-2">▸</span>
                    <p className="text-gray-300 text-xs">
                      <span className="text-blue-300 font-mono">Spin power:</span>{" "}
                      Only changes how long the wheel turns, never where it lands
                    </p>
                  </div>
                  <div className="flex items-start">
                    <span className="text-blue-300 mr-2">▸</span>
                    <p className="text-gray-300 text-xs">
                      <span className="text-blue-300 font-mono">
                        RNG Quality:
                      </span>{" "}
                      32+ bits true randomness used
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-500/10 to-purple-600/10 border border-purple-500/30 p-3 rounded-lg">
                <div className="flex items-center mb-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse mr-2"></div>
                  <strong className="text-purple-400 uppercase text-xs tracking-wider">
                    Live Statistics
                  </strong>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-black/30 rounded p-2">
                    <p className="text-purple-300 font-mono text-[10px]">
                      SEGMENTS
                    </p>
                    <p className="text-white font-bold">{wheelNames.length}</p>
                  </div>
                  <div className="bg-black/30 rounded p-2">
                    <p className="text-purple-300 font-mono text-[10px]">
                      OUTCOME BITS
                    </p>
                    <p className="text-white font-bold">
                      {Math.ceil(Math.log2(wheelNames.length))}
                    </p>
                  </div>
                  <div className="bg-black/30 rounded p-2">
                    <p className="text-purple-300 font-mono text-[10px]">
                      NAME ODDS
                    </p>
                    <p className="text-white font-bold">
                      {((1 / wheelNames.length) * 100).toFixed(2)}%
                    </p>
                  </div>
                  <div className="bg-black/30 rounded p-2">
                    <p className="text-purple-300 font-mono text-[10px]">
                      SPINS THIS SESSION
                    </p>
                    <p className="text-white font-bold">{winnerHistory.length}</p>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowFairnessPopup(false)}
              className="mt-4 px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 font-semibold"
              style={{ touchAction: "manipulation" }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Mute toggle - small, bottom-left */}
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Unmute wheel sounds" : "Mute wheel sounds"}
        aria-pressed={muted}
        title={muted ? "Sound off" : "Sound on"}
        className="fixed z-[45] w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 text-white/90 backdrop-blur-sm border border-white/20 flex items-center justify-center transition-colors cursor-pointer"
        style={{
          left: "max(0.75rem, env(safe-area-inset-left))",
          bottom: "max(0.75rem, env(safe-area-inset-bottom))",
          touchAction: "manipulation",
        }}
      >
        {muted ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H3v6h3l5 4V5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M22 9l-6 6m0-6l6 6" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H3v6h3l5 4V5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />
          </svg>
        )}
      </button>

      {/* Footer - Compact single line */}
      <div ref={footerRef} className="w-full text-center flex-shrink-0 pb-8 sm:pb-4" style={{
        minHeight: '40px',
        paddingBottom: isIOS ? 'max(2.5rem, calc(1.5rem + env(safe-area-inset-bottom)))' : undefined
      }}>
        <div ref={footerContentRef} className="flex flex-col items-center gap-0.5">
          {/* Fairness stats in one line */}
          {fairnessText && (
            <div className="text-[9px] sm:text-[10px] text-white/60">
              {fairnessText}
            </div>
          )}
          {/* Last winner, history and fairness links */}
          <div className="flex items-center gap-2 text-[9px] sm:text-[10px] text-white/70">
            <span className="whitespace-nowrap">
              Last: {winnerHistory.length > 0 ? (
                <span className="text-white font-semibold">
                  {winnerHistory[winnerHistory.length - 1]}
                </span>
              ) : (
                <span className="text-white/40">—</span>
              )}
            </span>
            <span className="text-white/40">•</span>
            <button
              onClick={() => setShowHistoryPopup(true)}
              aria-label={`Spin history, ${winnerHistory.length} ${winnerHistory.length === 1 ? "spin" : "spins"}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 -my-1 rounded-full bg-white/15 hover:bg-white/30 border border-white/25 text-white text-[11px] sm:text-xs font-medium transition-colors cursor-pointer"
              style={{ touchAction: "manipulation", minHeight: 28 }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              history{winnerHistory.length > 0 ? ` (${winnerHistory.length})` : ""}
            </button>
            <span className="text-white/40">•</span>
            <button
              onClick={() => {
                setShowFairnessPopup(true);
                trackFairnessChecked();
              }}
              className="text-white/70 hover:text-white underline"
              style={{ touchAction: "manipulation" }}
            >
              fairness
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpinningWheel;
