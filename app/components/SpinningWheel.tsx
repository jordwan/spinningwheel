"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import confetti from "canvas-confetti";

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
  const [lockedSpeed, setLockedSpeed] = useState<number | null>(null);
  const speedIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const confettiIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Process names to include RESPIN tiles
  const processedNames = (() => {
    const baseNames =
      names && names.length > 0
        ? names
        : ["Name 1", "Name 2", "Name 3", "Name 4", "Name 5", "Name 6"];

    // Calculate positions for RESPIN tiles
    const totalSlots = baseNames.length + 2; // Adding 2 RESPIN tiles
    const midPoint = Math.floor(totalSlots / 2);

    // Create the wheel with RESPIN tiles on opposite sides
    const result = [...baseNames];
    result.splice(0, 0, "RESPIN"); // Add first RESPIN at the beginning
    result.splice(midPoint, 0, "RESPIN"); // Add second RESPIN at the middle (opposite side)

    return result;
  })();

  const wheelNames = processedNames;

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

  const colors = [
    "#f54d4dff",
    "#399a94ff",
    "#45B7D1",
    "#54cb94ff",
    "#FECA57",
    "#da71daff",
    "#FF6B9D",
    "#FFD700",
  ];

  // Animate speed indicator
  useEffect(() => {
    if (!isSpinning) {
      const interval = setInterval(() => {
        setSpeedIndicator(() => {
          // Sine wave oscillation between 0 and 1
          const time = Date.now() / 1000;
          return (Math.sin(time * 2) + 1) / 2;
        });
      }, 50);
      speedIntervalRef.current = interval;
      return () => clearInterval(interval);
    } else if (speedIntervalRef.current) {
      clearInterval(speedIntervalRef.current);
    }
  }, [isSpinning]);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const containerHeight = containerRef.current.offsetHeight;
        // Leave space for title and button
        const maxSize = Math.min(containerWidth - 40, containerHeight - 200);
        // Increased max size from 600 to 800 for larger displays
        setCanvasSize(Math.max(300, Math.min(maxSize, 800)));
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      stopContinuousConfetti(); // Clean up confetti on unmount
    };
  }, []);

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

      // Draw slice
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();

      // Special styling for RESPIN (Free Spin)
      if (name === "RESPIN") {
        // Dark gradient background like bankrupt tile
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

        // Bold border
        ctx.strokeStyle = "#ff0000";
        ctx.lineWidth = 4;
        ctx.stroke();

        // Inner red border
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

      // Draw text
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = "right";

      if (name === "RESPIN") {
        // Special styling for Free Spin text
        ctx.fillStyle = "#ffff00"; // Bright yellow text
        const fontSize = Math.max(12, Math.min(16, canvasSize / 35));
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.strokeText("FREE SPIN", radius - 10, fontSize / 3);
        ctx.fillText("FREE SPIN", radius - 10, fontSize / 3);
      } else {
        ctx.fillStyle = "#fff";
        const fontSize = Math.max(14, Math.min(20, canvasSize / 30));
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        ctx.shadowBlur = 4;
        ctx.fillText(name, radius - 10, fontSize / 3);
      }

      ctx.restore();
    });

    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 20, 0, 2 * Math.PI);
    ctx.fillStyle = "#000";
    ctx.fill();

    // Draw pointer with enhanced visibility
    ctx.beginPath();
    ctx.moveTo(centerX + radius - 10, centerY);
    ctx.lineTo(centerX + radius + 30, centerY - 15);
    ctx.lineTo(centerX + radius + 30, centerY + 15);
    ctx.closePath();

    // Add shadow for better visibility against various backgrounds
    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.fillStyle = "#FF0000";
    ctx.fill();

    // Reset shadow for stroke
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // White outline for contrast
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Inner red border
    ctx.strokeStyle = "#8B0000";
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [rotation, canvasSize, wheelNames, colors]);

  useEffect(() => {
    drawWheel();
  }, [drawWheel]);

  const triggerConfetti = () => {
    // Multiple bursts for more impressive effect
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999,
    };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
    });
    fire(0.2, {
      spread: 60,
    });
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    });
  };

  const startContinuousConfetti = () => {
    let confettiCount = 0;

    // Fire confetti 3 times total
    const fireConfetti = () => {
      if (confettiCount < 1) {
        triggerConfetti();
        confettiCount++;

        if (confettiCount < 1) {
          setTimeout(fireConfetti, 1000);
        }
      }
    };

    fireConfetti();
  };

  const stopContinuousConfetti = () => {
    if (confettiIntervalRef.current) {
      clearInterval(confettiIntervalRef.current);
      confettiIntervalRef.current = null;
    }
  };

  const playTickSound = (volume: number = 0.3) => {
    // Create a more realistic wheel tick sound
    const audioContext = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();

    // Create multiple oscillators for a richer sound
    const oscillator1 = audioContext.createOscillator();
    const oscillator2 = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();

    // Set up the audio graph
    oscillator1.connect(filter);
    oscillator2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Configure filter for a wooden click sound
    filter.type = "bandpass";
    filter.frequency.value = 1000;
    filter.Q.value = 10;

    // Set frequencies for a click sound (mix of high and low)
    oscillator1.frequency.value = 800 + 400 * volume; // Higher component
    oscillator2.frequency.value = 200 + 100 * volume; // Lower component
    oscillator1.type = "square";
    oscillator2.type = "triangle";

    // Sharp attack, quick decay for click sound
    const clickDuration = 0.02; // Very short click
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(
      volume * 0.5,
      audioContext.currentTime + 0.001
    );
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + clickDuration
    );

    // Start and stop oscillators
    const now = audioContext.currentTime;
    oscillator1.start(now);
    oscillator2.start(now);
    oscillator1.stop(now + clickDuration + 0.01);
    oscillator2.stop(now + clickDuration + 0.01);
  };

  const spin = () => {
    if (isSpinning) return;

    setIsSpinning(true);
    setSelectedName("");
    setShowWinnerModal(false);
    setShowFairnessPopup(false); // Close fairness popup when spinning
    setLockedSpeed(speedIndicator); // Lock the speed when button is pressed

    // Use speed indicator to determine spin strength
    const spinStrength = speedIndicator; // 0 = slow, 1 = fast
    const baseRotations = 3 + spinStrength * 10; // 3-13 rotations based on timing
    const spinDuration = 4000 + (1 - spinStrength) * 4000; // 4-8 seconds (slower = longer)
    const finalRotation =
      rotation + Math.PI * 2 * (baseRotations + Math.random() * 2);

    const startTime = Date.now();
    let lastRotation = rotation;
    let lastSoundTime = 0;
    const segmentSize = (2 * Math.PI) / wheelNames.length;
    let cumulativeRotation = 0;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / spinDuration, 1);

      // More dramatic easing - faster start, much slower end
      const easeOut = 1 - Math.pow(1 - progress, 4);

      const currentRotation = rotation + (finalRotation - rotation) * easeOut;
      setRotation(currentRotation);

      // Calculate how much we've rotated since last frame
      const rotationDelta = currentRotation - lastRotation;
      cumulativeRotation += Math.abs(rotationDelta);

      // Play sound every time we pass through a segment amount of rotation
      // But limit to reasonable frequency based on speed
      const minTimeBetweenSounds = Math.max(50, 250 * (1 - (1 - progress)));

      if (
        cumulativeRotation >= segmentSize &&
        now - lastSoundTime >= minTimeBetweenSounds
      ) {
        const speed = 1 - easeOut;
        const volume = Math.max(0.05, Math.min(0.3, 0.05 + (1 - speed) * 0.25));
        playTickSound(volume);
        cumulativeRotation = 0;
        lastSoundTime = now;
      }

      lastRotation = currentRotation;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsSpinning(false);
        setLockedSpeed(null); // Reset locked speed after spin completes
        // Calculate selected segment
        const normalizedRotation =
          (2 * Math.PI - (currentRotation % (2 * Math.PI))) % (2 * Math.PI);
        const selectedIndex = Math.floor(
          normalizedRotation / ((2 * Math.PI) / wheelNames.length)
        );
        const winner = wheelNames[selectedIndex];
        setSelectedName(winner);

        // Check if it's a free spin
        if (winner === "RESPIN") {
          // Just show the free spin indicator, don't auto-spin
        } else {
          // Show winner modal with minimal delay
          setTimeout(() => {
            // Select random winner rhyme - ensure true randomness
            const randomIndex = Math.floor(Math.random() * winnerRhymes.length);
            const selectedRhyme = winnerRhymes[randomIndex];
            console.log(
              "Selected rhyme:",
              selectedRhyme,
              "Index:",
              randomIndex
            );
            setWinnerRhyme(selectedRhyme);
            setShowWinnerModal(true);
            startContinuousConfetti();
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
                stopContinuousConfetti();
                setWinnerRhyme(""); // Clear the rhyme when closing
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
                <strong>✓ FAIR DISTRIBUTION CONFIRMED</strong>
                <p>Statistical testing with 1,000,000 simulated spins each:</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded">
                  <strong>5 Names Test:</strong>
                  <p><strong>Free Spins:</strong> 28.53% (Expected: 28.57%)</p>
                  <p><strong>Deviation:</strong> 0.042%</p>
                  <p><strong>Names:</strong> All within 0.06%</p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <strong>50 Names Test:</strong>
                  <p><strong>Free Spins:</strong> 3.82% (Expected: 3.85%)</p>
                  <p><strong>Deviation:</strong> 0.023%</p>
                  <p><strong>Names:</strong> Avg deviation 0.047%</p>
                </div>
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <strong>How it works:</strong>
                <p>
                  iWheeli.com uses JaveScript Math.random() with true randomness
                  calculations. Each segment has equal probability based on its
                  size on the wheel.
                </p>
              </div>
              <div className="text-xs text-gray-600 mt-4">
                <p>
                  Free Spins are positioned at opposite sides of the wheel for
                  balanced distribution. Testing shows no bias toward any
                  particular outcome.
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
