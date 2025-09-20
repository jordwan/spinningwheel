"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import SpinningWheel from "./components/SpinningWheel";
import { getRandomNames } from "./data/names";

export default function Home() {
  const [showNameInput, setShowNameInput] = useState(true);
  const [wheelNames, setWheelNames] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [teamName, setTeamName] = useState("");
  const [randomNameCount, setRandomNameCount] = useState("6");
  const [showRandomCountInput, setShowRandomCountInput] = useState(false);
  const [showMinNamesWarning, setShowMinNamesWarning] = useState(false);
  const [showLongNameWarning, setShowLongNameWarning] = useState(false);
  const [longNameWarningText, setLongNameWarningText] = useState("");
  const [isUsingCustomNames, setIsUsingCustomNames] = useState(false);

  // Handle dynamic viewport height for mobile devices
  useEffect(() => {
    const updateViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    // Set initial value
    updateViewportHeight();

    // Update on resize (handles address bar show/hide on mobile)
    window.addEventListener('resize', updateViewportHeight);
    window.addEventListener('orientationchange', updateViewportHeight);

    return () => {
      window.removeEventListener('resize', updateViewportHeight);
      window.removeEventListener('orientationchange', updateViewportHeight);
    };
  }, []);

  // Universal viewport fix for keyboard issues (iOS 16 Firefox and others)
  useEffect(() => {
    // Force viewport recalculation when name input modal closes
    if (!showNameInput) {
      // Small delay to ensure keyboard is fully dismissed
      const timer = setTimeout(() => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);

        // Force a layout recalculation
        window.dispatchEvent(new Event('resize'));
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [showNameInput]);

  // Additional defensive viewport handling during modal interactions
  useEffect(() => {
    if (showNameInput) {
      // Add extra resize listener during modal interaction
      const handleViewportRestore = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
      };

      // Listen for focus/blur events that might indicate keyboard state
      window.addEventListener('focusin', handleViewportRestore);
      window.addEventListener('focusout', handleViewportRestore);

      return () => {
        window.removeEventListener('focusin', handleViewportRestore);
        window.removeEventListener('focusout', handleViewportRestore);
      };
    }
  }, [showNameInput]);

  // Prevent body scroll when modals are open
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;

    if (showNameInput || showMinNamesWarning || showLongNameWarning) {
      // Lock scrolling when any modal is open
      body.style.overflow = 'hidden';
      html.style.overflow = 'hidden';
      body.style.position = 'fixed';
      body.style.width = '100%';
      body.style.height = '100%';
    } else {
      // Restore normal state
      body.style.overflow = 'hidden'; // Keep as hidden for our no-scroll app
      html.style.overflow = 'hidden';
      body.style.position = 'fixed';
      body.style.width = '100%';
      body.style.height = '100%';
    }
  }, [showNameInput, showMinNamesWarning, showLongNameWarning]);

  // Validate name lengths
  const validateNameLengths = (namesList: string[]): boolean => {
    const maxLength = 20; // Reasonable limit for display
    const longNames = namesList.filter(name => name.length > maxLength);

    if (longNames.length > 0) {
      const longNamesText = longNames.length === 1
        ? `"${longNames[0]}" is too long`
        : `${longNames.length} names are too long`;
      setLongNameWarningText(`${longNamesText}. Please keep names under ${maxLength} characters.`);
      setShowLongNameWarning(true);
      return false;
    }
    return true;
  };

  const generateRandomNames = (count: number = 10) => {
    return getRandomNames(count);
  };

  const handleSubmitNames = () => {
    // If showing random count input, generate random names
    if (showRandomCountInput) {
      const count = parseInt(randomNameCount) || 10;
      setWheelNames(generateRandomNames(count));
      setIsUsingCustomNames(false); // Track that we're using random names
      setShowNameInput(false);
      setShowRandomCountInput(false);
      return;
    }

    // Parse names - try comma-separated first, then space-separated if no commas
    let names: string[];
    if (inputValue.includes(",")) {
      // Use comma-separated parsing
      names = inputValue
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name.length > 0);
    } else {
      // Use space-separated parsing
      names = inputValue
        .split(/\s+/)
        .map((name) => name.trim())
        .filter((name) => name.length > 0);
    }

    if (names.length >= 2) {
      // Validate name lengths before accepting
      if (validateNameLengths(names)) {
        setWheelNames(names);
        setIsUsingCustomNames(true); // Track that we're using custom names
        setShowNameInput(false);

        // Update document title with team name
        if (teamName) {
          document.title = `${teamName} - iWxeel`;
        }
      }
    } else if (names.length === 1) {
      // Show styled warning modal
      setShowMinNamesWarning(true);
    }
    // Removed the else clause that would show random count input
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Only submit if there's input or we're on the random count screen
      if (inputValue.trim() !== "" || showRandomCountInput) {
        handleSubmitNames();
      }
    }
  };

  return (
    <div
      className="w-screen overflow-hidden relative fixed inset-0"
      style={{
        height: 'calc(var(--vh, 1vh) * 100)',
        boxShadow: `
          inset 0 0 40px rgba(255, 255, 255, 0.15),
          inset 0 0 80px rgba(255, 255, 255, 0.08)
        `,
        touchAction: 'none',
        overscrollBehavior: 'none',
      }}
    >
      {/* Optimized blurred background image */}
      <div
        className="fixed inset-0 w-full h-full"
        style={{
          zIndex: -1,
          minHeight: "100vh",
          minWidth: "100vw"
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

      {/* Content overlay - not blurred */}
      <div className="relative z-10">
        {/* Name Input Popup (overlay on top of wheel) */}
        {showNameInput && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full pointer-events-auto text-center relative">
              {/* Close button */}
              <button
                onClick={() => {
                  if (showRandomCountInput) {
                    // Go back to custom names input
                    setShowRandomCountInput(false);
                  } else {
                    // On custom names screen, X button goes to random selector
                    setShowRandomCountInput(true);
                  }
                }}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
                aria-label="Close"
                style={{ touchAction: 'manipulation' }}
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
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                {showRandomCountInput
                  ? "How many random names?"
                  : "Enter Names Below"}
              </h2>
              <p className="text-gray-600 mb-4">
                <span className="text-sm text-gray-500">
                  {showRandomCountInput
                    ? "Choose between 2-101 names"
                    : "Enter at least 2 comma separated names or use random"}
                </span>
              </p>
              {!showRandomCountInput ? (
                <>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Team name (optional)"
                    className="w-full px-4 py-3 mb-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    style={{ touchAction: 'manipulation' }}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="example: tom, jerry, bart, cindy..."
                    className="w-full h-32 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
                    style={{ touchAction: 'manipulation' }}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                </>
              ) : (
                <div>
                  <label className="block text-center text-gray-600 mb-2 text-sm">
                    Select number of names
                  </label>
                  <select
                    value={randomNameCount}
                    onChange={(e) => setRandomNameCount(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-center text-lg bg-white cursor-pointer"
                    style={{ touchAction: 'manipulation' }}
                  >
                    {Array.from({ length: 100 }, (_, i) => i + 2).map((num) => (
                      <option key={num} value={num}>
                        {num} names
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="mt-6">
                {!showRandomCountInput ? (
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        if (inputValue.trim() !== "") {
                          // Clear input and team name
                          setInputValue("");
                          setTeamName("");
                        } else {
                          // Show random count input
                          setShowRandomCountInput(true);
                        }
                      }}
                      className="flex-1 px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors cursor-pointer"
                      style={{ touchAction: 'manipulation' }}
                    >
                      {inputValue.trim() !== "" ? "Clear" : "Random"}
                    </button>
                    <button
                      onClick={handleSubmitNames}
                      disabled={inputValue.trim() === ""}
                      className={`flex-1 px-6 py-3 font-semibold rounded-lg transition-colors ${
                        inputValue.trim() === ""
                          ? "bg-gray-300 text-gray-500"
                          : "bg-green-500 text-white hover:bg-green-600 cursor-pointer"
                      }`}
                      style={{ touchAction: 'manipulation' }}
                    >
                      Enter
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleSubmitNames}
                    className="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors cursor-pointer"
                    style={{ touchAction: 'manipulation' }}
                  >
                    Enter
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Minimum Names Warning Modal */}
        {showMinNamesWarning && (
          <>
            <div className="fixed inset-0 backdrop-blur-[2px] z-[59]" />
            <div className="fixed inset-0 flex items-center justify-center z-[60] p-4 pointer-events-none">
              <div
                className="bg-white rounded-2xl p-6 max-w-sm w-full pointer-events-auto text-center relative"
                style={{
                  boxShadow: '0 0 40px rgba(0, 0, 0, 0.3), 0 0 80px rgba(0, 0, 0, 0.15)'
                }}
              >
              <div className="mb-4">
                <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-yellow-100 mb-3">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Need More Names
                </h3>
                <p className="text-sm text-gray-600">
                  Please enter at least 2 names to spin the wheel
                </p>
              </div>
              <button
                onClick={() => setShowMinNamesWarning(false)}
                className="w-full px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors cursor-pointer"
                style={{ touchAction: 'manipulation' }}
              >
                Got it
              </button>
            </div>
          </div>
          </>
        )}

        {/* Long Names Warning Modal */}
        {showLongNameWarning && (
          <>
            <div className="fixed inset-0 backdrop-blur-[2px] z-[59]" />
            <div className="fixed inset-0 flex items-center justify-center z-[60] p-4 pointer-events-none">
              <div
                className="bg-white rounded-2xl p-6 max-w-sm w-full pointer-events-auto text-center relative"
                style={{
                  boxShadow: '0 0 40px rgba(0, 0, 0, 0.3), 0 0 80px rgba(0, 0, 0, 0.15)'
                }}
              >
              <div className="mb-4">
                <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-orange-100 mb-3">
                  <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Names Too Long
                </h3>
                <p className="text-sm text-gray-600">
                  {longNameWarningText}
                </p>
              </div>
              <button
                onClick={() => setShowLongNameWarning(false)}
                className="w-full px-4 py-2 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors cursor-pointer"
                style={{ touchAction: 'manipulation' }}
              >
                Got it
              </button>
            </div>
          </div>
          </>
        )}

        <main className="h-full w-full flex flex-col p-4">
          <div className="flex justify-center mb-3">
            <div
              className="relative w-48 h-16 sm:w-56 sm:h-18 lg:w-64 lg:h-20"
              style={{
                filter: 'drop-shadow(0 0 15px rgba(255, 255, 255, 0.25)) drop-shadow(0 0 30px rgba(255, 255, 255, 0.15))',
              }}
            >
              <Image
                src="/logo.png"
                alt="iWxeel"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>
          <div className="flex-1 w-full max-w-4xl mx-auto">
            <SpinningWheel
              names={wheelNames.length > 0 ? wheelNames : undefined}
              includeFreeSpins={false}
              showBlank={showNameInput}
              onReset={() => {
                // Track reset action
                if (typeof window !== 'undefined' && window.gtag) {
                  window.gtag('event', 'wheel_reset', {
                    event_category: 'engagement',
                    event_label: 'reset_wheel'
                  });
                }
                setShowNameInput(true);
                // Only clear inputValue if we weren't using custom names
                if (!isUsingCustomNames) {
                  setInputValue("");
                }
                setTeamName("");
                setShowRandomCountInput(false);
                document.title = "iWheeli.com";
              }}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
