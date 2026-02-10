import { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type ZipData = {
  zip: string;
  state: string;
  client_name: string;
  workspace_name: string | null;
  agency_color: string | null;
};

type ZipMapLeafletProps = {
  zipData: ZipData[];
  onZipClick?: (zip: string) => void;
};

// Simple US state center coordinates for visualization
const STATE_CENTERS: Record<string, [number, number]> = {
  AZ: [34.0489, -111.0937],
  CA: [36.7783, -119.4179],
  CO: [39.5501, -105.7821],
  FL: [27.6648, -81.5158],
  NV: [38.8026, -116.4194],
  NM: [34.5199, -105.8701],
  TX: [31.9686, -99.9018],
  UT: [39.3210, -111.0937],
  // Add more as needed
};

export default function ZipMapLeaflet({ zipData, onZipClick }: ZipMapLeafletProps) {
  // Group ZIPs by state for visualization
  const stateGroups = useMemo(() => {
    const groups = new Map<string, ZipData[]>();
    zipData.forEach((zip) => {
      if (!zip.state) return;
      if (!groups.has(zip.state)) {
        groups.set(zip.state, []);
      }
      groups.get(zip.state)!.push(zip);
    });
    return groups;
  }, [zipData]);

  // Calculate markers for each state (show as circles with size based on ZIP count)
  const stateMarkers = useMemo(() => {
    const markers: Array<{
      state: string;
      position: [number, number];
      count: number;
      color: string;
      agency: string;
    }> = [];

    stateGroups.forEach((zips, state) => {
      const center = STATE_CENTERS[state];
      if (!center) return;

      // Find dominant color for this state
      const colorCounts = new Map<string, number>();
      zips.forEach((zip) => {
        if (zip.agency_color) {
          colorCounts.set(zip.agency_color, (colorCounts.get(zip.agency_color) || 0) + 1);
        }
      });

      let dominantColor = "#9CA3AF"; // gray
      let dominantAgency = "Unassigned";
      let maxCount = 0;

      colorCounts.forEach((count, color) => {
        if (count > maxCount) {
          maxCount = count;
          dominantColor = color;
          dominantAgency = zips.find((z) => z.agency_color === color)?.client_name || "Unknown";
        }
      });

      markers.push({
        state,
        position: center,
        count: zips.length,
        color: dominantColor,
        agency: dominantAgency,
      });
    });

    return markers;
  }, [stateGroups]);

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={[37.8, -96]}
        zoom={4}
        className="w-full h-full rounded-lg"
        style={{ minHeight: "500px" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {stateMarkers.map((marker) => (
          <CircleMarker
            key={marker.state}
            center={marker.position}
            radius={Math.sqrt(marker.count) * 2} // Scale radius by ZIP count
            pathOptions={{
              fillColor: marker.color,
              fillOpacity: 0.7,
              color: "#ffffff",
              weight: 2,
            }}
            eventHandlers={{
              click: () => {
                if (onZipClick) {
                  const firstZip = stateGroups.get(marker.state)?.[0];
                  if (firstZip) {
                    onZipClick(firstZip.zip);
                  }
                }
              },
            }}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-bold">{marker.state}</p>
                <p className="text-gray-600">{marker.agency}</p>
                <p className="text-gray-500">{marker.count} ZIPs</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      <div className="absolute bottom-4 left-4 bg-white/95 p-3 rounded-lg shadow-lg text-xs max-w-xs">
        <p className="font-semibold mb-2">Map Legend</p>
        <p className="text-gray-600 mb-2">Circle size = ZIP count • Click to view details</p>
        <div className="space-y-1">
          {Array.from(new Set(zipData.map((z) => z.agency_color).filter(Boolean))).map((color) => {
            const agency = zipData.find((z) => z.agency_color === color);
            return (
              <div key={color} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full border"
                  style={{ backgroundColor: color || "#9CA3AF" }}
                />
                <span>{agency?.client_name || "Unknown"}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
