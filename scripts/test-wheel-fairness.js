// Test script to verify wheel fairness over 100,000 spins
// Simulates the exact logic from SpinningWheel.tsx

// Crypto random function (same as in the component)
const cryptoRandom = () => {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    const u32 = new Uint32Array(1);
    globalThis.crypto.getRandomValues(u32);
    return u32[0] / 4294967296; // [0,1)
  }
  return Math.random();
};

// Simulate wheel with different numbers of segments
function runSimulation(numNames = 10, numSpins = 100000) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing with ${numNames} names, ${numSpins} spins`);
  console.log(`${'='.repeat(60)}`);

  // Create test names
  const wheelNames = Array.from({ length: numNames }, (_, i) => `Name${i + 1}`);

  // Track statistics
  const winCounts = new Map();
  const consecutiveWins = new Map(); // Track back-to-back same winner
  const transitionMatrix = new Map(); // Track winner A -> winner B patterns
  let lastWinner = null;
  let rotation = 0; // Current wheel position (simulating state)

  // Initialize counters
  wheelNames.forEach(name => {
    winCounts.set(name, 0);
    consecutiveWins.set(name, 0);
    transitionMatrix.set(name, new Map());
    wheelNames.forEach(otherName => {
      transitionMatrix.get(name).set(otherName, 0);
    });
  });

  // Run simulations
  console.log('Running simulation...');
  for (let spin = 0; spin < numSpins; spin++) {
    // Simulate the spin logic exactly as in the component
    const speedIndicator = 0.5; // Middle power setting
    const spinStrength = speedIndicator;
    const baseRotations = 2.5 + spinStrength * 5; // 2.5 to 7.5 rotations

    // Simple random spin - let wheel land wherever it naturally stops
    const finalRotation = rotation + Math.PI * 2 * (baseRotations + cryptoRandom() * 2);

    // Calculate winner (exact same logic as component)
    const segmentSize = (2 * Math.PI) / wheelNames.length;
    const normalizedRotation = (2 * Math.PI - (finalRotation % (2 * Math.PI))) % (2 * Math.PI);
    const selectedIndex = Math.floor(normalizedRotation / segmentSize);
    const winner = wheelNames[selectedIndex % wheelNames.length];

    // Track statistics
    winCounts.set(winner, winCounts.get(winner) + 1);

    // Track consecutive patterns
    if (lastWinner === winner) {
      consecutiveWins.set(winner, consecutiveWins.get(winner) + 1);
    }

    // Track transitions
    if (lastWinner) {
      const transitions = transitionMatrix.get(lastWinner);
      transitions.set(winner, transitions.get(winner) + 1);
    }

    // Update state for next spin (simulating back-to-back spins)
    rotation = finalRotation;
    lastWinner = winner;

    // Progress indicator
    if (spin > 0 && spin % 10000 === 0) {
      process.stdout.write(`\rProgress: ${spin}/${numSpins} (${(spin/numSpins*100).toFixed(1)}%)`);
    }
  }
  console.log(`\rProgress: ${numSpins}/${numSpins} (100.0%) ✓`);

  // Calculate statistics
  const expectedWinsPerName = numSpins / numNames;
  const expectedProbability = 1 / numNames;

  console.log('\n📊 DISTRIBUTION RESULTS:');
  console.log('-'.repeat(50));

  let chiSquare = 0;
  let maxDeviation = 0;
  let minWins = numSpins;
  let maxWins = 0;

  wheelNames.forEach(name => {
    const wins = winCounts.get(name);
    const probability = wins / numSpins;
    const deviation = ((probability - expectedProbability) / expectedProbability * 100).toFixed(2);

    // Chi-square calculation
    const chiComponent = Math.pow(wins - expectedWinsPerName, 2) / expectedWinsPerName;
    chiSquare += chiComponent;

    maxDeviation = Math.max(maxDeviation, Math.abs(parseFloat(deviation)));
    minWins = Math.min(minWins, wins);
    maxWins = Math.max(maxWins, wins);

    console.log(`${name.padEnd(10)} | Wins: ${wins.toString().padStart(6)} | ${(probability * 100).toFixed(2)}% | Dev: ${deviation}%`);
  });

  console.log('\n📈 STATISTICAL ANALYSIS:');
  console.log('-'.repeat(50));
  console.log(`Expected wins per name: ${expectedWinsPerName.toFixed(0)}`);
  console.log(`Actual range: ${minWins} - ${maxWins}`);
  console.log(`Max deviation from expected: ${maxDeviation.toFixed(2)}%`);
  console.log(`Chi-square statistic: ${chiSquare.toFixed(2)}`);

  // Chi-square critical value for p=0.05
  const degreesOfFreedom = numNames - 1;
  const criticalValues = {
    5: 11.07,
    9: 16.92,
    19: 30.14,
    99: 123.23
  };
  const criticalValue = criticalValues[degreesOfFreedom] || degreesOfFreedom * 1.2;

  console.log(`Chi-square critical value (p=0.05): ${criticalValue.toFixed(2)}`);
  console.log(`Result: ${chiSquare < criticalValue ? '✅ FAIR (random)' : '❌ BIASED (not random)'}`);

  // Analyze consecutive wins
  console.log('\n🔄 CONSECUTIVE WIN ANALYSIS:');
  console.log('-'.repeat(50));
  let totalConsecutive = 0;
  wheelNames.forEach(name => {
    const consecutive = consecutiveWins.get(name);
    if (consecutive > 0) {
      totalConsecutive += consecutive;
      console.log(`${name}: ${consecutive} back-to-back wins`);
    }
  });

  const expectedConsecutive = numSpins / numNames / numNames; // Rough expected value
  console.log(`\nTotal consecutive wins: ${totalConsecutive}`);
  console.log(`Expected (rough): ${expectedConsecutive.toFixed(0)}`);
  console.log(`Ratio: ${(totalConsecutive / expectedConsecutive).toFixed(2)}x expected`);

  // Analyze transition patterns (simplified)
  console.log('\n🔀 TRANSITION BIAS CHECK:');
  console.log('-'.repeat(50));
  console.log('Checking if any segment is more likely to follow another...');

  let maxTransitionBias = 0;
  let biasedTransition = '';

  wheelNames.forEach(fromName => {
    const transitions = transitionMatrix.get(fromName);
    const totalTransitions = Array.from(transitions.values()).reduce((a, b) => a + b, 0);

    if (totalTransitions > 0) {
      transitions.forEach((count, toName) => {
        const actualProb = count / totalTransitions;
        const expectedProb = 1 / numNames;
        const bias = Math.abs(actualProb - expectedProb);

        if (bias > maxTransitionBias) {
          maxTransitionBias = bias;
          biasedTransition = `${fromName} -> ${toName}: ${(actualProb * 100).toFixed(2)}% (expected ${(expectedProb * 100).toFixed(2)}%)`;
        }
      });
    }
  });

  console.log(`Maximum transition bias: ${(maxTransitionBias * 100).toFixed(2)}%`);
  if (maxTransitionBias > 0.05) { // More than 5% deviation
    console.log(`Most biased transition: ${biasedTransition}`);
  }

  // Check for streak patterns
  console.log('\n🎯 STREAK ANALYSIS:');
  console.log('-'.repeat(50));
  const longestStreak = Math.max(...Array.from(consecutiveWins.values()));
  console.log(`Longest streak of same winner: ${longestStreak + 1} times`);
  console.log(`Probability of this happening by chance: ~${(Math.pow(1/numNames, longestStreak) * 100).toFixed(6)}%`);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`VERDICT: ${chiSquare < criticalValue && maxTransitionBias < 0.1 ?
    '✅ WHEEL IS FAIR for both single and consecutive spins' :
    '⚠️ POTENTIAL BIAS DETECTED'}`);
  console.log(`${'='.repeat(60)}`);

  return { chiSquare, maxTransitionBias, totalConsecutive };
}

// Run tests
console.log('🎰 WHEEL FAIRNESS TEST - 100,000 SPINS SIMULATION');
console.log('Testing with cryptographically secure randomness...');
console.log('Simulating back-to-back spins as a real user would...\n');

// Test with 6 names (small wheel)
console.log('Test 1/3: Small wheel (6 names)');
const result6 = runSimulation(6, 100000);

// Test with 10 names (medium wheel)
console.log('\nTest 2/3: Medium wheel (10 names)');
const result10 = runSimulation(10, 100000);

// Test with 20 names (large wheel)
console.log('\nTest 3/3: Large wheel (20 names)');
const result20 = runSimulation(20, 100000);

// Final summary
console.log('\n' + '='.repeat(60));
console.log('📋 FINAL SUMMARY');
console.log('='.repeat(60));
console.log('All wheel sizes tested with 100,000 spins each:');
console.log(`6 names:  Chi² = ${result6.chiSquare.toFixed(2)}, Max transition bias = ${(result6.maxTransitionBias * 100).toFixed(2)}%`);
console.log(`10 names: Chi² = ${result10.chiSquare.toFixed(2)}, Max transition bias = ${(result10.maxTransitionBias * 100).toFixed(2)}%`);
console.log(`20 names: Chi² = ${result20.chiSquare.toFixed(2)}, Max transition bias = ${(result20.maxTransitionBias * 100).toFixed(2)}%`);

const allFair = result6.chiSquare < 11.07 && result10.chiSquare < 16.92 && result20.chiSquare < 30.14;
console.log(`\n${allFair ?
  '✅ ALL TESTS PASSED - The wheel is demonstrably FAIR!' :
  '⚠️ SOME TESTS FAILED - Potential bias detected'}`);

console.log('\nTest complete!');