import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Loader2, FileCheck, AlertTriangle, ShieldCheck, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface UploadPaymentProofDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orderId: string;
    orderNumber?: string;
    totalAmount: number;
    p2pProvider?: string;
    onProofUploaded?: () => void;
}

export const UploadPaymentProofDialog: React.FC<UploadPaymentProofDialogProps> = ({
    open,
    onOpenChange,
    orderId,
    orderNumber,
    totalAmount,
    p2pProvider = "zelle",
    onProofUploaded
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [senderHandle, setSenderHandle] = useState("");
    const [declaredAmount, setDeclaredAmount] = useState(totalAmount.toFixed(2));
    const [loading, setLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const handleClearFile = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setFile(null);
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (!selected) return;

        // Validation 1: Allowed File Types
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
        if (!allowedTypes.includes(selected.type)) {
            toast.error("Invalid file type. Please upload a PNG, JPG, WEBP image or PDF receipt.");
            return;
        }

        // Validation 2: Max File Size (5MB)
        if (selected.size > 5 * 1024 * 1024) {
            toast.error("File is too large. Maximum allowed receipt image size is 5MB.");
            return;
        }

        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }

        setFile(selected);
        if (selected.type.startsWith("image/")) {
            setPreviewUrl(URL.createObjectURL(selected));
        } else {
            setPreviewUrl(null);
        }
    };


    // Calculate SHA-256 hash using Web Crypto API
    const computeFileHash = async (fileBuffer: ArrayBuffer): Promise<string> => {
        const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) {
            toast.error("Please select a payment receipt image or PDF file.");
            return;
        }

        setLoading(true);
        try {
            // Read file buffer & compute SHA-256 hash
            const arrayBuffer = await file.arrayBuffer();
            const fileHash = await computeFileHash(arrayBuffer);

            // Convert to Base64
            const bytes = new Uint8Array(arrayBuffer);
            let binary = "";
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64Data = btoa(binary);

            // Call Edge Function p2p-payment-verifier via Supabase SDK
            const { data: result, error } = await supabase.functions.invoke("p2p-payment-verifier", {
                body: {
                    action: "submit_proof",
                    orderId: orderId,
                    p2pProvider: p2pProvider,
                    p2pSenderHandle: senderHandle,
                    declaredAmount: parseFloat(declaredAmount),
                    proofFileHash: fileHash,
                    proofFileBase64: base64Data,
                    proofFileName: file.name
                }
            });

            if (error) {
                let msg = error.message || "Failed to upload payment proof";
                try {
                    if (error.context && typeof (error.context as any).json === "function") {
                        const bodyJson = await (error.context as any).json();
                        if (bodyJson?.error) msg = bodyJson.error;
                    }
                } catch (_) {}
                throw new Error(msg);
            }

            if (result?.error) {
                throw new Error(result.error);
            }



            toast.success("Payment receipt uploaded successfully! Your payment is queued for admin verification.");
            if (onProofUploaded) onProofUploaded();
            onOpenChange(false);

        } catch (err: any) {
            console.error("Error uploading receipt:", err);
            toast.error(err.message || "Failed to submit receipt proof");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-background border shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold flex items-center gap-2">
                        <Upload className="h-5 w-5 text-purple-600" />
                        Upload Payment Proof
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Upload your screenshot or receipt for Order #{orderNumber || orderId.slice(0, 8).toUpperCase()}.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 text-left pt-2">
                    {/* Amount & Handle Inputs */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="proof_amount" className="text-xs font-semibold">Amount Paid ($)</Label>
                            <Input
                                id="proof_amount"
                                type="number"
                                step="0.01"
                                value={declaredAmount}
                                onChange={(e) => setDeclaredAmount(e.target.value)}
                                required
                                className="font-mono text-sm font-bold"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="proof_handle" className="text-xs font-semibold">Your Handle / Name</Label>
                            <Input
                                id="proof_handle"
                                placeholder="@handle or John"
                                value={senderHandle}
                                onChange={(e) => setSenderHandle(e.target.value)}
                                className="text-sm"
                            />
                        </div>
                    </div>

                    {/* File Upload Zone */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold">Payment Receipt Image / PDF</Label>
                            {file && (
                                <button
                                    type="button"
                                    onClick={handleClearFile}
                                    className="text-xs font-bold text-destructive hover:underline flex items-center gap-1 z-20 cursor-pointer"
                                >
                                    <Trash2 className="h-3 w-3" />
                                    Clear & Select Another
                                </button>
                            )}
                        </div>

                        <div className="border-2 border-dashed border-muted-foreground/30 hover:border-purple-500/60 rounded-xl p-4 text-center bg-muted/20 transition-all cursor-pointer relative group">
                            <input
                                type="file"
                                accept="image/png, image/jpeg, image/webp, application/pdf"
                                onChange={handleFileSelect}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                            />

                            {previewUrl ? (
                                <div className="space-y-2 relative">
                                    <img
                                        src={previewUrl}
                                        alt="Receipt Preview"
                                        className="h-36 mx-auto object-contain rounded border shadow-sm bg-background"
                                    />
                                    <div className="flex items-center justify-center gap-2">
                                        <p className="text-[11px] font-medium text-foreground truncate max-w-[200px]">{file?.name}</p>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="sm"
                                            className="h-6 px-2 text-[10px] font-bold z-20"
                                            onClick={handleClearFile}
                                        >
                                            <Trash2 className="h-3 w-3 mr-1" />
                                            Remove
                                        </Button>
                                    </div>
                                </div>
                            ) : file ? (
                                <div className="py-4 space-y-2">
                                    <FileCheck className="h-8 w-8 text-green-600 mx-auto" />
                                    <p className="text-xs font-bold text-foreground">{file.name}</p>
                                    <p className="text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        className="h-6 px-2 text-[10px] font-bold z-20"
                                        onClick={handleClearFile}
                                    >
                                        <Trash2 className="h-3 w-3 mr-1" />
                                        Remove File
                                    </Button>
                                </div>
                            ) : (
                                <div className="py-4 space-y-1">
                                    <Upload className="h-8 w-8 text-purple-600/70 mx-auto mb-1" />
                                    <p className="text-xs font-bold text-foreground">Click to select screenshot or PDF</p>
                                    <p className="text-[10px] text-muted-foreground">PNG, JPG, WEBP, or PDF up to 5MB</p>
                                </div>
                            )}
                        </div>
                    </div>


                    <div className="p-2.5 rounded bg-purple-500/10 text-purple-900 dark:text-purple-200 text-[11px] flex items-start gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                        <span>Receipts are encrypted and stored in a private vault. Anti-fraud hash verification is enabled.</span>
                    </div>

                    <Button
                        type="submit"
                        disabled={loading || !file}
                        className="w-full font-bold bg-purple-600 hover:bg-purple-700 text-white py-5"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Verifying & Uploading Receipt...
                            </>
                        ) : (
                            "Submit Payment Receipt"
                        )}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
};
