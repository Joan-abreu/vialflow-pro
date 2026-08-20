import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ShieldCheck, CheckCircle2, XCircle, Loader2, AlertTriangle, ExternalLink, History, Eye, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface P2PVerificationModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    order: any;
    onOrderUpdated?: () => void;
}

export const P2PVerificationModal: React.FC<P2PVerificationModalProps> = ({
    open,
    onOpenChange,
    order,
    onOrderUpdated
}) => {
    const [signedUrl, setSignedUrl] = useState<string | null>(null);
    const [loadingImage, setLoadingImage] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("Payment amount mismatch");
    const [customReason, setCustomReason] = useState("");
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [logs, setLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    useEffect(() => {
        if (open && order?.id) {
            fetchSignedUrl();
            fetchAuditLogs();
        }
    }, [open, order?.id]);

    const fetchSignedUrl = async () => {
        if (!order?.p2p_proof_url) {
            setSignedUrl(null);
            return;
        }

        setLoadingImage(true);
        try {
            const { data } = await supabase.functions.invoke("p2p-payment-verifier", {
                body: {
                    action: "get_signed_receipt_url",
                    orderId: order.id
                }
            });

            if (data?.signedUrl) {
                setSignedUrl(data.signedUrl);
            }
        } catch (err) {
            console.error("Error fetching signed receipt URL:", err);
        } finally {
            setLoadingImage(false);
        }

    };

    const fetchAuditLogs = async () => {
        setLoadingLogs(true);
        try {
            const { data } = await supabase
                .from("p2p_verification_log")
                .select("*")
                .eq("order_id", order.id)
                .order("created_at", { ascending: false });
            setLogs(data || []);
        } catch (err) {
            console.error("Error fetching P2P logs:", err);
        } finally {
            setLoadingLogs(false);
        }
    };

    const handleApprove = async () => {
        setProcessing(true);
        try {
            const userRes = await supabase.auth.getUser();
            const { data, error } = await supabase.functions.invoke("p2p-payment-verifier", {
                body: {
                    action: "approve",
                    orderId: order.id,
                    actorId: userRes.data.user?.id
                }
            });

            if (error) throw new Error(error.message || "Failed to approve payment");
            if (data?.error) throw new Error(data.error);

            toast.success("Payment verified! Order moved to processing and customer notified.");
            if (onOrderUpdated) onOrderUpdated();
            onOpenChange(false);
        } catch (err: any) {
            console.error("Error approving payment:", err);
            toast.error(err.message || "Failed to verify payment");
        } finally {
            setProcessing(false);
        }

    };

    const handleReject = async () => {
        const finalReason = rejectionReason === "Other" ? customReason : rejectionReason;
        if (!finalReason.trim()) {
            toast.error("Please enter a valid rejection reason.");
            return;
        }

        setProcessing(true);
        try {
            const userRes = await supabase.auth.getUser();
            const { data, error } = await supabase.functions.invoke("p2p-payment-verifier", {
                body: {
                    action: "reject",
                    orderId: order.id,
                    reason: finalReason,
                    actorId: userRes.data.user?.id
                }
            });

            if (error) throw new Error(error.message || "Failed to reject payment");
            if (data?.error) throw new Error(data.error);

            toast.success("Payment proof rejected. Rejection notice sent to customer.");
            if (onOrderUpdated) onOrderUpdated();
            onOpenChange(false);
        } catch (err: any) {
            console.error("Error rejecting payment:", err);
            toast.error(err.message || "Failed to reject payment");
        } finally {
            setProcessing(false);
        }

    };

    const declaredAmount = order?.p2p_declared_amount != null ? Number(order.p2p_declared_amount) : null;
    const totalAmount = Number(order?.total_amount || 0);
    const isAmountMismatch = declaredAmount != null && Math.abs(declaredAmount - totalAmount) > 0.01;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md sm:max-w-lg bg-background border shadow-2xl">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <Badge variant="outline" className="bg-purple-500/10 text-purple-700 border-purple-400 font-bold flex items-center gap-1.5 px-3 py-1">
                            <ShieldCheck className="h-4 w-4 text-purple-600" />
                            P2P Verification Modal
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                            Order #{order?.id?.slice(0, 8)?.toUpperCase()}
                        </span>
                    </div>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2 pt-1">
                        Verify P2P Payment Receipt
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Review customer submitted receipt, declared amount, and audit history.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 text-left pt-1">
                    {/* Amount & Method Summary Box */}
                    <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/40 border">
                        <div>
                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
                                Provider / Sender Handle
                            </span>
                            <span className="font-semibold text-sm text-foreground uppercase">
                                {(order?.p2p_provider || "P2P")} {order?.p2p_sender_handle && `(${order.p2p_sender_handle})`}
                            </span>
                        </div>

                        <div>
                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
                                Declared vs Total
                            </span>
                            <div className="flex items-center gap-1.5 font-mono text-sm font-bold">
                                <span className={isAmountMismatch ? "text-red-600 font-black" : "text-emerald-600"}>
                                    ${declaredAmount != null ? declaredAmount.toFixed(2) : totalAmount.toFixed(2)}
                                </span>
                                <span className="text-muted-foreground text-xs font-normal">
                                    / ${totalAmount.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Mismatch Warning */}
                    {isAmountMismatch && (
                        <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-red-900 dark:text-red-300 text-xs flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                            <span><strong>Amount Mismatch Warning:</strong> Declared amount (${declaredAmount?.toFixed(2)}) does not match Order Total (${totalAmount.toFixed(2)}).</span>
                        </div>
                    )}

                    {/* Receipt Image Container */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold flex items-center justify-between">
                            <span>Uploaded Receipt Image</span>
                            {signedUrl && (
                                <a
                                    href={signedUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] text-primary hover:underline flex items-center gap-1 font-bold"
                                >
                                    <ExternalLink className="h-3 w-3" />
                                    Full Image
                                </a>
                            )}
                        </Label>

                        <div className="border rounded-xl p-2 bg-black/5 dark:bg-white/5 min-h-[160px] max-h-[260px] flex items-center justify-center overflow-hidden">
                            {loadingImage ? (
                                <div className="flex flex-col items-center space-y-2 text-muted-foreground">
                                    <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                                    <span className="text-xs">Fetching secure receipt URL...</span>
                                </div>
                            ) : signedUrl ? (
                                <img
                                    src={signedUrl}
                                    alt="Receipt Proof"
                                    className="max-h-[240px] w-auto object-contain rounded shadow-sm hover:scale-105 transition-transform"
                                />
                            ) : (
                                <div className="text-center text-muted-foreground p-4">
                                    <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-1" />
                                    <p className="text-xs font-semibold">No receipt file uploaded yet</p>
                                    <p className="text-[10px]">Customer has not submitted a screenshot for this order.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Audit Logs History */}
                    {logs.length > 0 && (
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold flex items-center gap-1">
                                <History className="h-3.5 w-3.5 text-muted-foreground" />
                                Verification Audit History
                            </Label>
                            <div className="max-h-28 overflow-y-auto space-y-1 bg-muted/20 p-2 rounded border text-[11px] font-mono">
                                {logs.map((log) => (
                                    <div key={log.id} className="flex items-start justify-between border-b border-muted/40 pb-1 last:border-0">
                                        <span className="font-bold uppercase text-foreground">
                                            [{log.action}] {log.reason}
                                        </span>
                                        <span className="text-muted-foreground text-[10px] shrink-0 ml-2">
                                            {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Rejection Form */}
                    {showRejectForm && (
                        <div className="p-3 border rounded-xl bg-red-500/5 border-red-500/30 space-y-2.5">
                            <Label className="text-xs font-bold text-red-700 dark:text-red-400">
                                Select Rejection Reason
                            </Label>
                            <Select value={rejectionReason} onValueChange={setRejectionReason}>
                                <SelectTrigger className="h-9 text-xs bg-background">
                                    <SelectValue placeholder="Select Reason" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Payment amount mismatch">Payment amount mismatch</SelectItem>
                                    <SelectItem value="Illegible or incomplete receipt screenshot">Illegible or incomplete receipt screenshot</SelectItem>
                                    <SelectItem value="Duplicate or suspicious receipt image">Duplicate or suspicious receipt image</SelectItem>
                                    <SelectItem value="Transaction not found in company account">Transaction not found in company account</SelectItem>
                                    <SelectItem value="Other">Other Custom Reason</SelectItem>
                                </SelectContent>
                            </Select>

                            {rejectionReason === "Other" && (
                                <Textarea
                                    placeholder="Enter detailed rejection explanation for customer..."
                                    value={customReason}
                                    onChange={(e) => setCustomReason(e.target.value)}
                                    className="text-xs h-16 bg-background"
                                />
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
                    {showRejectForm ? (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowRejectForm(false)}
                                className="w-full sm:w-1/2"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                disabled={processing}
                                onClick={handleReject}
                                className="w-full sm:w-1/2 font-bold"
                            >
                                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                                Confirm Rejection
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowRejectForm(true)}
                                className="w-full sm:w-1/2 text-red-600 border-red-200 hover:bg-red-50 font-bold"
                            >
                                <XCircle className="h-4 w-4 mr-1 text-red-600" />
                                Reject Receipt
                            </Button>

                            <Button
                                type="button"
                                disabled={processing || !signedUrl}
                                onClick={handleApprove}
                                className="w-full sm:w-1/2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                                Approve & Mark Paid
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
