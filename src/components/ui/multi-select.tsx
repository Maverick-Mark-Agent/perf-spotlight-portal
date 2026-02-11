import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select items...",
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (value: string) => {
    if (value === "all") {
      // Toggle all
      if (selected.length === options.length) {
        onChange([]);
      } else {
        onChange([...options]);
      }
    } else {
      // Toggle individual item
      if (selected.includes(value)) {
        onChange(selected.filter((item) => item !== value));
      } else {
        onChange([...selected, value]);
      }
    }
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const handleSelectAll = () => {
    onChange([...options]);
  };

  const getDisplayText = () => {
    if (selected.length === 0) return placeholder;
    if (selected.length === options.length) return "All clients selected";
    if (selected.length === 1) return selected[0];
    return `${selected.length} clients selected`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-[300px] justify-between", className)}
        >
          <span className="truncate">{getDisplayText()}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search clients..." />
          <CommandEmpty>No client found.</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-auto">
            {/* Select All / Clear All */}
            <CommandItem
              onSelect={() => handleSelect("all")}
              className="font-semibold border-b"
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  selected.length === options.length ? "opacity-100" : "opacity-0"
                )}
              />
              {selected.length === options.length ? "Clear All" : "Select All"}
            </CommandItem>

            {/* Individual options */}
            {options.map((option) => (
              <CommandItem
                key={option}
                onSelect={() => handleSelect(option)}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selected.includes(option) ? "opacity-100" : "opacity-0"
                  )}
                />
                {option}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
        
        {/* Selected count footer */}
        {selected.length > 0 && (
          <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
            <span>{selected.length} selected</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-6 px-2 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
