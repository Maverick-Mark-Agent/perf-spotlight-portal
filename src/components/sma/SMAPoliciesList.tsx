import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, DollarSign, TrendingUp, FileText } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { SMAPolicy } from "@/types/sma";
import {
  getPoliciesByLeadId,
  deletePolicy,
  getLeadCommissionSummary,
} from "@/services/smaPoliciesService";
import { SMACommissionSummary } from "@/types/sma";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SMAPoliciesListProps {
  leadId: string;
  onAddPolicy?: () => void;
  onPoliciesChange?: () => void;
}

export const SMAPoliciesList = ({
  leadId,
  onAddPolicy,
  onPoliciesChange,
}: SMAPoliciesListProps) => {
  const [policies, setPolicies] = useState<SMAPolicy[]>([]);
  const [summary, setSummary] = useState<SMACommissionSummary>({
    total_premium: 0,
    total_agency_commission: 0,
    total_maverick_commission: 0,
    policy_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [policyToDelete, setPolicyToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPolicies();
  }, [leadId]);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const [policiesData, summaryData] = await Promise.all([
        getPoliciesByLeadId(leadId),
        getLeadCommissionSummary(leadId),
      ]);
      setPolicies(policiesData);
      setSummary(summaryData);
    } catch (error) {
      console.error("Error fetching policies:", error);
      toast({
        title: "Error",
        description: "Failed to load policies",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (policyId: string) => {
    setPolicyToDelete(policyId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!policyToDelete) return;

    try {
      await deletePolicy(policyToDelete);
      toast({
        title: "Success",
        description: "Policy deleted successfully",
      });
      await fetchPolicies();
      onPoliciesChange?.();
    } catch (error) {
      console.error("Error deleting policy:", error);
      toast({
        title: "Error",
        description: "Failed to delete policy",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setPolicyToDelete(null);
    }
  };

  if (loading) {
    return (
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Policies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center">
            <p className="text-muted-foreground">Loading policies...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-gradient-to-br from-green-500/5 to-emerald-500/5 border-green-500/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600" />
              Policies ({policies.length})
            </CardTitle>
            {onAddPolicy && (
              <Button
                onClick={onAddPolicy}
                size="sm"
                variant="outline"
                className="border-green-500/30 hover:bg-green-500/10"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Policy
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {policies.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">No policies added yet</p>
              {onAddPolicy && (
                <Button
                  onClick={onAddPolicy}
                  variant="outline"
                  className="border-green-500/30 hover:bg-green-500/10"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Policy
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Policies Table */}
              <div className="rounded-lg border border-border overflow-hidden mb-4">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Policy Type</TableHead>
                      <TableHead className="text-right">Premium</TableHead>
                      <TableHead className="text-right">Agency Commission</TableHead>
                      <TableHead className="text-right">Maverick Commission</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {policies.map((policy) => (
                      <TableRow key={policy.id}>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {policy.policy_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${policy.premium_amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          ${policy.agency_commission.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-medium text-purple-600">
                          ${policy.maverick_commission.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(policy.id)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/20">
                        <DollarSign className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total Premium</p>
                        <p className="text-2xl font-bold">
                          ${summary.total_premium.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-500/20">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">SMA Commission</p>
                        <p className="text-2xl font-bold text-green-600">
                          ${summary.total_agency_commission.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/20">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/20">
                        <TrendingUp className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Maverick (20%)</p>
                        <p className="text-2xl font-bold text-purple-600">
                          ${summary.total_maverick_commission.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Policy?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this policy? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
