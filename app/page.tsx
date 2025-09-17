"use client";

import { useState } from "react";
import SpinningWheel from "./components/SpinningWheel";

export default function Home() {
  const [showNameInput, setShowNameInput] = useState(true);
  const [wheelNames, setWheelNames] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [teamName, setTeamName] = useState("");

  const generateRandomNames = () => {
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

    // Shuffle and pick 10 random names
    const shuffled = [...firstNames].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 10);
  };

  const handleSubmitNames = () => {
    // Parse comma-separated names and trim whitespace
    const names = inputValue
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    if (names.length > 0) {
      setWheelNames(names);
      setShowNameInput(false);
    } else {
      // If no input, generate random names
      setWheelNames(generateRandomNames());
      setShowNameInput(false);
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
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Name Input Popup (no overlay) */}
      {showNameInput && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full pointer-events-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Add Names to the Wheel
            </h2>
            <p className="text-gray-600 mb-4">
              Enter comma-separated names - name1, name2, etc
              <br />
              <span className="text-sm text-gray-500">
                Leave empty for random names
              </span>
            </p>
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
              placeholder="Enter comma separated names..."
              className="w-full h-32 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
              autoFocus
            />
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
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-800 mb-6 text-center">
          iWxeel
        </h1>
        <div className="flex-1 w-full max-w-4xl">
          {!showNameInput && (
            <SpinningWheel
              names={wheelNames}
              onReset={() => {
                setShowNameInput(true);
                setInputValue("");
                setTeamName("");
                document.title = "iWxeel";
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}
