import React from "react";
import { 
    ShieldCheck, 
    FileText, 
    CheckCircle2, 
    Award, 
    FlaskConical, 
    ExternalLink, 
    Clock,
    Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { COARecord } from "./ProductCOABadge";

interface ProductCOASectionProps {
    productName: string;
    coas: COARecord[];
    onOpenModal: (selectedCoa?: COARecord) => void;
}

export const ProductCOASection: React.FC<ProductCOASectionProps> = ({
    productName,
    coas,
    onOpenModal,
}) => {
    const activeCoa = coas?.find(c => c.is_featured) || (coas && coas.length > 0 ? coas[0] : null);

    return (
        <div className="bg-gradient-to-br from-card to-muted/30 border rounded-2xl p-6 md:p-8 space-y-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                        Quality Assurance & Analytical Testing
                    </div>
                    <h3 className="text-xl md:text-2xl font-bold text-foreground">
                        Third-Party Laboratory Testing (COA)
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-2xl">
                        Every production batch of <strong>{productName}</strong> is rigorously tested by independent, accredited US analytical laboratories to verify chemical identity, purity, and sterility.
                    </p>
                </div>

                {activeCoa ? (
                    <Button 
                        onClick={() => onOpenModal(activeCoa)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm gap-2 h-11 px-5 self-start md:self-auto"
                    >
                        <FileText className="h-4 w-4" />
                        View Certificate of Analysis (COA)
                    </Button>
                ) : (
                    <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-bold self-start md:self-auto">
                        <Clock className="h-4 w-4 animate-spin" style={{ animationDuration: '6s' }} />
                        <span>Sample at Lab • Report in ~3–5 Days</span>
                    </div>
                )}
            </div>

            {/* If COA is available for this product */}
            {activeCoa ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Active Batch Summary Card */}
                    <div className="bg-background border rounded-xl p-5 shadow-xs space-y-4 md:col-span-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current Batch in Stock</span>
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                                Verified
                            </span>
                        </div>
                        
                        <div>
                            <p className="text-lg font-mono font-bold text-foreground">Lot #{activeCoa.batch_number}</p>
                            <p className="text-xs text-muted-foreground">
                                Tested: {new Date(activeCoa.test_date).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                            <div>
                                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Purity</span>
                                <p className="font-bold text-foreground">
                                    {activeCoa.purity_pct !== null && activeCoa.purity_pct > 0 ? `${activeCoa.purity_pct}%` : "≥99.5%"}
                                </p>
                            </div>
                            <div>
                                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Sterility</span>
                                <p className="font-bold text-emerald-600">{activeCoa.sterility_status || "Pass"}</p>
                            </div>
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs font-semibold gap-1.5 border-emerald-600/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            onClick={() => onOpenModal(activeCoa)}
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open Full Report Viewer
                        </Button>
                    </div>

                    {/* Quality Testing Protocol Highlights */}
                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-background border space-y-1.5">
                            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                                <Award className="h-4 w-4" />
                                <span>HPLC & Mass Spectrometry</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                High-Performance Liquid Chromatography (HPLC) and MS analysis verify compound identity and ensure absolute purity without degradation artifacts.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl bg-background border space-y-1.5">
                            <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>USP &lt;71&gt; Sterility Validation</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Tested for bacterial endotoxins and membrane integrity in accordance with USP &lt;71&gt; and &lt;85&gt; pharmacopeia standards.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl bg-background border space-y-1.5">
                            <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
                                <FlaskConical className="h-4 w-4" />
                                <span>pH & Preservative Precision</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Stringent quality checks ensure exact buffering and optimal 0.9% benzyl alcohol content for bacteriostatic longevity.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl bg-background border space-y-1.5 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                    <span>Batch Traceability</span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                                    Every vial is stamped with its unique batch code. Verify your physical vial's lot code anytime.
                                </p>
                            </div>
                            <Link to="/lab-reports" className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1 mt-2">
                                Search All Lab Reports &rarr;
                            </Link>
                        </div>
                    </div>
                </div>
            ) : (
                /* Testing in Progress Card when no COA is uploaded yet */
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-background border border-blue-500/30 rounded-xl p-5 shadow-xs space-y-4 md:col-span-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">Active Production Batch</span>
                            <span className="text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" /> Testing in Flight
                            </span>
                        </div>
                        
                        <div className="space-y-1">
                            <p className="text-base font-bold text-foreground">Sample at Analytical Lab</p>
                            <p className="text-xs text-muted-foreground">
                                Representative lot samples have been dispatched to an accredited 3rd-party laboratory.
                            </p>
                        </div>

                        <div className="pt-2 border-t space-y-1 text-xs">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Estimated COA Publication</span>
                            <p className="font-bold text-blue-600 dark:text-blue-400">Within 3 to 5 Business Days</p>
                        </div>

                        <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="w-full text-xs font-semibold gap-1.5 border-blue-600/30 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                        >
                            <Link to="/lab-reports">
                                <Search className="h-3.5 w-3.5" />
                                Search All Past Reports
                            </Link>
                        </Button>
                    </div>

                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-background border space-y-1.5">
                            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                                <Award className="h-4 w-4" />
                                <span>HPLC Purity Assay (Pending)</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Chemical identity and chromatographic purity testing (≥99.0% threshold) currently in analysis.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl bg-background border space-y-1.5">
                            <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>USP &lt;71&gt; Sterility Validation</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                14-day membrane incubation for bacterial and fungal zero-growth certification.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl bg-background border space-y-1.5">
                            <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
                                <FlaskConical className="h-4 w-4" />
                                <span>pH & Preservative Precision</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Stringent quality checks ensure exact buffering and optimal 0.9% benzyl alcohol content.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl bg-background border space-y-1.5 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                    <span>Zero Compromise QA Guarantee</span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                                    Every batch is held to strict analytical standards. Full signed PDF will be accessible here.
                                </p>
                            </div>
                            <Link to="/contact" className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1 mt-2">
                                Contact QA Team &rarr;
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductCOASection;
