"use client";

import { useState } from "react";
import Image from "next/image";
import SpinningWheel from "./components/SpinningWheel";

export default function Home() {
  const [showNameInput, setShowNameInput] = useState(true);
  const [wheelNames, setWheelNames] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [teamName, setTeamName] = useState("");
  const [randomNameCount, setRandomNameCount] = useState("10");
  const [showRandomCountInput, setShowRandomCountInput] = useState(false);

  const generateRandomNames = (count: number = 10) => {
    const firstNames = [
      "Emma",
      "Liam",
      "Olivia",
      "Noah",
      "Ava",
      "Ethan",
      "Sophia",
      "Mason",
      "Isabella",
      "William",
      "Mia",
      "James",
      "Charlotte",
      "Benjamin",
      "Amelia",
      "Lucas",
      "Harper",
      "Henry",
      "Evelyn",
      "Alex",
      "Luna",
      "Jack",
      "Ella",
      "Daniel",
      "Chloe",
      "Matthew",
      "Grace",
      "Jackson",
      "Zoe",
      "David",
      "Lily",
      "Leo",
      "Aria",
      "Ryan",
      "Hazel",
      "Nathan",
      "Ellie",
      "Adam",
      "Sofia",
      "Owen",
      "Avery",
      "Luke",
      "Madison",
      "Gabriel",
      "Scarlett",
      "Anthony",
      "Abigail",
      "Isaac",
      "Emily",
      "Dylan",
      "Mila",
      "Julian",
      "Sam",
      "Max",
      "Victoria",
      "Felix",
      "Maya",
      "Oscar",
      "Aurora",
      "Theo",
      "Penelope",
      "Charlie",
      "Riley",
      "Jake",
      "Nora",
      "Finn",
    ];

    // Shuffle and pick specified number of random names
    const shuffled = [...firstNames].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
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

    // Parse comma-separated names and trim whitespace
    const names = inputValue
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    if (names.length > 0) {
      setWheelNames(names);
      setShowNameInput(false);
    } else {
      // If no input, show the random count input
      setShowRandomCountInput(true);
    }

    // Update document title with team name
    if (teamName) {
      document.title = `${teamName} - iWxeel`;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitNames();
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden relative">
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
        {/* Name Input Popup (no overlay) */}
        {showNameInput && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full pointer-events-auto text-center relative">
              {/* Close X button */}
              <button
                onClick={() => {
                  if (inputValue.trim() === "") {
                    setShowRandomCountInput(true);
                  } else {
                    handleSubmitNames();
                  }
                }}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-black hover:text-gray-100 hover:bg-black rounded-full transition-colors"
              >
                X
              </button>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                {showRandomCountInput ? "How many random names?" : "Enter Names Below"}
              </h2>
              <p className="text-gray-600 mb-4">
                <span className="text-sm text-gray-500">
                  {showRandomCountInput ? "Choose between 2-50 names" : "Enter comma separated names. Leave blank for random."}
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
                    placeholder="example: tom, jerry, beavis, bart, etc."
                    className="w-full h-32 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
                    autoFocus
                  />
                </>
              ) : (
                <input
                  type="number"
                  value={randomNameCount}
                  onChange={(e) => setRandomNameCount(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Number of random names"
                  min="2"
                  max="50"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  autoFocus
                />
              )}
              <div className="mt-6">
                <button
                  onClick={handleSubmitNames}
                  className="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Enter
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="h-full w-full flex flex-col items-center justify-center p-4">
          <div className="mb-4 flex justify-center">
            <div className="relative h-20 sm:h-24 lg:h-28 w-52 sm:w-48 lg:w-64">
              <Image
                src="/logo.png"
                alt="iWxeel"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>
          <div className="flex-1 w-full max-w-4xl">
            {!showNameInput && (
              <SpinningWheel
                names={wheelNames}
                onReset={() => {
                  setShowNameInput(true);
                  setInputValue("");
                  setTeamName("");
                  setShowRandomCountInput(false);
                  document.title = "iWxeel";
                }}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
