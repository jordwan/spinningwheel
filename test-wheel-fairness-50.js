// Test script to verify wheel fairness with 50 names
// Simulates the same logic as the SpinningWheel component

function simulateWheel() {
  // Setup the wheel with 50 names + 2 RESPIN tiles
  const names = [];
  for (let i = 1; i <= 50; i++) {
    names.push(`Name${i}`);
  }

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

function runSimulation(numSpins = 1000000) {
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

  console.log('\n=== WHEEL FAIRNESS TEST RESULTS (50 NAMES) ===');
  console.log(`Total spins: ${numSpins.toLocaleString()}`);
  console.log(`Total slots on wheel: ${totalSlots}`);
  console.log(`Expected probability per slot: ${expectedProbability.toFixed(4)}%`);
  console.log(`\nActual Results (showing first 10 names and RESPIN):`);
  console.log('-'.repeat(50));

  // Sort by frequency for easier reading
  const sortedResults = Object.entries(results).sort((a, b) => b[1] - a[1]);

  // Show first 10 names and RESPIN
  const toShow = sortedResults.filter(([name]) =>
    name === 'RESPIN' || parseInt(name.replace('Name', '')) <= 10
  );

  toShow.forEach(([name, count]) => {
    const percentage = (count / numSpins * 100).toFixed(4);
    const deviation = (percentage - expectedProbability).toFixed(4);
    const deviationSign = deviation > 0 ? '+' : '';
    console.log(`${name.padEnd(10)} : ${count.toString().padStart(6)} hits (${percentage.padStart(7)}%) [${deviationSign}${deviation}% deviation]`);
  });

  // Calculate RESPIN statistics
  const totalRespins = results['RESPIN'] || 0;
  const actualRespinPercentage = (totalRespins / numSpins * 100).toFixed(4);

  console.log('\n=== FREE SPIN (RESPIN) ANALYSIS ===');
  console.log(`Expected RESPIN probability: ${expectedRespinProbability.toFixed(4)}% (${respinCount} slots out of ${totalSlots})`);
  console.log(`Actual RESPIN hits: ${totalRespins.toLocaleString()} (${actualRespinPercentage}%)`);
  console.log(`Deviation: ${(actualRespinPercentage - expectedRespinProbability).toFixed(4)}%`);

  // Calculate deviation statistics for all names
  const deviations = Object.entries(results).map(([name, count]) => {
    const percentage = (count / numSpins * 100);
    return Math.abs(percentage - expectedProbability);
  });

  const maxDeviation = Math.max(...deviations);
  const avgDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length;

  console.log('\n=== STATISTICAL SUMMARY ===');
  console.log(`Maximum deviation from expected: ${maxDeviation.toFixed(4)}%`);
  console.log(`Average deviation from expected: ${avgDeviation.toFixed(4)}%`);

  // Chi-square test for fairness
  let chiSquare = 0;
  const expectedCount = numSpins / totalSlots;

  Object.values(results).forEach(observed => {
    chiSquare += Math.pow(observed - expectedCount, 2) / expectedCount;
  });

  console.log(`Chi-square statistic: ${chiSquare.toFixed(2)}`);
  console.log(`Degrees of freedom: ${totalSlots - 1}`);
  console.log(`Critical value (95% confidence): ~67.51`);
  console.log(`Fair wheel? ${chiSquare < 67.51 ? 'YES ✓' : 'NO ✗'} (chi-square < critical value)`);

  return { results, maxDeviation, avgDeviation, respinDeviation: Math.abs(actualRespinPercentage - expectedRespinProbability) };
}

// Run the simulation
console.log('Running fairness test with 50 names and 1,000,000 spins...');
runSimulation(1000000);