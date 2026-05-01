export interface MonthRange {
  startDate: string;
  endDate: string;
}

export function getMonthRange(year: number, month: number): MonthRange {
  const mm = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  const dd = String(lastDay).padStart(2, '0');
  return {
    startDate: `${year}-${mm}-01`,
    endDate: `${year}-${mm}-${dd}`,
  };
}
