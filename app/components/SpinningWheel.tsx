"use client";

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import confetti from "canvas-confetti";

/** ========= CRYPTO RNG (minimal + reliable) ========= */
const cryptoRandom = (): number => {
  // If we're in the browser and crypto is available, use it.
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const u32 = new Uint32Array(1);
    window.crypto.getRandomValues(u32);
    // u32 max is 2^32-1; divide by 2^32 -> [0, 1)
    return u32[0] / 4294967296;
  }
  // Fallback (SSR/older browsers)
  return Math.random();
};

interface SpinningWheelProps {
  names?: string[];
  onReset?: () => void;
}

const SpinningWheel: React.FC<SpinningWheelProps> = ({ names, onReset }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [selectedName, setSelectedName] = useState<string>("");
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winnerRhyme, setWinnerRhyme] = useState<string>("");
  const [canvasSize, setCanvasSize] = useState(400);
  const [speedIndicator, setSpeedIndicator] = useState(0.5);
  const [showFairnessPopup, setShowFairnessPopup] = useState(false);
  const [fairnessText, setFairnessText] = useState("");
  const [lockedSpeed, setLockedSpeed] = useState<number | null>(null);

  // Timer refs – use browser-friendly types
  const speedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** ========= AUDIO: reuse ONE AudioContext + prebuilt buffers ========= */
  const audioCtxRef = useRef<AudioContext | null>(null);
  const clickBufferRef = useRef<AudioBuffer | null>(null);
  const tadaBufferRef = useRef<AudioBuffer | null>(null);

  const ensureAudio = useCallback(() => {
    if (typeof window === "undefined") return null;

    // Create (or reuse) a single AudioContext
    if (!audioCtxRef.current) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioCtxRef.current = new Ctx();
    }

    // Build a tiny "tick" buffer once (1.5ms burst with quick decay)
    if (!clickBufferRef.current && audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      const duration = 0.008; // 8ms - shorter for more click-like sound
      const sr = ctx.sampleRate;
      const frames = Math.max(1, Math.floor(duration * sr));
      const buffer = ctx.createBuffer(1, frames, sr);
      const data = buffer.getChannelData(0);

      // Higher frequency, faster decay for crisp click sound
      const freq = 2000; // higher pitch for click
      for (let i = 0; i < frames; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 150); // much faster decay for sharp click
        data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.3; // reduce amplitude
      }
      clickBufferRef.current = buffer;
    }

    // Build a celebratory "ta da" buffer (rising musical phrase)
    if (!tadaBufferRef.current && audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      const duration = 0.8; // 800ms for ta da
      const sr = ctx.sampleRate;
      const frames = Math.max(1, Math.floor(duration * sr));
      const tadaBuffer = ctx.createBuffer(1, frames, sr);
      const tadaData = tadaBuffer.getChannelData(0);

      // Create a musical "ta da" with rising notes (C-E-G chord arpeggio)
      const frequencies = [261.63, 329.63, 392.0]; // C4, E4, G4
      for (let i = 0; i < frames; i++) {
        const t = i / sr;
        const progress = t / duration;

        // Envelope: quick attack, sustain, then fade
        let env;
        if (progress < 0.1) {
          env = progress / 0.1; // quick attack
        } else if (progress < 0.6) {
          env = 1; // sustain
        } else {
          env = (1 - progress) / 0.4; // fade out
        }

        // Play frequencies in sequence with overlap
        let sample = 0;
        frequencies.forEach((freq, index) => {
          const noteStart = index * 0.15; // staggered start times
          const noteEnd = noteStart + 0.4; // note duration
          if (t >= noteStart && t <= noteEnd) {
            const noteProgress = (t - noteStart) / (noteEnd - noteStart);
            const noteEnv = Math.sin(Math.PI * noteProgress); // smooth bell curve
            sample += Math.sin(2 * Math.PI * freq * t) * noteEnv * 0.3;
          }
        });

        tadaData[i] = sample * env * 0.4; // overall volume control
      }
      tadaBufferRef.current = tadaBuffer;
    }

    return audioCtxRef.current;
  }, []);

  const playTickSound = (volume = 0.1) => {
    const ctx = ensureAudio();
    if (!ctx || !clickBufferRef.current) return;

    // On some browsers the context may start suspended
    if (ctx.state === "suspended") {
      // Fire and forget resume; user gesture already happened (spin)
      ctx.resume().catch(() => {});
    }

    // Very light-weight buffer source each tick
    const src = ctx.createBufferSource();
    src.buffer = clickBufferRef.current;

    const gain = ctx.createGain();
    gain.gain.value = Math.max(0.01, Math.min(0.15, volume));

    src.connect(gain).connect(ctx.destination);
    src.start();
  };

  const playTadaSound = (volume = 0.3) => {
    const ctx = ensureAudio();
    if (!ctx || !tadaBufferRef.current) return;

    // On some browsers the context may start suspended
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    // Play the ta da celebration sound
    const src = ctx.createBufferSource();
    src.buffer = tadaBufferRef.current;

    const gain = ctx.createGain();
    gain.gain.value = Math.max(0.1, Math.min(0.5, volume));

    src.connect(gain).connect(ctx.destination);
    src.start();
  };

  /** ========= Names + RESPIN placement ========= */
  const processedNames = useMemo(() => {
    const baseNames =
      names && names.length > 0
        ? names
        : ["Name 1", "Name 2", "Name 3", "Name 4", "Name 5", "Name 6"];

    const totalSlots = baseNames.length + 2; // 2 RESPINs
    const midPoint = Math.floor(totalSlots / 2);

    const result = [...baseNames];
    result.splice(0, 0, "RESPIN");
    result.splice(midPoint, 0, "RESPIN");
    return result;
  }, [names]);

  const wheelNames = processedNames;

  /** ========= Initialize fairness text ========= */
  useEffect(() => {
    const totalSlots = wheelNames.length;
    const respinCount = wheelNames.filter((n) => n === "RESPIN").length;
    const nameChance = ((1 / totalSlots) * 100).toFixed(2);
    const respinChance = ((respinCount / totalSlots) * 100).toFixed(2);
    setFairnessText(
      `Each name ${nameChance}% odds, Free Spin ${respinChance}% odds`
    );
  }, [wheelNames]);

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

  const colors = useMemo(
    () => [
      "#f54d4dff",
      "#399a94ff",
      "#45B7D1",
      "#54cb94ff",
      "#FECA57",
      "#da71daff",
      "#FF6B9D",
      "#FFD700",
    ],
    []
  );

  /** ========= Speed indicator animation (fast and ultra-smooth) ========= */
  useEffect(() => {
    if (!isSpinning) {
      const interval = setInterval(() => {
        const time = Date.now() / 1000;
        setSpeedIndicator((Math.sin(time * 1.5) + 1) / 2);
      }, 16); // ~60fps for ultra-smooth animation

      speedIntervalRef.current = interval;
      return () => {
        if (speedIntervalRef.current) {
          clearInterval(speedIntervalRef.current);
          speedIntervalRef.current = null;
        }
      };
    } else {
      if (speedIntervalRef.current) {
        clearInterval(speedIntervalRef.current);
        speedIntervalRef.current = null;
      }
    }
  }, [isSpinning]);

  /** ========= Resize handling ========= */
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth || window.innerWidth;
      const containerHeight = containerRef.current.offsetHeight || window.innerHeight;

      // Better mobile sizing calculation
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const isMobile = viewportWidth < 768;

      let maxSize;
      if (isMobile) {
        // On mobile, be more conservative with sizing
        maxSize = Math.min(viewportWidth - 60, viewportHeight - 300);
      } else {
        maxSize = Math.min(containerWidth - 40, containerHeight - 200);
      }

      setCanvasSize(Math.max(280, Math.min(maxSize, 800)));
    };

    // Use setTimeout to ensure DOM is ready, especially on mobile
    const timeoutId = setTimeout(handleResize, 100);

    // Also call immediately
    handleResize();

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", () => {
      // Handle mobile orientation change with a delay
      setTimeout(handleResize, 200);
    });

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  // Additional resize when wheelNames change (important for mobile)
  useEffect(() => {
    if (wheelNames.length > 0) {
      const handleResize = () => {
        if (!containerRef.current) return;
        const containerWidth = containerRef.current.offsetWidth || window.innerWidth;
        const containerHeight = containerRef.current.offsetHeight || window.innerHeight;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const isMobile = viewportWidth < 768;

        let maxSize;
        if (isMobile) {
          maxSize = Math.min(viewportWidth - 60, viewportHeight - 300);
        } else {
          maxSize = Math.min(containerWidth - 40, containerHeight - 200);
        }

        setCanvasSize(Math.max(280, Math.min(maxSize, 800)));
      };

      // Small delay to let the layout settle after wheelNames change
      const timeoutId = setTimeout(handleResize, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [wheelNames]);

  /** ========= Draw wheel ========= */
  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const sliceAngle = (2 * Math.PI) / wheelNames.length;

    wheelNames.forEach((name, i) => {
      const startAngle = i * sliceAngle + rotation;
      const endAngle = (i + 1) * sliceAngle + rotation;

      // Slice
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();

      if (name === "RESPIN") {
        const gradient = ctx.createLinearGradient(
          centerX - radius,
          centerY - radius,
          centerX + radius,
          centerY + radius
        );
        gradient.addColorStop(0, "#1a1a1a");
        gradient.addColorStop(0.5, "#333333");
        gradient.addColorStop(1, "#000000");
        ctx.fillStyle = gradient;
        ctx.fill();

        // Clean white border only (no red border)
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Text
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = "right";

      if (name === "RESPIN") {
        ctx.fillStyle = "#ffff00";
        // More aggressive scaling for RESPIN text with many segments
        const baseFontSize = Math.max(6, Math.min(14, canvasSize / Math.max(35, wheelNames.length * 1.2)));
        const fontSize = baseFontSize;
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = Math.max(1, fontSize / 8); // Scale stroke width too

        // Always show "FREE SPIN"
        ctx.strokeText("FREE SPIN", radius - 10, fontSize / 3);
        ctx.fillText("FREE SPIN", radius - 10, fontSize / 3);
      } else {
        ctx.fillStyle = "#fff";
        // Dynamic font size based on wheel size and number of names
        const baseFontSize = Math.max(8, Math.min(16, canvasSize / Math.max(30, wheelNames.length * 0.6)));
        const fontSize = baseFontSize;
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        ctx.shadowBlur = 4;
        ctx.fillText(name, radius - 10, fontSize / 3);
      }

      ctx.restore();
    });

    // Center
    ctx.beginPath();
    ctx.arc(centerX, centerY, 20, 0, 2 * Math.PI);
    ctx.fillStyle = "#000";
    ctx.fill();

    // Pointer
    ctx.beginPath();
    ctx.moveTo(centerX + radius - 10, centerY);
    ctx.lineTo(centerX + radius + 30, centerY - 15);
    ctx.lineTo(centerX + radius + 30, centerY + 15);
    ctx.closePath();

    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.fillStyle = "#FF0000";
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.strokeStyle = "#8B0000";
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [rotation, canvasSize, wheelNames, colors]);

  useEffect(() => {
    drawWheel();
  }, [drawWheel]);

  /** ========= Confetti helpers ========= */
  const triggerConfetti = () => {
    const count = 200;
    const defaults = { origin: { y: 0.7 }, zIndex: 9999 } as const;

    const fire = (ratio: number, opts: confetti.Options) =>
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * ratio),
      });

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
  };

  /** ========= Spin logic ========= */
  const spin = () => {
    if (isSpinning) return;

    setIsSpinning(true);
    setSelectedName("");
    setShowWinnerModal(false);
    setShowFairnessPopup(false);
    setLockedSpeed(speedIndicator);

    const spinStrength = speedIndicator; // 0..1
    const baseRotations = 3 + spinStrength * 10; // 3-13 turns
    const spinDuration = 4000 + (1 - spinStrength) * 4000; // 4-8s
    const finalRotation =
      rotation + Math.PI * 2 * (baseRotations + cryptoRandom() * 2);

    const startTime = Date.now();
    let lastRotation = rotation;
    let lastSoundTime = 0;
    const segmentSize = (2 * Math.PI) / wheelNames.length;
    let accRotation = 0;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / spinDuration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 4);

      const currentRotation = rotation + (finalRotation - rotation) * easeOut;
      setRotation(currentRotation);

      const delta = Math.abs(currentRotation - lastRotation);
      accRotation += delta;

      // Tick gating by time so we don't spam audio
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

        // Winner determined by crypto-random

        if (winner !== "RESPIN") {
          setTimeout(() => {
            const rhyme =
              winnerRhymes[Math.floor(cryptoRandom() * winnerRhymes.length)];
            setWinnerRhyme(rhyme);
            setShowWinnerModal(true);
            triggerConfetti(); // Fire confetti only once
            playTadaSound(); // Play celebratory ta da sound
          }, 100);
        }
      }
    };

    requestAnimationFrame(animate);
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center justify-center w-full h-full"
    >
      {/* Speed Indicator */}
      <div className="mb-6 w-64">
        <div className="text-center mb-2 font-semibold text-white">
          Spin Power
        </div>
        <div className="relative h-8 bg-gradient-to-r from-blue-400 via-yellow-400 to-red-500 rounded-full overflow-hidden shadow-inner">
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
        <div className="flex justify-between mt-1 text-xs text-white">
          <span>Slow</span>
          <span>Fast</span>
        </div>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          className="border-4 border-gray-300 rounded-full shadow-2xl"
        />
      </div>

      <div className="flex gap-3 mt-4 justify-center">
        <button
          onClick={spin}
          disabled={isSpinning}
          className={`min-w-[140px] px-8 py-4 text-xl font-bold text-white rounded-lg shadow-lg transition-all transform ${
            isSpinning
              ? "bg-gray-500 cursor-not-allowed"
              : "bg-green-500 hover:bg-green-600 hover:scale-105 active:scale-95"
          }`}
        >
          {isSpinning ? "Spinning..." : "SPIN!"}
        </button>
        {onReset && (
          <button
            onClick={onReset}
            className="min-w-[80px] px-6 py-3 text-sm font-bold text-white bg-blue-500 rounded-lg shadow-lg hover:bg-blue-600 transition-all transform hover:scale-105 active:scale-95"
          >
            Reset
          </button>
        )}
      </div>

      {/* Winner Modal */}
      {showWinnerModal && selectedName && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white rounded-2xl shadow-2xl p-8 transform scale-100 animate-bounce-in pointer-events-auto text-center">
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
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-auto">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full mx-4 text-center relative">
            <button
              onClick={() => setShowFairnessPopup(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-black hover:text-gray-100 hover:bg-black rounded-full transition-colors"
            >
              ×
            </button>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Wheel Fairness Verification
            </h2>
            <div className="text-left space-y-3 text-sm">
              <div className="bg-green-50 p-3 rounded">
                <strong>✓ CRYPTOGRAPHICALLY SECURE RANDOMNESS</strong>
                <p>
                  iWheeli.com uses crypto.getRandomValues() for true randomness.
                </p>
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <strong>How it works:</strong>
                <p>
                  This wheel uses window.crypto.getRandomValues(), which is a
                  Cryptographically Secure Pseudo-Random Number Generator (CSPRNG)
                  backed by OS entropy from keystrokes, disk noise, system timers,
                  and other unpredictable sources. This provides the same level of
                  randomness used in the most advanced security applications.
                </p>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <strong>Current Configuration:</strong>
                <p>
                  <strong>Total Segments:</strong> {wheelNames.length}
                </p>
                <p>
                  <strong>Each Name:</strong>{" "}
                  {((1 / wheelNames.length) * 100).toFixed(2)}% chance
                </p>
                <p>
                  <strong>Free Spins:</strong>{" "}
                  {(
                    (wheelNames.filter((n) => n === "RESPIN").length /
                      wheelNames.length) *
                    100
                  ).toFixed(2)}
                  % chance
                </p>
              </div>
              <div className="text-xs text-gray-600 mt-4">
                <p>
                  Free Spins are positioned at opposite sides of the wheel for
                  balanced distribution. The crypto-random approach eliminates
                  any predictable patterns or bias.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowFairnessPopup(false)}
              className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Live Fairness Display */}
      {fairnessText && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-white/70 z-30 text-center whitespace-nowrap">
          <span>{fairnessText}</span>
        </div>
      )}

      {/* Tiny Fairness Link */}
      <button
        onClick={() => setShowFairnessPopup(true)}
        className="fixed bottom-2 left-1/2 transform -translate-x-1/2 text-xs text-white/70 hover:text-white underline z-30"
      >
        fairness
      </button>
    </div>
  );
};

export default SpinningWheel;
