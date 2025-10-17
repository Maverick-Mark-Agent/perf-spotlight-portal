import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Shield, User, Trash2, Plus, Mail } from "lucide-react";

interface User {
  id: string;
  email: string;
  created_at: string;
  workspaces: {
    workspace_name: string;
    role: string;
  }[];
}

interface Workspace {
  workspace_name: string;
}

const UserManagement = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showAddWorkspaceDialog, setShowAddWorkspaceDialog] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState("");
  const [newRole, setNewRole] = useState<"client" | "admin">("client");
  const [actionLoading, setActionLoading] = useState(false);

  // Invite user dialog state
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("123456");
  const [inviteWorkspaces, setInviteWorkspaces] = useState<string[]>([]);
  const [inviteRole, setInviteRole] = useState<"client" | "admin">("client");
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchWorkspaces();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      // Get all users from user_profiles (this has all 38 users)
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, created_at')
        .order('created_at', { ascending: false });

      if (profileError) throw profileError;

      // Get workspace access for all users
      const { data: accessData, error: accessError } = await supabase
        .from('user_workspace_access')
        .select('user_id, workspace_name, role');

      if (accessError) throw accessError;

      // Create a map of user_id to workspace access
      const accessMap = new Map<string, Array<{ workspace_name: string; role: string }>>();
      for (const access of accessData || []) {
        if (!accessMap.has(access.user_id)) {
          accessMap.set(access.user_id, []);
        }
        accessMap.get(access.user_id)!.push({
          workspace_name: access.workspace_name,
          role: access.role,
        });
      }

      // Combine profiles with their workspace access
      const users: User[] = (profiles || []).map((profile) => ({
        id: profile.id,
        email: profile.email || profile.full_name || `User ${profile.id.substring(0, 8)}...`,
        created_at: profile.created_at,
        workspaces: accessMap.get(profile.id) || [],
      }));

      setUsers(users);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error loading users",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkspaces = async () => {
    try {
      // Get unique workspace names from client_registry
      const { data, error } = await supabase
        .from('client_registry')
        .select('workspace_name')
        .order('workspace_name');

      if (error) throw error;

      setWorkspaces(data || []);
    } catch (error: any) {
      console.error("Error fetching workspaces:", error);
    }
  };

  const handleAddWorkspace = async () => {
    if (!selectedUser) return;

    // Validate: client role requires workspace selection, admin role doesn't
    if (newRole === "client" && !newWorkspace) return;

    try {
      setActionLoading(true);

      // For admin role, use "admin" as the workspace name
      const workspaceName = newRole === "admin" ? "admin" : newWorkspace;

      // Add workspace access directly to database
      const { error } = await supabase
        .from('user_workspace_access')
        .insert({
          user_id: selectedUser.id,
          workspace_name: workspaceName,
          role: newRole,
        });

      if (error) throw error;

      const successMessage = newRole === "admin"
        ? `${selectedUser.email} is now an admin with access to all workspaces`
        : `${selectedUser.email} now has access to ${newWorkspace}`;

      toast({
        title: "Access granted",
        description: successMessage,
      });

      setShowAddWorkspaceDialog(false);
      setNewWorkspace("");
      setNewRole("client");
      fetchUsers();
    } catch (error: any) {
      console.error("Error adding workspace:", error);
      toast({
        title: "Failed to add access",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveWorkspace = async (userId: string, workspaceName: string) => {
    try {
      // Remove workspace access directly from database
      const { error } = await supabase
        .from('user_workspace_access')
        .delete()
        .eq('user_id', userId)
        .eq('workspace_name', workspaceName);

      if (error) throw error;

      toast({
        title: "Workspace removed",
        description: `Access to ${workspaceName} has been removed`,
      });

      fetchUsers();
    } catch (error: any) {
      console.error("Error removing workspace:", error);
      toast({
        title: "Failed to remove workspace",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleInviteUser = async () => {
    // Validate email
    if (!inviteEmail || !inviteEmail.includes('@')) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    // Validate password
    if (!invitePassword || invitePassword.length < 6) {
      toast({
        title: "Invalid password",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    // Validate workspace selection for client role
    if (inviteRole === "client" && inviteWorkspaces.length === 0) {
      toast({
        title: "No workspace selected",
        description: "Please select at least one workspace for client users",
        variant: "destructive",
      });
      return;
    }

    try {
      setInviteLoading(true);

      console.log("Creating user:", inviteEmail);

      // Create user in Supabase Auth (email confirmation is now disabled in settings)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: inviteEmail,
        password: invitePassword,
        options: {
          emailRedirectTo: window.location.origin,
        }
      });

      console.log("SignUp response:", { authData, authError });

      if (authError) {
        console.error("Auth error:", authError);
        throw authError;
      }

      if (!authData.user) {
        throw new Error("User creation failed - no user returned");
      }

      const userId = authData.user.id;
      console.log("User created successfully, ID:", userId);

      // Add workspace access
      const workspacesToAdd = inviteRole === "admin" ? ["admin"] : inviteWorkspaces;

      const workspaceInserts = workspacesToAdd.map(workspace => ({
        user_id: userId,
        workspace_name: workspace,
        role: inviteRole,
      }));

      const { error: workspaceError } = await supabase
        .from('user_workspace_access')
        .insert(workspaceInserts);

      if (workspaceError) {
        console.error("Workspace assignment error:", workspaceError);

        // Check if it's a duplicate key error (user already has this workspace)
        if (workspaceError.code === '23505') {
          // Duplicate workspace assignment - this is okay, user already has access
          toast({
            title: "User created successfully",
            description: `${inviteEmail} can now login with password: ${invitePassword}. Workspace was already assigned.`,
          });
        } else {
          // Different error - warn the user
          toast({
            title: "User created, but workspace assignment failed",
            description: "Please manually assign workspace access from the user list",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "User created successfully",
          description: `${inviteEmail} can now login with password: ${invitePassword}`,
        });
      }

      // Refresh user list and close dialog
      fetchUsers();
      handleCloseInviteDialog();

    } catch (error: any) {
      console.error("Error creating user:", error);

      let errorMessage = error.message;
      if (error.message?.includes('already registered') || error.message?.includes('already exists') || error.message?.includes('User already registered')) {
        errorMessage = "A user with this email already exists";
      }

      toast({
        title: "Failed to create user",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCloseInviteDialog = () => {
    setShowInviteDialog(false);
    setInviteEmail("");
    setInvitePassword("123456");
    setInviteWorkspaces([]);
    setInviteRole("client");
    setInviteLoading(false);
  };

  const toggleWorkspace = (workspaceName: string) => {
    setInviteWorkspaces(prev =>
      prev.includes(workspaceName)
        ? prev.filter(w => w !== workspaceName)
        : [...prev, workspaceName]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">User Management</h1>
            <p className="text-muted-foreground">
              Manage user access to client portals and admin dashboard
            </p>
          </div>
          <Button onClick={() => setShowInviteDialog(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Invite User
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            {users.length} {users.length === 1 ? 'user' : 'users'} registered
          </CardDescription>
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-900">
              <strong>Tip:</strong> Users can have multiple workspace access. Click "Add Workspace Access" multiple times to grant access to multiple client portals.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Workspaces & Roles</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {user.workspaces.length === 0 ? (
                        <span className="text-sm text-muted-foreground">No access assigned</span>
                      ) : (
                        user.workspaces.map((ws, idx) => (
                          <div key={idx} className="flex items-center gap-1">
                            <Badge variant={ws.role === 'admin' ? 'default' : 'secondary'} className="gap-1">
                              {ws.role === 'admin' ? (
                                <Shield className="w-3 h-3" />
                              ) : (
                                <User className="w-3 h-3" />
                              )}
                              {ws.workspace_name}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => handleRemoveWorkspace(user.id, ws.workspace_name)}
                            >
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user);
                        setShowAddWorkspaceDialog(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Workspace Access
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Workspace Dialog */}
      <Dialog open={showAddWorkspaceDialog} onOpenChange={setShowAddWorkspaceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Workspace Access</DialogTitle>
            <DialogDescription>
              Grant {selectedUser?.email} access to a workspace
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={newRole} onValueChange={(val) => setNewRole(val as "client" | "admin")}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Client - View only their workspace
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Admin - Full access to all features
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newRole === "admin" ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Admin Access</p>
                    <p className="text-sm text-blue-700 mt-1">
                      Admin users have access to all workspaces and the admin dashboard. No workspace selection needed.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="workspace">Workspace</Label>
                <Select value={newWorkspace} onValueChange={setNewWorkspace}>
                  <SelectTrigger id="workspace">
                    <SelectValue placeholder="Select a workspace" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((ws) => (
                      <SelectItem key={ws.workspace_name} value={ws.workspace_name}>
                        {ws.workspace_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Tip: You can add multiple workspace access for the same user by clicking "Add Workspace Access" multiple times.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddWorkspaceDialog(false);
                setNewWorkspace("");
                setNewRole("client");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddWorkspace} disabled={actionLoading || (newRole === "client" && !newWorkspace)}>
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Access'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite User Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={handleCloseInviteDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Invite New User</DialogTitle>
            <DialogDescription>
              Create a new user account and assign workspace access immediately
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Email Input */}
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="pl-10"
                  disabled={inviteLoading}
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <Label htmlFor="invite-password">Password</Label>
              <Input
                id="invite-password"
                type="text"
                placeholder="Enter a simple password"
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
                disabled={inviteLoading}
              />
              <p className="text-xs text-muted-foreground">
                Default is "123456". You can change it to something else if needed (minimum 6 characters).
              </p>
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={(val) => setInviteRole(val as "client" | "admin")}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Client - Access to selected workspaces only
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Admin - Full access to all workspaces
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Workspace Selection (only for client role) */}
            {inviteRole === "admin" ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Admin Access</p>
                    <p className="text-sm text-blue-700 mt-1">
                      This user will have full access to all workspaces and the admin dashboard.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Select Workspaces</Label>
                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-2">
                  {workspaces.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No workspaces available</p>
                  ) : (
                    workspaces.map((ws) => (
                      <div key={ws.workspace_name} className="flex items-center space-x-2">
                        <Checkbox
                          id={`ws-${ws.workspace_name}`}
                          checked={inviteWorkspaces.includes(ws.workspace_name)}
                          onCheckedChange={() => toggleWorkspace(ws.workspace_name)}
                          disabled={inviteLoading}
                        />
                        <label
                          htmlFor={`ws-${ws.workspace_name}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {ws.workspace_name}
                        </label>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Select one or more workspaces. You can select multiple by checking multiple boxes.
                </p>
                {inviteWorkspaces.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {inviteWorkspaces.map(ws => (
                      <Badge key={ws} variant="secondary">{ws}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseInviteDialog}
              disabled={inviteLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleInviteUser}
              disabled={inviteLoading || !inviteEmail || !invitePassword}
            >
              {inviteLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating User...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create User
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
