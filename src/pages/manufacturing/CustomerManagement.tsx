import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Profile {
    phone: string;
    email: string;
    id: string;
    full_name: string | null;
    created_at: string;
}

const CustomerManagement = () => {
    const { data: profiles, isLoading } = useQuery({
        queryKey: ["admin-customers"],
        queryFn: async () => {
            // Get all user_roles with 'customer' role
            const { data: userRoles, error: rolesError } = await supabase
                .from("user_roles")
                .select("user_id, role")
                .eq("role", "customer");

            if (rolesError) throw rolesError;

            // Get user IDs with customer role
            const customerUserIds = userRoles?.map(ur => ur.user_id) || [];

            if (customerUserIds.length === 0) {
                return [];
            }

            // Get all customer profiles
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .in("user_id", customerUserIds)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data as Profile[];
        },
    });

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Customer Management</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Registered Customers</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Customer</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Joined Date</TableHead>
                                <TableHead>ID</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-8">
                                        Loading customers...
                                    </TableCell>
                                </TableRow>
                            ) : profiles?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-8">
                                        No customers found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                profiles?.map((profile) => (
                                    <TableRow key={profile.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar>
                                                    <AvatarImage src="" />
                                                    <AvatarFallback>
                                                        {profile.full_name?.[0] || "U"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium">
                                                        {profile.full_name || "Unknown User"}
                                                    </p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>{profile.email}</TableCell>
                                        <TableCell>{profile.phone}</TableCell>
                                        <TableCell>{format(new Date(profile.created_at), "MMM d, yyyy")}</TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground">
                                            {profile.id}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default CustomerManagement;
