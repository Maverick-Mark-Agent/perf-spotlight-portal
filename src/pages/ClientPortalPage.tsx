import { useState, useEffect } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { DndContext, DragEndEvent, DragOverEvent, closestCorners, PointerSensor, useSensor, useSensors, useDroppable, useDraggable } from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Calendar, ExternalLink, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClientKPIStats } from "@/components/dashboard/ClientKPIStats";
import { LeadDetailModal } from "@/components/client-portal/LeadDetailModal";
import { PremiumInputDialog } from "@/components/client-portal/PremiumInputDialog";
import { useAuth } from "@/components/auth/ProtectedRoute";
import { useSecureWorkspaceData } from "@/hooks/useSecureWorkspaceData";
import { ThemeToggle } from "@/components/ui/theme-toggle";
// SMA Insurance specific imports
import { SMACommissionKPICards } from "@/components/sma/SMACommissionKPICards";
import { SMAPoliciesInputDialog } from "@/components/sma/SMAPoliciesInputDialog";
import { createPolicies } from "@/services/smaPoliciesService";
import { SMAPolicyFormData } from "@/types/sma";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ClientLead {
  id: string;
  airtable_id: string;
  workspace_name: string;
  client_name: string | null;
  lead_email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  date_received: string | null;
  reply_received: string | null;
  email_sent: string | null;
  email_subject: string | null;
  lead_value: number;
  renewal_date: string | null;
  birthday: string | null;
  campaign_name: string | null;
  sender_email: string | null;
  icp: boolean;
  pipeline_stage: string;
  pipeline_position: number;
  notes: string | null;
  bison_conversation_url: string | null;
  bison_lead_id: string | null;
  interested: boolean;
  // NEW: Email Bison fields
  title: string | null;
  company: string | null;
  custom_variables: Array<{name: string; value: string}> | null;
  tags: Array<{id: number; name: string}> | null;
  lead_status: string | null;
  lead_campaign_data: any[] | null;
  overall_stats: any | null;
  premium_amount: number | null;
  policy_type: string | null;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
}

const PIPELINE_STAGES = [
  { key: 'interested', label: 'Interested', color: 'bg-pink-500/20 border-pink-500/40' },
  { key: 'quoting', label: 'Quoting', color: 'bg-purple-500/20 border-purple-500/40' },
  { key: 'follow-up', label: 'Follow Up', color: 'bg-yellow-500/20 border-yellow-500/40' },
  { key: 'won', label: 'Won', color: 'bg-green-500/20 border-green-500/40' },
  { key: 'lost', label: 'Lost', color: 'bg-red-500/20 border-red-500/40' },
];

// Draggable Lead Card Component
interface DraggableLeadCardProps {
  lead: ClientLead;
  onToggleInterested: (leadId: string, currentValue: boolean) => void;
  onClick: (lead: ClientLead) => void;
  formatDate: (dateString: string | null) => string;
}

const DraggableLeadCard = ({ lead, onToggleInterested, onClick, formatDate }: DraggableLeadCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: lead.id });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="group hover:bg-accent transition-colors relative"
    >
      {/* Drag Handle - Top of card */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-0 left-0 right-0 h-8 cursor-grab active:cursor-grabbing hover:bg-accent/50 flex items-center justify-center z-10"
      >
        <div className="w-8 h-1 bg-border group-hover:bg-accent-foreground/50 rounded-full"></div>
      </div>

      <CardContent className="p-4 pt-10 cursor-pointer" onClick={() => onClick(lead)}>
        <div className="space-y-2">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate group-hover:text-accent-foreground">
                {lead.first_name} {lead.last_name}
              </div>
              {lead.title && (
                <div className="text-primary group-hover:text-accent-foreground text-sm font-medium truncate">
                  {lead.title}
                </div>
              )}
              {lead.company && (
                <div className="text-muted-foreground group-hover:text-accent-foreground/80 text-sm truncate">
                  {lead.company}
                </div>
              )}
              <div className="text-muted-foreground group-hover:text-accent-foreground/80 text-sm truncate">
                {lead.lead_email}
              </div>
            </div>
            {lead.icp && (
              <Badge variant="outline" className="bg-success/20 text-success border-success/40 group-hover:bg-accent-foreground/20 group-hover:text-accent-foreground group-hover:border-accent-foreground/40 flex-shrink-0">
                ICP
              </Badge>
            )}
          </div>

          {/* Tags */}
          {lead.tags && lead.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {lead.tags.slice(0, 3).map((tag) => (
                <Badge key={tag.id} variant="outline" className="bg-accent/20 text-accent-foreground border-accent/40 group-hover:bg-accent-foreground/20 group-hover:border-accent-foreground/40 text-xs truncate max-w-full">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Custom Variables - show first 2 */}
          {lead.custom_variables && lead.custom_variables.length > 0 && (
            <div className="space-y-1">
              {lead.custom_variables.slice(0, 2).map((cv, idx) => (
                <div key={idx} className="text-muted-foreground group-hover:text-accent-foreground/80 text-xs truncate">
                  <span className="text-muted-foreground/60 group-hover:text-accent-foreground/60">{cv.name}:</span> {cv.value}
                </div>
              ))}
            </div>
          )}

          {lead.phone && (
            <div className="text-muted-foreground group-hover:text-accent-foreground/80 text-sm truncate">{lead.phone}</div>
          )}

          {lead.date_received && (
            <div className="flex items-center gap-1 text-muted-foreground group-hover:text-accent-foreground/80 text-xs">
              <Calendar className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{formatDate(lead.date_received)}</span>
            </div>
          )}

          {lead.renewal_date && (
            <div className="text-muted-foreground group-hover:text-accent-foreground/80 text-sm truncate">
              Renewal: {lead.renewal_date}
            </div>
          )}

          {lead.notes && (
            <div className="text-muted-foreground group-hover:text-accent-foreground/80 text-sm bg-muted group-hover:bg-accent-foreground/10 p-2 rounded line-clamp-2">
              {lead.notes}
            </div>
          )}

          {lead.bison_conversation_url && (
            <a
              href={lead.bison_conversation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary group-hover:text-accent-foreground hover:underline text-sm truncate"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">View in Email Bison</span>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Droppable Column Component
interface DroppableColumnProps {
  stage: typeof PIPELINE_STAGES[0];
  leads: ClientLead[];
  onToggleInterested: (leadId: string, currentValue: boolean) => void;
  onLeadClick: (lead: ClientLead) => void;
  formatDate: (dateString: string | null) => string;
}

const DroppableColumn = ({ stage, leads, onToggleInterested, onLeadClick, formatDate }: DroppableColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.key,
  });

  return (
    <div className="flex flex-col h-full">
      {/* Column Header */}
      <div className={`${stage.color} border rounded-lg p-3 mb-3`}>
        <h3 className="font-semibold">{stage.label}</h3>
        <p className="text-sm opacity-80">{leads.length} leads</p>
      </div>

      {/* Drop Zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 bg-muted border-2 rounded-lg p-2 min-h-[500px] space-y-2 transition-colors ${
          isOver ? 'border-primary bg-primary/10' : 'border-border'
        }`}
      >
        {leads.map(lead => (
          <DraggableLeadCard
            key={lead.id}
            lead={lead}
            onToggleInterested={onToggleInterested}
            onClick={onLeadClick}
            formatDate={formatDate}
          />
        ))}
        {leads.length === 0 && (
          <div className="text-muted-foreground text-center py-8 text-sm">
            Drop leads here
          </div>
        )}
      </div>
    </div>
  );
};

const ClientPortalPage = () => {
  const { workspace } = useParams<{ workspace: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [leads, setLeads] = useState<ClientLead[]>([]);
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showInterestedOnly, setShowInterestedOnly] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<ClientLead | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [premiumDialogLead, setPremiumDialogLead] = useState<ClientLead | null>(null);
  const [isPremiumDialogOpen, setIsPremiumDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast} = useToast();

  const handleLeadClick = (lead: ClientLead) => {
    setSelectedLead(lead);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedLead(null);
  };

  const handleLeadUpdate = () => {
    fetchLeads(); // Refresh leads after update
  };

  const handleRefreshData = async () => {
    if (!workspace) {
      toast({
        title: "No workspace selected",
        description: "Please select a workspace to refresh",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsRefreshing(true);
      toast({
        title: "Refreshing data...",
        description: "Syncing leads from Email Bison",
      });

      const { data, error } = await supabase.functions.invoke('sync-client-pipeline', {
        body: { workspace_name: workspace }
      });

      if (error) throw error;

      const result = data?.results?.[0];
      if (result) {
        toast({
          title: "Sync complete!",
          description: `Synced ${result.leads_synced} leads (${result.unique_leads} total unique)`,
        });
      } else {
        toast({
          title: "Sync complete!",
          description: "Data refreshed successfully",
        });
      }

      // Refresh the leads list
      await fetchLeads();

    } catch (error) {
      console.error('Refresh error:', error);
      toast({
        title: "Refresh failed",
        description: "Failed to sync data from Email Bison",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePremiumSave = async (premiumAmount: number, policyType: string) => {
    if (!premiumDialogLead) return;

    try {
      // Update lead with premium, policy type, and move to won
      const { error } = await (supabase as any)
        .from('client_leads')
        .update({
          premium_amount: premiumAmount,
          policy_type: policyType,
          pipeline_stage: 'won',
        })
        .eq('id', premiumDialogLead.id);

      if (error) throw error;

      // Update local state
      setLeads(prev => prev.map(l =>
        l.id === premiumDialogLead.id
          ? { ...l, premium_amount: premiumAmount, policy_type: policyType, pipeline_stage: 'won' }
          : l
      ));

      toast({
        title: "🎉 Deal won!",
        description: `${premiumDialogLead.first_name} ${premiumDialogLead.last_name} moved to Won with $${premiumAmount.toLocaleString()} premium`,
      });

      setPremiumDialogLead(null);
    } catch (error) {
      console.error('Error updating lead:', error);
      toast({
        title: "Error",
        description: "Failed to update lead",
        variant: "destructive",
      });
    }
  };

  // SMA Insurance: Handle multiple policies save
  const handleSMAPoliciesSave = async (policies: SMAPolicyFormData[]) => {
    if (!premiumDialogLead) return;

    try {
      // Create multiple policies for this lead
      await createPolicies(premiumDialogLead.id, policies);

      // Update lead pipeline stage to won
      const { error } = await (supabase as any)
        .from('client_leads')
        .update({
          pipeline_stage: 'won',
        })
        .eq('id', premiumDialogLead.id);

      if (error) throw error;

      // Update local state
      setLeads(prev => prev.map(l =>
        l.id === premiumDialogLead.id
          ? { ...l, pipeline_stage: 'won' }
          : l
      ));

      const totalPremium = policies.reduce((sum, p) => sum + p.premium_amount, 0);
      const totalAgencyCommission = policies.reduce((sum, p) => sum + p.agency_commission, 0);

      toast({
        title: "🎉 Deal won!",
        description: `${premiumDialogLead.first_name} ${premiumDialogLead.last_name} moved to Won with ${policies.length} ${policies.length === 1 ? 'policy' : 'policies'} totaling $${totalPremium.toLocaleString()} premium`,
      });

      setPremiumDialogLead(null);

      // Refresh SMA KPI cards if available
      if (typeof (window as any).refreshSMAKPIs === 'function') {
        (window as any).refreshSMAKPIs();
      }
    } catch (error) {
      console.error('Error creating SMA policies:', error);
      toast({
        title: "Error",
        description: "Failed to create policies",
        variant: "destructive",
      });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Drag starts after moving 8px
      },
    })
  );

  useEffect(() => {
    fetchLeads();
    fetchWorkspaces();
  }, [workspace]);

  const { user } = useAuth();
  const { getUserWorkspaces } = useSecureWorkspaceData();

  const fetchWorkspaces = async () => {
    try {
      // First check if workspaces were passed via navigation state from ClientPortalHub
      const navigationState = location.state as { availableWorkspaces?: string[], isAdmin?: boolean } | null;

      if (navigationState?.availableWorkspaces) {
        setWorkspaces(navigationState.availableWorkspaces);
        return;
      }

      // Fallback: Check if we have a valid session (for direct navigation)
      const { data: { session } } = await supabase.auth.getSession();

      let workspaceNames: string[];

      if (session?.user) {
        // AUTHENTICATED: Check if user is admin

        // Check if user is admin
        const { data: adminCheck } = await (supabase as any)
          .from('user_workspace_access')
          .select('role')
          .eq('user_id', session.user.id)
          .eq('role', 'admin')
          .maybeSingle();

        const isAdmin = !!adminCheck || session.user.id === '09322929-6078-4b08-bd55-e3e1ff773028';

        if (isAdmin) {
          // ADMIN: Show ALL workspaces from client_registry

          const { data: allWorkspaces, error: workspacesError } = await (supabase as any)
            .from('client_registry')
            .select('workspace_name')
            .order('workspace_name');

          if (workspacesError) {
            console.error('[ClientPortalPage] Error fetching workspaces:', workspacesError);
            throw workspacesError;
          }

          workspaceNames = (allWorkspaces || []).map((w: any) => w.workspace_name);
        } else {
          // REGULAR USER: Only show their assigned workspaces
          const userWorkspacesData = await getUserWorkspaces();

          workspaceNames = userWorkspacesData.map((w: any) => w.workspace_name);
        }
      } else {
        // UNAUTHENTICATED: Direct call (for admin dashboard)
        const BISON_API_KEY = "77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d";
        const BISON_BASE_URL = "https://send.maverickmarketingllc.com/api";

        const response = await fetch(`${BISON_BASE_URL}/workspaces`, {
          headers: {
            'Authorization': `Bearer ${BISON_API_KEY}`,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) throw new Error('Failed to fetch workspaces');

        const data = await response.json();
        const workspaceData = data.data;
        workspaceNames = workspaceData
          .map((w: any) => w.name)
          .sort((a: string, b: string) => a.localeCompare(b));
      }

      setWorkspaces(workspaceNames);
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    }
  };

  const handleWorkspaceChange = (newWorkspace: string) => {
    navigate(`/client-portal/${encodeURIComponent(newWorkspace)}`, {
      state: {
        availableWorkspaces: workspaces,
        isAdmin: location.state?.isAdmin
      }
    });
  };

  const fetchLeads = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('client_leads')
        .select('*')
        .eq('interested', true) // Only fetch interested leads
        .order('date_received', { ascending: false })
        .range(0, 9999); // Fetch up to 10,000 leads (removes 1000 default limit)

      if (workspace) {
        query = query.eq('workspace_name', workspace);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching leads:', error);
        throw error;
      }

      setLeads(data || []);
    } catch (error: any) {
      console.error('Error fetching leads:', error);

      // Check if it's a table not found error
      if (error?.message?.includes('relation "public.client_leads" does not exist')) {
        toast({
          title: "Database Setup Required",
          description: "The client_leads table hasn't been created yet. Please run the SQL migration in Supabase.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error?.message || "Failed to load leads",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const [draggedLead, setDraggedLead] = useState<{id: string, originalStage: string} | null>(null);

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
    const lead = leads.find(l => l.id === event.active.id);
    if (lead) {
      setDraggedLead({ id: lead.id, originalStage: lead.pipeline_stage });
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the active lead
    const activeLead = leads.find(l => l.id === activeId);
    if (!activeLead) return;

    // Determine target stage
    let targetStage: string;

    // Check if hovering over a column
    if (PIPELINE_STAGES.some(s => s.key === overId)) {
      targetStage = overId;
    } else {
      // Hovering over a lead - get that lead's stage
      const targetLead = leads.find(l => l.id === overId);
      if (!targetLead) return;
      targetStage = targetLead.pipeline_stage;
    }

    // If the stage hasn't changed, do nothing
    if (activeLead.pipeline_stage === targetStage) return;

    // Optimistically update the UI
    setLeads(prev => prev.map(l =>
      l.id === activeId ? { ...l, pipeline_stage: targetStage } : l
    ));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);

    if (!over || !draggedLead) {
      setDraggedLead(null);
      return;
    }

    const leadId = active.id as string;
    let newStage: string;

    // Check if dropped over a column or another lead
    const lead = leads.find(l => l.id === leadId);
    if (!lead) {
      setDraggedLead(null);
      return;
    }

    // If dropped over a column directly
    if (PIPELINE_STAGES.some(s => s.key === over.id)) {
      newStage = over.id as string;
    }
    // If dropped over another lead, get that lead's stage
    else {
      const targetLead = leads.find(l => l.id === over.id);
      if (!targetLead) {
        setDraggedLead(null);
        return;
      }
      newStage = targetLead.pipeline_stage;
    }

    // Don't update if it's the same stage as original
    if (draggedLead.originalStage === newStage) {
      setDraggedLead(null);
      return;
    }

    // Check if moving to Won stage - require premium and policy info
    if (newStage === 'won') {
      if (!lead.premium_amount || !lead.policy_type) {
        // Show premium input dialog
        setPremiumDialogLead({ ...lead, pipeline_stage: draggedLead.originalStage });
        setIsPremiumDialogOpen(true);
        setDraggedLead(null);
        return;
      }
    }

    // Update in database
    try {
      const { error } = await (supabase as any)
        .from('client_leads')
        .update({ pipeline_stage: newStage })
        .eq('id', leadId);

      if (error) throw error;

      toast({
        title: "Lead moved",
        description: `Moved to ${PIPELINE_STAGES.find(s => s.key === newStage)?.label}`,
      });
    } catch (error) {
      console.error('Error updating lead stage:', error);
      // Revert on error
      setLeads(prev => prev.map(l =>
        l.id === leadId ? { ...l, pipeline_stage: draggedLead.originalStage } : l
      ));
      toast({
        title: "Error",
        description: "Failed to move lead",
        variant: "destructive",
      });
    }

    setDraggedLead(null);
  };

  const handleToggleInterested = async (leadId: string, currentValue: boolean) => {
    const newValue = !currentValue;

    // Optimistically update UI
    setLeads(prev => prev.map(l =>
      l.id === leadId ? { ...l, interested: newValue } : l
    ));

    // Update in database
    try {
      const { error } = await (supabase as any)
        .from('client_leads')
        .update({ interested: newValue })
        .eq('id', leadId);

      if (error) throw error;

      toast({
        title: newValue ? "Marked as interested" : "Unmarked as interested",
        description: newValue ? "Lead marked as positive" : "Interest flag removed",
      });
    } catch (error) {
      console.error('Error updating interested flag:', error);
      // Revert on error
      setLeads(prev => prev.map(l =>
        l.id === leadId ? { ...l, interested: currentValue } : l
      ));
      toast({
        title: "Error",
        description: "Failed to update lead",
        variant: "destructive",
      });
    }
  };


  const filteredLeads = leads.filter(lead => {
    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesSearch = (
        lead.first_name?.toLowerCase().includes(search) ||
        lead.last_name?.toLowerCase().includes(search) ||
        lead.lead_email?.toLowerCase().includes(search) ||
        lead.phone?.includes(search)
      );
      if (!matchesSearch) return false;
    }

    // Filter by interested flag
    if (showInterestedOnly && !lead.interested) {
      return false;
    }

    return true;
  });

  const getLeadsByStage = (stage: string) => {
    return filteredLeads.filter(lead => lead.pipeline_stage === stage);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="flex items-center justify-center h-screen">
          <div className="text-foreground text-xl">Loading leads...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-6 justify-between">
          <Link to="/client-portal">
            <Button variant="ghost">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Client Portal Hub
            </Button>
          </Link>
          
          {/* Theme Toggle */}
          <ThemeToggle />
        </div>

        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">
                {workspace || 'All Leads'}
              </h1>
              <p className="text-muted-foreground">Manage your lead pipeline</p>
            </div>

            {/* Workspace Switcher */}
            {workspaces.length > 0 && (
              <Select value={workspace} onValueChange={handleWorkspaceChange}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Switch workspace..." />
                </SelectTrigger>
                <SelectContent className="max-h-[400px]">
                  {workspaces.map((ws) => (
                    <SelectItem
                      key={ws}
                      value={ws}
                    >
                      {ws}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Refresh Button */}
          {workspace && (
            <Button
              onClick={handleRefreshData}
              disabled={isRefreshing}
              variant="default"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
            </Button>
          )}
        </div>

        {/* Search and Filters */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* KPI Stats */}
      {workspace && (
        workspace === "SMA Insurance" ? (
          <SMACommissionKPICards />
        ) : (
          <ClientKPIStats
            workspaceName={workspace}
            totalLeads={filteredLeads.length}
            wonLeads={getLeadsByStage('won').length}
            newLeads={getLeadsByStage('interested').length}
          />
        )
      )}

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {PIPELINE_STAGES.map(stage => (
            <DroppableColumn
              key={stage.key}
              stage={stage}
              leads={getLeadsByStage(stage.key)}
              onToggleInterested={handleToggleInterested}
              onLeadClick={handleLeadClick}
              formatDate={formatDate}
            />
          ))}
        </div>
      </DndContext>

      {/* Lead Detail Modal */}
      <LeadDetailModal
        lead={selectedLead}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onUpdate={handleLeadUpdate}
      />

      {/* Premium Input Dialog - Conditional based on workspace */}
      {workspace === "SMA Insurance" ? (
        <SMAPoliciesInputDialog
          isOpen={isPremiumDialogOpen}
          onClose={() => {
            setIsPremiumDialogOpen(false);
            setPremiumDialogLead(null);
          }}
          onSave={handleSMAPoliciesSave}
          leadName={premiumDialogLead ? `${premiumDialogLead.first_name} ${premiumDialogLead.last_name}` : ''}
        />
      ) : (
        <PremiumInputDialog
          isOpen={isPremiumDialogOpen}
          onClose={() => {
            setIsPremiumDialogOpen(false);
            setPremiumDialogLead(null);
          }}
          onSave={handlePremiumSave}
          leadName={premiumDialogLead ? `${premiumDialogLead.first_name} ${premiumDialogLead.last_name}` : ''}
          currentPremium={premiumDialogLead?.premium_amount}
          currentPolicyType={premiumDialogLead?.policy_type}
        />
      )}
    </div>
  );
};

export default ClientPortalPage;
