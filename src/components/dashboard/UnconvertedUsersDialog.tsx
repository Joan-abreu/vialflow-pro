import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Copy, Search, UserCheck, ArrowUp, ArrowDown } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export interface UnconvertedUser {
    id: string;
    user_id: string;
    full_name?: string | null;
    email?: string | null;
    created_at?: string | null;
}

interface UnconvertedUsersDialogProps {
    users: UnconvertedUser[];
    trigger?: React.ReactNode;
}

export const UnconvertedUsersDialog: React.FC<UnconvertedUsersDialogProps> = ({ users, trigger }) => {
    const [open, setOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

    const sortedUsers = [...users]
        .filter(u => {
            const nameMatch = u.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
            const emailMatch = u.email?.toLowerCase().includes(searchTerm.toLowerCase());
            return nameMatch || emailMatch;
        })
        .sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
        });

    const handleToggleSort = () => {
        setSortOrder(prev => (prev === "desc" ? "asc" : "desc"));
    };

    const handleCopyAllEmails = () => {
        const emails = sortedUsers.map(u => u.email).filter(Boolean).join(", ");
        if (!emails) {
            toast.error("No valid emails found");
            return;
        }
        navigator.clipboard.writeText(emails);
        toast.success(`Copied ${sortedUsers.length} email addresses to clipboard!`);
    };

    const handleDownloadCSV = () => {
        if (sortedUsers.length === 0) {
            toast.error("No data to export");
            return;
        }

        const headers = ["Full Name", "Email", "Registered At"];
        const rows = sortedUsers.map(u => [
            `"${(u.full_name || 'Registered Customer').replace(/"/g, '""')}"`,
            `"${(u.email || '').replace(/"/g, '""')}"`,
            `"${u.created_at ? format(new Date(u.created_at), 'yyyy-MM-dd HH:mm') : ''}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `unconverted_registered_leads_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success("Downloaded CSV lead list!");
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>View Leads ({users.length})</span>
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader className="pb-2 border-b">
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-lg font-bold flex items-center gap-2">
                                <UserCheck className="h-5 w-5 text-amber-600" />
                                <span>Unconverted Registered Leads</span>
                                <Badge variant="secondary" className="bg-amber-100 text-amber-800 font-bold ml-1">
                                    {users.length} Users
                                </Badge>
                            </DialogTitle>
                            <p className="text-xs text-muted-foreground mt-1">
                                Registered accounts with 0 completed purchases. Ideal for marketing discount campaigns!
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-2">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search name or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-9 text-xs"
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <Button size="sm" variant="outline" onClick={handleCopyAllEmails} className="h-9 text-xs gap-1.5">
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy All Emails</span>
                        </Button>
                        <Button size="sm" variant="default" onClick={handleDownloadCSV} className="h-9 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white">
                            <Download className="h-3.5 w-3.5" />
                            <span>Export CSV</span>
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto border rounded-md">
                    <Table>
                        <TableHeader className="bg-muted/50 sticky top-0">
                            <TableRow>
                                <TableHead className="text-xs">User / Name</TableHead>
                                <TableHead className="text-xs">Email Address</TableHead>
                                <TableHead className="text-xs cursor-pointer select-none hover:text-foreground" onClick={handleToggleSort}>
                                    <div className="flex items-center gap-1">
                                        <span>Registered Date</span>
                                        {sortOrder === "desc" ? (
                                            <ArrowDown className="h-3.5 w-3.5 text-amber-600" />
                                        ) : (
                                            <ArrowUp className="h-3.5 w-3.5 text-amber-600" />
                                        )}
                                    </div>
                                </TableHead>
                                <TableHead className="text-right text-xs">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedUsers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground">
                                        No unconverted leads found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sortedUsers.map((user) => (
                                    <TableRow key={user.id || user.user_id}>
                                        <TableCell className="font-medium text-xs">
                                            {user.full_name || "Registered Customer"}
                                        </TableCell>
                                        <TableCell className="text-xs font-mono text-slate-700">
                                            {user.email || "N/A"}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                            {user.created_at ? format(new Date(user.created_at), "MMM d, yyyy") : "N/A"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {user.email && (
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-slate-500 hover:text-slate-900"
                                                    title="Copy Email"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(user.email!);
                                                        toast.success(`Copied ${user.email}`);
                                                    }}
                                                >
                                                    <Copy className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    );
};
