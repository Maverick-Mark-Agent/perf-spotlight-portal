import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

interface KPIMonthPickerProps {
  selectedYear: number;
  selectedMonth: number;
  onChange: (year: number, month: number) => void;
  isCurrentMonth: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Data starts from October 2025
const MIN_YEAR = 2025;
const MIN_MONTH = 10;

export const KPIMonthPicker = ({ selectedYear, selectedMonth, onChange, isCurrentMonth }: KPIMonthPickerProps) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const canGoBack = selectedYear > MIN_YEAR || (selectedYear === MIN_YEAR && selectedMonth > MIN_MONTH);
  const canGoForward = selectedYear < currentYear || (selectedYear === currentYear && selectedMonth < currentMonth);

  const handlePrev = () => {
    if (!canGoBack) return;
    if (selectedMonth === 1) {
      onChange(selectedYear - 1, 12);
    } else {
      onChange(selectedYear, selectedMonth - 1);
    }
  };

  const handleNext = () => {
    if (!canGoForward) return;
    if (selectedMonth === 12) {
      onChange(selectedYear + 1, 1);
    } else {
      onChange(selectedYear, selectedMonth + 1);
    }
  };

  const handleCurrentMonth = () => {
    onChange(currentYear, currentMonth);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 bg-muted/60 rounded-lg px-2 py-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handlePrev}
          disabled={!canGoBack}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-1.5 px-2 min-w-[140px] justify-center">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">
            {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleNext}
          disabled={!canGoForward}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {!isCurrentMonth && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleCurrentMonth}
          className="text-xs h-7"
        >
          Current Month
        </Button>
      )}

      {!isCurrentMonth && (
        <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
          Historical
        </span>
      )}
    </div>
  );
};
