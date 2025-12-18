import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Search, History, Eye, User } from "lucide-react";
import { DataTablePagination } from "@/components/shared/DataTablePagination";

interface AuditLog {
    id: string;
    table_name: string;
    operation: "INSERT" | "UPDATE" | "DELETE";
    record_id: string;
    old_values: any;
    new_values: any;
    created_at: string;
    changed_by_user?: {
        full_name: string | null;
        email: string | null;
    };
}

const AuditLogs = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const itemsPerPage = 15;

    const fetchLogs = async () => {
        setLoading(true);

        let query = supabase
            .from("audit_logs" as any)
            .select("*", { count: "exact" });

        if (searchQuery) {
            query = query.or(`table_name.ilike.%${searchQuery}%,operation.ilike.%${searchQuery}%`);
        }

        const { data, error, count } = await query
            .order("created_at", { ascending: false })
            .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

        if (data) {
            // Need to manually fetch user details if relationship fetch fails or is complex with auth.users
            // In this setup, we assume we might need to join with profiles or just display ID if FK is to auth.users which is restricted.
            // Let's try to map IDs to profiles if the join above didn't work as expected for auth schemas.
            // Actually, querying auth.users is usually restricted. Let's try fetching profiles instead if possible.
            // Correct approach: Audit logs usually store user_id. We might need a helper to fetch names from 'profiles'.

            const logsWithUsers = await Promise.all(data.map(async (log) => {
                if (log.changed_by) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('full_name')
                        .eq('user_id', log.changed_by)
                        .single();
                    return { ...log, changed_by_user: profile };
                }
                return log;
            }));

            setLogs(logsWithUsers as any);
            setTotalCount(count || 0);
        } else if (error) {
            console.error("Error fetching logs:", error);
        }

        setLoading(false);
    };

    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchLogs();
        }, 300);
        return () => clearTimeout(timeout);
    }, [searchQuery, currentPage]);

    const getOperationColor = (op: string) => {
        switch (op) {
            case "INSERT": return "default"; // black/primary
            case "UPDATE": return "secondary"; // gray
            case "DELETE": return "destructive"; // red
            default: return "outline";
        }
    };

    const renderDiff = (log: AuditLog) => {
        const oldVals = log.old_values || {};
        const newVals = log.new_values || {};
        const allKeys = Array.from(new Set([...Object.keys(oldVals), ...Object.keys(newVals)]));

        // Filter out keys that didn't change for UPDATE, or show all for INSERT/DELETE
        const changedKeys = log.operation === 'UPDATE'
            ? allKeys.filter(key => JSON.stringify(oldVals[key]) !== JSON.stringify(newVals[key]))
            : allKeys;

        return (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {changedKeys.map(key => (
                    <div key={key} className="grid grid-cols-2 gap-4 border-b pb-2 text-sm">
                        <div className="font-medium text-muted-foreground">{key}</div>
                        <div className="space-y-1">
                            {log.operation !== 'INSERT' && (
                                <div className="text-red-500 bg-red-50 p-1 rounded break-all">
                                    - {JSON.stringify(oldVals[key]) ?? 'null'}
                                </div>
                            )}
                            {log.operation !== 'DELETE' && (
                                <div className="text-green-600 bg-green-50 p-1 rounded break-all">
                                    + {JSON.stringify(newVals[key]) ?? 'null'}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {changedKeys.length === 0 && <p className="text-muted-foreground">No effective changes details.</p>}
            </div>
        );
    };

    return (
        <div className="container mx-auto py-8">
            <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
                <History className="h-8 w-8" />
                Audit Logs
            </h1>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle>System Activity</CardTitle>
                            <CardDescription>View historical changes to records.</CardDescription>
                        </div>
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search table or operation..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-center py-4 text-muted-foreground">Loading logs...</p>
                    ) : (
                        <>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Operation</TableHead>
                                            <TableHead>Table</TableHead>
                                            <TableHead>Record</TableHead>
                                            <TableHead>Changed By</TableHead>
                                            <TableHead>Time</TableHead>
                                            <TableHead className="text-right">Details</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {logs.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                    No logs found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            logs.map((log) => {
                                                const values = log.new_values || log.old_values || {};
                                                const getRecordLabel = () => {
                                                    if (log.table_name === 'raw_materials') return values.name || 'Unknown Material';
                                                    if (log.table_name === 'orders') return `Order #${log.record_id.slice(0, 8)}`;
                                                    if (log.table_name === 'shipments') return values.shipment_number || `Shipment #${log.record_id.slice(0, 8)}`;
                                                    if (log.table_name === 'product_variants') return `Variant #${log.record_id.slice(0, 8)}`;
                                                    return log.record_id.slice(0, 8);
                                                };

                                                return (
                                                    <TableRow key={log.id}>
                                                        <TableCell>
                                                            <Badge variant={getOperationColor(log.operation) as any}>
                                                                {log.operation}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="font-medium font-mono text-xs">
                                                            {log.table_name}
                                                        </TableCell>
                                                        <TableCell className="text-sm">
                                                            {getRecordLabel()}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <User className="h-3 w-3 text-muted-foreground" />
                                                                <span className="text-sm">
                                                                    {log.changed_by_user?.full_name || 'System / Unknown'}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
                                                            {format(new Date(log.created_at), "MMM d, HH:mm:ss")}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Dialog>
                                                                <DialogTrigger asChild>
                                                                    <Button variant="ghost" size="sm">
                                                                        <Eye className="h-4 w-4 mr-2" />
                                                                        View
                                                                    </Button>
                                                                </DialogTrigger>
                                                                <DialogContent className="max-w-2xl">
                                                                    <DialogHeader>
                                                                        <DialogTitle>Change Details</DialogTitle>
                                                                    </DialogHeader>
                                                                    {renderDiff(log)}
                                                                </DialogContent>
                                                            </Dialog>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="mt-4">
                                <DataTablePagination
                                    currentPage={currentPage}
                                    totalPages={Math.ceil(totalCount / itemsPerPage)}
                                    onPageChange={setCurrentPage}
                                    totalItems={totalCount}
                                />
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default AuditLogs;
