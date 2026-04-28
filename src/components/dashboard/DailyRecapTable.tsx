import { useState } from 'react';
import { format, addDays, subDays, isSameDay, startOfDay } from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useDailyRecap,
  type DailyRecapRow,
  type DailyRecapTotals,
} from '@/hooks/useDailyRecap';

const formatNumber = (n: number) => n.toLocaleString();
const formatRevenue = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const yesterday = () => startOfDay(subDays(new Date(), 1));
const today = () => startOfDay(new Date());

interface SectionProps {
  title: string;
  subtitle?: string;
  rows: DailyRecapRow[];
  totals: DailyRecapTotals;
  showRevenue: boolean;
}

const RecapSection = ({ title, subtitle, rows, totals, showRevenue }: SectionProps) => {
  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No active workspaces.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workspace</TableHead>
                <TableHead className="text-right">Emails Sent</TableHead>
                <TableHead className="text-right">Replies</TableHead>
                <TableHead className="text-right">Interested Leads</TableHead>
                {showRevenue && (
                  <TableHead className="text-right">Expected Revenue</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.workspaceName}>
                  <TableCell className="font-medium">{r.displayName}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(r.emailsSent)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(r.repliesReceived)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(r.interestedLeads)}
                  </TableCell>
                  {showRevenue && (
                    <TableCell className="text-right tabular-nums">
                      {formatRevenue(r.expectedRevenue)}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              <TableRow className="bg-muted/30 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(totals.emails)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(totals.replies)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(totals.leads)}
                </TableCell>
                {showRevenue && (
                  <TableCell className="text-right tabular-nums">
                    {formatRevenue(totals.revenue)}
                  </TableCell>
                )}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export const DailyRecapTable = () => {
  const [targetDate, setTargetDate] = useState<Date>(yesterday());
  const { data, isLoading, error } = useDailyRecap(targetDate);

  const minSelectableDate = subDays(today(), 30);
  const maxSelectableDate = today();
  const isYesterday = isSameDay(targetDate, yesterday());
  const atMin = targetDate <= minSelectableDate;
  const atMax = targetDate >= maxSelectableDate;

  const subtitleParts: string[] = [
    `Per-workspace performance for ${format(targetDate, 'MMMM d, yyyy')}`,
  ];
  if (isYesterday) subtitleParts.push('(yesterday)');
  if (data?.freshnessUtc) {
    subtitleParts.push(
      `· synced ${format(new Date(data.freshnessUtc), 'h:mm a')} CT`,
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>Daily Recap</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {subtitleParts.join(' ')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTargetDate(yesterday())}
              disabled={isYesterday}
            >
              Yesterday
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setTargetDate((d) => subDays(d, 1))}
              disabled={atMin}
              aria-label="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-w-[160px] justify-start gap-2"
                >
                  <CalendarIcon className="h-4 w-4" />
                  {format(targetDate, 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={targetDate}
                  onSelect={(d) => d && setTargetDate(startOfDay(d))}
                  disabled={(d) =>
                    d < minSelectableDate || d > maxSelectableDate
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setTargetDate((d) => addDays(d, 1))}
              disabled={atMax}
              aria-label="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <p className="text-sm text-destructive">
            Error loading recap: {(error as Error).message}
          </p>
        )}
        {isLoading && (
          <div className="space-y-3">
            <div className="h-5 w-40 bg-muted/40 rounded animate-pulse" />
            <div className="h-64 bg-muted/30 rounded animate-pulse" />
          </div>
        )}
        {data && !isLoading && (
          <>
            <RecapSection
              title="Per-Lead Clients"
              subtitle="Billable revenue is price_per_lead × interested leads"
              rows={data.perLead}
              totals={data.totals.perLead}
              showRevenue={true}
            />
            <RecapSection
              title="Retainer Clients"
              rows={data.retainer}
              totals={data.totals.retainer}
              showRevenue={false}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
};
