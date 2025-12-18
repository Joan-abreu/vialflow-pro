import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Loader2, UserX, UserCheck, Trash2, User } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import { DataTablePagination } from "@/components/shared/DataTablePagination";

interface UserWithRole {
    id: string;
    display_name: string;
    full_name?: string;
    email: string;
    created_at: string;
    role: string;
    role_id: string;
    banned_until?: string;
    phone?: string;
}

const CustomerManagement = () => {
    const [users, setUsers] = useState<UserWithRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [resettingPassword, setResettingPassword] = useState<string | null>(null);
    const [resetDialogOpen, setResetDialogOpen] = useState(false);
    const [selectedUserForReset, setSelectedUserForReset] = useState<UserWithRole | null>(null);
    const [togglingStatus, setTogglingStatus] = useState<string | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedUserForDelete, setSelectedUserForDelete] = useState<UserWithRole | null>(null);
    const [deletingUser, setDeletingUser] = useState<string | null>(null);
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

            // Call edge function to get users
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

            // Add banned status to users and filter for customers, hiding hidden admin
            const customers = usersData
                .filter((user: any) => user.role === 'customer' && user.email !== 'hidden.admin@dev.com')
                .map((user: any) => ({
                    ...user,
                    banned_until: user.banned_until || null
                }));

            setUsers(customers);
        } catch (error: any) {
            console.error("Error fetching users:", error);
            toast.error("Error loading users");
        } finally {
            setLoading(false);
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

            toast.success("Customer deleted successfully");
            fetchUsers(); // Refresh the list
        } catch (error: any) {
            console.error("Error deleting customer:", error);
            toast.error(error.message || "Error deleting customer");
        } finally {
            setDeletingUser(null);
            setSelectedUserForDelete(null);
        }
    };

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
                        <User className="h-8 w-8 text-primary" />
                        Customer Management
                    </h1>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Registered Customers</CardTitle>
                    <CardDescription>
                        Manage registered customer
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : users.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                            No customers registered
                        </p>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Full Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Phone</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Registration Date</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users
                                        .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                        .map((user) => (
                                            <TableRow key={user.id}>
                                                <TableCell className="font-medium text-xs sm:text-sm">{user.full_name || user.display_name || "N/A"}</TableCell>
                                                <TableCell className="font-medium text-xs sm:text-sm">{user.email}</TableCell>
                                                <TableCell className="text-xs sm:text-sm">{user.phone || "N/A"}</TableCell>
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
                                                    <div className="flex gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleToggleUserStatus(user)}
                                                            disabled={togglingStatus === user.id}
                                                            title="Active/Disable"
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
                                                        >
                                                            {deletingUser === user.id ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="h-4 w-4 text-destructive" />
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
                    {!loading && users.length > 0 && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={Math.ceil(users.length / itemsPerPage)}
                            onPageChange={setCurrentPage}
                            totalItems={users.length}
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
        </div>
    );
};

export default CustomerManagement;
