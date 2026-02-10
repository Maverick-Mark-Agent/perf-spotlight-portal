#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GEOJSON_DIR = path.join(__dirname, '../public/geojson');
const OUTPUT_DIR = path.join(__dirname, '../public/geojson-simplified');

// Simplify geometry using Douglas-Peucker algorithm
function simplifyGeometry(geometry, tolerance = 0.01) {
  if (geometry.type === 'Polygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map(ring => simplifyRing(ring, tolerance))
    };
  } else if (geometry.type === 'MultiPolygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map(polygon =>
        polygon.map(ring => simplifyRing(ring, tolerance))
      )
    };
  }
  return geometry;
}

function simplifyRing(points, tolerance) {
  if (points.length <= 2) return points;

  // Simple decimation: keep every Nth point, always keep first and last
  const keepEvery = Math.ceil(points.length / 50); // Reduce to ~50 points per ring
  const simplified = [];

  for (let i = 0; i < points.length; i++) {
    if (i === 0 || i === points.length - 1 || i % keepEvery === 0) {
      simplified.push(points[i]);
    }
  }

  return simplified;
}

// Process a single GeoJSON file
async function processFile(filename) {
  const inputPath = path.join(GEOJSON_DIR, filename);
  const outputPath = path.join(OUTPUT_DIR, filename);

  console.log(`\nProcessing ${filename}...`);

  const startSize = fs.statSync(inputPath).size;
  const startTime = Date.now();

  // Read and parse
  const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

  // Simplify features
  const simplified = {
    type: 'FeatureCollection',
    features: data.features.map(feature => ({
      type: 'Feature',
      properties: {
        // Keep only essential properties
        ZCTA5CE10: feature.properties.ZCTA5CE10,
        GEOID10: feature.properties.GEOID10,
        STATEFP10: feature.properties.STATEFP10,
      },
      geometry: simplifyGeometry(feature.geometry, 0.01)
    }))
  };

  // Write output
  fs.writeFileSync(outputPath, JSON.stringify(simplified));

  const endSize = fs.statSync(outputPath).size;
  const endTime = Date.now();
  const reduction = ((1 - endSize / startSize) * 100).toFixed(1);

  console.log(`  Original: ${(startSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Simplified: ${(endSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Reduction: ${reduction}%`);
  console.log(`  Time: ${((endTime - startTime) / 1000).toFixed(1)}s`);
}

// Main
async function main() {
  console.log('GeoJSON Simplification Script');
  console.log('==============================\n');

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Get all GeoJSON files
  const files = fs.readdirSync(GEOJSON_DIR)
    .filter(f => f.endsWith('.json'));

  console.log(`Found ${files.length} GeoJSON files\n`);

  // Process each file
  for (const file of files) {
    try {
      await processFile(file);
    } catch (err) {
      console.error(`Error processing ${file}:`, err.message);
    }
  }

  console.log('\n✅ Done! Simplified files saved to:', OUTPUT_DIR);
  console.log('\nNext steps:');
  console.log('1. Test the simplified files locally');
  console.log('2. If they look good, replace the originals:');
  console.log('   rm public/geojson/*.json && mv public/geojson-simplified/*.json public/geojson/');
}

main().catch(console.error);
