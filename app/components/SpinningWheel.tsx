"use client";

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useLayoutEffect,
} from "react";

/** ========= CRYPTO RNG (minimal + reliable) ========= */
const cryptoRandom = (): number => {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const u32 = new Uint32Array(1);
    window.crypto.getRandomValues(u32);
    return u32[0] / 4294967296; // [0,1)
  }
  return Math.random();
};

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

interface SpinningWheelProps {
  names?: string[];
  onReset?: () => void;
  includeFreeSpins?: boolean;
  showBlank?: boolean;
}

const SpinningWheel: React.FC<SpinningWheelProps> = ({
  names,
  onReset,
  includeFreeSpins = true,
  showBlank = false,
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
  const [canvasCSSSize, setCanvasCSSSize] = useState(400);
  const [speedIndicator, setSpeedIndicator] = useState(0.5);
  const [showFairnessPopup, setShowFairnessPopup] = useState(false);
  const [fairnessText, setFairnessText] = useState("");
  const [lockedSpeed, setLockedSpeed] = useState<number | null>(null);
  const [winnerHistory, setWinnerHistory] = useState<string[]>([]);
  const [isIOS16, setIsIOS16] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isFirefox, setIsFirefox] = useState(false);
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

  // Segment gradient caches for performance
  const segmentGradientsCache = useRef<Map<string, CanvasGradient>>(new Map());
  const lastWheelConfig = useRef<string>("");

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

      // No longer need tada buffer generation since we're using MP3 file
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


  /** ========= Names + RESPIN placement ========= */
  const wheelNames = useMemo(() => {
    // If showing blank state, use empty placeholder names
    if (showBlank) {
      const placeholderCount = 8;
      return Array(placeholderCount).fill("");
    }

    const base =
      names && names.length
        ? names
        : ["Name 1", "Name 2", "Name 3", "Name 4", "Name 5", "Name 6"];

    if (!includeFreeSpins) {
      return base;
    }

    const totalSlots = base.length + 2;
    const mid = Math.floor(totalSlots / 2);
    const result = [...base];
    result.splice(0, 0, "RESPIN");
    result.splice(mid, 0, "RESPIN");
    return result;
  }, [names, includeFreeSpins, showBlank]);

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
      wheelNames.every(
        (name) => name !== "RESPIN" && name !== "" && /^\d+$/.test(name)
      );

    const fontSize = getSimpleFontSize(wheelNames.length, isNumbers);

    // Simple truncation based on segment count
    const maxLength =
      wheelNames.length <= 10 ? 20 : wheelNames.length <= 20 ? 15 : 12;

    const displayTexts = wheelNames.map((name) => {
      if (name === "RESPIN" || name === "") return name;
      return simpleTextTruncate(name, maxLength);
    });

    return { fontSize, displayTexts };
  }, [wheelNames, showBlank]);

  /** ========= Fairness text ========= */
  useEffect(() => {
    if (showBlank) {
      setFairnessText("");
      setWinnerHistory([]); // Clear winner history when resetting
      return;
    }

    const total = wheelNames.length;
    const respinCount = wheelNames.filter((n) => n === "RESPIN").length;

    if (!includeFreeSpins || respinCount === 0) {
      setFairnessText(`Each name ${((1 / total) * 100).toFixed(2)}% chance`);
    } else {
      setFairnessText(
        `Each name ${((1 / total) * 100).toFixed(2)}% chance, Free Spin ${(
          (respinCount / total) *
          100
        ).toFixed(2)}% chance`
      );
    }
  }, [wheelNames, includeFreeSpins, showBlank]);

  /** ========= Idle speed indicator with RAF for smooth animation ========= */
  useEffect(() => {
    if (!isSpinning) {
      let animationId: number;
      let lastTime = 0;

      const animate = (currentTime: number) => {
        // Adaptive frame rate based on device capability
        // High capability: 8.33ms (120fps), Medium/Low: 16.67ms (60fps)
        const throttleMs = deviceCapability === "high" ? 8.33 : 16.67;

        if (currentTime - lastTime >= throttleMs) {
          const t = currentTime / 1000;
          setSpeedIndicator((Math.sin(t * 1.5) + 1) / 2);
          lastTime = currentTime;
        }
        animationId = requestAnimationFrame(animate);
      };

      animationId = requestAnimationFrame(animate);

      return () => {
        cancelAnimationFrame(animationId);
      };
    }
  }, [isSpinning, deviceCapability]);

  /** ========= Responsive sizing with ResizeObserver ========= */
  const recomputeSize = useCallback(() => {
    if (typeof window === "undefined") return;

    const vw = window.innerWidth;
    // Enhanced viewport height calculation with Firefox support
    let vh: number;

    if (isFirefox) {
      // Try Firefox-specific viewport first, then fallback
      const firefoxVh =
        parseInt(
          getComputedStyle(document.documentElement)
            .getPropertyValue("--firefox-vh")
            .replace("px", "")
        ) * 100;
      const visualVh =
        parseInt(
          getComputedStyle(document.documentElement)
            .getPropertyValue("--visual-vh")
            .replace("px", "")
        ) * 100;
      const standardVh =
        parseInt(
          getComputedStyle(document.documentElement)
            .getPropertyValue("--vh")
            .replace("px", "")
        ) * 100;

      vh = firefoxVh || visualVh || standardVh || window.innerHeight;
    } else {
      // Use standard dynamic viewport height for non-Firefox browsers
      vh =
        parseInt(
          getComputedStyle(document.documentElement)
            .getPropertyValue("--vh")
            .replace("px", "")
        ) * 100 || window.innerHeight;
    }

    // Conservative fallbacks so first pass doesn't oversize the wheel:
    const speedH = Math.max(speedRef.current?.offsetHeight ?? 0, 72);
    const controlsH = Math.max(controlsRef.current?.offsetHeight ?? 0, 88);
    // Increased footer fallback to account for dynamic content (fairness text + last winner)
    const footerH = Math.max(footerRef.current?.offsetHeight ?? 0, 80);

    const buffers = 32;

    // Available area for the wheel
    const availableH = Math.max(0, vh - speedH - controlsH - footerH - buffers);
    const sidePadding = vw < 768 ? 24 : 96;
    const availableW = Math.max(0, vw - sidePadding);

    let target = Math.min(availableW, availableH);

    // Desktop guard: allow slightly bigger wheel on XL screens
    const vhCap = Math.floor(
      vh * (vw >= 1280 ? 0.62 : vw >= 1024 ? 0.58 : 0.62)
    );
    target = Math.min(target, vhCap);

    // Global clamps - keep consistent sizes
    // Reduce size when showing blank wheel with modal overlay
    const minSize = showBlank ? 250 : 280;
    const maxSize = showBlank ? 450 : 600; // Smaller max for blank state
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
    const segmentCache = segmentGradientsCache.current;
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
      segmentCache.clear();

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
    // Defer audio initialization to reduce initial load
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
    }, 100); // Defer by 100ms

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
      const isFirefox = /Firefox/.test(userAgent);

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
      setIsFirefox(isFirefox);
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

    // Start momentum animation if there's significant velocity
    if (Math.abs(dragVelocity) > 0.5) {
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
  }, [isDragging, dragVelocity, canDrag]);

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
      e.preventDefault();
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        startDrag(touch.clientX, touch.clientY);
      }
    },
    [startDrag]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        updateDrag(touch.clientX, touch.clientY);
      }
    },
    [updateDrag]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      endDrag();
    },
    [endDrag]
  );

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

  /** ========= Draw wheel (HiDPI, labels, pointer) ========= */
  const colors = useMemo(
    () => [
      "#f54d4dff",
      "#205cbdff",
      "#45B7D1",
      "#54cb94ff",
      "#FECA57",
      "#c810c8ff",
      "#FF6B9D",
      "#bea412ff",
    ],
    []
  );

  // Cached gradient creation for performance
  const getCachedGradient = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      type: string,
      segmentIndex: number,
      centerX: number,
      centerY: number,
      radius: number,
      midAngle: number,
      color?: string
    ): CanvasGradient => {
      const cacheKey = `${type}-${segmentIndex}-${centerX}-${centerY}-${radius}-${
        color || ""
      }`;
      const cache = segmentGradientsCache.current;

      if (cache.has(cacheKey)) {
        return cache.get(cacheKey)!;
      }

      let gradient: CanvasGradient;

      if (type === "blank") {
        gradient = ctx.createRadialGradient(
          centerX + Math.cos(midAngle) * radius * 0.5,
          centerY + Math.sin(midAngle) * radius * 0.5,
          0,
          centerX,
          centerY,
          radius
        );
        const cleanColor = color!.slice(0, 7);
        gradient.addColorStop(0, cleanColor + "33");
        gradient.addColorStop(0.85, cleanColor + "22");
        gradient.addColorStop(1, cleanColor + "11");
      } else if (type === "respin") {
        gradient = ctx.createRadialGradient(
          centerX + Math.cos(midAngle) * radius * 0.5,
          centerY + Math.sin(midAngle) * radius * 0.5,
          0,
          centerX,
          centerY,
          radius
        );
        gradient.addColorStop(0, "#2a2a2a");
        gradient.addColorStop(0.7, "#0f0f0f");
        gradient.addColorStop(1, "#000000");
      } else {
        // regular segment
        gradient = ctx.createRadialGradient(
          centerX + Math.cos(midAngle) * radius * 0.5,
          centerY + Math.sin(midAngle) * radius * 0.5,
          0,
          centerX,
          centerY,
          radius
        );
        const cleanColor = color!.slice(0, 7);
        gradient.addColorStop(0, cleanColor);
        gradient.addColorStop(0.85, cleanColor + "dd");
        gradient.addColorStop(1, cleanColor + "99");
      }

      cache.set(cacheKey, gradient);
      return gradient;
    },
    []
  );

  // Clear gradient cache when wheel configuration changes
  const clearGradientCache = useCallback(() => {
    segmentGradientsCache.current.clear();
  }, []);

  // Draw wheel segments with performance-aware rendering
  const drawWheelSegments = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!wheelGeometry) return;

      const { centerX, centerY, radius, sliceAngle } = wheelGeometry;
      const { fontSize, displayTexts } = textInfo;

      // Performance optimizations based on segment count
      const useSimplifiedGradients = performanceMode === "performance";
      const skipInnerGlow = performanceMode === "performance";
      const reducedShadows = performanceMode !== "optimal";

      // Draw wheel segments
      wheelNames.forEach((name, i) => {
        const start = i * sliceAngle;
        const end = (i + 1) * sliceAngle;
        const midAngle = start + sliceAngle / 2;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, start, end);
        ctx.closePath();

        if (showBlank) {
          // Use simplified or cached gradient for blank segments
          if (useSimplifiedGradients) {
            const baseColor = colors[i % colors.length];
            const cleanColor = baseColor.slice(0, 7);
            ctx.fillStyle = cleanColor + "33";
          } else {
            const baseColor = colors[i % colors.length];
            const g = getCachedGradient(
              ctx,
              "blank",
              i,
              centerX,
              centerY,
              radius,
              midAngle,
              baseColor
            );
            ctx.fillStyle = g;
          }
          ctx.fill();

          // Lighter border for blank state
          ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
          ctx.lineWidth = 1;
          ctx.stroke();
        } else if (name === "RESPIN") {
          // Use simplified or cached gradient for RESPIN
          if (useSimplifiedGradients) {
            ctx.fillStyle = "#1a1a1a";
          } else {
            const g = getCachedGradient(
              ctx,
              "respin",
              i,
              centerX,
              centerY,
              radius,
              midAngle
            );
            ctx.fillStyle = g;
          }
          ctx.fill();

          // Standard white border to match other segments
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.stroke();

          // Save and clip to segment for inner golden border
          ctx.save();
          ctx.clip();

          // Draw golden inner border (closer to edge to avoid gap)
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.arc(centerX, centerY, radius - 2, start, end);
          ctx.closePath();
          ctx.strokeStyle = "#ffd700";
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.restore();
        } else {
          // Use simplified or cached gradient for regular segments
          if (useSimplifiedGradients) {
            const baseColor = colors[i % colors.length];
            const cleanColor = baseColor.slice(0, 7);
            ctx.fillStyle = cleanColor;
          } else {
            const baseColor = colors[i % colors.length];
            const g = getCachedGradient(
              ctx,
              "regular",
              i,
              centerX,
              centerY,
              radius,
              midAngle,
              baseColor
            );
            ctx.fillStyle = g;
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
        }

        // Labels (skip for blank segments)
        if (!showBlank) {
          ctx.save();
          ctx.translate(centerX, centerY);
          ctx.rotate(start + sliceAngle / 2);
          ctx.textAlign = "right";

          if (name === "RESPIN") {
            const text = "FREE SPIN";
            const fs = Math.max(8, fontSize - 2); // Slightly smaller than regular text

            ctx.font = `bold ${fs}px Arial`;
            ctx.strokeStyle = "#000";
            ctx.lineWidth = Math.max(1, fs / 8);
            const paddingFromEdge = 15;
            ctx.strokeText(text, radius - paddingFromEdge, fs / 3);
            ctx.fillStyle = "#ffff00";
            ctx.fillText(text, radius - paddingFromEdge, fs / 3);
          } else {
            // Use simple pre-calculated font size and display text
            const displayText = displayTexts[i] || name;
            const fs = fontSize;

            ctx.fillStyle = "#fff";
            ctx.font = `bold ${fs}px Arial`;

            // Apply shadows only in optimal mode for performance
            if (!reducedShadows) {
              ctx.shadowColor = "rgba(0,0,0,0.7)";
              ctx.shadowBlur = Math.max(2, fs / 4);
              ctx.shadowOffsetX = 1;
              ctx.shadowOffsetY = 1;
            }

            // Position text consistently from edge, regardless of length
            const paddingFromEdge = 15; // Consistent padding from wheel edge
            ctx.fillText(displayText, radius - paddingFromEdge, fs / 3);

            // Reset shadow properties to prevent context pollution
            if (!reducedShadows) {
              ctx.shadowColor = "transparent";
              ctx.shadowBlur = 0;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 0;
            }
          }
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
      colors,
      showBlank,
      getCachedGradient,
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

  /** ========= Gradient Cache Management ========= */
  useEffect(() => {
    // Clear gradient cache when wheel configuration changes
    const currentConfig = `${wheelNames.join(
      "-"
    )}-${canvasCSSSize}-${colors.join("-")}-${showBlank}`;
    if (lastWheelConfig.current !== currentConfig) {
      clearGradientCache();
      lastWheelConfig.current = currentConfig;
    }
  }, [wheelNames, canvasCSSSize, colors, showBlank, clearGradientCache]);

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

  /** ========= Confetti ========= */
  const triggerConfetti = async () => {
    // Skip confetti entirely if user prefers reduced motion
    if (prefersReducedMotion) {
      return;
    }

    try {
      // Lazy-load canvas-confetti only when needed
      const { default: confetti } = await import("canvas-confetti");

      const baseCount = 100; // Reduced from 200 to 100 (50% less)
      // Scale particle count based on device capability
      let scaleFactor = 1.0;
      if (deviceCapability === "low") scaleFactor = 0.3;
      else if (deviceCapability === "medium") scaleFactor = 0.6;
      else scaleFactor = 1.0; // high capability

      const count = baseCount * scaleFactor;

      const defaults = {
        origin: { y: 0.7 },
        zIndex: 9999,
        disableForReducedMotion: true, // Respect accessibility settings
        colors: ["#ffd700"], // Yellow/gold confetti
      };
      const fire = (r: number, o: Parameters<typeof confetti>[0]) =>
        confetti({ ...defaults, ...o, particleCount: Math.floor(count * r) });
      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1, { spread: 120, startVelocity: 45 });
    } catch (error) {
      // Gracefully handle failed confetti load
      console.warn("Failed to load confetti:", error);
    }
  };

  /** ========= Spin logic ========= */
  const winnerRhymes = [
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

  const spin = () => {
    if (isSpinning || showBlank) return;

    // If there's a current winner being shown, save it to history before spinning again
    if (showWinnerModal && selectedName && selectedName !== "RESPIN") {
      setWinnerHistory(prev => [...prev, selectedName]);
    }

    // Track wheel spin event
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "wheel_spin", {
        segments: wheelNames.length,
        spin_power: speedIndicator,
      });
    }

    setIsSpinning(true);
    setSelectedName("");
    setShowWinnerModal(false);
    setShowFairnessPopup(false);
    setLockedSpeed(speedIndicator);

    // Enhanced aria announcement for spin start
    setAriaAnnouncement(
      `Spinning wheel with ${wheelNames.length} options at ${Math.round(
        speedIndicator * 100
      )}% power`
    );

    const spinStrength = speedIndicator;
    const baseRotations = 2.5 + spinStrength * 5; // 2.5 to 7.5 rotations
    const spinDuration = 10000; // Fixed 10 second duration for all speeds

    // Simple random spin - let wheel land wherever it naturally stops
    const finalRotation = rotation + Math.PI * 2 * (baseRotations + cryptoRandom() * 2);

    const startTime = Date.now();
    let lastFrameTime = 0;
    const segmentSize = (2 * Math.PI) / wheelNames.length;
    let lastSegment = -1;

    const animate = () => {
      const now = Date.now();

      // Adaptive frame rate based on device capability
      // High capability: 8.33ms (120fps), Medium/Low: 16.67ms (60fps)
      const throttleMs = deviceCapability === "high" ? 8.33 : 16.67;

      if (now - lastFrameTime < throttleMs) {
        requestAnimationFrame(animate);
        return;
      }
      lastFrameTime = now;

      const elapsed = now - startTime;
      const progress = Math.min(elapsed / spinDuration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 4);

      const currentRotation = rotation + (finalRotation - rotation) * easeOut;
      setRotation(currentRotation);

      // Calculate which segment is currently under the pointer (using same logic as final result)
      const normalized =
        (2 * Math.PI - (currentRotation % (2 * Math.PI))) % (2 * Math.PI);
      const currentSegment = Math.floor(normalized / segmentSize);

      // Play click sound on every segment crossing with optimized audio system
      if (currentSegment !== lastSegment) {
        // Calculate speed-based volume (louder when faster)
        const speed = 1 - easeOut;
        const vol = Math.max(0.01, Math.min(0.08, 0.01 + speed * 0.07));

        playTickSound(vol).catch(() => {}); // Use pooled audio system
        lastSegment = currentSegment;
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsSpinning(false);
        setLockedSpeed(null);

        // Calculate winner based on where the wheel actually stopped
        const normalizedRotation = (2 * Math.PI - (finalRotation % (2 * Math.PI))) % (2 * Math.PI);
        const selectedIndex = Math.floor(normalizedRotation / segmentSize);
        const winner = wheelNames[selectedIndex % wheelNames.length];
        setSelectedName(winner);

        if (winner !== "RESPIN") {
          // Show winner modal IMMEDIATELY - this is what user sees
          const rhyme =
            winnerRhymes[Math.floor(cryptoRandom() * winnerRhymes.length)];
          setWinnerRhyme(rhyme);
          setShowWinnerModal(true);

          // Everything else happens asynchronously (non-blocking)
          setTimeout(() => {
            // Enhanced aria announcement for result
            setAriaAnnouncement(
              `Winner selected: ${winner}. The wheel has stopped spinning.`
            );

            // Track winner selection (async, non-blocking)
            if (typeof window !== "undefined" && window.gtag) {
              window.gtag("event", "wheel_result", {
                result: winner,
                segments: wheelNames.length,
                is_respin: false,
              });
            }

            // Trigger effects (async, non-blocking)
            triggerConfetti();
            // Removed winner audio - only show confetti
          }, 0);
        } else {
          // For RESPIN, just do aria announcement
          setTimeout(() => {
            setAriaAnnouncement(
              "Free spin! The wheel landed on a respin. You get another turn."
            );

            // Track respin selection (async, non-blocking)
            if (typeof window !== "undefined" && window.gtag) {
              window.gtag("event", "wheel_result", {
                result: winner,
                segments: wheelNames.length,
                is_respin: true,
              });
            }
          }, 0);
        }
      }
    };

    requestAnimationFrame(animate);
  };

  /** ========= UI ========= */
  return (
    <div
      ref={rootRef}
      className="flex flex-col items-center w-full h-full"
      role="application"
      aria-label="Spinning wheel"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !isSpinning && !showBlank) {
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
      {/* Spin Power (≈50% width on mobile, larger on bigger screens) */}
      <div
        ref={speedRef}
        className="mb-2 w-[min(45vw,300px)] sm:w-[min(60vw,360px)] lg:w-[400px]"
      >
        <div className="text-center mb-1 text-[clamp(10px,1.5vw,13px)] font-semibold text-white">
          Spin Power
        </div>
        <div className="relative h-6 bg-gradient-to-r from-blue-400 via-yellow-400 to-red-500 rounded-full overflow-hidden shadow-inner">
          <div
            className="absolute top-0 bottom-0 w-4 bg-white border-2 border-gray-800 rounded-full shadow-lg"
            style={{
              left: `${
                (lockedSpeed !== null ? lockedSpeed : speedIndicator) * 100
              }%`,
              transform: "translateX(-50%)",
            }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[clamp(10px,1.4vw,12px)] text-white">
          <span>Slow</span>
          <span>Fast</span>
        </div>
      </div>

      {/* Wheel */}
      <div
        ref={wheelWrapRef}
        className="relative flex items-center justify-center mb-8 flex-1 min-h-0 flex-col justify-center"
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

      {/* Controls — width locked to wheel, wrap when needed */}
      <div
        ref={controlsRef}
        className="flex flex-wrap justify-center items-center mx-auto mb-2 relative z-[60]"
        style={{
          width: `max(${canvasCSSSize}px, 200px)`,
          maxWidth: isFirefox ? "600px" : "95vw",
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
          onClick={spin}
          disabled={isSpinning || showBlank}
          className={`
            ${
              isFirefox
                ? "px-4 py-3 text-base min-w-[140px] max-w-[200px] mr-3"
                : "px-[clamp(16px,3vw,22px)] py-[clamp(12px,2.5vw,14px)] text-[clamp(16px,2.2vw,18px)] min-w-[clamp(120px,28vw,156px)] mr-3"
            }
            font-bold text-white rounded-lg shadow-lg transition-all
            ${
              isSpinning || showBlank
                ? "bg-green-500"
                : "bg-green-500 hover:bg-green-600 hover:scale-[1.02] active:scale-95 cursor-pointer"
            }
          `}
          style={{
            touchAction: "manipulation",
            opacity: isSpinning || showBlank ? "0.5" : "1",
            pointerEvents: isSpinning || showBlank ? "none" : "auto",
            // iOS opacity fixes
            ...(isIOS && (isSpinning || showBlank)
              ? {
                  WebkitOpacity: "0.5",
                  filter: "opacity(0.5)",
                  backgroundColor:
                    isSpinning || showBlank
                      ? "rgba(34, 197, 94, 0.5)"
                      : undefined,
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
              // Save winner when user resets (acknowledging the win)
              if (selectedName && selectedName !== "RESPIN") {
                setWinnerHistory(prev => [...prev, selectedName]);
              }
              setShowWinnerModal(false); // Close winner modal first
              setWinnerRhyme("");
              onReset();
            }}
            disabled={isSpinning || showBlank}
            className={`
              ${
                isFirefox
                  ? "px-3 py-3 text-sm min-w-[90px] max-w-[140px]"
                  : "px-[clamp(14px,2.5vw,18px)] py-[clamp(10px,2vw,12px)] text-[clamp(13px,1.8vw,14px)] min-w-[clamp(85px,20vw,110px)]"
              }
              font-bold text-white rounded-lg shadow-lg
              transition-all hover:scale-[1.02] active:scale-95
              ${
                isSpinning || showBlank
                  ? "bg-blue-500"
                  : "bg-blue-500 hover:bg-blue-600 cursor-pointer"
              }
            `}
            style={{
              touchAction: "manipulation",
              opacity: isSpinning || showBlank ? "0.5" : "1",
              pointerEvents: isSpinning || showBlank ? "none" : "auto",
              // iOS opacity fixes
              ...(isIOS && (isSpinning || showBlank)
                ? {
                    WebkitOpacity: "0.5",
                    filter: "opacity(0.5)",
                    backgroundColor:
                      isSpinning || showBlank
                        ? "rgba(59, 130, 246, 0.5)"
                        : undefined,
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
            Reset
          </button>
        )}
      </div>

      {/* Winner Modal */}
      {showWinnerModal && selectedName && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 pointer-events-auto p-4"
          onClick={(e) => {
            // Close modal when clicking backdrop
            if (e.target === e.currentTarget) {
              // Save winner when user acknowledges the win by clicking backdrop
              if (selectedName && selectedName !== "RESPIN") {
                setWinnerHistory(prev => [...prev, selectedName]);
              }
              setShowWinnerModal(false);
              setWinnerRhyme("");
            }
          }}
        >
          <div
            className="bg-white rounded-2xl p-6 sm:p-8 transform scale-100 animate-bounce-in pointer-events-auto text-center max-w-[90vw] w-full max-w-md"
            style={{
              boxShadow:
                "0 0 40px rgba(0, 0, 0, 0.3), 0 0 80px rgba(0, 0, 0, 0.15)",
            }}
            onClick={(e) => {
              // Prevent modal from closing when clicking inside the modal content
              e.stopPropagation();
            }}
          >
            <h2 className="text-xl sm:text-2xl font-bold text-gray-700 mb-2 leading-tight">
              {winnerRhyme}
            </h2>
            <p
              className={`font-bold text-green-600 animate-pulse mb-6 leading-tight break-words ${
                selectedName.length > 15
                  ? "text-2xl sm:text-3xl"
                  : selectedName.length > 10
                  ? "text-3xl sm:text-4xl"
                  : "text-4xl sm:text-5xl"
              }`}
              style={{
                wordBreak: "break-word",
                overflowWrap: "break-word",
                hyphens: "auto",
              }}
            >
              {selectedName}
            </p>
            <button
              onClick={() => {
                // Save winner when user acknowledges the win
                if (selectedName && selectedName !== "RESPIN") {
                  setWinnerHistory(prev => [...prev, selectedName]);
                }
                setShowWinnerModal(false);
                setWinnerRhyme("");
              }}
              className="min-w-[100px] px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              style={{ touchAction: "manipulation" }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Free Spin Indicator */}
      {selectedName === "RESPIN" && !isSpinning && (
        <div className="fixed inset-0 flex items-center justify-center z-40 pointer-events-none">
          <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 text-black rounded-2xl shadow-2xl p-8 transform scale-100 animate-bounce-in text-center border-4 border-red-600">
            <h2 className="text-4xl font-bold mb-2">FREE SPIN!</h2>
            <p className="text-xl font-semibold">Try one more time...</p>
          </div>
        </div>
      )}

      {/* Fairness Popup */}
      {showFairnessPopup && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-auto backdrop-blur-sm bg-black/20">
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
                      <span className="text-blue-300 font-mono">Entropy:</span>{" "}
                      Keyboard/mouse timing, CPU thermal noise
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
                  {includeFreeSpins &&
                    wheelNames.filter((n) => n === "RESPIN").length > 0 && (
                      <div className="bg-black/30 rounded p-2">
                        <p className="text-purple-300 font-mono text-[10px]">
                          RESPIN ODDS
                        </p>
                        <p className="text-white font-bold">
                          {(
                            (wheelNames.filter((n) => n === "RESPIN").length /
                              wheelNames.length) *
                            100
                          ).toFixed(2)}
                          %
                        </p>
                      </div>
                    )}
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

      {/* Footer - Ultra compact and stable */}
      <div ref={footerRef} className="w-full text-center flex-shrink-0">
        <div ref={footerContentRef} className="pb-1">
          {/* Stable content area with skeleton placeholders */}
          <div className="text-center space-y-0">
            {fairnessText && (
              <div className="text-[clamp(8px,1.2vw,10px)] text-white/70 whitespace-nowrap">
                {fairnessText}
              </div>
            )}
            {/* Always show last winner line to prevent layout shifts */}
            <div className="relative flex justify-center items-center text-[clamp(8px,1.2vw,10px)] text-white/70 px-1">
              {/* Centered main winner display */}
              <div className="text-center">
                Last winner:{" "}
                {winnerHistory.length > 0 ? (
                  <span className="text-white font-semibold">
                    {winnerHistory[winnerHistory.length - 1]}
                  </span>
                ) : (
                  <span className="text-white/40 italic">—</span>
                )}
              </div>
              {/* History extending to the right with proper spacing */}
              {winnerHistory.length > 1 && (
                <div className="absolute text-white/50 font-normal whitespace-nowrap overflow-hidden" style={{left: 'calc(50% + 10ch)', maxWidth: '40%'}}>
                  ← {winnerHistory.slice(0, -1).reverse().slice(0, 24).join(" ← ")}
                  {winnerHistory.length > 25 && " ..."}
                </div>
              )}
            </div>
          </div>
          <div className="text-center mt-0">
            <button
              onClick={() => {
                setShowFairnessPopup(true);
                // Track fairness popup view
                if (typeof window !== "undefined" && window.gtag) {
                  window.gtag("event", "fairness_view", {
                    event_category: "engagement",
                    event_label: "view_fairness_popup",
                  });
                }
              }}
              className="text-[clamp(10px,1.6vw,12px)] text-white/70 hover:text-white underline min-h-[24px] px-2 py-1"
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
