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
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Shield, User, Trash2, Plus } from "lucide-react";
import { listUsers, addWorkspaceAccess, removeWorkspaceAccess } from "@/services/userManagementService";

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

  useEffect(() => {
    fetchUsers();
    fetchWorkspaces();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      console.log('[UserManagement] Fetching users...');

      // Use Edge Function to securely fetch all users (requires admin role)
      const usersData = await listUsers();

      console.log('[UserManagement] Users fetched successfully:', usersData.length);
      setUsers(usersData);
    } catch (error: any) {
      console.error("[UserManagement] Error fetching users:", error);
      console.error("[UserManagement] Error details:", {
        message: error.message,
        name: error.name,
        stack: error.stack
      });

      toast({
        title: "Error loading users",
        description: error.message || "Failed to fetch users. Check console for details.",
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
    if (!selectedUser || !newWorkspace) return;

    try {
      setActionLoading(true);

      // Use Edge Function to securely add workspace access
      await addWorkspaceAccess(selectedUser.id, newWorkspace, newRole);

      toast({
        title: "Workspace added",
        description: `${selectedUser.email} now has access to ${newWorkspace}`,
      });

      setShowAddWorkspaceDialog(false);
      setNewWorkspace("");
      setNewRole("client");
      fetchUsers();
    } catch (error: any) {
      console.error("Error adding workspace:", error);
      toast({
        title: "Failed to add workspace",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveWorkspace = async (userId: string, workspaceName: string) => {
    try {
      // Use Edge Function to securely remove workspace access
      await removeWorkspaceAccess(userId, workspaceName);

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
    // TODO: Implement user invitation
    toast({
      title: "Coming soon",
      description: "User invitation feature will be available soon",
    });
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
          <Button onClick={handleInviteUser}>
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
                      Add Workspace
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
            </div>

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
            <Button onClick={handleAddWorkspace} disabled={actionLoading || !newWorkspace}>
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
    </div>
  );
};

export default UserManagement;
