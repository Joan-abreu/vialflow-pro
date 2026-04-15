import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Mail, Eye, Search, RotateCcw, Filter } from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type EmailLog = {
    id: string;
    created_at: string;
    recipient: string;
    subject: string;
    status: string;
    type: string;
    content: string;
    metadata: any;
};

const CommunicationLogs = () => {
    const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [resending, setResending] = useState<string | null>(null);

    const { data: logs, isLoading } = useQuery({
        queryKey: ["email_logs"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("email_logs" as any)
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data as unknown as EmailLog[];
        },
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case "sent":
                return "outline"; 
            case "failed":
                return "destructive";
            default:
                return "secondary";
        }
    };

    const handleResend = async (log: EmailLog) => {
        try {
            setResending(log.id);
            const { data: { session } } = await supabase.auth.getSession();
            
            // We use the generic type for manual resends
            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-system-notification`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${session?.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        type: 'generic',
                        recipient: log.recipient,
                        data: {
                            subject: `[RESEND] ${log.subject}`,
                            message: "See attached content",
                            // We can't easily resend the exact HTML without a tweak to the engine
                            // so we'll just send it as a generic message for now or improve the engine later
                            html: log.content 
                        }
                    }),
                }
            );

            if (!response.ok) throw new Error("Failed to resend");
            toast.success("Resend triggered successfully");
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setResending(null);
        }
    };

    const filteredLogs = logs?.filter((log) => {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
            log.recipient.toLowerCase().includes(query) ||
            log.subject.toLowerCase().includes(query) ||
            log.type.toLowerCase().includes(query);
            
        const matchesType = typeFilter === "all" || log.type === typeFilter;
        
        return matchesSearch && matchesType;
    });

    const totalPages = Math.ceil((filteredLogs?.length || 0) / itemsPerPage);
    const paginatedLogs = filteredLogs?.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Communication Logs</h1>
                    <p className="text-muted-foreground">
                        View history of all system emails and notifications.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between space-y-0 pb-4">
                    <CardTitle>Email History</CardTitle>
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                        <div className="flex items-center gap-2 w-full sm:w-64">
                            <Search className="w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search logs..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full"
                            />
                        </div>
                        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setCurrentPage(1); }}>
                            <SelectTrigger className="w-full sm:w-[150px]">
                                <Filter className="w-4 h-4 mr-2" />
                                <SelectValue placeholder="All Types" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="order_confirmation">Order Confirmed</SelectItem>
                                <SelectItem value="shipped">Order Shipped</SelectItem>
                                <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                                <SelectItem value="delivered">Order Delivered</SelectItem>
                                <SelectItem value="status_update">Status Updates</SelectItem>
                                <SelectItem value="user_invitation">Auth/Invites</SelectItem>
                                <SelectItem value="password_reset">Password Resets</SelectItem>
                                <SelectItem value="generic">Manual/Generic</SelectItem>
                                <SelectItem value="low_stock_alert">System Alerts</SelectItem>
                                <SelectItem value="contact_form">Contact Form</SelectItem>
                                <SelectItem value="signup_confirmation">New Signups</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Recipient</TableHead>
                                        <TableHead>Subject</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedLogs?.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                                No logs found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {paginatedLogs?.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell>
                                                {format(new Date(log.created_at), "MMM d, yyyy h:mm a")}
                                            </TableCell>
                                            <TableCell className="capitalize">
                                                {log.type.replace(/_/g, " ")}
                                            </TableCell>
                                            <TableCell>{log.recipient}</TableCell>
                                            <TableCell className="max-w-[200px] truncate" title={log.subject}>
                                                {log.subject}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={getStatusColor(log.status) as any}>
                                                    {log.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setSelectedLog(log)}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleResend(log)}
                                                    disabled={resending === log.id}
                                                    title="Resend this email"
                                                >
                                                    {resending === log.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <RotateCcw className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                            {totalPages > 1 && (
                                <DataTablePagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={setCurrentPage}
                                    totalItems={filteredLogs?.length}
                                    pageSize={itemsPerPage}
                                    onPageSizeChange={(size) => {
                                        setItemsPerPage(size);
                                        setCurrentPage(1);
                                    }}
                                />
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Email Details</DialogTitle>
                    </DialogHeader>
                    {selectedLog && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="font-semibold">To:</span> {selectedLog.recipient}
                                </div>
                                <div>
                                    <span className="font-semibold">Date:</span>{" "}
                                    {format(new Date(selectedLog.created_at), "PPpp")}
                                </div>
                                <div className="col-span-2">
                                    <span className="font-semibold">Subject:</span> {selectedLog.subject}
                                </div>
                            </div>
                            <div className="border rounded-md p-4 bg-muted/30">
                                <iframe
                                    srcDoc={selectedLog.content}
                                    title="Email Content"
                                    className="w-full min-h-[400px] border-none"
                                    sandbox="allow-same-origin"
                                />
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default CommunicationLogs;
