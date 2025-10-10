import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import { GeoJsonObject } from "geojson";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type ZipData = {
  zip: string;
  state: string | null;
  client_name: string;
  workspace_name: string | null;
  agency_color: string | null;
};

type ZipChoroplethLeafletProps = {
  zipData: ZipData[];
  loading?: boolean;
  onZipClick?: (zipCode: string) => void;
};

// State to GeoJSON file mapping
// Use relative path for both localhost and production (Lovable)
// Files are served from public/geojson directory
const STATE_GEOJSON_FILES: Record<string, string> = {
  CA: "/geojson/ca_california_zip_codes_geo.min.json",
  NV: "/geojson/nv_nevada_zip_codes_geo.min.json",
  TX: "/geojson/tx_texas_zip_codes_geo.min.json",
  MI: "/geojson/mi_michigan_zip_codes_geo.min.json",
  IL: "/geojson/il_illinois_zip_codes_geo.min.json",
  OR: "/geojson/or_oregon_zip_codes_geo.min.json",
  MO: "/geojson/mo_missouri_zip_codes_geo.min.json",
  OK: "/geojson/ok_oklahoma_zip_codes_geo.min.json",
};

export default function ZipChoroplethLeaflet({ zipData, loading, onZipClick }: ZipChoroplethLeafletProps) {
  const [geoJsonData, setGeoJsonData] = useState<GeoJsonObject | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get unique states from zipData
  const statesInData = useMemo(() => {
    const states = new Set(zipData.map((z) => z.state).filter(Boolean));
    return Array.from(states) as string[];
  }, [zipData]);

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

  // Get set of ZIPs we actually have data for (for filtering)
  const neededZips = useMemo(() => {
    return new Set(zipData.map((z) => z.zip));
  }, [zipData]);

  // Load GeoJSON for all states
  useEffect(() => {
    async function loadGeoJson() {
      try {
        setLoadingGeo(true);
        setError(null);

        console.log(`[ZipLeaflet] Loading GeoJSON for states:`, statesInData);

        // Load all state GeoJSON files
        const promises = statesInData.map(async (state) => {
          const filePath = STATE_GEOJSON_FILES[state];
          if (!filePath) {
            console.warn(`[ZipLeaflet] No GeoJSON file for state: ${state}`);
            return null;
          }

          console.log(`[ZipLeaflet] Fetching ${state} from: ${filePath}`);
          const response = await fetch(filePath);

          if (!response.ok) {
            throw new Error(`Failed to load ${state} GeoJSON: ${response.status}`);
          }

          const text = await response.text();

          // Check if response is a Git LFS pointer file
          if (text.includes('version https://git-lfs.github.com')) {
            console.error(`[ZipLeaflet] ERROR: Git LFS pointer file for ${state}`);
            throw new Error(`Git LFS files not supported. Please contact support.`);
          }

          const data = JSON.parse(text);
          console.log(`[ZipLeaflet] Loaded ${state} with ${data.features?.length || 0} features`);
          return data;
        });

        const allStateGeoJsons = await Promise.all(promises);

        // CRITICAL OPTIMIZATION: Filter features to only ZIPs we have data for
        const filteredFeatures = allStateGeoJsons
          .filter(Boolean)
          .flatMap((geoJson: any) => {
            return geoJson.features.filter((feature: any) => {
              const zipCode = feature.properties.ZCTA5CE10 || feature.properties.GEOID10;
              return zipCode && neededZips.has(zipCode);
            });
          });

        console.log(`[ZipLeaflet] Filtered to ${filteredFeatures.length} features (from ${zipData.length} ZIPs)`);

        const merged: GeoJsonObject = {
          type: "FeatureCollection",
          features: filteredFeatures,
        };

        setGeoJsonData(merged);
      } catch (err: any) {
        console.error("[ZipLeaflet] Error loading GeoJSON:", err);
        setError(err.message || "Failed to load map data");
      } finally {
        setLoadingGeo(false);
      }
    }

    if (statesInData.length > 0) {
      loadGeoJson();
    } else {
      setLoadingGeo(false);
    }
  }, [statesInData, neededZips, zipData.length]);

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

  // Style function for GeoJSON features
  const getFeatureStyle = (feature: any): L.PathOptions => {
    const zipCode = feature.properties.ZCTA5CE10 || feature.properties.GEOID10;
    const mapping = zipMapping[zipCode];

    return {
      fillColor: mapping?.color || "#E5E7EB",
      fillOpacity: 0.7,
      color: "#ffffff",
      weight: 1,
      opacity: 0.8,
    };
  };

  // On each feature (for popups and click handlers)
  const onEachFeature = (feature: any, layer: L.Layer) => {
    const zipCode = feature.properties.ZCTA5CE10 || feature.properties.GEOID10;
    const data = zipMapping[zipCode];

    if (data) {
      // Bind popup
      layer.bindPopup(`
        <div style="color: #000;">
          <strong>ZIP:</strong> ${zipCode}<br>
          <strong>Agency:</strong> ${data.agency}<br>
          <strong>State:</strong> ${data.state}
        </div>
      `);

      // Click handler
      layer.on('click', () => {
        if (onZipClick) {
          onZipClick(zipCode);
        }
      });

      // Hover effects
      layer.on('mouseover', function(this: L.Path) {
        this.setStyle({
          weight: 2,
          fillOpacity: 0.9,
        });
      });

      layer.on('mouseout', function(this: L.Path) {
        this.setStyle({
          weight: 1,
          fillOpacity: 0.7,
        });
      });
    }
  };

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

  if (!geoJsonData) {
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
        <MapContainer
          center={[37.0902, -95.7129]}
          zoom={4}
          style={{ width: "100%", height: "100%", backgroundColor: "#1e293b" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />

          {geoJsonData && (
            <GeoJSON
              data={geoJsonData}
              style={getFeatureStyle}
              onEachFeature={onEachFeature}
            />
          )}
        </MapContainer>
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
