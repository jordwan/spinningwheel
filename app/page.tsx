"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
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
  trackWhatsAppShare,
  trackShareModalOpened,
  startSession,
  endSession,
} from "./utils/analytics";
import { useSession } from "../hooks/useSession";
import { useViewportHeight } from "../hooks/useViewportHeight";
import HuePicker from "./components/HuePicker";
import { accentHexFromHue, hexToHsl, isValidHexColor } from "../lib/utils/palette";

// Lazy load the heavy SpinningWheel component
const SpinningWheel = lazy(() => import("./components/SpinningWheel"));

// Loading placeholder component for better LCP
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

export default function Home() {
  const [showNameInput, setShowNameInput] = useState(true);
  const [wheelNames, setWheelNames] = useState<string[]>([]);
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
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [currentShareSlug, setCurrentShareSlug] = useState<string | null>(null);
  // Wheel colours: automatic theme, or a user-picked accent hue
  const [accentHue, setAccentHue] = useState(210);
  const [useCustomColor, setUseCustomColor] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const accentColor = useCustomColor ? accentHexFromHue(accentHue) : null;

  // Session tracking
  const {
    saveConfiguration,
    recordSpin,
    updateSpinAcknowledgment,
    createShareableWheel,
    getLastConfiguration,
  } = useSession();

  // Textarea contents (parsed only on submit)
  const [localInputValue, setLocalInputValue] = useState("");

  // Hydration guard - ensures client-side rendering
  useEffect(() => {
    setMounted(true);

    // Start analytics session
    startSession();

    // Welcome back: prefill the last custom wheel from this browser so a returning
    // teacher/host doesn't retype the list. They still confirm with "Create wheel".
    const last = getLastConfiguration();
    if (last && last.inputMethod === "custom" && last.names.length >= 2) {
      setLocalInputValue(last.names.join(", "));
      if (last.teamName) setTeamName(last.teamName);
    }
    if (last && isValidHexColor(last.accentColor)) {
      setAccentHue(Math.round(hexToHsl(last.accentColor).h));
      setUseCustomColor(true);
    }

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
  }, [getLastConfiguration]);

  // Unified viewport management
  const { isFirefox } = useViewportHeight({
    enableFirefoxSupport: true,
    enableKeyboardDetection: true,
    modalOpen:
      showNameInput ||
      showMinNamesWarning ||
      showLongNameWarning ||
      showDuplicateWarning ||
      showShareModal,
  });

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
      setLocalInputValue(customNamesString);
    }
  }, [showNameInput, isUsingCustomNames, wheelNames]); // Include all dependencies

  // Prevent body scroll when modals are open
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const anyModalOpen =
      showNameInput ||
      showMinNamesWarning ||
      showLongNameWarning ||
      showDuplicateWarning ||
      showShareModal;

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
    showShareModal,
  ]);

  // Escape key dismisses the colour popover, then the simple modals (warnings + share)
  useEffect(() => {
    const anyDismissable =
      showColorPicker ||
      showMinNamesWarning ||
      showLongNameWarning ||
      showDuplicateWarning ||
      showShareModal;
    if (!anyDismissable) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showColorPicker) {
        setShowColorPicker(false);
        return;
      }
      setShowMinNamesWarning(false);
      setShowLongNameWarning(false);
      setShowDuplicateWarning(false);
      setShowShareModal(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    showColorPicker,
    showMinNamesWarning,
    showLongNameWarning,
    showDuplicateWarning,
    showShareModal,
  ]);

  // Clicking anywhere outside the colour popover closes it
  useEffect(() => {
    if (!showColorPicker) return;
    const onPointerDown = (e: PointerEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [showColorPicker]);

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

  const randomCount = Math.min(Math.max(parseInt(randomNameCount) || 6, 2), 99);

  const handleRandomNames = async () => {
    const count = randomCount;
    const names = generateRandomNames(count);
    setWheelNames(names);
    setIsUsingCustomNames(false); // Track that we're using random names
    setShowNameInput(false);
    setShowRandomCountInput(false);
    setCurrentShareSlug(null); // Clear any existing share slug since config changed
    // Track random names selection
    trackRandomSelection("names", count);
    trackInputMethodSelected("random");

    // Save configuration to database
    const configId = await saveConfiguration(names, undefined, "random", accentColor);
    setCurrentConfigId(configId);
  };

  const handleSequentialNumbers = async () => {
    const count = randomCount;
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
    setCurrentShareSlug(null); // Clear any existing share slug since config changed
    // Track sequential numbers selection
    trackRandomSelection("numbers", count);
    trackInputMethodSelected("numbers");

    // Save configuration to database
    const configId = await saveConfiguration(
      shuffledNumbers,
      undefined,
      "numbers",
      accentColor
    );
    setCurrentConfigId(configId);
  };

  const handleInputChange = useCallback((value: string) => {
    setLocalInputValue(value);
  }, []);

  // Memoized enhanced name processing to reduce computation
  const processNames = useCallback(
    (input: string): { names: string[]; duplicatesRemoved: number } => {
      const enhancedTrim = (name: string): string => {
        return name
          .trim()
          .replace(/\s+/g, " ") // Replace multiple spaces with single space
          // Keep letters and digits from any language (José, Zoë, 李), plus spaces,
          // hyphens, dots, underscores and apostrophes. The old \w-based version
          // silently mangled accented names ("José" became "Jos").
          .replace(/[^\p{L}\p{M}\p{N}\s\-\._']/gu, "");
        // No length cap here: validateNameLengths() warns the user instead of
        // silently chopping "Alexander Hamilton Jr" to 20 characters.
      };

      // Delimiter priority: commas, then one-name-per-line (pasted rosters like
      // "Mary Ann\nJohn Smith"), then plain whitespace.
      const trimmed = input.trim();
      const separator = trimmed.includes(",")
        ? ","
        : /\r?\n/.test(trimmed)
        ? /\r?\n/
        : /\s+/;

      const cleaned = trimmed
        .split(separator)
        .map(enhancedTrim)
        .filter((name) => name.length > 0);

      // Remove duplicates (case-insensitive)
      const names = cleaned.filter(
        (name, index, arr) =>
          arr.findIndex((n) => n.toLowerCase() === name.toLowerCase()) === index
      );

      return { names, duplicatesRemoved: cleaned.length - names.length };
    },
    []
  );

  // Parsed live as the user types: powers the "4 names ready" hint and the wheel preview
  const parsedInput = useMemo(
    () => processNames(localInputValue),
    [processNames, localInputValue]
  );
  const previewNames = parsedInput.names;

  // Changing colours invalidates the share link and the saved config (both carry the colour)
  const handleAccentHueChange = (hue: number) => {
    setAccentHue(hue);
    setUseCustomColor(true);
    setCurrentShareSlug(null);
    setCurrentConfigId(null);
  };
  const handleAutoColors = () => {
    setUseCustomColor(false);
    setCurrentShareSlug(null);
    setCurrentConfigId(null);
    setShowColorPicker(false); // choosing Auto is a complete answer; no extra Done needed
  };

  // Close the setup card and keep whatever wheel is behind it (or a blank one to play with)
  const handleCloseNameInput = () => {
    setShowNameInput(false);
    setShowRandomCountInput(false);
    trackModalClosed("name_input", "x_button");
    // Reset cleared the config id; re-save so spins on the kept wheel are recorded
    if (wheelNames.length >= 2 && !currentConfigId) {
      saveConfiguration(
        wheelNames,
        teamName || undefined,
        isUsingCustomNames ? "custom" : "random",
        accentColor
      ).then((configId) => setCurrentConfigId(configId));
    }
  };

  const handleSubmitNames = () => {
    // This function now only handles custom names
    // Random generation is handled by separate functions
    const { names, duplicatesRemoved } = parsedInput;

    // Show warning if duplicates were removed
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
        setCurrentShareSlug(null); // Clear any existing share slug since config changed

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
        saveConfiguration(names, teamName || undefined, "custom", accentColor).then(
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

  // Handle creating a shareable link
  const handleCreateShare = async () => {
    if (wheelNames.length < 2) return;

    setIsCreatingShare(true);
    try {
      // Check if we already have a slug for this wheel configuration
      let slug = currentShareSlug;

      // Only create a new slug if we don't have one yet
      if (!slug) {
        slug = await createShareableWheel(
          wheelNames,
          teamName || undefined,
          isUsingCustomNames ? 'custom' : 'random',
          accentColor
        );

        if (slug) {
          // Save the slug so we reuse it next time
          setCurrentShareSlug(slug);
        }
      }

      if (slug) {
        const url = `${window.location.origin}/${slug}`;
        setShareUrl(url);
        setShowShareModal(true);
        trackShareModalOpened('button');
      } else {
        alert('Failed to create shareable link. Please try again.');
      }
    } catch (err) {
      console.error('Error creating shareable link:', err);
      alert('Failed to create shareable link. Please try again.');
    } finally {
      setIsCreatingShare(false);
    }
  };

  // Copy share URL to clipboard
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShowCopySuccess(true);
      setTimeout(() => setShowCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setShowCopySuccess(true);
        setTimeout(() => setShowCopySuccess(false), 2000);
      } catch {
        alert('Failed to copy URL. Please copy manually: ' + shareUrl);
      }
      document.body.removeChild(textArea);
    }
  };

  // Share to WhatsApp
  const handleWhatsAppShare = () => {
    try {
      const wheelTitle = teamName || 'Spinning Wheel';
      const message = `Check out this wheel! ${wheelTitle} - ${shareUrl}`;
      const encodedMessage = encodeURIComponent(message);

      const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;

      trackWhatsAppShare(shareUrl, !!teamName);

      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Failed to share to WhatsApp:', err);
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
      <div className="relative z-10 h-[100svh] h-[100vh]">
        {/* Name Input Popup (overlay on top of wheel) */}
        {showNameInput && (
          <div className="fixed inset-0 flex items-center justify-center z-[70] p-4 pointer-events-none">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Customize Wheel"
              className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-2xl w-full pointer-events-auto text-center relative"
            >
              {/* Close button - keeps the wheel behind (or a blank one to play with) */}
              <button
                onClick={handleCloseNameInput}
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

              <h2 className="text-2xl font-bold text-gray-800 mb-1">Customize Wheel</h2>
              <p className="text-sm text-gray-500 mb-4">
                Add at least 2 names, or generate random names or numbers.
              </p>

              {/* 1. Names */}
              <textarea
                value={localInputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="mike, cindy, jamal, wayne"
                aria-label="Names for the wheel"
                aria-describedby="names-help"
                className="w-full h-32 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
                style={{ touchAction: "manipulation" }}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus={!isMobileDevice}
              />

              {/* Live parsing feedback */}
              <div
                id="names-help"
                className="flex items-center justify-between gap-3 mt-1.5 mb-3 min-h-[1.25rem] text-xs text-left"
              >
                <span
                  className={
                    previewNames.length >= 2
                      ? "text-green-600 font-medium"
                      : "text-gray-500"
                  }
                  aria-live="polite"
                >
                  {localInputValue.trim() === ""
                    ? "Separate names with commas, or put one per line"
                    : previewNames.length === 0
                    ? "Keep typing\u2026"
                    : previewNames.length === 1
                    ? "1 name so far. Add at least one more"
                    : `${previewNames.length} names ready${
                        parsedInput.duplicatesRemoved > 0
                          ? ` (${parsedInput.duplicatesRemoved} duplicate${
                              parsedInput.duplicatesRemoved === 1 ? "" : "s"
                            } ignored)`
                          : ""
                      }`}
                </span>
                {localInputValue.trim() !== "" && (
                  <button
                    type="button"
                    onClick={() => {
                      setLocalInputValue("");
                      setTeamName("");
                    }}
                    className="text-gray-400 hover:text-red-600 underline whitespace-nowrap cursor-pointer"
                    style={{ touchAction: "manipulation" }}
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* 2. Wheel name + colour swatch */}
              <div className="flex items-end gap-3 mb-4">
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Wheel name (optional)"
                  aria-label="Wheel name (optional)"
                  className="flex-1 min-w-0 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  style={{ touchAction: "manipulation" }}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                />

                {/* Colour: a swatch showing what the wheel will use; click for the picker */}
                <div ref={colorPickerRef} className="relative flex flex-col items-center flex-shrink-0">
                  <span className="text-[11px] leading-none text-gray-500 mb-1">Colors</span>
                  <button
                    type="button"
                    onClick={() => setShowColorPicker((open) => !open)}
                    aria-haspopup="dialog"
                    aria-expanded={showColorPicker}
                    aria-label={useCustomColor ? "Wheel color (custom). Change" : "Wheel color: auto. Change"}
                    title="Wheel colors"
                    className="w-[52px] h-[52px] rounded-lg border-2 border-gray-300 hover:border-blue-500 shadow-sm flex items-center justify-center cursor-pointer transition-colors"
                    style={{
                      touchAction: "manipulation",
                      background: accentColor
                        ? accentColor
                        : "conic-gradient(from 0deg, hsl(0 85% 55%), hsl(60 85% 55%), hsl(120 85% 50%), hsl(180 85% 50%), hsl(240 85% 58%), hsl(300 85% 58%), hsl(360 85% 55%))",
                    }}
                  >
                    {!useCustomColor && (
                      <span
                        className="text-[11px] font-bold text-white"
                        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.7)" }}
                      >
                        Auto
                      </span>
                    )}
                  </button>

                  {showColorPicker && (
                    <div
                      role="dialog"
                      aria-label="Pick a wheel color"
                      className="absolute right-0 z-20 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 flex flex-col items-center gap-3"
                      style={{ bottom: "calc(100% + 8px)", width: "11rem" }}
                    >
                      <HuePicker
                        hue={accentHue}
                        active={useCustomColor}
                        onChange={handleAccentHueChange}
                        onActivate={() => {
                          if (!useCustomColor) handleAccentHueChange(accentHue);
                        }}
                        size={112}
                      />
                      <p className="text-[11px] text-gray-500 -mt-1">Drag around the ring</p>
                      <div className="flex gap-2 w-full">
                        <button
                          type="button"
                          onClick={handleAutoColors}
                          aria-pressed={!useCustomColor}
                          className={`flex-1 px-3 py-1.5 text-sm font-semibold rounded-lg border-2 transition-colors cursor-pointer ${
                            !useCustomColor
                              ? "border-blue-500 text-blue-600 bg-blue-50"
                              : "border-gray-300 text-gray-600 hover:border-blue-400"
                          }`}
                          style={{ touchAction: "manipulation" }}
                        >
                          Auto
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowColorPicker(false)}
                          className="flex-1 px-3 py-1.5 text-sm font-semibold rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors cursor-pointer"
                          style={{ touchAction: "manipulation" }}
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRandomCountInput((open) => !open)}
                  aria-expanded={showRandomCountInput}
                  aria-controls="random-panel"
                  className={`w-1/3 px-2 sm:px-4 py-3 font-semibold rounded-lg border-2 transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                    showRandomCountInput
                      ? "border-blue-500 text-blue-600 bg-blue-50"
                      : "border-gray-300 text-gray-700 hover:border-blue-500 hover:text-blue-600"
                  }`}
                  style={{ touchAction: "manipulation" }}
                >
                  Random
                  <svg
                    className={`w-4 h-4 flex-shrink-0 transition-transform ${showRandomCountInput ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <button
                  onClick={handleSubmitNames}
                  disabled={previewNames.length < 2}
                  className={`w-2/3 px-6 py-3 font-semibold rounded-lg transition-colors ${
                    previewNames.length < 2
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-green-500 text-white hover:bg-green-600 cursor-pointer"
                  }`}
                  style={{ touchAction: "manipulation" }}
                >
                  Create wheel
                </button>
              </div>

              {/* Random names / numbers panel (expands in place) */}
              {showRandomCountInput && (
                <div
                  id="random-panel"
                  className="mt-4 pt-4 border-t border-gray-200 text-left"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">How many tiles?</span>
                    {isEditingCount ? (
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min="2"
                        max="99"
                        value={randomNameCount}
                        aria-label="Number of tiles"
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
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur();
                          }
                        }}
                        className="text-lg font-semibold text-gray-700 text-center bg-transparent border-b-2 border-blue-500 outline-none w-20 px-2 py-1 h-8 rounded"
                        style={{ touchAction: "manipulation" }}
                        autoFocus
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsEditingCount(true)}
                        className="text-lg font-semibold text-gray-700 hover:text-blue-600 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-gray-100"
                        style={{ touchAction: "manipulation" }}
                        title="Type a number"
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
                    aria-label="Number of tiles"
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    style={{
                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                        (((parseInt(randomNameCount) || 6) - 2) / 97) * 100
                      }%, #e5e7eb ${
                        (((parseInt(randomNameCount) || 6) - 2) / 97) * 100
                      }%, #e5e7eb 100%)`,
                      touchAction: "manipulation",
                    }}
                    autoFocus={!isEditingCount}
                  />
                  <div className="flex gap-3 mt-3">
                    <button
                      onClick={handleRandomNames}
                      className="flex-1 px-4 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors cursor-pointer"
                      style={{ touchAction: "manipulation" }}
                    >
                      {randomCount} random names
                    </button>
                    <button
                      onClick={handleSequentialNumbers}
                      className="flex-1 px-4 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors cursor-pointer"
                      style={{ touchAction: "manipulation" }}
                    >
                      Numbers 1–{randomCount}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Minimum Names Warning Modal */}
        {showMinNamesWarning && (
          <>
            <div className="fixed inset-0 backdrop-blur-[2px] z-[79]" />
            <div className="fixed inset-0 flex items-center justify-center z-[80] p-4 pointer-events-none">
              <div
                role="dialog"
                aria-modal="true"
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
            <div className="fixed inset-0 backdrop-blur-[2px] z-[79]" />
            <div className="fixed inset-0 flex items-center justify-center z-[80] p-4 pointer-events-none">
              <div
                role="dialog"
                aria-modal="true"
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
            <div className="fixed inset-0 backdrop-blur-[2px] z-[79]" />
            <div className="fixed inset-0 flex items-center justify-center z-[80] p-4 pointer-events-none">
              <div
                role="dialog"
                aria-modal="true"
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

        {/* Share Modal */}
        {showShareModal && (
          <>
            <div className="fixed inset-0 backdrop-blur-[2px] z-[79]" />
            <div className="fixed inset-0 flex items-center justify-center z-[80] p-4 pointer-events-none">
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Share Your Wheel"
                className="bg-white rounded-2xl p-6 max-w-md w-full pointer-events-auto text-center relative"
                style={{
                  boxShadow:
                    "0 0 40px rgba(0, 0, 0, 0.3), 0 0 80px rgba(0, 0, 0, 0.15)",
                }}
              >
                {/* Close button */}
                <button
                  onClick={() => setShowShareModal(false)}
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

                <div className="mb-4">
                  <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-3">
                    <svg
                      className="w-6 h-6 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Share Your Wheel
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Anyone with this link can view and spin this wheel
                  </p>

                  {/* URL Display */}
                  <div className="bg-gray-100 rounded-lg p-3 mb-3 break-all text-sm text-gray-700 font-mono">
                    {shareUrl}
                  </div>
                </div>

                <button
                  onClick={handleCopyUrl}
                  className="w-full px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors cursor-pointer flex items-center justify-center gap-2"
                  style={{ touchAction: "manipulation" }}
                >
                  {showCopySuccess ? (
                    <>
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      Copy Link
                    </>
                  )}
                </button>

                {/* WhatsApp Share Button */}
                <button
                  onClick={handleWhatsAppShare}
                  className="w-full px-4 py-2 mt-3 bg-[#25D366] text-white font-semibold rounded-lg hover:bg-[#1fb855] transition-colors cursor-pointer flex items-center justify-center gap-2"
                  style={{ touchAction: "manipulation" }}
                  aria-label="Share on WhatsApp"
                >
                  {/* WhatsApp Icon SVG */}
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  Share on WhatsApp
                </button>
              </div>
            </div>
          </>
        )}

        <main className="h-full w-full flex flex-col relative">
          {/* Logo - Fixed in top-left corner */}
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-20 flex-shrink-0">
            <div
              className="relative w-36 h-12 sm:w-44 sm:h-15 lg:w-52 lg:h-18"
              style={{
                filter:
                  "drop-shadow(0 0 12px rgba(255, 255, 255, 0.35)) drop-shadow(0 0 24px rgba(255, 255, 255, 0.2))",
              }}
            >
              <Image
                src="/logo.png"
                alt="iWheeli"
                fill
                sizes="(min-width: 1024px) 208px, (min-width: 640px) 176px, 144px"
                className="object-contain"
                priority
              />
            </div>
          </div>

          {/* Share button - Fixed in top-right corner when available */}
          {wheelNames.length >= 2 && !showNameInput && (
            <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20 flex-shrink-0">
              <button
                onClick={handleCreateShare}
                disabled={isCreatingShare}
                className="px-4 py-2 sm:px-5 sm:py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 text-sm sm:text-base"
                style={{ touchAction: "manipulation" }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 sm:h-5 sm:w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
                <span>{isCreatingShare ? 'Creating...' : 'Share'}</span>
              </button>
            </div>
          )}

          {/* Wheel container - takes all available space */}
          <div className="flex-1 w-full max-w-5xl mx-auto min-h-0 flex flex-col overflow-hidden py-2">
            <Suspense
              fallback={<WheelLoadingPlaceholder />}
            >
              <SpinningWheel
                names={
                  showNameInput && previewNames.length >= 2
                    ? previewNames
                    : wheelNames.length >= 2
                    ? wheelNames
                    : undefined
                }
                showBlank={!(showNameInput && previewNames.length >= 2) && wheelNames.length < 2}
                controlsDisabled={showNameInput}
                accentColor={accentColor}
                isFirefox={isFirefox}
                configId={currentConfigId}
                onRecordSpin={recordSpin}
                onUpdateSpinAcknowledgment={updateSpinAcknowledgment}
                onRemoveWinner={async (newNames: string[]) => {
                  // Update the wheel names in the parent component
                  setWheelNames(newNames);
                  setCurrentShareSlug(null); // Clear share slug since config changed
                  // Create new configuration with the remaining names
                  const newConfigId = await saveConfiguration(
                    newNames,
                    teamName || undefined,
                    "custom",
                    accentColor
                  );
                  setCurrentConfigId(newConfigId);
                  return newConfigId;
                }}
                onReset={() => {
                  // Track reset action with context
                  trackWheelReset(isUsingCustomNames);
                  setShowNameInput(true);
                  setCurrentShareSlug(null); // Clear share slug on reset
                  // Preserve custom names and team name when resetting
                  // They will only be cleared if user explicitly clicks "Clear"
                  if (!isUsingCustomNames) {
                    // Only clear if we were using random/numbers
                    setLocalInputValue("");
                    setTeamName("");
                  }
                  // If using custom names, preserve them but show input modal
                  // The input and teamName stay as they were
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
