import React from "react";
import { FlaskConical, ShieldCheck, FileCheck, Thermometer, Atom, Dna, AlertCircle } from "lucide-react";
import { getResearchProductSpecs } from "@/utils/researchChemicalSpecs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ResearchProductSpecsCardProps {
    product: any;
    onViewCoa?: () => void;
}

export const ResearchProductSpecsCard: React.FC<ResearchProductSpecsCardProps> = ({
    product,
    onViewCoa
}) => {
    const specs = getResearchProductSpecs(product);

    return (
        <div className="bg-card border-2 border-primary/20 rounded-2xl p-5 md:p-6 shadow-sm space-y-5 my-6 text-left">
            {/* Header / Title */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-primary/10 rounded-xl text-primary shrink-0">
                        <FlaskConical className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base md:text-lg font-bold text-foreground">
                                Analytical & Research Specifications
                            </h3>
                            <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider border-primary/40 text-primary">
                                Lab Grade
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Standard reference data & handling guidelines for laboratory research use only
                        </p>
                    </div>
                </div>

                {onViewCoa && (
                    <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={onViewCoa}
                        className="text-xs font-semibold gap-1.5 border-primary/30 text-primary hover:bg-primary/10 self-start sm:self-auto"
                    >
                        <FileCheck className="h-3.5 w-3.5 text-primary" />
                        View Certificate of Analysis (COA)
                    </Button>
                )}
            </div>

            {/* Technical Specifications Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. CAS Number */}
                <div className="p-3 bg-muted/40 rounded-xl border border-border/60 space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Atom className="h-3.5 w-3.5 text-primary" />
                        CAS Number
                    </span>
                    <p className="text-xs md:text-sm font-bold font-mono text-foreground break-all">
                        {specs.casNumber}
                    </p>
                </div>

                {/* 2. Molecular Weight & Formula */}
                <div className="p-3 bg-muted/40 rounded-xl border border-border/60 space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Dna className="h-3.5 w-3.5 text-primary" />
                        Molecular Weight
                    </span>
                    <p className="text-xs md:text-sm font-bold font-mono text-foreground">
                        {specs.molecularWeight}
                    </p>
                    <span className="text-[10px] text-muted-foreground block truncate">
                        {specs.molecularFormula}
                    </span>
                </div>

                {/* 3. Purity & Quality */}
                <div className="p-3 bg-muted/40 rounded-xl border border-border/60 space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        Verified Purity
                    </span>
                    <p className="text-xs md:text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        {specs.purity}
                    </p>
                    <span className="text-[10px] text-muted-foreground block truncate">
                        Third-party tested batch
                    </span>
                </div>

                {/* 4. Storage Conditions */}
                <div className="p-3 bg-muted/40 rounded-xl border border-border/60 space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Thermometer className="h-3.5 w-3.5 text-blue-500" />
                        Storage Spec
                    </span>
                    <p className="text-xs md:text-sm font-bold text-foreground">
                        {specs.isWater ? "15°C to 30°C" : "-20°C (Lyophilized)"}
                    </p>
                    <span className="text-[10px] text-muted-foreground block truncate">
                        {specs.storage}
                    </span>
                </div>
            </div>

            {/* Plain Words Research Framing Box (Required by Kashu/Tagada Underwriters) */}
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1 leading-relaxed">
                    <p className="font-bold text-amber-950 dark:text-amber-200">
                        Strict Laboratory & Analytical Research Use Only (RUO)
                    </p>
                    <p className="text-amber-900/90 dark:text-amber-300/90 text-[11px]">
                        <strong>This product is not a drug, food, dietary supplement, medical device, or cosmetic.</strong> It has not been approved or evaluated by the FDA and is strictly not intended for human or animal consumption, therapeutic use, clinical administration, or diagnostic testing.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ResearchProductSpecsCard;
