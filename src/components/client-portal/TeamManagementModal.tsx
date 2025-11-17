import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Loader2, UserPlus, Trash2, Mail, Users } from "lucide-react";

interface TeamMember {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
}

interface TeamManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceName: string;
  onTeamUpdated?: () => void;
}

export const TeamManagementModal = ({
  isOpen,
  onClose,
  workspaceName,
  onTeamUpdated,
}: TeamManagementModalProps) => {
  const { toast } = useToast();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Invite user state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [invitePassword, setInvitePassword] = useState("123456");
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTeamMembers();
      getCurrentUser();
    }
  }, [isOpen, workspaceName]);

  const getCurrentUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setCurrentUserId(session?.user?.id || null);
  };

  const fetchTeamMembers = async () => {
    try {
      setLoading(true);

      // Get all users with access to this workspace
      const { data: accessData, error: accessError } = await supabase
        .from('user_workspace_access')
        .select('user_id, role, created_at')
        .eq('workspace_name', workspaceName);

      if (accessError) throw accessError;

      if (!accessData || accessData.length === 0) {
        setTeamMembers([]);
        return;
      }

      // Get user profiles separately
      const userIds = accessData.map((a: any) => a.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Create profile map
      const profileMap = new Map<string, { email: string; full_name: string }>();
      (profiles || []).forEach((p: any) => {
        profileMap.set(p.id, {
          email: p.email || '',
          full_name: p.full_name || ''
        });
      });

      const members: TeamMember[] = (accessData || [])
        .filter((access: any) => access.role !== 'admin') // Don't show admins
        .map((access: any) => {
          const profile = profileMap.get(access.user_id);
          const emailUsername = profile?.email?.split('@')[0] || '';
          const displayName = profile?.full_name || emailUsername || 'Unknown User';

          return {
            user_id: access.user_id,
            email: profile?.email || '',
            full_name: displayName,
            role: access.role,
            created_at: access.created_at,
          };
        })
        .sort((a: TeamMember, b: TeamMember) =>
          a.full_name.localeCompare(b.full_name)
        );

      setTeamMembers(members);
    } catch (error: any) {
      console.error('Error fetching team members:', error);
      toast({
        title: "Error loading team",
        description: error.message || "Failed to load team members",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail || !inviteFullName) {
      toast({
        title: "Missing information",
        description: "Please provide both email and full name",
        variant: "destructive",
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    try {
      setInviteLoading(true);

      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: inviteEmail,
        password: invitePassword,
        options: {
          data: {
            full_name: inviteFullName,
          },
        },
      });

      if (authError) {
        // Check if user already exists
        if (authError.message.includes("already registered")) {
          toast({
            title: "User already exists",
            description: "This email is already registered. You can add them to your workspace directly.",
            variant: "destructive",
          });
          return;
        }
        throw authError;
      }

      if (!authData.user) {
        throw new Error("Failed to create user account");
      }

      // 2. Create user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          id: authData.user.id,
          email: inviteEmail,
          full_name: inviteFullName,
        });

      if (profileError) {
        console.warn('Profile creation warning:', profileError);
        // Continue anyway - profile might have been created by trigger
      }

      // 3. Add workspace access
      const { error: accessError } = await supabase
        .from('user_workspace_access')
        .insert({
          user_id: authData.user.id,
          workspace_name: workspaceName,
          role: 'client', // Always client role for workspace invites
          created_by: currentUserId,
        });

      if (accessError) throw accessError;

      toast({
        title: "Team member invited",
        description: `${inviteFullName} has been added to your team. They can log in with password: ${invitePassword}`,
      });

      // Reset form
      setInviteEmail("");
      setInviteFullName("");
      setInvitePassword("123456");
      setShowInviteForm(false);

      // Refresh team list
      fetchTeamMembers();
      onTeamUpdated?.();
    } catch (error: any) {
      console.error('Error inviting user:', error);
      toast({
        title: "Invite failed",
        description: error.message || "Failed to invite team member",
        variant: "destructive",
      });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveAccess = async (userId: string, userName: string) => {
    if (userId === currentUserId) {
      toast({
        title: "Cannot remove yourself",
        description: "You cannot remove your own access",
        variant: "destructive",
      });
      return;
    }

    if (!window.confirm(`Are you sure you want to remove ${userName} from this workspace?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('user_workspace_access')
        .delete()
        .eq('user_id', userId)
        .eq('workspace_name', workspaceName);

      if (error) throw error;

      toast({
        title: "Access removed",
        description: `${userName} has been removed from the workspace`,
      });

      // Refresh team list
      fetchTeamMembers();
      onTeamUpdated?.();
    } catch (error: any) {
      console.error('Error removing access:', error);
      toast({
        title: "Remove failed",
        description: error.message || "Failed to remove team member",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Management
          </DialogTitle>
          <DialogDescription>
            Manage team members who have access to {workspaceName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Invite Button */}
          {!showInviteForm && (
            <Button
              onClick={() => setShowInviteForm(true)}
              className="w-full"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Invite Team Member
            </Button>
          )}

          {/* Invite Form */}
          {showInviteForm && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold">Invite New Team Member</h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={inviteFullName}
                    onChange={(e) => setInviteFullName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Initial Password</Label>
                  <Input
                    id="password"
                    value={invitePassword}
                    onChange={(e) => setInvitePassword(e.target.value)}
                    placeholder="Temporary password"
                  />
                  <p className="text-xs text-muted-foreground">
                    Share this password with the new team member. They should change it after first login.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleInviteUser}
                  disabled={inviteLoading}
                >
                  {inviteLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Inviting...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Send Invite
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowInviteForm(false);
                    setInviteEmail("");
                    setInviteFullName("");
                    setInvitePassword("123456");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Team Members Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : teamMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No team members found. Invite someone to get started!
                    </TableCell>
                  </TableRow>
                ) : (
                  teamMembers.map((member) => (
                    <TableRow key={member.user_id}>
                      <TableCell className="font-medium">
                        {member.full_name}
                        {member.user_id === currentUserId && (
                          <Badge variant="outline" className="ml-2">You</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {member.user_id !== currentUserId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveAccess(member.user_id, member.full_name)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
