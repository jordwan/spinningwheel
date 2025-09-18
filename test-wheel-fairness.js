// Test script to verify wheel fairness
// Simulates the same logic as the SpinningWheel component

function simulateWheel() {
  // Setup the wheel with 10 names + 2 RESPIN tiles
  const names = ['Name1', 'Name2', 'Name3', 'Name4', 'Name5', 'Name6', 'Name7', 'Name8', 'Name9', 'Name10'];

  // Add RESPIN tiles at opposite positions (beginning and middle)
  const wheelNames = [...names];
  wheelNames.splice(0, 0, "RESPIN"); // Add first RESPIN at the beginning
  wheelNames.splice(Math.floor((names.length + 2) / 2), 0, "RESPIN"); // Add second RESPIN at middle

  return wheelNames;
}

function simulateSpin(wheelNames) {
  // Simulate the spin logic from the component
  const currentRotation = 0;

  // Random spin strength (0-1) like the speed indicator
  const spinStrength = Math.random();

  // Same calculation as in the component
  const baseRotations = 3 + spinStrength * 10; // 3-13 rotations
  const finalRotation = currentRotation + Math.PI * 2 * (baseRotations + Math.random() * 2);

  // Calculate selected segment
  const normalizedRotation = (2 * Math.PI - (finalRotation % (2 * Math.PI))) % (2 * Math.PI);
  const selectedIndex = Math.floor(normalizedRotation / ((2 * Math.PI) / wheelNames.length));

  return wheelNames[selectedIndex];
}

function runSimulation(numSpins = 100) {
  const wheelNames = simulateWheel();
  const results = {};

  // Initialize counters
  wheelNames.forEach(name => {
    results[name] = results[name] || 0;
  });

  // Run simulations
  for (let i = 0; i < numSpins; i++) {
    const winner = simulateSpin(wheelNames);
    results[winner]++;
  }

  // Calculate statistics
  const totalSlots = wheelNames.length;
  const expectedProbability = (1 / totalSlots) * 100;
  const respinCount = wheelNames.filter(n => n === 'RESPIN').length;
  const expectedRespinProbability = (respinCount / totalSlots) * 100;

  console.log('\n=== WHEEL FAIRNESS TEST RESULTS ===');
  console.log(`Total spins: ${numSpins}`);
  console.log(`Total slots on wheel: ${totalSlots}`);
  console.log(`Expected probability per slot: ${expectedProbability.toFixed(2)}%`);
  console.log(`\nActual Results:`);
  console.log('-'.repeat(40));

  // Sort by frequency for easier reading
  const sortedResults = Object.entries(results).sort((a, b) => b[1] - a[1]);

  sortedResults.forEach(([name, count]) => {
    const percentage = (count / numSpins * 100).toFixed(2);
    const deviation = (percentage - expectedProbability).toFixed(2);
    const deviationSign = deviation > 0 ? '+' : '';
    console.log(`${name.padEnd(10)} : ${count.toString().padStart(3)} hits (${percentage.padStart(6)}%) [${deviationSign}${deviation}% deviation]`);
  });

  // Calculate RESPIN statistics
  const totalRespins = results['RESPIN'] || 0;
  const actualRespinPercentage = (totalRespins / numSpins * 100).toFixed(2);

  console.log('\n=== FREE SPIN (RESPIN) ANALYSIS ===');
  console.log(`Expected RESPIN probability: ${expectedRespinProbability.toFixed(2)}% (${respinCount} slots out of ${totalSlots})`);
  console.log(`Actual RESPIN hits: ${totalRespins} (${actualRespinPercentage}%)`);
  console.log(`Deviation: ${(actualRespinPercentage - expectedRespinProbability).toFixed(2)}%`);

  // Chi-square test for fairness
  let chiSquare = 0;
  const expectedCount = numSpins / totalSlots;

  Object.values(results).forEach(observed => {
    chiSquare += Math.pow(observed - expectedCount, 2) / expectedCount;
  });

  console.log('\n=== STATISTICAL ANALYSIS ===');
  console.log(`Chi-square statistic: ${chiSquare.toFixed(2)}`);
  console.log(`Degrees of freedom: ${totalSlots - 1}`);
  console.log(`Critical value (95% confidence): ~19.68`);
  console.log(`Fair wheel? ${chiSquare < 19.68 ? 'YES ✓' : 'NO ✗'} (chi-square < critical value)`);

  return results;
}

// Run the simulation
console.log('Running fairness test with 100 spins...');
runSimulation(100);

console.log('\n\nRunning extended test with 1000 spins for better accuracy...');
runSimulation(1000);

console.log('\n\nRunning comprehensive test with 100,000 spins for statistical significance...');
runSimulation(100000);

console.log('\n\nRunning ultimate test with 1,000,000 spins for maximum precision...');
runSimulation(1000000);

console.log('\n\nRunning extreme test with 1,000,000,000 spins for absolute precision...');
runSimulation(1000000000);