"use client";

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useLayoutEffect,
} from "react";
import confetti from "canvas-confetti";

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
const getAngleFromPoint = (centerX: number, centerY: number, pointX: number, pointY: number): number => {
  const deltaX = pointX - centerX;
  const deltaY = pointY - centerY;
  let angle = Math.atan2(deltaY, deltaX);
  // Convert to 0-2π range
  if (angle < 0) angle += Math.PI * 2;
  return angle;
};

const getCanvasCoordinates = (canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
  const rect = canvas.getBoundingClientRect();
  // Convert to canvas coordinate space (not including device pixel ratio)
  return {
    x: (clientX - rect.left) * (canvas.offsetWidth / rect.width),
    y: (clientY - rect.top) * (canvas.offsetHeight / rect.height)
  };
};

const normalizeAngleDifference = (angleDiff: number): number => {
  // Normalize angle difference to [-π, π] for shortest rotation path
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
  return angleDiff;
};

/** ========= TEXT UTILITIES ========= */
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;

  // Try to break at word boundaries
  const truncated = text.slice(0, maxLength - 3);
  const lastSpaceIndex = truncated.lastIndexOf(' ');

  if (lastSpaceIndex > maxLength * 0.6) {
    // Break at word boundary if it's not too early
    return truncated.slice(0, lastSpaceIndex) + '...';
  }

  // Break at character boundary
  return truncated + '...';
};

const measureTextWidth = (ctx: CanvasRenderingContext2D, text: string, fontSize: number): number => {
  ctx.save();
  ctx.font = `bold ${fontSize}px Arial`;
  const metrics = ctx.measureText(text);
  ctx.restore();
  return metrics.width;
};

const calculateOptimalFontSize = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  minSize: number = 6,
  maxSize: number = 16
): number => {
  let fontSize = maxSize;

  while (fontSize >= minSize) {
    const textWidth = measureTextWidth(ctx, text, fontSize);
    if (textWidth <= maxWidth) {
      return fontSize;
    }
    fontSize -= 0.5;
  }

  return minSize;
};

const getMaxTextWidth = (radius: number, sliceAngle: number): number => {
  // Calculate maximum text width that fits within the segment
  // Use 70% of the radius and consider the angular constraints
  const maxRadialWidth = radius * 0.7;
  const maxAngularWidth = radius * sliceAngle * 0.8; // Arc length constraint
  return Math.min(maxRadialWidth, maxAngularWidth, radius - 30); // 30px padding from edge
};

interface SpinningWheelProps {
  names?: string[];
  onReset?: () => void;
  includeFreeSpins?: boolean;
  showBlank?: boolean;
}

const SpinningWheel: React.FC<SpinningWheelProps> = ({ names, onReset, includeFreeSpins = true, showBlank = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Layout refs
  const rootRef = useRef<HTMLDivElement>(null);
  const wheelWrapRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

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
  const [lastWinner, setLastWinner] = useState<string>("");
  const [isIOS16, setIsIOS16] = useState(false);
  const [deviceCapability, setDeviceCapability] = useState<'high' | 'medium' | 'low'>('medium');

  // Drag interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [lastDragAngle, setLastDragAngle] = useState<number | null>(null);
  const [dragVelocity, setDragVelocity] = useState(0);
  const [lastDragTime, setLastDragTime] = useState(0);
  const momentumAnimationRef = useRef<number | null>(null);

  /** ========= AUDIO (unchanged) ========= */
  const audioCtxRef = useRef<AudioContext | null>(null);
  const clickBufferRef = useRef<AudioBuffer | null>(null);
  const tadaBufferRef = useRef<AudioBuffer | null>(null);

  const ensureAudio = useCallback(() => {
    if (typeof window === "undefined") return null;

    try {
      if (!audioCtxRef.current) {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        audioCtxRef.current = new Ctx();
      }

      if (!clickBufferRef.current && audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        const duration = 0.008,
          sr = ctx.sampleRate;
        const frames = Math.max(1, Math.floor(duration * sr));
        const buffer = ctx.createBuffer(1, frames, sr);
        const data = buffer.getChannelData(0);
        const freq = 2000;
        for (let i = 0; i < frames; i++) {
          const t = i / sr;
          const env = Math.exp(-t * 150);
          data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.3;
        }
        clickBufferRef.current = buffer;
      }

      if (!tadaBufferRef.current && audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        const duration = 0.8,
          sr = ctx.sampleRate;
        const frames = Math.max(1, Math.floor(duration * sr));
        const tadaBuffer = ctx.createBuffer(1, frames, sr);
        const tadaData = tadaBuffer.getChannelData(0);
        const frequencies = [261.63, 329.63, 392.0];
        for (let i = 0; i < frames; i++) {
          const t = i / sr;
          const p = t / duration;
          const env = p < 0.1 ? p / 0.1 : p < 0.6 ? 1 : (1 - p) / 0.4;
          let sample = 0;
          frequencies.forEach((f, idx) => {
            const ns = idx * 0.15,
              ne = ns + 0.4;
            if (t >= ns && t <= ne) {
              const np = (t - ns) / (ne - ns);
              const nenv = Math.sin(Math.PI * np);
              sample += Math.sin(2 * Math.PI * f * t) * nenv * 0.3;
            }
          });
          tadaData[i] = sample * env * 0.4;
        }
        tadaBufferRef.current = tadaBuffer;
      }
      return audioCtxRef.current;
    } catch (error) {
      console.warn("Audio initialization failed:", error);
      return null;
    }
  }, []);

  const playTickSound = (v = 0.1) => {
    const ctx = ensureAudio();
    if (!ctx || !clickBufferRef.current) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const src = ctx.createBufferSource();
    src.buffer = clickBufferRef.current;
    const gain = ctx.createGain();
    gain.gain.value = Math.max(0.01, Math.min(0.15, v));
    src.connect(gain).connect(ctx.destination);
    src.start();
  };
  const playTadaSound = (v = 0.3) => {
    const ctx = ensureAudio();
    if (!ctx || !tadaBufferRef.current) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const src = ctx.createBufferSource();
    src.buffer = tadaBufferRef.current;
    const gain = ctx.createGain();
    gain.gain.value = Math.max(0.1, Math.min(0.5, v));
    src.connect(gain).connect(ctx.destination);
    src.start();
  };

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

  /** ========= Fairness text ========= */
  useEffect(() => {
    if (showBlank) {
      setFairnessText("");
      setLastWinner(""); // Clear last winner when showing blank wheel
      return;
    }

    const total = wheelNames.length;
    const respinCount = wheelNames.filter((n) => n === "RESPIN").length;

    if (!includeFreeSpins || respinCount === 0) {
      setFairnessText(
        `Each name ${((1 / total) * 100).toFixed(2)}% chance`
      );
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
        const throttleMs = deviceCapability === 'high' ? 8.33 : 16.67;

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
    // Use dynamic viewport height instead of window.innerHeight for better mobile support
    const vh = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--vh').replace('px', '')) * 100 || window.innerHeight;

    // Conservative fallbacks so first pass doesn't oversize the wheel:
    const speedH = Math.max(speedRef.current?.offsetHeight ?? 0, 72);
    const controlsH = Math.max(controlsRef.current?.offsetHeight ?? 0, 88);
    const footerH = Math.max(footerRef.current?.offsetHeight ?? 0, 56);

    const buffers = 32;

    // Available area for the wheel
    const availableH = Math.max(0, vh - speedH - controlsH - footerH - buffers);
    const sidePadding = vw < 768 ? 24 : 96;
    const availableW = Math.max(0, vw - sidePadding);

    let target = Math.min(availableW, availableH);

    // Desktop guard: never let the wheel exceed ~56% of viewport height
    const vhCap = Math.floor(vh * (vw >= 1024 ? 0.56 : 0.62));
    target = Math.min(target, vhCap);

    // Global clamps - keep consistent sizes
    const minSize = 280;
    const maxSize = 600; // Same max for all devices
    target = Math.max(minSize, Math.min(maxSize, target));

    setCanvasCSSSize(target);
  }, []);

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
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    // Force recalculation after a brief delay to ensure layout is settled
    const timer = setTimeout(() => recomputeSize(), 100);

    return () => {
      clearTimeout(timer);
      ro.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [recomputeSize, wheelNames.length]); // Add dependency on names count

  /** ========= Audio Context Cleanup ========= */
  useEffect(() => {
    return () => {
      // Cleanup audio context on unmount
      if (audioCtxRef.current) {
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
    return () => {
      // Cleanup momentum animation on unmount
      if (momentumAnimationRef.current) {
        cancelAnimationFrame(momentumAnimationRef.current);
        momentumAnimationRef.current = null;
      }
    };
  }, []);

  /** ========= iOS 16 Detection ========= */
  useEffect(() => {
    const detectIOS16 = () => {
      if (typeof window === 'undefined') return false;

      const userAgent = window.navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(userAgent);

      if (!isIOS) return false;

      // Extract iOS version from user agent
      const versionMatch = userAgent.match(/OS (\d+)_(\d+)/);
      if (versionMatch) {
        const majorVersion = parseInt(versionMatch[1]);
        return majorVersion === 16;
      }

      return false;
    };

    const isIOS16 = detectIOS16();
    setIsIOS16(isIOS16);

    // Enhanced device capability detection
    const detectDeviceCapability = (): 'high' | 'medium' | 'low' => {
      if (typeof window === 'undefined') return 'medium';

      const userAgent = window.navigator.userAgent;
      let score = 0;

      // Browser version scoring
      const chromeMatch = userAgent.match(/Chrome\/(\d+)/);
      if (chromeMatch) {
        const version = parseInt(chromeMatch[1]);
        if (version >= 100) score += 3;
        else if (version >= 80) score += 2;
        else score += 0;
      }

      const safariMatch = userAgent.match(/Version\/(\d+).*Safari/);
      if (safariMatch) {
        const version = parseInt(safariMatch[1]);
        if (version >= 16) score += 3;
        else if (version >= 14) score += 2;
        else score += 0;
      }

      const firefoxMatch = userAgent.match(/Firefox\/(\d+)/);
      if (firefoxMatch) {
        const version = parseInt(firefoxMatch[1]);
        if (version >= 100) score += 3;
        else if (version >= 75) score += 2;
        else score += 0;
      }

      // OS version scoring
      if (/iPad|iPhone|iPod/.test(userAgent)) {
        const iosMatch = userAgent.match(/OS (\d+)_(\d+)/);
        if (iosMatch) {
          const majorVersion = parseInt(iosMatch[1]);
          if (majorVersion >= 17) score += 2;
          else if (majorVersion === 16) score -= 1; // iOS 16 performance issues
          else score -= 2;
        }
      }

      if (/Android/.test(userAgent)) {
        const androidMatch = userAgent.match(/Android (\d+)/);
        if (androidMatch) {
          const version = parseInt(androidMatch[1]);
          if (version >= 12) score += 2;
          else if (version >= 10) score += 1;
          else score -= 1;
        }
      }

      // Hardware indicators
      if (navigator.hardwareConcurrency) {
        if (navigator.hardwareConcurrency >= 8) score += 2;
        else if (navigator.hardwareConcurrency >= 4) score += 1;
        else score -= 1;
      }

      // Device memory (if available)
      // Note: deviceMemory is experimental API, not in standard Navigator type
      interface NavigatorWithMemory extends Navigator {
        deviceMemory?: number;
      }
      const navigatorWithMemory = navigator as NavigatorWithMemory;

      if ('deviceMemory' in navigator && navigatorWithMemory.deviceMemory) {
        const memory = navigatorWithMemory.deviceMemory;
        if (memory >= 8) score += 2;
        else if (memory >= 4) score += 1;
        else score -= 1;
      }

      // Determine capability based on score
      if (score >= 7) return 'high';
      if (score >= 3) return 'medium';
      return 'low';
    };

    setDeviceCapability(detectDeviceCapability());
  }, []);

  /** ========= DRAG INTERACTION HANDLERS ========= */
  // Allow drag when wheel is visible and not spinning, even if blank
  const canDrag = !isSpinning && !showWinnerModal;

  const startDrag = useCallback((clientX: number, clientY: number) => {
    if (!canDrag || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const { x, y } = getCanvasCoordinates(canvas, clientX, clientY);
    const centerX = canvas.offsetWidth / 2;
    const centerY = canvas.offsetHeight / 2;

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
  }, [canDrag]);

  const updateDrag = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || !canvasRef.current || lastDragAngle === null) return;

    const canvas = canvasRef.current;
    const { x, y } = getCanvasCoordinates(canvas, clientX, clientY);
    const centerX = canvas.offsetWidth / 2;
    const centerY = canvas.offsetHeight / 2;

    const currentAngle = getAngleFromPoint(centerX, centerY, x, y);
    const angleDiff = normalizeAngleDifference(currentAngle - lastDragAngle);

    // Calculate velocity for momentum
    const currentTime = Date.now();
    const timeDiff = currentTime - lastDragTime;
    if (timeDiff > 0) {
      setDragVelocity(angleDiff / timeDiff * 1000); // radians per second
    }

    setRotation(prev => prev + angleDiff);
    setLastDragAngle(currentAngle);
    setLastDragTime(currentTime);
  }, [isDragging, lastDragAngle, lastDragTime]);

  const endDrag = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);
    setLastDragAngle(null);

    // Start momentum animation if there's significant velocity
    if (Math.abs(dragVelocity) > 0.5) {
      let currentVelocity = dragVelocity;
      const friction = 0.95; // Friction coefficient

      const animateMomentum = () => {
        currentVelocity *= friction;

        // Continue if velocity is significant
        if (Math.abs(currentVelocity) > 0.01 && canDrag) {
          setRotation(prev => prev + currentVelocity / 60); // 60 FPS assumption
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
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  }, [startDrag]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      updateDrag(e.clientX, e.clientY);
    }
  }, [isDragging, updateDrag]);

  const handleMouseUp = useCallback(() => {
    endDrag();
  }, [endDrag]);

  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      startDrag(touch.clientX, touch.clientY);
    }
  }, [startDrag]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      updateDrag(touch.clientX, touch.clientY);
    }
  }, [updateDrag]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
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

      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
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

  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const css = canvasCSSSize;

    canvas.style.width = `${css}px`;
    canvas.style.height = `${css}px`;
    canvas.width = Math.floor(css * dpr);
    canvas.height = Math.floor(css * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const centerX = css / 2;
    const centerY = css / 2;
    const radius = Math.min(centerX, centerY) - 18;

    ctx.clearRect(0, 0, css, css);

    const sliceAngle = (2 * Math.PI) / wheelNames.length;

    wheelNames.forEach((name, i) => {
      const start = i * sliceAngle + rotation;
      const end = (i + 1) * sliceAngle + rotation;
      const midAngle = start + sliceAngle / 2;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, start, end);
      ctx.closePath();

      if (showBlank) {
        // Simple gradient for blank segments
        const g = ctx.createRadialGradient(
          centerX + Math.cos(midAngle) * radius * 0.5,
          centerY + Math.sin(midAngle) * radius * 0.5,
          0,
          centerX,
          centerY,
          radius
        );
        const baseColor = colors[i % colors.length];
        const cleanColor = baseColor.slice(0, 7);
        // More muted colors for blank state
        g.addColorStop(0, cleanColor + "33");
        g.addColorStop(0.85, cleanColor + "22");
        g.addColorStop(1, cleanColor + "11");
        ctx.fillStyle = g;
        ctx.fill();

        // Lighter border for blank state
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (name === "RESPIN") {
        // Metallic black gradient for RESPIN
        const g = ctx.createRadialGradient(
          centerX + Math.cos(midAngle) * radius * 0.5,
          centerY + Math.sin(midAngle) * radius * 0.5,
          0,
          centerX,
          centerY,
          radius
        );
        g.addColorStop(0, "#2a2a2a");
        g.addColorStop(0.7, "#0f0f0f");
        g.addColorStop(1, "#000000");
        ctx.fillStyle = g;
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
        // Gradient fill for regular segments
        const g = ctx.createRadialGradient(
          centerX + Math.cos(midAngle) * radius * 0.5,
          centerY + Math.sin(midAngle) * radius * 0.5,
          0,
          centerX,
          centerY,
          radius
        );
        const baseColor = colors[i % colors.length];
        // Remove any existing alpha channel from the color
        const cleanColor = baseColor.slice(0, 7);
        g.addColorStop(0, cleanColor);
        g.addColorStop(0.85, cleanColor + "dd");
        g.addColorStop(1, cleanColor + "99");
        ctx.fillStyle = g;
        ctx.fill();

        // White border with shadow
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner glow
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

        if (name === "RESPIN") {
          const text = "FREE SPIN";
          const maxWidth = getMaxTextWidth(radius, sliceAngle);
          const baseFontSize = Math.max(6, Math.min(14, css / Math.max(35, wheelNames.length * 1.2)));
          const fs = calculateOptimalFontSize(ctx, text, maxWidth, 6, baseFontSize);

          ctx.fillStyle = "#ffff00";
          ctx.font = `bold ${fs}px Arial`;
          ctx.strokeStyle = "#000";
          ctx.lineWidth = Math.max(1, fs / 8);
          const paddingFromEdge = 15; // Consistent with regular text
          ctx.strokeText(text, radius - paddingFromEdge, fs / 3);
          ctx.fillText(text, radius - paddingFromEdge, fs / 3);
        } else {
          // Calculate optimal font size and truncate text if needed
          const maxWidth = getMaxTextWidth(radius, sliceAngle);
          const baseFontSize = Math.max(8, Math.min(16, css / Math.max(30, wheelNames.length * 0.6)));

          // First try with original text
          let displayText = name;
          let fs = calculateOptimalFontSize(ctx, displayText, maxWidth, 6, baseFontSize);

          // If font size is too small, try truncating the text
          if (fs <= 7 && name.length > 15) {
            // Calculate max characters that fit
            let maxChars = 15;
            while (maxChars > 8) {
              displayText = truncateText(name, maxChars);
              fs = calculateOptimalFontSize(ctx, displayText, maxWidth, 6, baseFontSize);
              if (fs > 7) break;
              maxChars -= 2;
            }
          }

          ctx.fillStyle = "#fff";
          ctx.font = `bold ${fs}px Arial`;
          ctx.shadowColor = "rgba(0,0,0,0.7)";
          ctx.shadowBlur = Math.max(2, fs / 4);
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 1;

          // Position text consistently from edge, regardless of length
          // Use right alignment and position from edge for consistent layout
          const paddingFromEdge = 15; // Consistent padding from wheel edge
          ctx.fillText(displayText, radius - paddingFromEdge, fs / 3);
        }
        ctx.restore();
      }
    });

    // Center cap with metallic gradient
    const capGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 25);
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

    // Pointer with modern arrow design
    ctx.save();

    // Outer glow effect
    ctx.shadowColor = "rgba(255, 0, 0, 0.6)";
    ctx.shadowBlur = 10;

    // Modern arrow pointer
    ctx.beginPath();
    ctx.moveTo(centerX + radius - 5, centerY);
    ctx.lineTo(centerX + radius + 30, centerY - 15);
    ctx.lineTo(centerX + radius + 25, centerY);
    ctx.lineTo(centerX + radius + 30, centerY + 15);
    ctx.closePath();

    // Gradient fill
    const pointerGradient = ctx.createLinearGradient(
      centerX + radius - 5, centerY,
      centerX + radius + 30, centerY
    );
    pointerGradient.addColorStop(0, "#ff3333");
    pointerGradient.addColorStop(0.5, "#ff0000");
    pointerGradient.addColorStop(1, "#cc0000");

    ctx.fillStyle = pointerGradient;
    ctx.fill();

    // White highlight
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dark edge
    ctx.strokeStyle = "#660000";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }, [rotation, canvasCSSSize, wheelNames, colors, showBlank]);

  useEffect(() => {
    drawWheel();
  }, [drawWheel]);

  /** ========= Confetti ========= */
  const triggerConfetti = () => {
    const baseCount = 200;
    // Scale particle count based on device capability
    let scaleFactor = 1.0;
    if (deviceCapability === 'low') scaleFactor = 0.3;
    else if (deviceCapability === 'medium') scaleFactor = 0.6;
    else scaleFactor = 1.0; // high capability

    const count = baseCount * scaleFactor;

    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999,
      disableForReducedMotion: true // Respect accessibility settings
    } as const;
    const fire = (r: number, o: confetti.Options) =>
      confetti({ ...defaults, ...o, particleCount: Math.floor(count * r) });
    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
  };

  /** ========= Spin logic ========= */
  const winnerRhymes = [
    "Winner Winner, Chicken Dinner",
    "You are the Chosen One",
    "Victory Royale!",
    "Winner = Chosen",
    "Absolute Legend Pick",
    "Throw some W's in the chat for",
    "The Wheel has Spoken",
    "You have been randomly selected",
    "Jackpot!!!",
    "Congrats",
    "The Algorithm was in your Favor",
  ];

  const spin = () => {
    if (isSpinning || showBlank) return;

    // Track wheel spin event
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'wheel_spin', {
        event_category: 'engagement',
        event_label: 'spin_wheel',
        custom_map: {
          'segments': wheelNames.length,
          'spin_power': speedIndicator
        }
      });
    }

    setIsSpinning(true);
    setSelectedName("");
    setShowWinnerModal(false);
    setShowFairnessPopup(false);
    setLockedSpeed(speedIndicator);

    const spinStrength = speedIndicator;
    const baseRotations = 3 + spinStrength * 10;
    const spinDuration = 4000 + (1 - spinStrength) * 4000;
    const finalRotation =
      rotation + Math.PI * 2 * (baseRotations + cryptoRandom() * 2);

    const startTime = Date.now();
    let lastRotation = rotation;
    let lastSoundTime = 0;
    let lastFrameTime = 0;
    const segmentSize = (2 * Math.PI) / wheelNames.length;
    let accRotation = 0;

    const animate = () => {
      const now = Date.now();

      // Adaptive frame rate based on device capability
      // High capability: 8.33ms (120fps), Medium/Low: 16.67ms (60fps)
      const throttleMs = deviceCapability === 'high' ? 8.33 : 16.67;

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

      const delta = Math.abs(currentRotation - lastRotation);
      accRotation += delta;

      const minBetweenTicks = Math.max(50, 250 * (1 - (1 - progress)));
      if (
        accRotation >= segmentSize &&
        now - lastSoundTime >= minBetweenTicks
      ) {
        const speed = 1 - easeOut;
        const vol = Math.max(0.02, Math.min(0.1, 0.02 + (1 - speed) * 0.08));
        playTickSound(vol);
        accRotation = 0;
        lastSoundTime = now;
      }

      lastRotation = currentRotation;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsSpinning(false);
        setLockedSpeed(null);

        const normalized =
          (2 * Math.PI - (currentRotation % (2 * Math.PI))) % (2 * Math.PI);
        const selectedIndex = Math.floor(
          normalized / ((2 * Math.PI) / wheelNames.length)
        );
        const winner = wheelNames[selectedIndex];
        setSelectedName(winner);

        // Save last winner (but not RESPIN)
        if (winner !== "RESPIN") {
          setLastWinner(winner);
        }

        // Track winner selection
        if (typeof window !== 'undefined' && window.gtag) {
          window.gtag('event', 'wheel_result', {
            event_category: 'engagement',
            event_label: winner === "RESPIN" ? 'free_spin' : 'winner_selected',
            custom_map: {
              'result': winner,
              'segments': wheelNames.length,
              'is_respin': winner === "RESPIN"
            }
          });
        }

        if (winner !== "RESPIN") {
          // Show winner immediately
          const rhyme =
            winnerRhymes[Math.floor(cryptoRandom() * winnerRhymes.length)];
          setWinnerRhyme(rhyme);
          setShowWinnerModal(true);
          triggerConfetti();
          playTadaSound();
        }
      }
    };

    requestAnimationFrame(animate);
  };

  /** ========= UI ========= */
  return (
    <div ref={rootRef} className="flex flex-col items-center w-full h-full">
      {/* Spin Power (≈50% width on mobile, larger on bigger screens) */}
      <div
        ref={speedRef}
        className="mb-3 w-[min(45vw,300px)] sm:w-[min(60vw,360px)] lg:w-[400px]"
      >
        <div className="text-center mb-1 text-[clamp(11px,1.6vw,14px)] font-semibold text-white">
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
        className="relative flex items-center justify-center mb-4 flex-1 flex-col justify-center"
      >
        <canvas
          ref={canvasRef}
          className="rounded-full shadow-xl border border-white/30"
          style={{
            width: canvasCSSSize,
            height: canvasCSSSize,
            cursor: canDrag ? (isDragging ? 'grabbing' : 'grab') : 'default',
            touchAction: 'pan-x pan-y', // Allow touch gestures for dragging
            // Remove problematic iOS 16 properties
            ...(isIOS16 ? {} : {
              transform: 'translateZ(0)', // Hardware acceleration
              willChange: 'transform',     // Hint browser for optimization
            }),
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
        className="flex flex-wrap gap-2 sm:gap-3 justify-center items-center mx-auto mb-4"
        style={{
          width: `${canvasCSSSize}px`,
          maxWidth: "95vw",
        }}
      >
        <button
          onClick={spin}
          disabled={isSpinning || showBlank}
          className={`
            px-[clamp(14px,2.2vw,22px)]
            py-[clamp(9px,1.8vw,14px)]
            text-[clamp(16px,1.8vw,18px)]
            font-bold text-white rounded-lg shadow-lg transition-all
            min-w-[clamp(120px,24vw,156px)]
            ${
              isSpinning || showBlank
                ? "bg-green-500 opacity-50"
                : "bg-green-500 hover:bg-green-600 hover:scale-[1.02] active:scale-95 cursor-pointer"
            }
          `}
          style={{ touchAction: 'manipulation' }}
        >
          {isSpinning ? "Spinning..." : "SPIN!"}
        </button>

        {onReset && (
          <button
            onClick={() => {
              setShowWinnerModal(false); // Close winner modal first
              setWinnerRhyme("");
              onReset();
            }}
            disabled={isSpinning || showBlank}
            className={`
              px-[clamp(12px,2vw,18px)]
              py-[clamp(8px,1.6vw,12px)]
              text-[clamp(12px,1.6vw,14px)]
              font-bold text-white rounded-lg shadow-lg
              transition-all hover:scale-[1.02] active:scale-95
              min-w-[clamp(80px,18vw,110px)]
              ${
                isSpinning || showBlank
                  ? "bg-blue-500 opacity-50"
                  : "bg-blue-500 hover:bg-blue-600 cursor-pointer"
              }
            `}
            style={{ touchAction: 'manipulation' }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Winner Modal */}
      {showWinnerModal && selectedName && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div
            className="bg-white rounded-2xl p-8 transform scale-100 animate-bounce-in pointer-events-auto text-center"
            style={{
              boxShadow: '0 0 40px rgba(0, 0, 0, 0.3), 0 0 80px rgba(0, 0, 0, 0.15)'
            }}
          >
            <h2 className="text-2xl font-bold text-gray-700 mb-2">
              {winnerRhyme}
            </h2>
            <p className="text-5xl font-bold text-green-600 animate-pulse mb-6">
              {selectedName}
            </p>
            <button
              onClick={() => {
                setShowWinnerModal(false);
                setWinnerRhyme("");
              }}
              className="min-w-[100px] px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              style={{ touchAction: 'manipulation' }}
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
                <svg className="w-12 h-12 text-green-400 relative" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
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
                  <strong className="text-green-400 uppercase text-xs tracking-wider">Cryptographically Secure Randomness</strong>
                </div>
                <p className="text-gray-300 text-xs leading-relaxed">
                  Powered by crypto.getRandomValues() - military-grade randomness used by banks, cryptocurrency,
                  and security systems worldwide.
                </p>
              </div>

              <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 border border-blue-500/30 p-3 rounded-lg">
                <div className="flex items-center mb-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse mr-2"></div>
                  <strong className="text-blue-400 uppercase text-xs tracking-wider">Technical Stack</strong>
                </div>
                <div className="space-y-2">
                  <div className="flex items-start">
                    <span className="text-blue-300 mr-2">▸</span>
                    <p className="text-gray-300 text-xs">
                      <span className="text-blue-300 font-mono">CSPRNG:</span> Hardware entropy from OS kernel
                    </p>
                  </div>
                  <div className="flex items-start">
                    <span className="text-blue-300 mr-2">▸</span>
                    <p className="text-gray-300 text-xs">
                      <span className="text-blue-300 font-mono">Entropy:</span> Keyboard/mouse timing, CPU thermal noise
                    </p>
                  </div>
                  <div className="flex items-start">
                    <span className="text-blue-300 mr-2">▸</span>
                    <p className="text-gray-300 text-xs">
                      <span className="text-blue-300 font-mono">RNG Quality:</span> 32+ bits true randomness used
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-500/10 to-purple-600/10 border border-purple-500/30 p-3 rounded-lg">
                <div className="flex items-center mb-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse mr-2"></div>
                  <strong className="text-purple-400 uppercase text-xs tracking-wider">Live Statistics</strong>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-black/30 rounded p-2">
                    <p className="text-purple-300 font-mono text-[10px]">SEGMENTS</p>
                    <p className="text-white font-bold">{wheelNames.length}</p>
                  </div>
                  <div className="bg-black/30 rounded p-2">
                    <p className="text-purple-300 font-mono text-[10px]">OUTCOME BITS</p>
                    <p className="text-white font-bold">{Math.ceil(Math.log2(wheelNames.length))}</p>
                  </div>
                  <div className="bg-black/30 rounded p-2">
                    <p className="text-purple-300 font-mono text-[10px]">NAME ODDS</p>
                    <p className="text-white font-bold">{((1 / wheelNames.length) * 100).toFixed(2)}%</p>
                  </div>
                  {includeFreeSpins && wheelNames.filter((n) => n === "RESPIN").length > 0 && (
                    <div className="bg-black/30 rounded p-2">
                      <p className="text-purple-300 font-mono text-[10px]">RESPIN ODDS</p>
                      <p className="text-white font-bold">
                        {((wheelNames.filter((n) => n === "RESPIN").length / wheelNames.length) * 100).toFixed(2)}%
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowFairnessPopup(false)}
              className="mt-4 px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 font-semibold"
              style={{ touchAction: 'manipulation' }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div ref={footerRef} className="w-full text-center">
        {(fairnessText || lastWinner) && (
          <div className="text-center mb-1 flex flex-col items-center gap-1">
            {fairnessText && (
              <span className="text-[clamp(10px,1.6vw,12px)] text-white/70 whitespace-nowrap">
                {fairnessText}
              </span>
            )}
            {lastWinner && (
              <span className="text-[clamp(10px,1.6vw,12px)] text-white/70">
                Last winner: <span className="text-white font-semibold">{lastWinner}</span>
              </span>
            )}
          </div>
        )}
        <div className="text-center">
          <button
            onClick={() => {
              setShowFairnessPopup(true);
              // Track fairness popup view
              if (typeof window !== 'undefined' && window.gtag) {
                window.gtag('event', 'fairness_view', {
                  event_category: 'engagement',
                  event_label: 'view_fairness_popup'
                });
              }
            }}
            className="text-[clamp(10px,1.6vw,12px)] text-white/70 hover:text-white underline"
            style={{ touchAction: 'manipulation' }}
          >
            fairness
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpinningWheel;
