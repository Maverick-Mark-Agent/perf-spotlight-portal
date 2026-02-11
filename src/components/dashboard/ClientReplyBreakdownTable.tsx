import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Users } from "lucide-react";
import { useState } from "react";
import type { ClientReplyBreakdown } from "@/hooks/useReplyMetrics";

interface ClientReplyBreakdownTableProps {
  data: ClientReplyBreakdown[];
  loading?: boolean;
}

type SortKey = 'clientName' | 'totalReplies' | 'interested' | 'interestedPercentage' | 'replyRate';
type SortDirection = 'asc' | 'desc';

export const ClientReplyBreakdownTable = ({
  data,
  loading = false,
}: ClientReplyBreakdownTableProps) => {
  const [sortKey, setSortKey] = useState<SortKey>('replyRate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    let aVal: any = a[sortKey];
    let bVal: any = b[sortKey];

    // For string comparison (client name)
    if (typeof aVal === 'string') {
      return sortDirection === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    // For number comparison
    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const getStatusIcon = (status: 'good' | 'warning' | 'critical') => {
    switch (status) {
      case 'good':
        return '🟢';
      case 'warning':
        return '🟡';
      case 'critical':
        return '🔴';
    }
  };

  const getStatusColor = (status: 'good' | 'warning' | 'critical') => {
    switch (status) {
      case 'good':
        return 'text-success';
      case 'warning':
        return 'text-warning';
      case 'critical':
        return 'text-destructive';
    }
  };

  const SortableHeader = ({ label, sortKey: key }: { label: string; sortKey: SortKey }) => (
    <TableHead
      className="cursor-pointer hover:bg-muted/50 transition-colors select-none"
      onClick={() => handleSort(key)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortKey === key && (
          <span className="text-xs">
            {sortDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </TableHead>
  );

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-primary/20 shadow-xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold text-foreground">
              Client Reply Breakdown
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Month-to-date metrics for each client (click headers to sort)
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[400px] flex items-center justify-center">
            <div className="text-muted-foreground">Loading client data...</div>
          </div>
        ) : data.length === 0 ? (
          <div className="h-[400px] flex items-center justify-center">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <div className="text-muted-foreground">No client data available</div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/70">
                  <SortableHeader label="Client" sortKey="clientName" />
                  <SortableHeader label="Total Replies" sortKey="totalReplies" />
                  <SortableHeader label="Interested" sortKey="interested" />
                  <SortableHeader label="Interested %" sortKey="interestedPercentage" />
                  <SortableHeader label="Reply Rate" sortKey="replyRate" />
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map((client) => (
                  <TableRow
                    key={client.workspaceName}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="font-medium">{client.clientName}</TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold text-primary">
                        {client.totalReplies.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold text-success">
                        {client.interested.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold">
                        {client.interestedPercentage.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center">
                        <span className={`font-bold ${getStatusColor(client.status)}`}>
                          {client.replyRate.toFixed(2)}%
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {client.totalReplies} / {client.emailsSent.toLocaleString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-2xl">{getStatusIcon(client.status)}</span>
                        <div className="text-xs text-muted-foreground">
                          {client.status === 'good' && '≥ 0.3%'}
                          {client.status === 'warning' && '0.2-0.3%'}
                          {client.status === 'critical' && '< 0.2%'}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
