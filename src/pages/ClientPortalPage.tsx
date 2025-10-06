import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { DndContext, DragEndEvent, DragOverEvent, closestCenter, closestCorners, PointerSensor, useSensor, useSensors, DragOverlay, useDroppable, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Calendar, ExternalLink, ChevronDown, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ClientKPIStats } from "@/components/dashboard/ClientKPIStats";
import { LeadDetailModal } from "@/components/client-portal/LeadDetailModal";
import { ClientROICalculator } from "@/components/client-portal/ClientROICalculator";
import { PremiumInputDialog } from "@/components/client-portal/PremiumInputDialog";
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
  { key: 'new', label: 'New', color: 'bg-blue-500/20 border-blue-500/40' },
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
      className="bg-white/10 border-white/20 hover:bg-white/20 transition-colors relative"
    >
      {/* Drag Handle - Top of card */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-0 left-0 right-0 h-8 cursor-grab active:cursor-grabbing hover:bg-white/5 flex items-center justify-center z-10"
      >
        <div className="w-8 h-1 bg-white/30 rounded-full"></div>
      </div>

      <CardContent className="p-4 pt-10 cursor-pointer" onClick={() => onClick(lead)}>
        <div className="space-y-2">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold truncate">
                {lead.first_name} {lead.last_name}
              </div>
              {lead.title && (
                <div className="text-blue-300 text-sm font-medium truncate">
                  {lead.title}
                </div>
              )}
              {lead.company && (
                <div className="text-white/60 text-sm truncate">
                  {lead.company}
                </div>
              )}
              <div className="text-white/70 text-sm truncate">
                {lead.lead_email}
              </div>
            </div>
            {lead.icp && (
              <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/40 flex-shrink-0">
                ICP
              </Badge>
            )}
          </div>

          {/* Tags */}
          {lead.tags && lead.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {lead.tags.slice(0, 3).map((tag) => (
                <Badge key={tag.id} variant="outline" className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-xs truncate max-w-full">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Custom Variables - show first 2 */}
          {lead.custom_variables && lead.custom_variables.length > 0 && (
            <div className="space-y-1">
              {lead.custom_variables.slice(0, 2).map((cv, idx) => (
                <div key={idx} className="text-white/60 text-xs truncate">
                  <span className="text-white/40">{cv.name}:</span> {cv.value}
                </div>
              ))}
            </div>
          )}

          {lead.phone && (
            <div className="text-white/60 text-sm truncate">{lead.phone}</div>
          )}

          {lead.date_received && (
            <div className="flex items-center gap-1 text-white/50 text-xs">
              <Calendar className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{formatDate(lead.date_received)}</span>
            </div>
          )}

          {lead.renewal_date && (
            <div className="text-white/60 text-sm truncate">
              Renewal: {lead.renewal_date}
            </div>
          )}

          {lead.notes && (
            <div className="text-white/70 text-sm bg-white/5 p-2 rounded line-clamp-2">
              {lead.notes}
            </div>
          )}

          {lead.bison_conversation_url && (
            <a
              href={lead.bison_conversation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-dashboard-accent hover:text-dashboard-accent/80 text-sm truncate"
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
        <h3 className="text-white font-semibold">{stage.label}</h3>
        <p className="text-white/70 text-sm">{leads.length} leads</p>
      </div>

      {/* Drop Zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 bg-white/5 border-2 rounded-lg p-2 min-h-[500px] space-y-2 transition-colors ${
          isOver ? 'border-dashboard-accent bg-dashboard-accent/10' : 'border-white/10'
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
          <div className="text-white/40 text-center py-8 text-sm">
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

  const handlePremiumSave = async (premiumAmount: number, policyType: string) => {
    if (!premiumDialogLead) return;

    try {
      // Update lead with premium, policy type, and move to won
      const { error } = await supabase
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

  const fetchWorkspaces = async () => {
    try {
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
      const workspaceNames = data.data
        .map((w: any) => w.name)
        .sort((a: string, b: string) => a.localeCompare(b));

      setWorkspaces(workspaceNames);
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    }
  };

  const handleWorkspaceChange = (newWorkspace: string) => {
    navigate(`/client-portal/${encodeURIComponent(newWorkspace)}`);
  };

  const fetchLeads = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('client_leads')
        .select('*')
        .order('date_received', { ascending: false });

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
      const { error } = await supabase
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
      const { error } = await supabase
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
      <div className="min-h-screen bg-gradient-to-br from-dashboard-dark via-dashboard-slate to-dashboard-charcoal p-8">
        <div className="flex items-center justify-center h-screen">
          <div className="text-white text-xl">Loading leads...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dashboard-dark via-dashboard-slate to-dashboard-charcoal p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-6">
          <Link to="/">
            <Button variant="ghost" className="text-white hover:bg-white/10">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                {workspace || 'All Leads'}
              </h1>
              <p className="text-white/70">Manage your lead pipeline</p>
            </div>

            {/* Workspace Switcher */}
            {workspaces.length > 0 && (
              <Select value={workspace} onValueChange={handleWorkspaceChange}>
                <SelectTrigger className="w-[280px] bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Switch workspace..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-white/20 text-white max-h-[400px]">
                  {workspaces.map((ws) => (
                    <SelectItem
                      key={ws}
                      value={ws}
                      className="text-white hover:bg-white/10 focus:bg-white/20 cursor-pointer"
                    >
                      {ws}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

        </div>

        {/* Search and Filters */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4" />
          <Input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
          />
        </div>
      </div>

      {/* KPI Stats */}
      {workspace && (
        <ClientKPIStats
          workspaceName={workspace}
          totalLeads={filteredLeads.length}
          wonLeads={getLeadsByStage('won').length}
          newLeads={getLeadsByStage('new').length}
        />
      )}

      {/* ROI Calculator */}
      {workspace && leads.length > 0 && (
        <div className="mb-8">
          <ClientROICalculator
            workspaceName={workspace}
            leads={leads}
          />
        </div>
      )}

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
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

      {/* Premium Input Dialog */}
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
    </div>
  );
};

export default ClientPortalPage;
