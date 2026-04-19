import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Shield, Loader2, KeyRound, UserX, UserCheck, Trash2, UserPlus, Send } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { SendEmailDialog } from "@/components/shared/SendEmailDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
  role: string;
  role_id: string;
  banned_until?: string;
  can_view_private_products?: boolean;
}

const Users = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const [resettingPassword, setResettingPassword] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState<UserWithRole | null>(null);
  
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("staff");
  const [inviting, setInviting] = useState(false);

  const [togglingStatus, setTogglingStatus] = useState<string | null>(null);
  const [togglingAccess, setTogglingAccess] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUserForDelete, setSelectedUserForDelete] = useState<UserWithRole | null>(null);
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  
  // Filters and Search
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all"); // all, admin, manager, staff, pending
  const [statusFilter, setStatusFilter] = useState("all"); // all, active, disabled
  const [sortFilter, setSortFilter] = useState("newest"); // newest, oldest
  
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);

  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate("/");
      toast.error("You don't have permission to access this page");
    }
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-users`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch users');
      }

      const { users: usersData } = await response.json();
      setTotalUsersCount(usersData.length);

      const customerUsers = usersData.filter((u: any) => u.role === 'customer');
      setCustomerCount(customerUsers.length);

      const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, can_view_private_products");

      if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
      }

      const profilesByUser: Record<string, boolean> = {};
      if (profilesData) {
          profilesData.forEach(p => {
              profilesByUser[p.user_id] = p.can_view_private_products || false;
          });
      }

      // Add banned status to users
      const usersWithStatus = usersData
        .map((user: any) => ({
          ...user,
          banned_until: user.banned_until || null,
          can_view_private_products: profilesByUser[user.id] || false
        }));

      setUsers(usersWithStatus);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error("Error loading users");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, roleId: string, newRole: string) => {
    try {
      setUpdatingUser(userId);

      // Delete old role
      if (roleId) {
        await supabase.from("user_roles").delete().eq("id", roleId);
      }

      // Insert new role
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("user_roles").insert([{
        user_id: userId,
        role: newRole as any,
        granted_by: user?.id,
      }]);

      if (error) throw error;

      toast.success("Role updated successfully");
      fetchUsers();
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast.error("Error updating role");
    } finally {
      setUpdatingUser(null);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "default";
      case "manager":
        return "secondary";
      case "staff":
        return "outline";
      case "customer":
        return "outline";
      case "pending":
        return "destructive";
      default:
        return "outline";
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUserForReset) return;

    try {
      setResettingPassword(selectedUserForReset.id);
      setResetDialogOpen(false);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-user-password`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: selectedUserForReset.id,
            email: selectedUserForReset.email,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reset password');
      }

      toast.success(`Password reset email sent to ${selectedUserForReset.email}`);
    } catch (error: any) {
      console.error("Error resetting password:", error);
      toast.error(error.message || "Error resetting password");
    } finally {
      setResettingPassword(null);
      setSelectedUserForReset(null);
    }
  };

  const handleToggleUserStatus = async (user: UserWithRole) => {
    const isDisabled = !!user.banned_until;

    try {
      setTogglingStatus(user.id);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/toggle-user-status`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            disabled: !isDisabled, // Toggle the current state
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update user status');
      }

      toast.success(`User ${!isDisabled ? 'disabled' : 'enabled'} successfully`);
      fetchUsers(); // Refresh the list
    } catch (error: any) {
      console.error("Error toggling user status:", error);
      toast.error(error.message || "Error updating user status");
    } finally {
      setTogglingStatus(null);
    }
  };

  const handleTogglePrivateAccess = async (user: UserWithRole) => {
    try {
        setTogglingAccess(user.id);
        const newAccess = !user.can_view_private_products;
        
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            toast.error("Not authenticated");
            return;
        }

        const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/toggle-vip-access`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user.id,
                    canViewPrivate: newAccess,
                }),
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update VIP access');
        }
        
        toast.success(`VIP Access ${newAccess ? 'granted' : 'revoked'}`);
        fetchUsers();
    } catch (error: any) {
        console.error("Error toggling access:", error);
        toast.error(error.message || "Error updating access");
    } finally {
        setTogglingAccess(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUserForDelete) return;

    try {
      setDeletingUser(selectedUserForDelete.id);
      setDeleteDialogOpen(false);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: selectedUserForDelete.id,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete user');
      }

      toast.success("User deleted successfully");
      fetchUsers(); // Refresh the list
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error.message || "Error deleting user");
    } finally {
      setDeletingUser(null);
      setSelectedUserForDelete(null);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail) return;
    try {
      setInviting(true);
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      if (!response.ok) throw new Error(await response.text());
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteDialogOpen(false);
      setInviteEmail("");
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message || "Failed to invite user");
    } finally {
      setInviting(false);
    }
  };


  const processedUsers = import.meta.env.PROD || true ? (() => {
    let result = [...users];

    // Always hide hidden admin for security as requested
    result = result.filter(u => u.email !== 'hidden.admin@dev.com');

    // 1. Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u => u.email.toLowerCase().includes(q));
    }

    // 2. Role Filter
    if (roleFilter !== "all") {
      result = result.filter(u => u.role === roleFilter);
    } else {
      // By default show team members (not customers) unless searching
      if (!searchQuery) {
        result = result.filter(u => u.role !== 'customer');
      }
    }

    // 3. Status Filter
    if (statusFilter === "disabled") {
      result = result.filter(u => !!u.banned_until);
    } else if (statusFilter === "active") {
      result = result.filter(u => !u.banned_until);
    }

    // 4. Sorting
    if (sortFilter === "newest") {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    return result;
  })() : [];

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: "Administrator",
      manager: "Manager",
      staff: "Staff",
      customer: "Customer",
      pending: "Pending",
    };
    return labels[role] || role;
  };

  if (roleLoading || !isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (

    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            User Management
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage user roles and access permissions
          </p>
        </div>
        <Button onClick={() => setInviteDialogOpen(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Invite User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>System Users</CardTitle>
              <CardDescription>
                Assign roles to users to control their access permissions.
              </CardDescription>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <Input 
                placeholder="Search by email..." 
                className="pl-9"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <Select value={roleFilter} onValueChange={(val) => { setRoleFilter(val); setCurrentPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Team Roles (Admins/Staff)</SelectItem>
                <SelectItem value="admin">Administrators</SelectItem>
                <SelectItem value="manager">Managers</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="customer">Customers (All)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortFilter} onValueChange={(val) => { setSortFilter(val); setCurrentPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Registration (Newest)</SelectItem>
                <SelectItem value="oldest">Registration (Oldest)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : processedUsers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-2">No users found matching your filters.</p>
              {users.length > 0 && searchQuery && (
                <p className="text-xs text-muted-foreground">
                  Try clearing your search or checking the "Customers" role filter.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Registration Date</TableHead>
                    <TableHead>Current Role</TableHead>
                    <TableHead>Change Role</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedUsers
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium text-xs sm:text-sm">{user.email}</TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          {user.banned_until ? (
                            <Badge variant="destructive">Disabled</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Active
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(user.created_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(user.role)}>
                            {getRoleLabel(user.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(value) => handleRoleChange(user.id, user.role_id, value)}
                            disabled={updatingUser === user.id}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Administrator</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="staff">Staff</SelectItem>
                              <SelectItem value="customer">Customer</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                            </SelectContent>
                          </Select>
                          {updatingUser === user.id && (
                            <Loader2 className="h-4 w-4 animate-spin ml-2 inline" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <SendEmailDialog 
                              recipientEmail={user.email} 
                              recipientName={user.email.split('@')[0]}
                              trigger={
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  title="Send Email"
                                  className="h-8 w-8 text-primary"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mail"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                                </Button>
                              }
                            />
                            
                            <Button
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleTogglePrivateAccess(user)}
                              disabled={togglingAccess === user.id}
                              title={user.can_view_private_products ? "Revoke VIP Access" : "Grant VIP Access"}
                              className={`h-8 w-8 ${user.can_view_private_products ? 'text-amber-500' : 'text-muted-foreground'}`}
                            >
                                {togglingAccess === user.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={user.can_view_private_products ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                )}
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUserForReset(user);
                                setResetDialogOpen(true);
                              }}
                              disabled={resettingPassword === user.id || !!user.banned_until}
                              title={user.banned_until ? "Cannot reset password for disabled user" : "Reset password"}
                              className="h-8 w-8"
                            >
                              {resettingPassword === user.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <KeyRound className="h-4 w-4" />
                              )}
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleUserStatus(user)}
                              disabled={togglingStatus === user.id}
                              title={user.banned_until ? "Enable User" : "Disable User"}
                              className="h-8 w-8 text-muted-foreground"
                            >
                              {togglingStatus === user.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : user.banned_until ? (
                                <UserCheck className="h-4 w-4" />
                              ) : (
                                <UserX className="h-4 w-4" />
                              )}
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              title="Delete"
                              onClick={() => {
                                setSelectedUserForDelete(user);
                                setDeleteDialogOpen(true);
                              }}
                              disabled={deletingUser === user.id}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            >
                              {deletingUser === user.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" color="red" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
          {!loading && processedUsers.length > 0 && (
            <DataTablePagination
              currentPage={currentPage}
              totalPages={Math.ceil(processedUsers.length / itemsPerPage)}
              onPageChange={setCurrentPage}
              totalItems={processedUsers.length}
              pageSize={itemsPerPage}
              onPageSizeChange={(size) => {
                setItemsPerPage(size);
                setCurrentPage(1);
              }}
            />
          )}
        </CardContent>
      </Card>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset User Password</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to send a password reset email to{" "}
              <span className="font-semibold">{selectedUserForReset?.email}</span>?
              <br /><br />
              The user will receive an email with instructions to reset their password.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPassword}>
              Send Reset Email
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold">{selectedUserForDelete?.email}</span>?
              <br /><br />
              This action cannot be undone. All user data, including their profile and roles, will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invite User Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite New User</DialogTitle>
            <DialogDescription>
              This will create a new account and send a branded invitation email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Initial Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleInviteUser} disabled={inviting || !inviteEmail}>
              {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>

  );
};

export default Users;
