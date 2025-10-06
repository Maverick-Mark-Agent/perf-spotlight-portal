import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

type AgencyColorPickerProps = {
  currentColor: string | null;
  onColorChange: (color: string) => void;
  agencyName: string;
};

const PRESET_COLORS = [
  "#EF4444", // red
  "#F59E0B", // amber
  "#10B981", // emerald
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#84CC16", // lime
  "#F97316", // orange
  "#6366F1", // indigo
  "#14B8A6", // teal
  "#A855F7", // purple
];

export default function AgencyColorPicker({
  currentColor,
  onColorChange,
  agencyName,
}: AgencyColorPickerProps) {
  const [customColor, setCustomColor] = useState(currentColor || "#3B82F6");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <div
            className="w-4 h-4 rounded border border-gray-300"
            style={{ backgroundColor: currentColor || "#E5E7EB" }}
          />
          <span className="text-xs">Change Color</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium mb-2">
              Color for {agencyName}
            </p>
            <p className="text-xs text-gray-500 mb-3">
              This color will be used on the map for all ZIPs assigned to this agency.
            </p>
          </div>

          <div>
            <p className="text-xs font-medium mb-2">Preset Colors</p>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  className="w-8 h-8 rounded border-2 hover:scale-110 transition-transform"
                  style={{
                    backgroundColor: color,
                    borderColor:
                      currentColor === color ? "#000000" : "transparent",
                  }}
                  onClick={() => onColorChange(color)}
                  title={color}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium mb-2">Custom Color</p>
            <div className="flex gap-2">
              <Input
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="w-16 h-9 p-1"
              />
              <Input
                type="text"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                placeholder="#000000"
                className="flex-1 h-9"
              />
              <Button
                size="sm"
                onClick={() => onColorChange(customColor)}
                className="h-9"
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
