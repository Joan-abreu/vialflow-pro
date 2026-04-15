import { useEffect, useState, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserX, UserCheck, Trash2, User, Search, Eye, Mail, ShoppingCart } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { SendEmailDialog } from "@/components/shared/SendEmailDialog";
import { format } from "date-fns";
import CopyCell from "@/components/CopyCell";

interface OrderHistoryItem {
    id: string;
    created_at: string;
    total_amount: number;
    status: string;
}

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
    last_sign_in_at?: string;
    orders?: OrderHistoryItem[];
    totalSpent?: number;
    orderCount?: number;
    can_view_private_products?: boolean;
}

const CustomerManagement = () => {
    const [users, setUsers] = useState<UserWithRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [resettingPassword, setResettingPassword] = useState<string | null>(null);
    const [resetDialogOpen, setResetDialogOpen] = useState(false);
    const [selectedUserForReset, setSelectedUserForReset] = useState<UserWithRole | null>(null);
    const [togglingStatus, setTogglingStatus] = useState<string | null>(null);
    const [togglingAccess, setTogglingAccess] = useState<string | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedUserForDelete, setSelectedUserForDelete] = useState<UserWithRole | null>(null);
    const [deletingUser, setDeletingUser] = useState<string | null>(null);
    
    // Modal state for order history
    const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
    const [selectedUserForHistory, setSelectedUserForHistory] = useState<UserWithRole | null>(null);

    // Filters and Search
    const [searchQuery, setSearchQuery] = useState("");
    const [purchaseFilter, setPurchaseFilter] = useState("all"); // all, purchaser, nopurchase
    const [statusFilter, setStatusFilter] = useState("all"); // all, active, disabled, pending
    const [sortFilter, setSortFilter] = useState("newest"); // newest, highest_spent, most_orders

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

            // 1. Fetch Users from Edge Function
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

            // 2. Fetch Orders entirely
            const { data: ordersData, error: ordersError } = await supabase
                .from("orders")
                .select("id, user_id, total_amount, status, created_at");

            if (ordersError) {
                 console.error("Error fetching orders:", ordersError);
            }

            // Fetch Profiles for can_view_private_products
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

            // Group orders by user_id
            const ordersByUser: Record<string, OrderHistoryItem[]> = {};
            if (ordersData) {
                ordersData.forEach(order => {
                    if (order.user_id) {
                        if (!ordersByUser[order.user_id]) ordersByUser[order.user_id] = [];
                        ordersByUser[order.user_id].push(order);
                    }
                });
            }

            // 3. Merge data
            const customers = usersData
                .filter((user: any) => user.role === 'customer' && user.email !== 'hidden.admin@dev.com')
                .map((user: any) => {
                    const userOrders = ordersByUser[user.id] || [];
                    const validOrders = userOrders.filter(o => o.status !== 'cancelled' && o.status !== 'failed');
                    const totalSpent = validOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);

                    return {
                        ...user,
                        banned_until: user.banned_until || null,
                        orders: userOrders.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
                        orderCount: validOrders.length,
                        totalSpent,
                        can_view_private_products: profilesByUser[user.id] || false
                    };
                });

            setUsers(customers);
        } catch (error: any) {
            console.error("Error fetching users:", error);
            toast.error("Error loading users");
        } finally {
            setLoading(false);
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
                        disabled: !isDisabled,
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update user status');
            }

            toast.success(`User ${!isDisabled ? 'disabled' : 'enabled'} successfully`);
            fetchUsers();
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
            
            // First check if profile exists
            const { data: profile } = await supabase.from('profiles').select('user_id').eq('user_id', user.id).single();
            
            if (profile) {
                const { error } = await supabase.from('profiles').update({ can_view_private_products: newAccess }).eq('user_id', user.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('profiles').insert({ user_id: user.id, can_view_private_products: newAccess });
                if (error) throw error;
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

            toast.success("Customer deleted successfully");
            fetchUsers();
        } catch (error: any) {
            console.error("Error deleting customer:", error);
            toast.error(error.message || "Error deleting customer");
        } finally {
            setDeletingUser(null);
            setSelectedUserForDelete(null);
        }
    };

    const processedUsers = useMemo(() => {
        let result = [...users];

        // 1. Full Text Search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(user => 
                user.full_name?.toLowerCase().includes(query) ||
                user.display_name?.toLowerCase().includes(query) ||
                user.email?.toLowerCase().includes(query) ||
                user.phone?.toLowerCase().includes(query)
            );
        }

        // 2. Purchase Filter
        if (purchaseFilter === "purchaser") {
            result = result.filter(user => (user.orderCount || 0) > 0);
        } else if (purchaseFilter === "nopurchase") {
            result = result.filter(user => (user.orderCount || 0) === 0);
        }

        // 3. Status Filter
        if (statusFilter === "disabled") {
            result = result.filter(user => !!user.banned_until);
        } else if (statusFilter === "pending") {
            result = result.filter(user => !user.banned_until && !user.last_sign_in_at);
        } else if (statusFilter === "active") {
            result = result.filter(user => !user.banned_until && !!user.last_sign_in_at);
        }

        // 4. Sorting
        if (sortFilter === "newest") {
            result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        } else if (sortFilter === "highest_spent") {
            result.sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
        } else if (sortFilter === "most_orders") {
            result.sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0));
        }

        return result;
    }, [users, searchQuery, purchaseFilter, statusFilter, sortFilter]);

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
                        Manage registered customers and view purchase history.
                    </CardDescription>
                    
                    <div className="flex flex-col gap-4 mt-6 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name, email, or phone..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Select value={purchaseFilter} onValueChange={(val) => { setPurchaseFilter(val); setCurrentPage(1); }}>
                                <SelectTrigger className="w-[160px]">
                                    <SelectValue placeholder="Purchases" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Purchasers</SelectItem>
                                    <SelectItem value="purchaser">Has Purchased</SelectItem>
                                    <SelectItem value="nopurchase">No Purchases Yet</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}>
                                <SelectTrigger className="w-[160px]">
                                    <SelectValue placeholder="Account Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="disabled">Disabled</SelectItem>
                                    <SelectItem value="pending">Needs Verification</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={sortFilter} onValueChange={(val) => { setSortFilter(val); setCurrentPage(1); }}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Sort By" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="newest">Registration (Newest)</SelectItem>
                                    <SelectItem value="highest_spent">Highest LTV ($)</SelectItem>
                                    <SelectItem value="most_orders">Most Orders</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
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
                                    <TableRow className="bg-muted/50">
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Purchases (LTV)</TableHead>
                                        <TableHead>Last Sign In</TableHead>
                                        <TableHead>Registration</TableHead>
                                        <TableHead align="right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {processedUsers.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                No customers match your filters.
                                            </TableCell>
                                        </TableRow>
                                    ) : processedUsers
                                        .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                        .map((user) => (
                                            <TableRow key={user.id}>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1 items-start">
                                                        <div className="flex items-center gap-2 group">
                                                            <span className="font-medium text-sm">{user.full_name || user.display_name || "N/A"}</span>
                                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity"><CopyCell value={user.full_name || user.display_name || "N/A"} size={12} /></div>
                                                        </div>
                                                        <div className="flex items-center gap-2 group">
                                                            <span className="text-xs text-muted-foreground">{user.email}</span>
                                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity"><CopyCell value={user.email} size={12} /></div>
                                                        </div>
                                                        {user.phone && (
                                                            <div className="flex items-center gap-2 group">
                                                                <span className="text-xs text-muted-foreground">{user.phone}</span>
                                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity"><CopyCell value={user.phone} size={12} /></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {user.banned_until ? (
                                                        <Badge variant="destructive" className="text-[10px]">Disabled</Badge>
                                                    ) : !user.last_sign_in_at ? (
                                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                                                            Unverified
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">
                                                            Active
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col items-start gap-1">
                                                        {user.orderCount && user.orderCount > 0 ? (
                                                            <>
                                                                <span className="font-medium text-sm text-green-600 dark:text-green-500">
                                                                    ${user.totalSpent?.toFixed(2)}
                                                                </span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {user.orderCount} order{user.orderCount > 1 ? 's' : ''}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <span className="text-xs italic text-muted-foreground">No purchases</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs sm:text-sm">
                                                    {user.last_sign_in_at ? (
                                                        format(new Date(user.last_sign_in_at), "MMM d, yyyy HH:mm")
                                                    ) : (
                                                        <span className="text-muted-foreground italic">Never signed in</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {format(new Date(user.created_at), "MMM d, yyyy")}
                                                </TableCell>
                                                <TableCell align="right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            title="View Purchase History"
                                                            className="h-8 w-8 text-primary"
                                                            onClick={() => {
                                                                setSelectedUserForHistory(user);
                                                                setHistoryDialogOpen(true);
                                                            }}
                                                            disabled={!user.orders || user.orders.length === 0}
                                                        >
                                                            <ShoppingCart className="h-4 w-4" />
                                                        </Button>
                                                        <SendEmailDialog 
                                                            recipientEmail={user.email} 
                                                            recipientName={user.full_name || user.display_name}
                                                            trigger={
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="sm" 
                                                                    title="Send Email"
                                                                    className="h-8 w-8 text-primary"
                                                                >
                                                                    <Mail className="h-4 w-4" />
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
                                                                <Trash2 className="h-4 w-4" />
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
                        <div className="mt-4">
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
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Order History Dialog Modal */}
            <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ShoppingCart className="h-5 w-5 text-primary" />
                            Purchase History
                        </DialogTitle>
                        <DialogDescription>
                            All orders placed by {selectedUserForHistory?.full_name || selectedUserForHistory?.email}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto mt-4 px-1">
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead>Date</TableHead>
                                        <TableHead>Order #</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead align="right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedUserForHistory?.orders?.map((order) => (
                                        <TableRow key={order.id}>
                                            <TableCell className="text-sm font-medium">
                                                {format(new Date(order.created_at), "MMM d, yyyy")}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs">{order.id.slice(0, 8)}</span>
                                                    <CopyCell value={order.id} size={12} />
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                 <Badge variant={order.status === "delivered" || order.status === "completed" ? "secondary" : "outline"} className="capitalize text-[10px]">
                                                    {order.status.replace(/_/g, " ")}
                                                </Badge>
                                            </TableCell>
                                            <TableCell align="right" className="font-medium text-green-600">
                                                ${Number(order.total_amount).toFixed(2)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {(!selectedUserForHistory?.orders || selectedUserForHistory.orders.length === 0) && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">
                                                No orders found for this customer.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

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
