import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { toast } from "sonner";
import { FileText, Loader2, Plus, Trash2, User, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface OrderNote {
    id: string;
    order_id: string;
    author_id?: string;
    author_name: string;
    note: string;
    created_at: string;
}

interface OrderNotesDialogProps {
    orderId: string;
    orderNumber?: string;
    customerEmail?: string;
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export const OrderNotesDialog: React.FC<OrderNotesDialogProps> = ({
    orderId,
    orderNumber,
    customerEmail,
    trigger,
    open: externalOpen,
    onOpenChange: externalOnOpenChange,
}) => {
    const [internalOpen, setInternalOpen] = useState(false);
    const [newNote, setNewNote] = useState("");
    const queryClient = useQueryClient();

    const isControlled = externalOpen !== undefined;
    const isOpen = isControlled ? externalOpen : internalOpen;
    const setIsOpen = isControlled ? (externalOnOpenChange || (() => {})) : setInternalOpen;

    // Fetch notes for this order
    const { data: notes, isLoading } = useQuery({
        queryKey: ["order-notes", orderId],
        enabled: !!orderId && isOpen,
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("order_notes")
                .select("*")
                .eq("order_id", orderId)
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Error fetching order notes:", error);
                return [];
            }
            return (data || []) as OrderNote[];
        },
    });

    // Add Note Mutation
    const addNoteMutation = useMutation({
        mutationFn: async (noteText: string) => {
            const { data: { user } } = await supabase.auth.getUser();
            let authorName = "Admin";

            if (user) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("full_name")
                    .eq("user_id", user.id)
                    .single();

                authorName = profile?.full_name || user.email || "Admin";
            }

            const { error } = await (supabase as any)
                .from("order_notes")
                .insert({
                    order_id: orderId,
                    author_id: user?.id || null,
                    author_name: authorName,
                    note: noteText.trim(),
                });

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["order-notes", orderId] });
            queryClient.invalidateQueries({ queryKey: ["all-order-notes"] });
            toast.success("Note added to order");
            setNewNote("");
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to add note");
        },
    });

    // Delete Note Mutation
    const deleteNoteMutation = useMutation({
        mutationFn: async (noteId: string) => {
            const { error } = await (supabase as any)
                .from("order_notes")
                .delete()
                .eq("id", noteId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["order-notes", orderId] });
            queryClient.invalidateQueries({ queryKey: ["all-order-notes"] });
            toast.success("Note deleted");
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to delete note");
        },
    });

    const handleAddNote = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNote.trim()) {
            toast.error("Please enter a note before saving");
            return;
        }
        addNoteMutation.mutate(newNote);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <FileText className="h-5 w-5 text-primary" />
                        Order Notes & Log: <span className="font-mono text-primary font-bold">#{orderNumber || orderId.slice(0, 8)}</span>
                    </DialogTitle>
                    <DialogDescription>
                        Internal log history for replacements, customer follow-ups, and special handling instructions.
                        {customerEmail && (
                            <span className="block mt-1 font-medium text-foreground">
                                Customer: {customerEmail}
                            </span>
                        )}
                    </DialogDescription>
                </DialogHeader>

                {/* Add Note Input Area */}
                <form onSubmit={handleAddNote} className="space-y-3 pt-2">
                    <Textarea
                        placeholder="Type internal note here (e.g. Sent replacement vial via Shippo tracking #12345, agreed on exchange)..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        className="min-h-[80px] text-xs resize-none"
                    />
                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            size="sm"
                            disabled={addNoteMutation.isPending || !newNote.trim()}
                            className="gap-1.5 h-8 text-xs"
                        >
                            {addNoteMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Plus className="h-3.5 w-3.5" />
                            )}
                            Add Note
                        </Button>
                    </div>
                </form>

                <div className="border-t my-2" />

                {/* Notes History List */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-[200px] max-h-[350px]">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Log History ({notes?.length || 0})
                        </span>
                    </div>

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            <span className="text-xs">Loading order notes...</span>
                        </div>
                    ) : !notes || notes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2 text-center bg-slate-50 rounded-lg border border-dashed p-6">
                            <Clock className="h-8 w-8 text-slate-300" />
                            <span className="font-medium text-xs text-slate-600">No internal notes added yet.</span>
                            <span className="text-[11px] text-slate-400">Use the form above to record any customer interactions or replacement logs.</span>
                        </div>
                    ) : (
                        notes.map((note) => (
                            <div key={note.id} className="bg-slate-50 border rounded-lg p-3 text-xs space-y-2 relative group hover:border-slate-300 transition-colors">
                                <div className="flex items-center justify-between border-b pb-1.5 border-slate-200">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="bg-white text-slate-700 text-[10px] gap-1 py-0.5">
                                            <User className="h-3 w-3 text-primary" />
                                            {note.author_name}
                                        </Badge>
                                        <span className="text-[11px] text-muted-foreground">
                                            {format(new Date(note.created_at), "MMM d, yyyy h:mm a")}
                                        </span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-slate-400 hover:text-destructive hover:bg-slate-200/50"
                                        onClick={() => deleteNoteMutation.mutate(note.id)}
                                        disabled={deleteNoteMutation.isPending}
                                        title="Delete note"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                                <p className="text-slate-800 whitespace-pre-wrap leading-relaxed font-normal">
                                    {note.note}
                                </p>
                            </div>
                        ))
                    )}
                </div>

                <DialogFooter className="pt-2 border-t flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
