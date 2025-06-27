'use client';

import React, { useRef, useState, useEffect } from 'react';
import confetti from 'canvas-confetti';

interface SpinningWheelProps {
  names?: string[];
}

const SpinningWheel: React.FC<SpinningWheelProps> = ({ names }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [selectedName, setSelectedName] = useState<string>('');
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [canvasSize, setCanvasSize] = useState(400);
  const [speedIndicator, setSpeedIndicator] = useState(0.5);
  const [lockedSpeed, setLockedSpeed] = useState<number | null>(null);
  const speedIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const confettiIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Default names if none provided
  const wheelNames = names || [
    'Name 1', 'Name 2', 'Name 3', 'Name 4', 
    'Name 5', 'Name 6', 'Name 7', 'RESPIN'
  ];
  
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
    '#FECA57', '#DDA0DD', '#FF6B9D', '#FFD700'
  ];

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
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      stopContinuousConfetti(); // Clean up confetti on unmount
    };
  }, []);

  // Animate speed indicator
  useEffect(() => {
    if (!isSpinning) {
      const interval = setInterval(() => {
        setSpeedIndicator(prev => {
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
    drawWheel();
  }, [rotation, canvasSize]);

  const drawWheel = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
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
      
      // Special color for RESPIN
      if (name === 'RESPIN') {
        ctx.fillStyle = '#333333';
      } else {
        ctx.fillStyle = colors[i % colors.length];
      }
      
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw text
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      const fontSize = Math.max(14, Math.min(20, canvasSize / 30));
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4;
      ctx.fillText(name, radius - 10, fontSize / 3);
      ctx.restore();
    });

    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 20, 0, 2 * Math.PI);
    ctx.fillStyle = '#333';
    ctx.fill();

    // Draw pointer
    ctx.beginPath();
    ctx.moveTo(centerX + radius - 10, centerY);
    ctx.lineTo(centerX + radius + 30, centerY - 15);
    ctx.lineTo(centerX + radius + 30, centerY + 15);
    ctx.closePath();
    ctx.fillStyle = '#FF0000';
    ctx.fill();
    ctx.strokeStyle = '#8B0000';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const triggerConfetti = () => {
    // Multiple bursts for more impressive effect
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999
    };

    function fire(particleRatio: number, opts: any) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio)
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
      scalar: 0.8
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2
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
      if (confettiCount < 3) {
        triggerConfetti();
        confettiCount++;
        
        if (confettiCount < 3) {
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
    // Create a simple click sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 600 + (200 * volume); // Higher pitch when louder
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  };

  const playCelebrationSound = () => {
    // Create "Do-dooo-dooo-dooooooo!" celebration sound (classic fanfare)
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Notes and timing for "Do-dooo-dooo-dooooooo!" (classic trumpet fanfare)
    const fanfare = [
      { note: 392.00, duration: 0.12, startTime: 0 },      // G4 - "Do" (short)
      { note: 523.25, duration: 0.25, startTime: 0.15 },   // C5 - "dooo" (medium)
      { note: 659.25, duration: 0.25, startTime: 0.45 },   // E5 - "dooo" (medium)
      { note: 783.99, duration: 0.6, startTime: 0.75 }     // G5 - "dooooooo!" (long)
    ];
    
    fanfare.forEach(({ note, duration, startTime }) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      
      // Add filter for more horn-like sound
      filter.type = 'lowpass';
      filter.frequency.value = 2000;
      filter.Q.value = 1;
      
      oscillator.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = note;
      oscillator.type = 'square'; // More horn-like
      
      const noteStart = audioContext.currentTime + startTime;
      
      // Envelope for each note
      gainNode.gain.setValueAtTime(0, noteStart);
      gainNode.gain.linearRampToValueAtTime(0.3, noteStart + 0.03); // Quick attack
      gainNode.gain.setValueAtTime(0.25, noteStart + duration - 0.05); // Sustain
      gainNode.gain.exponentialRampToValueAtTime(0.01, noteStart + duration); // Release
      
      oscillator.start(noteStart);
      oscillator.stop(noteStart + duration + 0.1);
    });
  };

  const spin = () => {
    if (isSpinning) return;

    setIsSpinning(true);
    setSelectedName('');
    setShowWinnerModal(false);
    setLockedSpeed(speedIndicator); // Lock the speed when button is pressed

    // Use speed indicator to determine spin strength
    const spinStrength = speedIndicator; // 0 = slow, 1 = fast
    const baseRotations = 3 + spinStrength * 10; // 3-13 rotations based on timing
    const spinDuration = 4000 + (1 - spinStrength) * 4000; // 4-8 seconds (slower = longer)
    const finalRotation = rotation + (Math.PI * 2 * (baseRotations + Math.random() * 2));
    
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
      
      if (cumulativeRotation >= segmentSize && (now - lastSoundTime) >= minTimeBetweenSounds) {
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
        const normalizedRotation = ((2 * Math.PI) - (currentRotation % (2 * Math.PI))) % (2 * Math.PI);
        const selectedIndex = Math.floor(normalizedRotation / ((2 * Math.PI) / wheelNames.length));
        const winner = wheelNames[selectedIndex];
        setSelectedName(winner);
        
        // Check if it's a respin
        if (winner === 'RESPIN') {
          // Just show the respin indicator, don't auto-spin
        } else {
          // Show winner modal after a brief delay
          setTimeout(() => {
            setShowWinnerModal(true);
            startContinuousConfetti();
            playCelebrationSound();
          }, 500);
        }
      }
    };

    requestAnimationFrame(animate);
  };

  return (
    <div ref={containerRef} className="flex flex-col items-center justify-center w-full h-full">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          className="border-4 border-gray-300 rounded-full shadow-2xl"
        />
      </div>
      
      {/* Speed Indicator */}
      <div className="mt-6 w-64">
        <div className="text-center mb-2 font-semibold text-gray-700">
          Spin Power
        </div>
        <div className="relative h-8 bg-gradient-to-r from-blue-400 via-yellow-400 to-red-500 rounded-full overflow-hidden shadow-inner">
          <div 
            className="absolute top-0 bottom-0 w-4 bg-white border-2 border-gray-800 rounded-full shadow-lg"
            style={{ 
              left: `${(lockedSpeed !== null ? lockedSpeed : speedIndicator) * 100}%`, 
              transform: 'translateX(-50%)' 
            }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-600">
          <span>Slow</span>
          <span>Fast</span>
        </div>
      </div>

      <button
        onClick={spin}
        disabled={isSpinning}
        className={`mt-4 px-8 py-4 text-xl font-bold text-white rounded-lg shadow-lg transition-all transform ${
          isSpinning 
            ? 'bg-gray-500 cursor-not-allowed' 
            : 'bg-green-500 hover:bg-green-600 hover:scale-105 active:scale-95'
        }`}
      >
        {isSpinning ? 'Spinning...' : 'SPIN!'}
      </button>

      {/* Winner Modal */}
      {showWinnerModal && selectedName && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white rounded-2xl shadow-2xl p-8 transform scale-100 animate-bounce-in pointer-events-auto">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">🎉 WINNER! 🎉</h2>
            <p className="text-5xl font-bold text-green-600 animate-pulse mb-6">{selectedName}</p>
            <button
              onClick={() => {
                setShowWinnerModal(false);
                stopContinuousConfetti();
              }}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Respin Indicator */}
      {selectedName === 'RESPIN' && !isSpinning && (
        <div className="fixed inset-0 flex items-center justify-center z-40 pointer-events-none">
          <div className="bg-gray-800 text-white rounded-2xl shadow-2xl p-8 transform scale-100 animate-bounce-in">
            <h2 className="text-4xl font-bold mb-2">🔄 RESPIN! 🔄</h2>
            <p className="text-xl">Press the button to spin again!</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpinningWheel;