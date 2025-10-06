import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export type ZipData = {
  zip: string;
  state: string;
  client_name: string;
  workspace_name: string | null;
  agency_color: string | null;
};

type ZipVisualizationProps = {
  zipData: ZipData[];
  onZipClick?: (zip: string) => void;
};

export default function ZipVisualization({ zipData, onZipClick }: ZipVisualizationProps) {
  // Group ZIPs by state and agency
  const groupedByState = useMemo(() => {
    const groups = new Map<string, Map<string, ZipData[]>>();

    zipData.forEach((zip) => {
      const state = zip.state || "Unknown";

      if (!groups.has(state)) {
        groups.set(state, new Map());
      }

      const stateGroup = groups.get(state)!;
      const agencyKey = zip.client_name || "Unassigned";

      if (!stateGroup.has(agencyKey)) {
        stateGroup.set(agencyKey, []);
      }

      stateGroup.get(agencyKey)!.push(zip);
    });

    return groups;
  }, [zipData]);

  // Sort states alphabetically
  const sortedStates = useMemo(() => {
    return Array.from(groupedByState.keys()).sort();
  }, [groupedByState]);

  // Calculate stats per state
  const stateStats = useMemo(() => {
    const stats = new Map<string, { total: number; agencies: Map<string, number> }>();

    groupedByState.forEach((agencies, state) => {
      const agencyStats = new Map<string, number>();
      let total = 0;

      agencies.forEach((zips, agency) => {
        agencyStats.set(agency, zips.length);
        total += zips.length;
      });

      stats.set(state, { total, agencies: agencyStats });
    });

    return stats;
  }, [groupedByState]);

  return (
    <div className="w-full h-full flex flex-col bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
      {/* Header */}
      <div className="p-4 border-b border-white/20">
        <h2 className="font-semibold text-lg text-white">ZIP Code Coverage by State</h2>
        <p className="text-sm text-gray-300 mt-1">
          {zipData.length.toLocaleString()} total ZIPs across {sortedStates.length} states
        </p>
      </div>

      {/* State Grid */}
      <ScrollArea className="flex-1 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedStates.map((state) => {
            const agencies = groupedByState.get(state)!;
            const stats = stateStats.get(state)!;

            // Find dominant color
            let dominantAgency = "";
            let dominantColor = "#E5E7EB";
            let maxCount = 0;

            stats.agencies.forEach((count, agency) => {
              if (count > maxCount) {
                maxCount = count;
                dominantAgency = agency;
                const firstZip = agencies.get(agency)?.[0];
                dominantColor = firstZip?.agency_color || "#E5E7EB";
              }
            });

            return (
              <Card
                key={state}
                className="p-4 bg-white/5 border-white/10 hover:bg-white/10 hover:shadow-xl transition-all cursor-pointer backdrop-blur-sm"
                style={{
                  borderLeft: `4px solid ${dominantColor}`,
                }}
                onClick={() => {
                  const firstZip = Array.from(agencies.values())[0]?.[0];
                  if (firstZip && onZipClick) {
                    onZipClick(firstZip.zip);
                  }
                }}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-xl font-bold text-white">{state}</h3>
                    <p className="text-sm text-gray-300">{stats.total} ZIPs</p>
                  </div>
                  <div
                    className="w-8 h-8 rounded-full border-2 border-white/30 shadow-lg"
                    style={{ backgroundColor: dominantColor }}
                  />
                </div>

                {/* Agency breakdown */}
                <div className="space-y-2">
                  {Array.from(agencies.entries())
                    .sort(([, a], [, b]) => b.length - a.length)
                    .map(([agency, zips]) => {
                      const color = zips[0]?.agency_color || "#9CA3AF";
                      const percentage = ((zips.length / stats.total) * 100).toFixed(0);

                      return (
                        <div key={agency} className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-sm flex-shrink-0 ring-1 ring-white/20"
                            style={{ backgroundColor: color }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between text-xs">
                              <span className="truncate font-medium text-gray-200">{agency}</span>
                              <span className="text-gray-400 ml-2">{percentage}%</span>
                            </div>
                            <div className="text-xs text-gray-500">{zips.length} ZIPs</div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </Card>
            );
          })}
        </div>

        {sortedStates.length === 0 && (
          <div className="flex items-center justify-center h-64 text-gray-400">
            No ZIP code data available
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
