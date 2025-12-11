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
import { Loader2, Mail, Eye, Search } from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { DataTablePagination } from "@/components/shared/DataTablePagination";

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
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const { data: logs, isLoading } = useQuery({
        queryKey: ["email_logs"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("email_logs" as any)
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data as EmailLog[];
        },
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case "sent":
                return "default"; // or success variant if available
            case "failed":
                return "destructive";
            default:
                return "secondary";
        }
    };

    const filteredLogs = logs?.filter((log) => {
        const query = searchQuery.toLowerCase();
        return (
            log.recipient.toLowerCase().includes(query) ||
            log.subject.toLowerCase().includes(query) ||
            log.type.toLowerCase().includes(query)
        );
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
                    <div className="flex items-center gap-2 w-full md:w-72">
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
                                                {format(new Date(log.created_at), "MMM d, yyyy HH:mm")}
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
