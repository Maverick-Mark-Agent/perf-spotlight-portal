import { useEffect, useState, useMemo } from "react";
import Plot from "react-plotly.js";
import { ZipData } from "./ZipVisualization";

type ZipChoroplethMapProps = {
  zipData: ZipData[];
  loading?: boolean;
  onZipClick?: (zipCode: string) => void;
};

// State to GeoJSON file mapping
// Use local files for development (localhost), CDN for production
const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const CDN_BASE = isLocalhost
  ? "/geojson" // Local files served from public/geojson
  : "https://cdn.jsdelivr.net/gh/Maverick-Mark-Agent/perf-spotlight-portal@main/public/geojson";

const STATE_GEOJSON_FILES: Record<string, string> = {
  CA: `${CDN_BASE}/ca_california_zip_codes_geo.min.json`,
  NV: `${CDN_BASE}/nv_nevada_zip_codes_geo.min.json`,
  TX: `${CDN_BASE}/tx_texas_zip_codes_geo.min.json`,
  MI: `${CDN_BASE}/mi_michigan_zip_codes_geo.min.json`,
  IL: `${CDN_BASE}/il_illinois_zip_codes_geo.min.json`,
  OR: `${CDN_BASE}/or_oregon_zip_codes_geo.min.json`,
  MO: `${CDN_BASE}/mo_missouri_zip_codes_geo.min.json`,
  OK: `${CDN_BASE}/ok_oklahoma_zip_codes_geo.min.json`,
};

export default function ZipChoroplethMap({ zipData, loading, onZipClick }: ZipChoroplethMapProps) {
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [loadingGeo, setLoadingGeo] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get unique states from zipData
  const statesInData = useMemo(() => {
    const states = new Set(zipData.map((z) => z.state).filter(Boolean));
    return Array.from(states);
  }, [zipData]);

  // Load GeoJSON for all states
  useEffect(() => {
    async function loadGeoJson() {
      try {
        setLoadingGeo(true);
        setError(null);

        // Load all state GeoJSON files
        const promises = statesInData.map(async (state) => {
          const filePath = STATE_GEOJSON_FILES[state];
          if (!filePath) {
            console.warn(`No GeoJSON file for state: ${state}`);
            return null;
          }

          console.log(`[ZipMap] Fetching GeoJSON for ${state} from: ${filePath}`);
          const response = await fetch(filePath);

          console.log(`[ZipMap] ${state} response status: ${response.status}, content-type: ${response.headers.get('content-type')}`);

          if (!response.ok) {
            throw new Error(`Failed to load ${state} GeoJSON: ${response.status} ${response.statusText}`);
          }

          // Get response as text first to check if it's an LFS pointer
          const text = await response.text();

          // Check if response is a Git LFS pointer file
          if (text.includes('version https://git-lfs.github.com')) {
            console.error(`[ZipMap] ERROR: Received Git LFS pointer file instead of actual JSON for ${state}`);
            console.log(`[ZipMap] LFS Pointer content:`, text.substring(0, 200));
            throw new Error(`Git LFS files not supported on this platform. Please contact support.`);
          }

          // Parse the JSON
          const data = JSON.parse(text);
          console.log(`[ZipMap] Successfully loaded ${state} with ${data.features?.length || 0} features`);
          return data;
        });

        const allStateGeoJsons = await Promise.all(promises);

        // Merge all features into single GeoJSON
        const mergedFeatures = allStateGeoJsons
          .filter(Boolean)
          .flatMap((geoJson) => geoJson.features || []);

        console.log(`[ZipMap] Total merged features: ${mergedFeatures.length}`);

        const merged = {
          type: "FeatureCollection",
          features: mergedFeatures,
        };

        setGeoJsonData(merged);
      } catch (err: any) {
        console.error("[ZipMap] Error loading GeoJSON:", err);
        setError(err.message || "Failed to load map data");
      } finally {
        setLoadingGeo(false);
      }
    }

    if (statesInData.length > 0) {
      loadGeoJson();
    }
  }, [statesInData]);

  // Build mapping from ZIP to color and agency
  const zipMapping = useMemo(() => {
    const mapping: Record<string, { color: string; agency: string; state: string }> = {};
    zipData.forEach((z) => {
      mapping[z.zip] = {
        color: z.agency_color || "#E5E7EB",
        agency: z.client_name || "Unassigned",
        state: z.state || "Unknown",
      };
    });
    return mapping;
  }, [zipData]);

  // Prepare Plotly data - create separate traces for each color to avoid interpolation
  const plotData = useMemo(() => {
    if (!geoJsonData) return [];

    // Group ZIPs by color
    const colorGroups = new Map<string, { locations: string[]; agencies: string[]; states: string[] }>();

    geoJsonData.features.forEach((feature: any) => {
      const zipCode = feature.properties.ZCTA5CE10 || feature.properties.GEOID10;
      if (zipCode && zipMapping[zipCode]) {
        const color = zipMapping[zipCode].color;

        if (!colorGroups.has(color)) {
          colorGroups.set(color, { locations: [], agencies: [], states: [] });
        }

        const group = colorGroups.get(color)!;
        group.locations.push(zipCode);
        group.agencies.push(zipMapping[zipCode].agency);
        group.states.push(zipMapping[zipCode].state);
      }
    });

    // Create one trace per color group (ensures solid, non-interpolated colors)
    const traces = Array.from(colorGroups.entries()).map(([color, group]) => ({
      type: "choroplethmapbox" as const,
      geojson: geoJsonData,
      locations: group.locations,
      z: group.locations.map(() => 1), // Same value for all = solid color
      featureidkey: "properties.ZCTA5CE10",
      colorscale: [[0, color], [1, color]], // Single solid color (no interpolation)
      showscale: false,
      marker: {
        opacity: 0.85,
        line: {
          color: "rgba(255,255,255,0.6)",
          width: 1.0,
        },
      },
      hovertemplate:
        "<b>ZIP:</b> %{location}<br>" +
        "<b>Agency:</b> %{customdata[0]}<br>" +
        "<b>State:</b> %{customdata[1]}<extra></extra>",
      customdata: group.locations.map((_, i) => [group.agencies[i], group.states[i]]),
      name: group.agencies[0], // Use first agency as trace name
    }));

    return traces;
  }, [geoJsonData, zipMapping]);

  // Build legend data
  const legend = useMemo(() => {
    const agencyColors = new Map<string, string>();
    zipData.forEach((z) => {
      if (z.client_name) {
        agencyColors.set(z.client_name, z.agency_color || "#E5E7EB");
      }
    });
    return Array.from(agencyColors.entries()).map(([agency, color]) => ({
      agency,
      color,
    }));
  }, [zipData]);

  if (loading || loadingGeo) {
    return (
      <div className="w-full h-[600px] bg-white/10 backdrop-blur-md rounded-xl border border-white/20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading map data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[600px] bg-white/10 backdrop-blur-md rounded-xl border border-white/20 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-2">Failed to load map</p>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!geoJsonData || plotData.length === 0) {
    return (
      <div className="w-full h-[600px] bg-white/10 backdrop-blur-md rounded-xl border border-white/20 flex items-center justify-center">
        <p className="text-gray-400">No map data available</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/20">
        <h2 className="font-semibold text-lg text-white">Color-Coded ZIP Map</h2>
        <p className="text-sm text-gray-300 mt-1">
          {zipData.length.toLocaleString()} ZIPs across {statesInData.length} states
        </p>
      </div>

      {/* Map */}
      <div className="relative" style={{ height: "700px" }}>
        <Plot
          data={plotData}
          layout={{
            mapbox: {
              style: "open-street-map",
              center: { lat: 37.0902, lon: -95.7129 }, // Center of USA
              zoom: 3.5,
            },
            dragmode: "pan",
            autosize: true,
            margin: { t: 0, b: 0, l: 0, r: 0 },
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            font: {
              color: "#ffffff",
            },
            hovermode: "closest",
          }}
          config={{
            displayModeBar: true,
            displaylogo: false,
            scrollZoom: true,
            doubleClick: "reset",
            modeBarButtonsToRemove: ["lasso2d", "select2d"],
            responsive: true,
          }}
          style={{ width: "100%", height: "100%" }}
          onClick={(event: any) => {
            if (onZipClick && event.points && event.points[0]) {
              const zipCode = event.points[0].location;
              if (zipCode) {
                onZipClick(zipCode);
              }
            }
          }}
        />
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-white/20 bg-white/5">
        <h3 className="text-sm font-semibold text-white mb-3">Agency Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {legend.map(({ agency, color }) => (
            <div key={agency} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded flex-shrink-0 border border-white/30"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm text-gray-300 truncate">{agency}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
