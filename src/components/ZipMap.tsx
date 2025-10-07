import { memo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";

const geoUrl = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

export type ZipData = {
  zip: string;
  state: string;
  client_name: string;
  workspace_name: string | null;
  agency_color: string | null;
};

type ZipMapProps = {
  zipData: ZipData[];
  onZipClick?: (zip: string) => void;
  selectedZip?: string | null;
};

// Group ZIPs by state and calculate dominant color per state
function getStateColors(zipData: ZipData[]): Map<string, string> {
  const stateMap = new Map<string, Map<string, number>>();

  zipData.forEach((zip) => {
    if (!zip.state || !zip.agency_color) return;

    if (!stateMap.has(zip.state)) {
      stateMap.set(zip.state, new Map());
    }

    const colorCounts = stateMap.get(zip.state)!;
    const currentCount = colorCounts.get(zip.agency_color) || 0;
    colorCounts.set(zip.agency_color, currentCount + 1);
  });

  const stateColors = new Map<string, string>();
  stateMap.forEach((colorCounts, state) => {
    let maxColor = "";
    let maxCount = 0;

    colorCounts.forEach((count, color) => {
      if (count > maxCount) {
        maxCount = count;
        maxColor = color;
      }
    });

    if (maxColor) {
      stateColors.set(state, maxColor);
    }
  });

  return stateColors;
}

// State abbreviation to full name mapping
const STATE_NAME_TO_ABBR: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
  "District of Columbia": "DC",
  "Puerto Rico": "PR",
};

const ZipMap = memo(({ zipData, onZipClick, selectedZip }: ZipMapProps) => {
  const stateColors = getStateColors(zipData);

  return (
    <div className="w-full h-full bg-gray-50 rounded-lg border border-gray-200">
      <ComposableMap
        projection="geoAlbersUsa"
        projectionConfig={{
          scale: 1000,
        }}
      >
        <ZoomableGroup zoom={1} center={[-96, 38]}>
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const stateName = geo.properties.name;
                const stateAbbr = STATE_NAME_TO_ABBR[stateName];
                const fillColor = stateColors.get(stateAbbr) || "#E5E7EB"; // gray-200 for unassigned

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fillColor}
                    stroke="#FFFFFF"
                    strokeWidth={0.5}
                    style={{
                      default: {
                        fill: fillColor,
                        stroke: "#FFFFFF",
                        strokeWidth: 0.5,
                        outline: "none",
                      },
                      hover: {
                        fill: fillColor,
                        stroke: "#000000",
                        strokeWidth: 1.5,
                        outline: "none",
                        opacity: 0.8,
                      },
                      pressed: {
                        fill: fillColor,
                        stroke: "#000000",
                        strokeWidth: 2,
                        outline: "none",
                      },
                    }}
                    onClick={() => {
                      if (onZipClick && stateAbbr) {
                        // Find first ZIP in this state
                        const firstZip = zipData.find((z) => z.state === stateAbbr);
                        if (firstZip) {
                          onZipClick(firstZip.zip);
                        }
                      }
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      <div className="p-4 text-sm text-gray-600">
        <p className="font-medium mb-2">Map Legend:</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-200 border border-gray-300"></div>
            <span>Unassigned ZIPs</span>
          </div>
          {Array.from(
            new Set(zipData.map((z) => z.agency_color).filter(Boolean))
          ).map((color) => {
            const agency = zipData.find((z) => z.agency_color === color);
            return (
              <div key={color} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 border border-gray-300"
                  style={{ backgroundColor: color || "#E5E7EB" }}
                ></div>
                <span>{agency?.client_name || "Unknown"}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-gray-500">
          States are colored by the dominant agency. Click a state to view details.
        </p>
      </div>
    </div>
  );
});

ZipMap.displayName = "ZipMap";

export default ZipMap;
