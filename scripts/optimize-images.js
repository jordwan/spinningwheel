const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../public');

const optimizations = [
  {
    input: 'bkgddT.png',
    outputs: [
      { name: 'bkgddT.webp', format: 'webp', quality: 85, resize: { width: 1536 } },
      { name: 'bkgddT-optimized.png', format: 'png', quality: 85, resize: { width: 1536 }, compressionLevel: 9 }
    ],
  },
  {
    input: 'logo.png',
    outputs: [
      { name: 'logo.webp', format: 'webp', quality: 90, resize: { width: 976 } },
      { name: 'logo-optimized.png', format: 'png', quality: 90, resize: { width: 976 }, compressionLevel: 9 }
    ],
  },
  {
    input: 'favicon.png',
    outputs: [
      { name: 'favicon.webp', format: 'webp', quality: 90, resize: { width: 1024 } },
      { name: 'favicon-optimized.png', format: 'png', quality: 90, resize: { width: 1024 }, compressionLevel: 9 }
    ],
  }
];

async function optimizeImage(config) {
  const inputPath = path.join(publicDir, config.input);

  console.log(`\nOptimizing ${config.input}...`);

  const originalStats = fs.statSync(inputPath);
  console.log(`Original size: ${(originalStats.size / 1024).toFixed(2)} KB`);

  for (const output of config.outputs) {
    const outputPath = path.join(publicDir, output.name);

    try {
      let pipeline = sharp(inputPath);

      if (output.resize) {
        pipeline = pipeline.resize(output.resize.width, null, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      if (output.format === 'webp') {
        pipeline = pipeline.webp({
          quality: output.quality,
          effort: 6
        });
      } else if (output.format === 'png') {
        pipeline = pipeline.png({
          quality: output.quality,
          compressionLevel: output.compressionLevel || 9,
          palette: true
        });
      }

      await pipeline.toFile(outputPath);

      const outputStats = fs.statSync(outputPath);
      const reduction = ((1 - outputStats.size / originalStats.size) * 100).toFixed(2);
      console.log(`  ✓ ${output.name}: ${(outputStats.size / 1024).toFixed(2)} KB (${reduction}% reduction)`);

    } catch (error) {
      console.error(`  ✗ Error creating ${output.name}:`, error.message);
    }
  }
}

async function main() {
  console.log('Starting image optimization...\n');

  for (const config of optimizations) {
    await optimizeImage(config);
  }

  console.log('\n✓ Image optimization complete!');
}

main().catch(console.error);
