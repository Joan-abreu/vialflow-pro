import React, { useState } from "react";
import { 
    ShieldCheck, 
    FileText, 
    ChevronRight, 
    Clock, 
    FlaskConical, 
    Award, 
    CheckCircle2, 
    ExternalLink,
    Search
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export interface COARecord {
    id: string;
    product_id: string | null;
    batch_number: string;
    test_date: string;
    pdf_url: string;
    purity_pct: number | null;
    ph_level: number | null;
    benzyl_alcohol_pct: number | null;
    sterility_status: string;
    is_active: boolean;
    is_featured?: boolean;
    lab_name?: string | null;
}

interface ProductCOABadgeProps {
    coas: COARecord[];
    productName?: string;
    onOpenModal: (selectedCoa?: COARecord) => void;
    className?: string;
}

export const ProductCOABadge: React.FC<ProductCOABadgeProps> = ({
    coas,
    productName = "Product",
    onOpenModal,
    className = ""
}) => {
    const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);

    // If no COA is uploaded yet for this product, show the "Lab Testing in Progress (48h)" badge
    if (!coas || coas.length === 0) {
        return (
            <>
                <div 
                    onClick={() => setIsPendingModalOpen(true)}
                    className={`group inline-flex flex-wrap items-center gap-2 p-1.5 pr-3 rounded-full bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 shadow-xs hover:shadow-md hover:border-blue-400 dark:hover:border-blue-700 transition-all cursor-pointer select-none text-left ${className}`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setIsPendingModalOpen(true);
                        }
                    }}
                    title="Click for laboratory testing status"
                >
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-600 text-white text-xs font-bold shadow-xs">
                        <Clock className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: '6s' }} />
                        <span>Lab Testing in Progress</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-blue-950 dark:text-blue-200 font-medium">
                        <span className="hidden sm:inline text-blue-700 dark:text-blue-400">●</span>
                        <span>Sample submitted to accredited lab</span>
                        <span className="font-semibold text-blue-700 dark:text-blue-300 font-mono text-[11px] bg-blue-100/80 dark:bg-blue-900/50 px-2 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-800/40">
                            COA in ~48h
                        </span>
                    </div>

                    <div className="ml-auto pl-1 flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-400 group-hover:text-blue-800 dark:group-hover:text-blue-300 transition-colors">
                        <span className="underline underline-offset-2">Status</span>
                        <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                </div>

                {/* Pending Lab Status Modal */}
                <Dialog open={isPendingModalOpen} onOpenChange={setIsPendingModalOpen}>
                    <DialogContent className="w-[95vw] sm:max-w-lg p-0 rounded-2xl overflow-hidden border border-slate-700/60 bg-background shadow-2xl [&>button]:text-white [&>button]:hover:text-blue-300 [&>button]:bg-slate-800/80 [&>button]:hover:bg-slate-700 [&>button]:p-1.5 [&>button]:rounded-full [&>button]:top-4 [&>button]:right-4 [&>button]:z-30">
                        <div className="p-6 bg-gradient-to-r from-blue-950 via-slate-900 to-slate-950 text-white border-b border-slate-800 space-y-2 pr-12">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                                <FlaskConical className="h-3.5 w-3.5 text-blue-400" />
                                3rd-Party Analytical Verification Underway
                            </span>
                            <DialogTitle className="text-xl font-bold tracking-tight text-white">
                                Laboratory Testing in Progress
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-300">
                                {productName} — Active Production Batch
                            </DialogDescription>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/50 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">Current Status</span>
                                    <span className="text-[11px] font-bold bg-blue-600 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                        <Clock className="h-3 w-3" /> Report Ready in 24–48h
                                    </span>
                                </div>
                                <p className="text-xs text-blue-950 dark:text-blue-200 leading-relaxed">
                                    Representative samples from this product lot have been submitted to an independent, accredited US analytical laboratory. The signed official Certificate of Analysis (COA) is currently in process and will be published here within 24 to 48 hours.
                                </p>
                            </div>

                            <div className="space-y-2.5">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Analytical Testing Protocol:</h4>
                                <div className="space-y-2 text-xs">
                                    <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/40 border">
                                        <Award className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                                        <div>
                                            <span className="font-bold text-foreground">HPLC Purity & Identity Assay</span>
                                            <p className="text-muted-foreground text-[11px]">High-performance liquid chromatography to ensure ≥99.0% chemical purity.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/40 border">
                                        <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                                        <div>
                                            <span className="font-bold text-foreground">USP &lt;71&gt; Sterility Validation</span>
                                            <p className="text-muted-foreground text-[11px]">Comprehensive 14-day membrane filtration testing for zero microbial growth.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/40 border">
                                        <FlaskConical className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                                        <div>
                                            <span className="font-bold text-foreground">pH & Benzyl Alcohol Concentration</span>
                                            <p className="text-muted-foreground text-[11px]">Precision buffering and preservative potency verification.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t text-xs">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsPendingModalOpen(false)}
                                    className="font-semibold text-xs"
                                >
                                    Close
                                </Button>
                                <Button
                                    asChild
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5"
                                    onClick={() => setIsPendingModalOpen(false)}
                                >
                                    <Link to="/lab-reports">
                                        <Search className="h-3.5 w-3.5" />
                                        Search All Past Reports
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </>
        );
    }

    // Find the primary featured COA or default to the most recent one
    const activeCoa = coas.find(c => c.is_featured) || coas[0];

    const purityDisplay = activeCoa.purity_pct !== null && activeCoa.purity_pct > 0 
        ? `${activeCoa.purity_pct}% Purity` 
        : activeCoa.sterility_status === "Pass" 
            ? "Sterility Tested (Pass)" 
            : "Lab Verified";

    return (
        <div 
            onClick={() => onOpenModal(activeCoa)}
            className={`group inline-flex flex-wrap items-center gap-2 p-1.5 pr-3 rounded-full bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 shadow-xs hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-700 transition-all cursor-pointer select-none text-left ${className}`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenModal(activeCoa);
                }
            }}
            title="Click to view full Certificate of Analysis (COA)"
        >
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold shadow-xs">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>3rd-Party Lab Tested</span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-emerald-950 dark:text-emerald-200 font-semibold">
                <span className="hidden sm:inline text-emerald-700 dark:text-emerald-400">●</span>
                <span className="font-bold text-emerald-800 dark:text-emerald-300">{purityDisplay}</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-mono text-[11px] bg-emerald-100/80 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/40">
                    Lot #{activeCoa.batch_number}
                </span>
            </div>

            <div className="ml-auto pl-1 flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 group-hover:text-emerald-800 dark:group-hover:text-emerald-300 transition-colors">
                <FileText className="h-3 w-3" />
                <span className="underline underline-offset-2">View COA</span>
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
        </div>
    );
};

export default ProductCOABadge;
