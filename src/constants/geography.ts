/**
 * Geographic Constants
 * 
 * State centers, GeoJSON file paths, and geographic data mappings.
 * 
 * @file src/constants/geography.ts
 */

// ============= State Center Coordinates =============

/**
 * Geographic center coordinates for US states [latitude, longitude]
 * Used for map centering and initial viewport
 */
export const STATE_CENTERS: Record<string, [number, number]> = {
  TX: [31.9686, -99.9018],
  FL: [27.6648, -81.5158],
  CA: [36.7783, -119.4179],
  NY: [42.1657, -74.9481],
  PA: [41.2033, -77.1945],
  IL: [40.6331, -89.3985],
  OH: [40.4173, -82.9071],
  GA: [32.1656, -82.9001],
  NC: [35.7596, -79.0193],
  MI: [44.3148, -85.6024],
  NJ: [40.0583, -74.4057],
  VA: [37.4316, -78.6569],
  WA: [47.7511, -120.7401],
  AZ: [34.0489, -111.0937],
  MA: [42.4072, -71.3824],
  TN: [35.5175, -86.5804],
  IN: [40.2672, -86.1349],
  MO: [37.9643, -91.8318],
  MD: [39.0458, -76.6413],
  WI: [43.7844, -88.7879],
  CO: [39.5501, -105.7821],
  MN: [46.7296, -94.6859],
  SC: [33.8361, -81.1637],
  AL: [32.3182, -86.9023],
  LA: [31.2448, -92.1450],
  KY: [37.8393, -84.2700],
  OR: [43.8041, -120.5542],
  OK: [35.0078, -97.0929],
  CT: [41.6032, -73.0877],
  UT: [39.3210, -111.0937],
  IA: [41.8780, -93.0977],
  NV: [38.8026, -116.4194],
  AR: [34.7465, -92.2896],
  MS: [32.3547, -89.3985],
  KS: [39.0119, -98.4842],
  NM: [34.5199, -105.8701],
  NE: [41.4925, -99.9018],
  WV: [38.5976, -80.4549],
  ID: [44.0682, -114.7420],
  HI: [19.8968, -155.5828],
  NH: [43.1939, -71.5724],
  ME: [45.2538, -69.4455],
  MT: [46.8797, -110.3626],
  RI: [41.5801, -71.4774],
  DE: [38.9108, -75.5277],
  SD: [43.9695, -99.9018],
  ND: [47.5515, -101.0020],
  AK: [64.2008, -149.4937],
  VT: [44.5588, -72.5778],
  WY: [43.0760, -107.2903],
} as const;

// ============= GeoJSON File Paths =============

/**
 * Paths to GeoJSON files for state boundaries and ZIP code overlays
 * Used for choropleth maps and geographic visualizations
 */
export const STATE_GEOJSON_FILES: Record<string, string> = {
  TX: '/geojson/texas.json',
  FL: '/geojson/florida.json',
  CA: '/geojson/california.json',
  NJ: '/geojson/new-jersey.json',
  NY: '/geojson/new-york.json',
  PA: '/geojson/pennsylvania.json',
  // Add more states as GeoJSON files become available
} as const;

// ============= State Name to Abbreviation Mapping =============

/**
 * Full state names to two-letter abbreviation mapping
 */
export const STATE_NAME_TO_ABBR: Record<string, string> = {
  "Alabama": "AL",
  "Alaska": "AK",
  "Arizona": "AZ",
  "Arkansas": "AR",
  "California": "CA",
  "Colorado": "CO",
  "Connecticut": "CT",
  "Delaware": "DE",
  "Florida": "FL",
  "Georgia": "GA",
  "Hawaii": "HI",
  "Idaho": "ID",
  "Illinois": "IL",
  "Indiana": "IN",
  "Iowa": "IA",
  "Kansas": "KS",
  "Kentucky": "KY",
  "Louisiana": "LA",
  "Maine": "ME",
  "Maryland": "MD",
  "Massachusetts": "MA",
  "Michigan": "MI",
  "Minnesota": "MN",
  "Mississippi": "MS",
  "Missouri": "MO",
  "Montana": "MT",
  "Nebraska": "NE",
  "Nevada": "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  "Ohio": "OH",
  "Oklahoma": "OK",
  "Oregon": "OR",
  "Pennsylvania": "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  "Tennessee": "TN",
  "Texas": "TX",
  "Utah": "UT",
  "Vermont": "VT",
  "Virginia": "VA",
  "Washington": "WA",
  "West Virginia": "WV",
  "Wisconsin": "WI",
  "Wyoming": "WY",
} as const;

// ============= State Abbreviation to Name Mapping =============

/**
 * Two-letter abbreviation to full state name mapping
 */
export const STATE_ABBR_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [abbr, name])
) as Record<string, string>;
