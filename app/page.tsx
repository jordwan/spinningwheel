"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  const [isEditingCount, setIsEditingCount] = useState(false);
  const [showMinNamesWarning, setShowMinNamesWarning] = useState(false);
  const [showLongNameWarning, setShowLongNameWarning] = useState(false);
  const [longNameWarningText, setLongNameWarningText] = useState("");
  const [isUsingCustomNames, setIsUsingCustomNames] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateWarningText, setDuplicateWarningText] = useState("");

  // Debouncing refs for performance optimization
  const inputDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const nameProcessingDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Local input state for immediate UI feedback (separate from debounced state)
  const [localInputValue, setLocalInputValue] = useState("");

  // Hydration guard - ensures client-side rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle dynamic viewport height for mobile devices
  useEffect(() => {
    const updateViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };

    // Set initial value
    updateViewportHeight();

    // Update on resize (handles address bar show/hide on mobile)
    window.addEventListener("resize", updateViewportHeight, { passive: true });
    window.addEventListener("orientationchange", updateViewportHeight, { passive: true });

    return () => {
      window.removeEventListener("resize", updateViewportHeight);
      window.removeEventListener("orientationchange", updateViewportHeight);
    };
  }, []);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      if (inputDebounceRef.current) {
        clearTimeout(inputDebounceRef.current);
      }
      if (nameProcessingDebounceRef.current) {
        clearTimeout(nameProcessingDebounceRef.current);
      }
    };
  }, []);

  // Enhanced Firefox and browser detection
  const [isFirefox, setIsFirefox] = useState(false);
  const [hasVisualViewport, setHasVisualViewport] = useState(false);

  // Detect Firefox and capabilities on mount
  useEffect(() => {
    const detectFirefox = () => {
      if (typeof window === "undefined")
        return { isFirefox: false, version: 0 };

      const userAgent = navigator.userAgent;
      const firefoxMatch = userAgent.match(/Firefox\/(\d+)/);

      if (firefoxMatch) {
        const version = parseInt(firefoxMatch[1]);
        return { isFirefox: true, version };
      }

      return { isFirefox: false, version: 0 };
    };

    const { isFirefox: firefoxDetected, version } = detectFirefox();
    setIsFirefox(firefoxDetected);
    const hasViewportAPI = "visualViewport" in window;
    setHasVisualViewport(hasViewportAPI);

    // Debug logging for troubleshooting
    if (firefoxDetected) {
      console.log(
        `Firefox ${version} detected, visualViewport support: ${hasViewportAPI}`
      );
    }
  }, []);

  // Enhanced viewport fix for keyboard issues (iOS 16, Firefox and others)
  useEffect(() => {
    // Force viewport recalculation when name input modal closes
    if (!showNameInput) {
      // Firefox needs longer delay for consistent keyboard dismissal
      const delay = isFirefox ? 200 : 100;

      const timer = setTimeout(() => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty("--vh", `${vh}px`);

        // Firefox-specific additional custom property
        if (isFirefox) {
          document.documentElement.style.setProperty("--firefox-vh", `${vh}px`);
        }

        // Force a layout recalculation
        window.dispatchEvent(new Event("resize"));

        // Additional Firefox-specific viewport restore
        if (isFirefox && window.visualViewport) {
          const visualVh = window.visualViewport.height * 0.01;
          document.documentElement.style.setProperty(
            "--visual-vh",
            `${visualVh}px`
          );
        }
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [showNameInput, isFirefox]);

  // Advanced viewport handling during modal interactions with Firefox support
  useEffect(() => {
    if (showNameInput) {
      let viewportRestoreTimeout: NodeJS.Timeout;

      const handleViewportRestore = () => {
        // Debounce to prevent excessive calls
        clearTimeout(viewportRestoreTimeout);
        viewportRestoreTimeout = setTimeout(
          () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty("--vh", `${vh}px`);

            // Firefox-specific handling
            if (isFirefox) {
              document.documentElement.style.setProperty(
                "--firefox-vh",
                `${vh}px`
              );

              // Use visualViewport API if available
              if (hasVisualViewport && window.visualViewport) {
                const visualVh = window.visualViewport.height * 0.01;
                document.documentElement.style.setProperty(
                  "--visual-vh",
                  `${visualVh}px`
                );
              }
            }
          },
          isFirefox ? 50 : 16
        ); // Firefox needs slight debouncing
      };

      // Enhanced event handling for Firefox
      const events = ["focusin", "focusout"];

      // Add visualViewport events for modern Firefox
      if (hasVisualViewport && window.visualViewport) {
        window.visualViewport.addEventListener("resize", handleViewportRestore, { passive: true });
      }

      // Traditional events as fallback (focusin/focusout can't be passive as they might need preventDefault)
      events.forEach((event) => {
        window.addEventListener(event, handleViewportRestore);
      });

      // Firefox-specific keyboard detection fallback
      let lastWindowHeight = window.innerHeight;
      const firefoxKeyboardDetector = () => {
        if (isFirefox) {
          const currentHeight = window.innerHeight;
          const heightDiff = Math.abs(currentHeight - lastWindowHeight);

          // If significant height change, likely keyboard show/hide
          if (heightDiff > 150) {
            handleViewportRestore();
            lastWindowHeight = currentHeight;
          }
        }
      };

      const firefoxInterval = isFirefox
        ? setInterval(firefoxKeyboardDetector, 100)
        : null;

      return () => {
        clearTimeout(viewportRestoreTimeout);

        if (hasVisualViewport && window.visualViewport) {
          window.visualViewport.removeEventListener(
            "resize",
            handleViewportRestore
          );
        }

        events.forEach((event) => {
          window.removeEventListener(event, handleViewportRestore);
        });

        if (firefoxInterval) {
          clearInterval(firefoxInterval);
        }
      };
    }
  }, [showNameInput, isFirefox, hasVisualViewport]);

  // Prevent body scroll when modals are open
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const anyModalOpen =
      showNameInput || showMinNamesWarning || showLongNameWarning || showDuplicateWarning;

    if (anyModalOpen) {
      body.style.overflow = "hidden";
      html.style.overflow = "hidden";
      body.style.position = "fixed";
      body.style.width = "100%";
      body.style.height = "100%";
    } else {
      // Revert fully to defaults
      body.style.overflow = "";
      html.style.overflow = "";
      body.style.position = "";
      body.style.width = "";
      body.style.height = "";
    }
  }, [showNameInput, showMinNamesWarning, showLongNameWarning, showDuplicateWarning]);

  // Validate name lengths
  const validateNameLengths = (namesList: string[]): boolean => {
    const maxLength = 20; // Reasonable limit for display
    const longNames = namesList.filter((name) => name.length > maxLength);

    if (longNames.length > 0) {
      const longNamesText =
        longNames.length === 1
          ? `"${longNames[0]}" is too long`
          : `${longNames.length} names are too long`;
      setLongNameWarningText(
        `${longNamesText}. Please keep names under ${maxLength} characters.`
      );
      setShowLongNameWarning(true);
      return false;
    }
    return true;
  };

  const generateRandomNames = (count: number = 10) => {
    return getRandomNames(count);
  };

  // Debounced input change handler to reduce expensive processing
  const handleInputChange = useCallback((value: string) => {
    // Update local state immediately for UI responsiveness
    setLocalInputValue(value);

    // Clear any existing debounce timer
    if (inputDebounceRef.current) {
      clearTimeout(inputDebounceRef.current);
    }

    // Debounce the actual processing for performance (especially with regex operations)
    inputDebounceRef.current = setTimeout(() => {
      setInputValue(value);
    }, 150); // 150ms debounce to balance responsiveness with performance
  }, []);

  // Memoized enhanced name processing to reduce computation
  const processNames = useCallback((input: string): string[] => {
    const enhancedTrim = (name: string): string => {
      return name
        .trim()
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/[^\w\s\-\.]/g, '') // Remove special characters except hyphens and dots
        .substring(0, 20); // Cap length at 20 characters
    };

    let names: string[];

    if (input.includes(",")) {
      // Use comma-separated parsing
      names = input
        .split(",")
        .map(enhancedTrim)
        .filter((name) => name.length > 0);
    } else {
      // Use space-separated parsing
      names = input
        .split(/\s+/)
        .map(enhancedTrim)
        .filter((name) => name.length > 0);
    }

    // Remove duplicates (case-insensitive)
    return names.filter((name, index, arr) =>
      arr.findIndex(n => n.toLowerCase() === name.toLowerCase()) === index
    );
  }, []);

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

    // Use optimized name processing
    const rawNames = inputValue
      .split(/[,\s]+/)
      .map(name => name.trim())
      .filter(name => name.length > 0);

    const names = processNames(inputValue);

    // Show warning if duplicates were removed
    const duplicatesRemoved = rawNames.length - names.length;
    if (duplicatesRemoved > 0) {
      setDuplicateWarningText(
        `${duplicatesRemoved} duplicate ${duplicatesRemoved === 1 ? 'name was' : 'names were'} removed.`
      );
      setShowDuplicateWarning(true);
    }

    if (names.length >= 2) {
      // Validate name lengths before accepting
      if (validateNameLengths(names)) {
        setWheelNames(names);
        setIsUsingCustomNames(true); // Track that we're using custom names
        setShowNameInput(false);

        // Update document title with team name
        if (teamName) {
          document.title = `${teamName} - iWheeli.com`;
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
      if (localInputValue.trim() !== "" || showRandomCountInput) {
        handleSubmitNames();
      }
    }
  };

  // Prevent hydration mismatches by only rendering after client mount
  if (!mounted) {
    return (
      <div className="w-screen overflow-hidden relative min-h-[100svh]">
        {/* Same background image as main app */}
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

        {/* Subtle loading indicator over background */}
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
      className="w-screen overflow-hidden relative min-h-[100svh]"
      style={{
        boxShadow: `
          inset 0 0 40px rgba(255, 255, 255, 0.15),
          inset 0 0 80px rgba(255, 255, 255, 0.08)
        `,
        touchAction: "none",
        overscrollBehavior: "none",
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
                style={{ touchAction: "manipulation" }}
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
              {!showRandomCountInput && (
                <p className="text-gray-600 mb-4">
                  <span className="text-sm text-gray-500">
                    Enter names below or use random to select number of tiles
                  </span>
                </p>
              )}
              {!showRandomCountInput ? (
                <>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Team name (optional)"
                    className="w-full px-4 py-3 mb-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    style={{ touchAction: "manipulation" }}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                  <textarea
                    value={localInputValue}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="example: tom, jerry, bart, cindy..."
                    className="w-full h-32 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
                    style={{ touchAction: "manipulation" }}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus={!showRandomCountInput}
                  />
                </>
              ) : (
                <div>
                  {/* Merged Slider and Manual Input */}
                  <div>
                    <div className="flex items-center justify-center mb-2">
                      {isEditingCount ? (
                        <input
                          type="number"
                          min="2"
                          max="101"
                          value={randomNameCount}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Allow empty string for user typing
                            if (value === "") {
                              setRandomNameCount("");
                              return;
                            }
                            const num = parseInt(value);
                            if (!isNaN(num) && num >= 2 && num <= 101) {
                              setRandomNameCount(value);
                            }
                          }}
                          onBlur={(e) => {
                            // Ensure valid value on blur and exit edit mode
                            const num = parseInt(e.target.value);
                            if (isNaN(num) || num < 2) {
                              setRandomNameCount("2");
                            } else if (num > 101) {
                              setRandomNameCount("101");
                            }
                            setIsEditingCount(false);
                          }}
                          onKeyPress={(e) => {
                            if (e.key === "Enter") {
                              e.currentTarget.blur();
                            }
                          }}
                          className="text-lg font-semibold text-gray-700 text-center bg-transparent border-b-2 border-blue-500 outline-none w-24 px-2 py-1 h-8 rounded hover:bg-gray-100"
                          style={{ touchAction: "manipulation" }}
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={() => setIsEditingCount(true)}
                          className="text-lg font-semibold text-gray-700 hover:text-blue-600 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-gray-100"
                          style={{ touchAction: "manipulation" }}
                        >
                          {randomNameCount} names
                        </button>
                      )}
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="101"
                      value={parseInt(randomNameCount) || 6}
                      onChange={(e) => setRandomNameCount(e.target.value)}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                      style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((parseInt(randomNameCount) || 6) - 2) / 99 * 100}%, #e5e7eb ${((parseInt(randomNameCount) || 6) - 2) / 99 * 100}%, #e5e7eb 100%)`,
                        touchAction: "manipulation"
                      }}
                      autoFocus={showRandomCountInput && !isEditingCount}
                    />
                  </div>
                </div>
              )}
              <div className="mt-4">
                {!showRandomCountInput ? (
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        if (localInputValue.trim() !== "") {
                          // Clear both local and debounced input states
                          setLocalInputValue("");
                          setInputValue("");
                          setTeamName("");
                          // Clear debounce timer
                          if (inputDebounceRef.current) {
                            clearTimeout(inputDebounceRef.current);
                          }
                        } else {
                          // Show random count input
                          setShowRandomCountInput(true);
                        }
                      }}
                      className={`flex-1 px-6 py-3 font-semibold rounded-lg transition-colors cursor-pointer ${
                        localInputValue.trim() !== ""
                          ? "bg-blue-500 text-white hover:bg-blue-600"
                          : "bg-green-500 text-white hover:bg-green-600"
                      }`}
                      style={{ touchAction: "manipulation" }}
                    >
                      {localInputValue.trim() !== "" ? "Clear" : "Random"}
                    </button>
                    <button
                      onClick={handleSubmitNames}
                      disabled={localInputValue.trim() === ""}
                      className={`flex-1 px-6 py-3 font-semibold rounded-lg transition-colors ${
                        localInputValue.trim() === ""
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "bg-green-500 text-white hover:bg-green-600 cursor-pointer"
                      }`}
                      style={{ touchAction: "manipulation" }}
                    >
                      Enter
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleSubmitNames}
                    className="w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors cursor-pointer"
                    style={{ touchAction: "manipulation" }}
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
                  boxShadow:
                    "0 0 40px rgba(0, 0, 0, 0.3), 0 0 80px rgba(0, 0, 0, 0.15)",
                }}
              >
                <div className="mb-4">
                  <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-yellow-100 mb-3">
                    <svg
                      className="w-6 h-6 text-yellow-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
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
                  style={{ touchAction: "manipulation" }}
                  autoFocus
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
                  boxShadow:
                    "0 0 40px rgba(0, 0, 0, 0.3), 0 0 80px rgba(0, 0, 0, 0.15)",
                }}
              >
                <div className="mb-4">
                  <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-orange-100 mb-3">
                    <svg
                      className="w-6 h-6 text-orange-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Names Too Long
                  </h3>
                  <p className="text-sm text-gray-600">{longNameWarningText}</p>
                </div>
                <button
                  onClick={() => setShowLongNameWarning(false)}
                  className="w-full px-4 py-2 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors cursor-pointer"
                  style={{ touchAction: "manipulation" }}
                  autoFocus
                >
                  Got it
                </button>
              </div>
            </div>
          </>
        )}

        {/* Duplicate Names Warning Modal */}
        {showDuplicateWarning && (
          <>
            <div className="fixed inset-0 backdrop-blur-[2px] z-[59]" />
            <div className="fixed inset-0 flex items-center justify-center z-[60] p-4 pointer-events-none">
              <div
                className="bg-white rounded-2xl p-6 max-w-sm w-full pointer-events-auto text-center relative"
                style={{
                  boxShadow:
                    "0 0 40px rgba(0, 0, 0, 0.3), 0 0 80px rgba(0, 0, 0, 0.15)",
                }}
              >
                <div className="mb-4">
                  <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-3">
                    <svg
                      className="w-6 h-6 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Duplicates Removed
                  </h3>
                  <p className="text-sm text-gray-600">{duplicateWarningText}</p>
                </div>
                <button
                  onClick={() => setShowDuplicateWarning(false)}
                  className="w-full px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors cursor-pointer"
                  style={{ touchAction: "manipulation" }}
                  autoFocus
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
                filter:
                  "drop-shadow(0 0 15px rgba(255, 255, 255, 0.25)) drop-shadow(0 0 30px rgba(255, 255, 255, 0.15))",
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
                if (typeof window !== "undefined" && window.gtag) {
                  window.gtag("event", "wheel_reset", {
                    event_category: "engagement",
                    event_label: "reset_wheel",
                  });
                }
                setShowNameInput(true);
                // Only clear inputValue if we weren't using custom names
                if (!isUsingCustomNames) {
                  setInputValue("");
                  setLocalInputValue("");
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
