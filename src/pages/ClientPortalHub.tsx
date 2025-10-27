import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Users, TrendingUp, MapPin, ArrowLeft, PieChart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/ProtectedRoute";
import { useSecureWorkspaceData } from "@/hooks/useSecureWorkspaceData";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface Workspace {
  id: number;
  name: string;
  leadsCount?: number;
  wonLeadsCount?: number;
}

// Only show clients with webhooks deployed (23 clients)
const ALLOWED_WORKSPACES = [
  "David Amiri",
  "Kim Wallace",
  "Jeff Schroder",
  "ATI",
  "Jason Binyon",
  "Danny Schwartz",
  "Devin Hodo",
  "Gregg Blanchard",
  "John Roberts",
  "Kirk Hodgson",
  "Nick Sakha",
  "Rob Russell",
  "SMA Insurance",
  "Shane Miller",
  "StreetSmart Commercial",
  "StreetSmart P&C",
  "StreetSmart Trucking",
  "Tony Schmitz",
  "Insurance" // Longrun workspace (Boring Book Keeping, Koppa Analytics, Ozment media, Radiant Energy Partners, Workspark)
];

export default function ClientPortalHub() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [filteredWorkspaces, setFilteredWorkspaces] = useState<Workspace[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredWorkspaces(workspaces);
    } else {
      const filtered = workspaces.filter(w =>
        w.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredWorkspaces(filtered);
    }
  }, [searchTerm, workspaces]);

  const { user } = useAuth();
  const { getUserWorkspaces } = useSecureWorkspaceData();

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);

      // Check if we have a valid session
      const { data: { session } } = await supabase.auth.getSession();

      let workspacesWithCounts: Workspace[];

      if (session?.user) {
        // AUTHENTICATED: Check if user is admin
        console.log('[ClientPortalHub] Fetching workspaces for authenticated user:', session.user.email);

        // Check if user is admin
        const { data: adminCheck } = await (supabase as any)
          .from('user_workspace_access')
          .select('role')
          .eq('user_id', session.user.id)
          .eq('role', 'admin')
          .maybeSingle();

        const isAdmin = !!adminCheck || session.user.id === '09322929-6078-4b08-bd55-e3e1ff773028';
        setIsAdmin(isAdmin);
        console.log('[ClientPortalHub] User is admin:', isAdmin);

        if (isAdmin) {
          // ADMIN: Show ALL workspaces from client_registry
          console.log('[ClientPortalHub] Admin user - showing all workspaces');

          const { data: allWorkspaces, error: workspacesError } = await (supabase as any)
            .from('client_registry')
            .select('workspace_name')
            .order('workspace_name');

          if (workspacesError) {
            console.error('[ClientPortalHub] Error fetching workspaces:', workspacesError);
            throw workspacesError;
          }

          // Get lead counts for all workspaces
          const { data: leadCounts, error: leadsError } = await (supabase as any)
            .from('client_leads')
            .select('workspace_name, pipeline_stage');

          if (leadsError) {
            console.error('[ClientPortalHub] Error fetching lead counts:', leadsError);
            // Don't throw, just continue with empty counts
          }

          // Aggregate counts by workspace
          const countsByWorkspace = leadCounts?.reduce((acc: any, lead: any) => {
            if (!acc[lead.workspace_name]) {
              acc[lead.workspace_name] = { total: 0, won: 0 };
            }
            acc[lead.workspace_name].total++;
            if (lead.pipeline_stage === 'won') {
              acc[lead.workspace_name].won++;
            }
            return acc;
          }, {});

          workspacesWithCounts = (allWorkspaces || []).map((w, idx) => ({
            id: idx,
            name: w.workspace_name,
            leadsCount: countsByWorkspace?.[w.workspace_name]?.total || 0,
            wonLeadsCount: countsByWorkspace?.[w.workspace_name]?.won || 0,
          }));
        } else {
          // REGULAR USER: Only show their assigned workspaces
          console.log('[ClientPortalHub] Regular user - showing assigned workspaces only');
          const userWorkspacesData = await getUserWorkspaces();

          console.log('[ClientPortalHub] User workspace data:', userWorkspacesData);

          workspacesWithCounts = userWorkspacesData.map((w: any) => ({
            id: w.workspace_id || 0,
            name: w.workspace_name,
            leadsCount: Number(w.leads_count) || 0,
            wonLeadsCount: Number(w.won_leads_count) || 0,
          }));
        }
      } else {
        // This shouldn't happen since the route is protected
        console.error('[ClientPortalHub] No session found - this should not happen');
        workspacesWithCounts = [];
      }

      // Sort by leads count (descending), then by name
      workspacesWithCounts.sort((a, b) => {
        if (b.leadsCount !== a.leadsCount) {
          return (b.leadsCount || 0) - (a.leadsCount || 0);
        }
        return a.name.localeCompare(b.name);
      });

      setWorkspaces(workspacesWithCounts);
      setFilteredWorkspaces(workspacesWithCounts);
      console.log('[ClientPortalHub] Successfully loaded workspaces:', workspacesWithCounts.length);
    } catch (error) {
      console.error('[ClientPortalHub] Error fetching workspaces:', error);
      // Set empty state on error
      setWorkspaces([]);
      setFilteredWorkspaces([]);
    } finally {
      setLoading(false);
    }
  };

  const handleWorkspaceClick = (workspaceName: string) => {
    navigate(`/client-portal/${encodeURIComponent(workspaceName)}`, {
      state: {
        availableWorkspaces: workspaces.map(w => w.name),
        isAdmin
      }
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">

        {/* Admin Back Button, Logout, and Theme Toggle */}
        <div className="mb-6 flex items-center justify-between w-full">
          <div>
            {isAdmin ? (
              <Link to="/admin">
                <Button variant="ghost">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
            ) : (
              <div className="flex items-center gap-3">
              <div className="bg-[#5B8FF9] rounded-xl p-2 flex items-center justify-center">
                <img
                  src="/maverick-icon.svg"
                  alt="Maverick Marketing Icon"
                  className="h-6 w-auto"
                  style={{ filter: 'brightness(0) invert(1)' }}
                />
              </div>
              <span className="text-2xl font-bold text-foreground">
                <img
                  src="/maverick-marketing-icon.svg"
                  alt="Maverick Marketing LLC"
                  className="h-8 w-auto"
                />
              </span>
            </div>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {/* Theme Toggle */}
            <ThemeToggle />
            <Button
              variant="outline"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/";
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1" /></svg>
              Logout
            </Button>
          </div>
        </div>

        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Client Portal Hub
            </h1>
            <p className="text-muted-foreground">
              Select a workspace to view their lead pipeline and performance metrics
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link to="/zip-dashboard">
                  <MapPin className="h-4 w-4 mr-2" />
                  ZIP Dashboard
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/roi-dashboard">
                  <PieChart className="h-4 w-4 mr-2" />
                  ROI Dashboard
                </Link>
              </Button>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search workspaces..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Workspace Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="h-32 bg-muted/80 border border-border rounded-xl relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-foreground/10 before:to-transparent" />
            ))}
          </div>
        ) : filteredWorkspaces.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No workspaces found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredWorkspaces.map(workspace => (
              <Card
                key={workspace.id}
                onClick={() => handleWorkspaceClick(workspace.name)}
                className="group hover:bg-accent cursor-pointer transition-all hover:scale-105 p-4"
              >
                <div className="flex flex-col gap-3">
                  {/* Workspace Name */}
                  <div className="flex items-start gap-2">
                    <Users className="h-5 w-5 text-primary group-hover:text-accent-foreground flex-shrink-0 mt-0.5" />
                    <h3 className="font-semibold line-clamp-2 group-hover:text-accent-foreground">
                      {workspace.name}
                    </h3>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-success group-hover:text-accent-foreground" />
                      <span className="text-muted-foreground group-hover:text-accent-foreground/80">Leads:</span>
                      <span className="font-medium group-hover:text-accent-foreground">{workspace.leadsCount || 0}</span>
                    </div>
                    {(workspace.wonLeadsCount || 0) > 0 && (
                      <div className="text-success group-hover:text-accent-foreground font-medium">
                        {workspace.wonLeadsCount} Won
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Summary */}
        <div className="mt-8 pt-6 border-t border-border">
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">{filteredWorkspaces.length}</span> workspaces
              {searchTerm && ` matching "${searchTerm}"`}
            </div>
            <div>
              <span className="font-medium text-foreground">
                {filteredWorkspaces.reduce((sum, w) => sum + (w.leadsCount || 0), 0)}
              </span> total leads
            </div>
            <div>
              <span className="font-medium text-foreground">
                {filteredWorkspaces.reduce((sum, w) => sum + (w.wonLeadsCount || 0), 0)}
              </span> won leads
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
