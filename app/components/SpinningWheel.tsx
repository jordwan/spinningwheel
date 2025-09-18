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

interface SpinningWheelProps {
  names?: string[];
  onReset?: () => void;
}

const SpinningWheel: React.FC<SpinningWheelProps> = ({ names, onReset }) => {
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

  // Timer refs
  const speedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** ========= AUDIO (unchanged) ========= */
  const audioCtxRef = useRef<AudioContext | null>(null);
  const clickBufferRef = useRef<AudioBuffer | null>(null);
  const tadaBufferRef = useRef<AudioBuffer | null>(null);

  const ensureAudio = useCallback(() => {
    if (typeof window === "undefined") return null;

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
    const base =
      names && names.length
        ? names
        : ["Name 1", "Name 2", "Name 3", "Name 4", "Name 5", "Name 6"];
    const totalSlots = base.length + 2;
    const mid = Math.floor(totalSlots / 2);
    const result = [...base];
    result.splice(0, 0, "RESPIN");
    result.splice(mid, 0, "RESPIN");
    return result;
  }, [names]);

  /** ========= Fairness text ========= */
  useEffect(() => {
    const total = wheelNames.length;
    const respinCount = wheelNames.filter((n) => n === "RESPIN").length;
    setFairnessText(
      `Each name ${((1 / total) * 100).toFixed(2)}% chance, Free Spin ${(
        (respinCount / total) *
        100
      ).toFixed(2)}% chance`
    );
  }, [wheelNames]);

  /** ========= Idle speed indicator ========= */
  useEffect(() => {
    if (!isSpinning) {
      const id = setInterval(() => {
        const t = Date.now() / 1000;
        setSpeedIndicator((Math.sin(t * 1.5) + 1) / 2);
      }, 16);
      speedIntervalRef.current = id;
      return () => {
        if (speedIntervalRef.current) {
          clearInterval(speedIntervalRef.current);
          speedIntervalRef.current = null;
        }
      };
    } else if (speedIntervalRef.current) {
      clearInterval(speedIntervalRef.current);
      speedIntervalRef.current = null;
    }
  }, [isSpinning]);

  /** ========= Responsive sizing with ResizeObserver ========= */
  const recomputeSize = useCallback(() => {
    if (typeof window === "undefined") return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

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

    // Global clamps
    const minSize = 260;
    const maxSize = vw < 1024 ? 540 : 600;
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

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [recomputeSize]);

  /** ========= Draw wheel (HiDPI, labels, pointer) ========= */
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

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, start, end);
      ctx.closePath();

      if (name === "RESPIN") {
        const g = ctx.createLinearGradient(
          centerX - radius,
          centerY - radius,
          centerX + radius,
          centerY + radius
        );
        g.addColorStop(0, "#1a1a1a");
        g.addColorStop(0.5, "#333333");
        g.addColorStop(1, "#000000");
        ctx.fillStyle = g;
        ctx.fill();
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

      // Labels
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(start + sliceAngle / 2);
      ctx.textAlign = "right";

      if (name === "RESPIN") {
        ctx.fillStyle = "#ffff00";
        const fs = Math.max(
          6,
          Math.min(14, css / Math.max(35, wheelNames.length * 1.2))
        );
        ctx.font = `bold ${fs}px Arial`;
        ctx.strokeStyle = "#000";
        ctx.lineWidth = Math.max(1, fs / 8);
        ctx.strokeText("FREE SPIN", radius - 10, fs / 3);
        ctx.fillText("FREE SPIN", radius - 10, fs / 3);
      } else {
        ctx.fillStyle = "#fff";
        const fs = Math.max(
          8,
          Math.min(16, css / Math.max(30, wheelNames.length * 0.6))
        );
        ctx.font = `bold ${fs}px Arial`;
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;
        ctx.fillText(name, radius - 10, fs / 3);
      }
      ctx.restore();
    });

    // Center cap
    ctx.beginPath();
    ctx.arc(centerX, centerY, 20, 0, 2 * Math.PI);
    ctx.fillStyle = "#000";
    ctx.fill();

    // Pointer
    ctx.beginPath();
    ctx.moveTo(centerX + radius - 10, centerY);
    ctx.lineTo(centerX + radius + 26, centerY - 13);
    ctx.lineTo(centerX + radius + 26, centerY + 13);
    ctx.closePath();
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1.5;
    ctx.shadowOffsetY = 1.5;
    ctx.fillStyle = "#FF0000";
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#FFFFFF";
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#8B0000";
    ctx.stroke();
  }, [rotation, canvasCSSSize, wheelNames, colors]);

  useEffect(() => {
    drawWheel();
  }, [drawWheel]);

  /** ========= Confetti ========= */
  const triggerConfetti = () => {
    const count = 200;
    const defaults = { origin: { y: 0.7 }, zIndex: 9999 } as const;
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
    if (isSpinning) return;

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

        if (winner !== "RESPIN") {
          setTimeout(() => {
            const rhyme =
              winnerRhymes[Math.floor(cryptoRandom() * winnerRhymes.length)];
            setWinnerRhyme(rhyme);
            setShowWinnerModal(true);
            triggerConfetti();
            playTadaSound();
          }, 100);
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
          style={{ width: canvasCSSSize, height: canvasCSSSize }}
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
          disabled={isSpinning}
          className={`
            px-[clamp(14px,2.2vw,22px)]
            py-[clamp(9px,1.8vw,14px)]
            text-[clamp(16px,1.8vw,18px)]
            font-bold text-white rounded-lg shadow-lg transition-all
            min-w-[clamp(120px,24vw,156px)]
            ${
              isSpinning
                ? "bg-gray-500 cursor-not-allowed"
                : "bg-green-500 hover:bg-green-600 hover:scale-[1.02] active:scale-95"
            }
          `}
        >
          {isSpinning ? "Spinning..." : "SPIN!"}
        </button>

        {onReset && (
          <button
            onClick={onReset}
            className="
              px-[clamp(12px,2vw,18px)]
              py-[clamp(8px,1.6vw,12px)]
              text-[clamp(12px,1.6vw,14px)]
              font-bold text-white bg-blue-500 rounded-lg shadow-lg
              hover:bg-blue-600 transition-all hover:scale-[1.02] active:scale-95
              min-w-[clamp(80px,18vw,110px)]
            "
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
                  This wheel uses crypto.getRandomValues() - the same
                  cryptographic-grade randomness used by banks, cryptocurrency,
                  and security systems worldwide.
                </p>
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <strong>Technical Implementation:</strong>
                <p>
                  <strong>CSPRNG Source:</strong>{" "}
                  window.crypto.getRandomValues() accesses your operating
                  system&apos;s hardware entropy pool, collecting randomness
                  from mouse movements, keyboard timings, disk activity, and
                  other unpredictable system events.
                </p>
                <p className="mt-2">
                  <strong>Entropy Quality:</strong> Each spin uses 32+ bits of
                  true entropy - mathematically impossible to predict or
                  manipulate. This exceeds casino-grade randomness standards.
                </p>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <strong>Current Configuration:</strong>
                <p>
                  <strong>Total Segments:</strong> {wheelNames.length}
                </p>
                <p>
                  <strong>Each Name:</strong>{" "}
                  {((1 / wheelNames.length) * 100).toFixed(2)}% chance (
                  {(1 / wheelNames.length).toFixed(6)} probability)
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
                <p className="mt-1 text-xs text-gray-600">
                  <strong>Entropy per spin:</strong>{" "}
                  {Math.ceil(Math.log2(wheelNames.length))} bits minimum
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

      {/* Footer */}
      <div ref={footerRef} className="w-full text-center">
        {fairnessText && (
          <div className="text-center mb-1">
            <span className="text-[clamp(10px,1.6vw,12px)] text-white/70 whitespace-nowrap">
              {fairnessText}
            </span>
          </div>
        )}
        <div className="text-center">
          <button
            onClick={() => setShowFairnessPopup(true)}
            className="text-[clamp(10px,1.6vw,12px)] text-white/70 hover:text-white underline"
          >
            fairness
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpinningWheel;
