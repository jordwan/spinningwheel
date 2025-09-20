"use client";

import { useState } from "react";
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
  const [includeFreeSpins] = useState(false);

  const generateRandomNames = (count: number = 10) => {
    return getRandomNames(count);
  };

  const handleSubmitNames = () => {
    // If showing random count input, generate random names
    if (showRandomCountInput) {
      const count = parseInt(randomNameCount) || 10;
      setWheelNames(generateRandomNames(count));
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

    if (names.length > 0) {
      setWheelNames(names);
      setShowNameInput(false);

      // Update document title with team name
      if (teamName) {
        document.title = `${teamName} - iWxeel`;
      }
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
      className="h-screen w-screen overflow-hidden relative"
      style={{
        boxShadow: `
          inset 0 0 40px rgba(255, 255, 255, 0.15),
          inset 0 0 80px rgba(255, 255, 255, 0.08)
        `,
      }}
    >
      {/* Blurred background image */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/bkgddT.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          filter: "blur(3px)",
          zIndex: -1,
        }}
      />

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
                    : "Enter comma separated names or use random"}
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
                  />
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="example: tom, jerry, bart, cindy..."
                    className="w-full h-32 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
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
                      onClick={() => setShowRandomCountInput(true)}
                      className="flex-1 px-6 py-3 bg-purple-500 text-white font-semibold rounded-lg hover:bg-purple-600 transition-colors cursor-pointer"
                    >
                      Random
                    </button>
                    <button
                      onClick={handleSubmitNames}
                      disabled={inputValue.trim() === ""}
                      className={`flex-1 px-6 py-3 font-semibold rounded-lg transition-colors ${
                        inputValue.trim() === ""
                          ? "bg-gray-300 text-gray-500"
                          : "bg-blue-500 text-white hover:bg-blue-600 cursor-pointer"
                      }`}
                    >
                      Enter
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleSubmitNames}
                    className="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors cursor-pointer"
                  >
                    Enter
                  </button>
                )}
              </div>
            </div>
          </div>
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
              includeFreeSpins={includeFreeSpins}
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
                setInputValue("");
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
