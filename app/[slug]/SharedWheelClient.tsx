"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import Image from "next/image";
import { useSession } from "../../hooks/useSession";
import { useViewportHeight } from "../../hooks/useViewportHeight";

const SpinningWheel = lazy(() => import("../components/SpinningWheel"));

// Loading placeholder component (matches main page)
const WheelLoadingPlaceholder = () => (
  <div className="flex flex-col items-center w-full h-full justify-center">
    {/* Wheel - Centered */}
    <div className="flex flex-col items-center justify-center flex-1 min-h-0 w-full">
      <div className="relative flex items-center justify-center">
        <div
          className="rounded-full shadow-xl border border-white/30 bg-gradient-to-br from-blue-500 to-purple-600 animate-pulse"
          style={{ width: 'min(450px, 90vw)', height: 'min(450px, 90vw)', maxWidth: '500px', maxHeight: '500px' }}
        />
      </div>
    </div>

    {/* Speed indicator placeholder - below wheel */}
    <div className="mt-3 mb-2 w-full max-w-[min(85vw,500px)] flex-shrink-0" style={{ minHeight: '40px' }}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-white/80 whitespace-nowrap flex-shrink-0">Slow</span>
        <div className="relative flex-1 h-4 bg-gradient-to-r from-blue-400 via-yellow-400 to-red-500 rounded-full overflow-hidden shadow-inner">
          <div className="absolute top-0 bottom-0 w-3 bg-white border-2 border-gray-800 rounded-full shadow-lg animate-pulse" style={{ left: '50%', transform: 'translateX(-50%)' }} />
        </div>
        <span className="text-[10px] text-white/80 whitespace-nowrap flex-shrink-0">Fast</span>
      </div>
    </div>

    {/* Controls placeholder */}
    <div className="flex flex-wrap justify-center items-center mx-auto mb-0.5 flex-shrink-0" style={{ maxWidth: '450px', minHeight: '60px' }}>
      <div className="px-6 py-3 bg-green-500 text-white rounded-lg mr-3 animate-pulse" style={{ minWidth: '120px', height: '48px' }} />
      <div className="px-3 py-3 bg-blue-500 text-white rounded-lg animate-pulse" style={{ minWidth: '85px', height: '48px' }} />
    </div>

    {/* Footer placeholder */}
    <div className="w-full text-center flex-shrink-0" style={{ minHeight: '40px' }}>
      <div className="flex flex-col items-center gap-0.5">
        <div className="text-[10px] text-white/60 animate-pulse bg-white/10 rounded" style={{ width: '150px', height: '10px' }} />
        <div className="flex items-center gap-2">
          <div className="animate-pulse bg-white/10 rounded" style={{ width: '80px', height: '10px' }} />
          <span className="text-white/40">•</span>
          <div className="animate-pulse bg-white/10 rounded" style={{ width: '50px', height: '10px' }} />
        </div>
      </div>
    </div>
  </div>
);

interface SharedWheelClientProps {
  names: string[];
  teamName?: string;
  inputMethod?: 'custom' | 'random' | 'numbers';
}

export default function SharedWheelClient({
  names,
  teamName,
  inputMethod,
}: SharedWheelClientProps) {
  const [mounted, setMounted] = useState(false);
  const [currentConfigId, setCurrentConfigId] = useState<string | null>(null);
  const { saveConfiguration, recordSpin, updateSpinAcknowledgment } = useSession();

  useEffect(() => {
    setMounted(true);

    // Save the shared configuration to the visitor's session
    if (names.length > 0) {
      saveConfiguration(names, teamName, inputMethod).then((configId) => {
        setCurrentConfigId(configId);
      });
    }

    // Update document title
    if (teamName) {
      document.title = `${teamName} – iWheeli – Random Name Picker Wheel`;
    }
  }, [names, teamName, inputMethod, saveConfiguration]);

  // Unified viewport management
  const { isFirefox } = useViewportHeight({
    enableFirefoxSupport: true,
    enableKeyboardDetection: false,
    modalOpen: false,
  });

  if (!mounted) {
    return (
      <div className="w-screen overflow-hidden relative min-h-[100svh]">
        <div
          className="fixed inset-0 w-full h-full"
          style={{
            zIndex: -1,
            minHeight: "100vh",
            minWidth: "100vw",
          }}
        >
          <Image
            src="/bkgddT.png"
            alt="Spinning wheel background"
            fill
            priority
            className="object-cover object-center blur-[3px]"
            sizes="100vw"
            quality={85}
          />
        </div>
        <div className="relative z-10 flex items-center justify-center h-screen">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg px-6 py-3">
            <div className="animate-pulse text-white text-lg">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-screen h-[100svh] h-[100vh] overflow-hidden relative"
      style={{
        boxShadow: `
          inset 0 0 40px rgba(255, 255, 255, 0.15),
          inset 0 0 80px rgba(255, 255, 255, 0.08)
        `,
        touchAction: "none",
        overscrollBehavior: "none",
      }}
    >
      {/* Background image */}
      <div
        className="fixed inset-0 w-full h-full"
        style={{
          zIndex: -1,
          minHeight: "100vh",
          minWidth: "100vw",
        }}
      >
        <Image
          src="/bkgddT.png"
          alt="Spinning wheel background"
          fill
          priority
          className="object-cover object-center blur-[3px]"
          sizes="100vw"
          quality={85}
        />
      </div>

      {/* Content overlay */}
      <div className="relative z-10 h-[100svh] h-[100vh]">
        <main className="h-full w-full flex flex-col relative">
          {/* Logo - Fixed in top-left corner */}
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-20 flex-shrink-0">
            <div
              className="relative w-32 h-11 sm:w-40 sm:h-14 lg:w-48 lg:h-16"
              style={{
                filter:
                  "drop-shadow(0 0 12px rgba(255, 255, 255, 0.35)) drop-shadow(0 0 24px rgba(255, 255, 255, 0.2))",
              }}
            >
              <Image
                src="/logo.png"
                alt="iWheeli"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          {/* Wheel container - takes all available space */}
          <div className="flex-1 w-full max-w-5xl mx-auto min-h-0 flex flex-col overflow-hidden py-2">
            <Suspense fallback={<WheelLoadingPlaceholder />}>
              <SpinningWheel
                names={names}
                includeFreeSpins={false}
                showBlank={false}
                isFirefox={isFirefox}
                configId={currentConfigId}
                onRecordSpin={recordSpin}
                onUpdateSpinAcknowledgment={updateSpinAcknowledgment}
                onRemoveWinner={async (newNames: string[]) => {
                  const newConfigId = await saveConfiguration(
                    newNames,
                    teamName,
                    inputMethod
                  );
                  setCurrentConfigId(newConfigId);
                  return newConfigId;
                }}
                onReset={() => {
                  // For shared wheels, reset just reloads the page
                  window.location.reload();
                }}
              />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
