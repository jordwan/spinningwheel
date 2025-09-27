"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  lazy,
  Suspense,
} from "react";
import Image from "next/image";
import { getRandomNames } from "./data/names";
import {
  trackNameInputOpened,
  trackInputMethodSelected,
  trackCustomNamesSubmitted,
  trackRandomSelection,
  trackValidationWarning,
  trackTeamNameSet,
  trackWheelReset,
  trackModalClosed,
  startSession,
  endSession,
} from "./utils/analytics";
import { useSession } from "../hooks/useSession";

// Lazy load the heavy SpinningWheel component
const SpinningWheel = lazy(() => import("./components/SpinningWheel"));

// Loading placeholder component for better LCP
const WheelLoadingPlaceholder = () => (
  <div className="flex flex-col items-center w-full h-full">
    {/* Speed indicator placeholder */}
    <div className="mb-2 w-[min(45vw,300px)] sm:w-[min(60vw,360px)] lg:w-[400px]" style={{ minHeight: '72px' }}>
      <div className="text-center mb-1 text-[clamp(10px,1.5vw,13px)] font-semibold text-white">
        Spin Power
      </div>
      <div className="relative h-6 bg-gradient-to-r from-blue-400 via-yellow-400 to-red-500 rounded-full overflow-hidden shadow-inner">
        <div className="absolute top-0 bottom-0 w-4 bg-white border-2 border-gray-800 rounded-full shadow-lg animate-pulse" style={{ left: '50%', transform: 'translateX(-50%)' }} />
      </div>
      <div className="flex justify-between mt-1 text-[clamp(10px,1.4vw,12px)] text-white">
        <span>Slow</span>
        <span>Fast</span>
      </div>
    </div>

    {/* Wheel placeholder */}
    <div className="relative flex items-center justify-center mb-8 flex-1 min-h-0 flex-col justify-center">
      <div
        className="rounded-full shadow-xl border border-white/30 bg-gradient-to-br from-blue-500 to-purple-600 animate-pulse"
        style={{ width: '350px', height: '350px' }}
      />
    </div>

    {/* Controls placeholder */}
    <div className="flex flex-wrap justify-center items-center mx-auto mb-2" style={{ width: '350px', minHeight: '60px' }}>
      <div className="px-6 py-3 bg-green-500 text-white rounded-lg mr-3 animate-pulse" style={{ minWidth: '120px', height: '48px' }} />
      <div className="px-3 py-3 bg-blue-500 text-white rounded-lg animate-pulse" style={{ minWidth: '85px', height: '48px' }} />
    </div>

    {/* Footer placeholder */}
    <div className="w-full text-center flex-shrink-0" style={{ minHeight: '60px' }}>
      <div className="pb-1">
        <div className="text-center space-y-0">
          <div className="text-[clamp(8px,1.2vw,10px)] text-white/70 animate-pulse bg-white/10 rounded mx-auto" style={{ width: '200px', height: '12px' }} />
          <div className="relative flex justify-center items-center text-[clamp(8px,1.2vw,10px)] text-white/70 px-1" style={{ minHeight: '14px' }}>
            <div className="animate-pulse bg-white/10 rounded" style={{ width: '150px', height: '12px' }} />
          </div>
        </div>
        <div className="text-center mt-0">
          <div className="text-[clamp(10px,1.6vw,12px)] text-white/70 animate-pulse bg-white/10 rounded mx-auto" style={{ width: '60px', height: '16px' }} />
        </div>
      </div>
    </div>
  </div>
);

export default function Home() {
  const [showNameInput, setShowNameInput] = useState(true);
  const [wheelNames, setWheelNames] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [teamName, setTeamName] = useState("");
  const [randomNameCount, setRandomNameCount] = useState("6");
  const [showRandomCountInput, setShowRandomCountInput] = useState(false);
  const [isEditingCount, setIsEditingCount] = useState(false);
  const [hasStartedTyping, setHasStartedTyping] = useState(false);
  const [showMinNamesWarning, setShowMinNamesWarning] = useState(false);
  const [showLongNameWarning, setShowLongNameWarning] = useState(false);
  const [longNameWarningText, setLongNameWarningText] = useState("");
  const [isUsingCustomNames, setIsUsingCustomNames] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateWarningText, setDuplicateWarningText] = useState("");
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [currentConfigId, setCurrentConfigId] = useState<string | null>(null);

  // Session tracking
  const { saveConfiguration, recordSpin, updateSpinAcknowledgment } =
    useSession();

  // Debouncing refs for performance optimization
  const inputDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const nameProcessingDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Local input state for immediate UI feedback (separate from debounced state)
  const [localInputValue, setLocalInputValue] = useState("");

  // Hydration guard - ensures client-side rendering
  useEffect(() => {
    setMounted(true);

    // Start analytics session
    startSession();

    // Detect mobile device
    const checkIsMobile = () => {
      if (typeof window !== "undefined") {
        // Check for touch capability and screen size
        const hasTouch =
          "ontouchstart" in window || navigator.maxTouchPoints > 0;
        const isSmallScreen = window.innerWidth <= 1024; // Consider tablets as mobile for keyboard behavior
        setIsMobileDevice(hasTouch && isSmallScreen);
      }
    };

    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);

    return () => {
      window.removeEventListener("resize", checkIsMobile);
      // End analytics session on unmount
      endSession();
    };
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
    window.addEventListener("orientationchange", updateViewportHeight, {
      passive: true,
    });

    return () => {
      window.removeEventListener("resize", updateViewportHeight);
      window.removeEventListener("orientationchange", updateViewportHeight);
    };
  }, []);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    const nameProcessingDebounce = nameProcessingDebounceRef.current;

    return () => {
      if (inputDebounceRef.current) {
        clearTimeout(inputDebounceRef.current);
      }
      if (nameProcessingDebounce) {
        clearTimeout(nameProcessingDebounce);
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
        window.visualViewport.addEventListener(
          "resize",
          handleViewportRestore,
          { passive: true }
        );
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

  // Track when name input modal opens
  useEffect(() => {
    if (showNameInput && mounted) {
      trackNameInputOpened();
    }
  }, [showNameInput, mounted]);

  // Populate input field when modal opens with existing custom names
  useEffect(() => {
    if (showNameInput && isUsingCustomNames && wheelNames.length > 0) {
      // If we have custom names and the modal is opening, repopulate the input
      const customNamesString = wheelNames.join(", ");
      setInputValue(customNamesString);
      setLocalInputValue(customNamesString);
    }
  }, [showNameInput]); // Only run when showNameInput changes

  // Prevent body scroll when modals are open
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const anyModalOpen =
      showNameInput ||
      showMinNamesWarning ||
      showLongNameWarning ||
      showDuplicateWarning;

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
  }, [
    showNameInput,
    showMinNamesWarning,
    showLongNameWarning,
    showDuplicateWarning,
  ]);

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
      // Track validation warning
      trackValidationWarning("long_names", { count: longNames.length });
      return false;
    }
    return true;
  };

  const generateRandomNames = (count: number = 10) => {
    return getRandomNames(count);
  };

  const handleRandomNames = async () => {
    const count = Math.min(parseInt(randomNameCount) || 10, 99);
    const names = generateRandomNames(count);
    setWheelNames(names);
    setIsUsingCustomNames(false); // Track that we're using random names
    setShowNameInput(false);
    setShowRandomCountInput(false);
    // Track random names selection
    trackRandomSelection("names", count);
    trackInputMethodSelected("random");

    // Save configuration to database
    const configId = await saveConfiguration(names, undefined, "random");
    setCurrentConfigId(configId);
  };

  const handleSequentialNumbers = async () => {
    const count = Math.min(parseInt(randomNameCount) || 10, 99);
    const numbers = Array.from({ length: count }, (_, i) => (i + 1).toString());

    // Shuffle the numbers array to randomize their position on the wheel
    const shuffledNumbers = [...numbers];
    for (let i = shuffledNumbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledNumbers[i], shuffledNumbers[j]] = [
        shuffledNumbers[j],
        shuffledNumbers[i],
      ];
    }

    setWheelNames(shuffledNumbers);
    setIsUsingCustomNames(false); // Track that we're using sequential numbers
    setShowNameInput(false);
    setShowRandomCountInput(false);
    // Track sequential numbers selection
    trackRandomSelection("numbers", count);
    trackInputMethodSelected("numbers");

    // Save configuration to database
    const configId = await saveConfiguration(
      shuffledNumbers,
      undefined,
      "numbers"
    );
    setCurrentConfigId(configId);
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
        .replace(/\s+/g, " ") // Replace multiple spaces with single space
        .replace(/[^\w\s\-\.]/g, "") // Remove special characters except hyphens and dots
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
    return names.filter(
      (name, index, arr) =>
        arr.findIndex((n) => n.toLowerCase() === name.toLowerCase()) === index
    );
  }, []);

  const handleSubmitNames = () => {
    // This function now only handles custom names
    // Random generation is handled by separate functions

    // Use optimized name processing
    const rawNames = inputValue
      .split(/[,\s]+/)
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    const names = processNames(inputValue);

    // Show warning if duplicates were removed
    const duplicatesRemoved = rawNames.length - names.length;
    if (duplicatesRemoved > 0) {
      setDuplicateWarningText(
        `${duplicatesRemoved} duplicate ${
          duplicatesRemoved === 1 ? "name was" : "names were"
        } removed.`
      );
      setShowDuplicateWarning(true);
      // Track duplicate warning
      trackValidationWarning("duplicates", { count: duplicatesRemoved });
    }

    if (names.length >= 2) {
      // Validate name lengths before accepting
      if (validateNameLengths(names)) {
        setWheelNames(names);
        setIsUsingCustomNames(true); // Track that we're using custom names
        setShowNameInput(false);

        // Update document title with team name
        if (teamName) {
          document.title = `${teamName} – iWheeli – Random Name Picker Wheel`;
        }

        // Track custom names submission
        trackCustomNamesSubmitted(names.length, !!teamName);
        trackInputMethodSelected("custom");
        if (teamName) {
          trackTeamNameSet(true);
        }

        // Save configuration to database
        saveConfiguration(names, teamName || undefined, "custom").then(
          (configId) => {
            setCurrentConfigId(configId);
          }
        );
      }
    } else if (names.length === 1) {
      // Show styled warning modal
      setShowMinNamesWarning(true);
      // Track minimum names warning
      trackValidationWarning("min_names", { count: names.length });
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

      {/* Content overlay - not blurred */}
      <div className="relative z-10">
        {/* Name Input Popup (overlay on top of wheel) */}
        {showNameInput && (
          <div className="fixed inset-0 flex items-center justify-center z-[70] p-4 pointer-events-none">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full pointer-events-auto text-center relative">
              {/* Close button */}
              <button
                onClick={() => {
                  if (showRandomCountInput) {
                    // Go back to custom names input
                    setShowRandomCountInput(false);
                    trackModalClosed("random_input", "x_button");
                  } else {
                    // On custom names screen, X button goes to random selector
                    setShowRandomCountInput(true);
                    trackModalClosed("name_input", "x_to_random");
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
                  ? "How many random tiles?"
                  : "Customize Wheel"}
              </h2>
              {!showRandomCountInput && (
                <p className="text-gray-600 mb-4">
                  <span className="text-sm text-gray-500">
                    Input your own names/numbers <br></br>or use random to
                    select number of tiles.
                  </span>
                </p>
              )}
              {!showRandomCountInput ? (
                <>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Wheel name (optional)"
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
                    placeholder="eg: mike, cindy, jamal, wayne..."
                    className="w-full h-32 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
                    style={{ touchAction: "manipulation" }}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus={!showRandomCountInput && !isMobileDevice}
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
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min="2"
                          max="99"
                          value={randomNameCount}
                          onFocus={(e) => {
                            setHasStartedTyping(false);
                            e.target.select(); // Select all text for easy replacement
                          }}
                          onChange={(e) => {
                            let value = e.target.value;

                            // Check for non-numeric characters on desktop
                            if (value && !/^\d*$/.test(value)) {
                              // Flash a visual warning
                              e.target.style.borderColor = "red";
                              setTimeout(() => {
                                e.target.style.borderColor = "#3b82f6";
                              }, 500);
                              return;
                            }

                            // Handle fresh typing (replace existing value)
                            if (!hasStartedTyping && value.length > 0) {
                              setHasStartedTyping(true);
                            }

                            // Limit to 2 digits - keep last 2 digits if more are entered
                            if (value.length > 2) {
                              value = value.slice(-2);
                            }

                            // Allow empty string for user typing
                            if (value === "") {
                              setRandomNameCount("");
                              return;
                            }

                            // Accept any 1-2 digit number, validation happens on blur
                            setRandomNameCount(value);
                          }}
                          onBlur={(e) => {
                            // Ensure valid value on blur and exit edit mode
                            const num = parseInt(e.target.value);
                            if (isNaN(num) || num < 2) {
                              setRandomNameCount("2");
                            } else if (num > 99) {
                              setRandomNameCount("99");
                            }
                            setIsEditingCount(false);
                            setHasStartedTyping(false);
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
                          {randomNameCount} tiles
                        </button>
                      )}
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="99"
                      value={parseInt(randomNameCount) || 6}
                      onChange={(e) => setRandomNameCount(e.target.value)}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                      style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                          (((parseInt(randomNameCount) || 6) - 2) / 97) * 100
                        }%, #e5e7eb ${
                          (((parseInt(randomNameCount) || 6) - 2) / 97) * 100
                        }%, #e5e7eb 100%)`,
                        touchAction: "manipulation",
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
                      className={`w-1/3 px-6 py-3 font-semibold rounded-lg transition-colors cursor-pointer ${
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
                      className={`w-2/3 px-6 py-3 font-semibold rounded-lg transition-colors ${
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
                  <div className="flex gap-3">
                    <button
                      onClick={handleRandomNames}
                      className="flex-1 px-6 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors cursor-pointer"
                      style={{ touchAction: "manipulation" }}
                    >
                      Names
                    </button>
                    <button
                      onClick={handleSequentialNumbers}
                      className="flex-1 px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors cursor-pointer"
                      style={{ touchAction: "manipulation" }}
                    >
                      Numbers
                    </button>
                  </div>
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
                    Enter min. 2 names to spin the wheel
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
                  <p className="text-sm text-gray-600">
                    {duplicateWarningText}
                  </p>
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
            <Suspense
              fallback={<WheelLoadingPlaceholder />}
            >
              <SpinningWheel
                names={wheelNames.length > 0 ? wheelNames : undefined}
                includeFreeSpins={false}
                showBlank={showNameInput}
                configId={currentConfigId}
                onRecordSpin={recordSpin}
                onUpdateSpinAcknowledgment={updateSpinAcknowledgment}
                onRemoveWinner={async (newNames: string[]) => {
                  // Update the wheel names in the parent component
                  setWheelNames(newNames);
                  // Create new configuration with the remaining names
                  const newConfigId = await saveConfiguration(
                    newNames,
                    teamName || undefined,
                    "custom"
                  );
                  setCurrentConfigId(newConfigId);
                  return newConfigId;
                }}
                onReset={() => {
                  // Track reset action with context
                  trackWheelReset(isUsingCustomNames);
                  setShowNameInput(true);
                  // Preserve custom names and team name when resetting
                  // They will only be cleared if user explicitly clicks "Clear"
                  if (!isUsingCustomNames) {
                    // Only clear if we were using random/numbers
                    setInputValue("");
                    setLocalInputValue("");
                    setTeamName("");
                  }
                  // If using custom names, preserve them but show input modal
                  // The inputValue and teamName stay as they were
                  setShowRandomCountInput(false);
                  setCurrentConfigId(null);
                  document.title = teamName ? `${teamName} – iWheeli – Random Name Picker Wheel` : "iWheeli – Random Name Picker Wheel | Spin to Choose Names & Winners";
                }}
              />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
