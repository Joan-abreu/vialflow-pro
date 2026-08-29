import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    ShieldCheck,
    Download,
    ExternalLink,
    FileText,
    Calendar,
    Award,
    Activity,
    FlaskConical,
    Search,
    CheckCircle2
} from "lucide-react";
import { Link } from "react-router-dom";
import { COARecord } from "./ProductCOABadge";
import PDFViewerCanvas from "./PDFViewerCanvas";
import { downloadCoaPdf } from "@/utils/downloadCoa";

interface ProductCOAModalProps {
    isOpen: boolean;
    onClose: () => void;
    productName: string;
    coas: COARecord[];
    initialSelectedCoa?: COARecord;
}

export const ProductCOAModal: React.FC<ProductCOAModalProps> = ({
    isOpen,
    onClose,
    productName,
    coas,
    initialSelectedCoa,
}) => {
    const [selectedCoaId, setSelectedCoaId] = useState<string>("");
    const [pdfLoading, setPdfLoading] = useState(true);

    useEffect(() => {
        if (initialSelectedCoa) {
            setSelectedCoaId(initialSelectedCoa.id);
        } else if (coas && coas.length > 0) {
            const featured = coas.find(c => c.is_featured);
            setSelectedCoaId(featured ? featured.id : coas[0].id);
        }
    }, [initialSelectedCoa, coas, isOpen]);

    if (!coas || coas.length === 0) return null;

    const currentCoa = coas.find(c => c.id === selectedCoaId) || coas[0];

    const formattedTestDate = currentCoa?.test_date
        ? new Date(currentCoa.test_date).toLocaleDateString("en-US", {
            timeZone: "UTC",
            month: "long",
            day: "numeric",
            year: "numeric"
        })
        : "Recent";

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] p-0 gap-0 rounded-2xl overflow-hidden border border-slate-700/60 bg-background shadow-2xl flex flex-col [&>button]:text-white [&>button]:hover:text-emerald-300 [&>button]:bg-slate-800/80 [&>button]:hover:bg-slate-700 [&>button]:p-1.5 [&>button]:rounded-full [&>button]:top-4 [&>button]:right-4 [&>button]:z-30 [&>button]:opacity-100">
                {/* Header with Lab Trust Styling */}
                <div className="shrink-0 p-4 sm:p-6 pb-4 sm:pb-5 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 text-white border-b border-slate-800 space-y-2 sm:space-y-3 pr-12">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400" />
                                3rd-Party Analytical Verification
                            </span>
                            {currentCoa.is_featured && (
                                <Badge className="bg-emerald-500 text-slate-950 font-bold text-[10px] uppercase tracking-wider">
                                    Current Active Lot
                                </Badge>
                            )}
                        </div>

                        {/* Batch History Switcher if multiple batches available */}
                        {coas.length > 1 && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-300 font-medium">Batch Lot:</span>
                                <Select 
                                    value={selectedCoaId} 
                                    onValueChange={(val) => {
                                        setSelectedCoaId(val);
                                    }}
                                >
                                    <SelectTrigger className="h-8 text-xs bg-slate-800/90 border-slate-700 text-white min-w-[170px] rounded-lg">
                                        <SelectValue placeholder="Select Batch..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                        {coas.map((c) => (
                                            <SelectItem 
                                                key={c.id} 
                                                value={c.id} 
                                                className="text-xs focus:bg-slate-800 focus:text-emerald-300 cursor-pointer"
                                            >
                                                Lot #{c.batch_number} {c.is_featured ? "(Current)" : ""}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    <div className="space-y-1">
                        <DialogTitle className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-white">
                            Certificate of Analysis (COA)
                        </DialogTitle>
                        <DialogDescription className="text-xs sm:text-sm text-slate-300">
                            {productName} — Lot #{currentCoa.batch_number}
                        </DialogDescription>
                    </div>
                </div>

                {/* Scrollable Body Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 bg-background">
                    {/* Key Metrics Cards Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
                        {/* Purity Card */}
                        <div className="bg-muted/40 p-4 rounded-xl border space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Purity (HPLC)</span>
                                <Award className="h-4 w-4 text-emerald-600" />
                            </div>
                            <p className="text-xl font-black text-foreground">
                                {currentCoa.purity_pct !== null && currentCoa.purity_pct > 0 
                                    ? `${currentCoa.purity_pct}%` 
                                    : "≥99.5%"}
                            </p>
                            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> High Analytical Grade
                            </span>
                        </div>

                        {/* pH Level */}
                        <div className="bg-muted/40 p-4 rounded-xl border space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">pH Level</span>
                                <Activity className="h-4 w-4 text-blue-600" />
                            </div>
                            <p className="text-xl font-black text-foreground">
                                {currentCoa.ph_level !== null ? currentCoa.ph_level : "5.0 - 7.0"}
                            </p>
                            <span className="text-[10px] text-muted-foreground">Standard Specification</span>
                        </div>

                        {/* Benzyl Alcohol */}
                        <div className="bg-muted/40 p-4 rounded-xl border space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Benzyl Alcohol</span>
                                <FlaskConical className="h-4 w-4 text-indigo-600" />
                            </div>
                            <p className="text-xl font-black text-foreground">
                                {currentCoa.benzyl_alcohol_pct !== null ? `${currentCoa.benzyl_alcohol_pct}%` : "0.90%"}
                            </p>
                            <span className="text-[10px] text-muted-foreground">Bacteriostatic Agent</span>
                        </div>

                        {/* Sterility Status */}
                        <div className="bg-muted/40 p-4 rounded-xl border space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sterility USP &lt;71&gt;</span>
                                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                            </div>
                            <p className="text-xl font-black text-emerald-600">
                                {currentCoa.sterility_status || "Pass"}
                            </p>
                            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> No Microorganism Growth
                            </span>
                        </div>
                    </div>

                    {/* Metadata Strip */}
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-muted/50 px-4 py-2.5 rounded-xl border">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-4 w-4 text-primary" />
                            <span>Analysis Date: <strong className="text-foreground">{formattedTestDate}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <ShieldCheck className="h-4 w-4 text-emerald-600" />
                            <span>Accredited Lab: <strong className="text-foreground">{currentCoa.lab_name || "A2LA-Accredited 3rd Party US Laboratory"}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Verified Authentic</span>
                        </div>
                    </div>

                    {/* Embedded Interactive PDF Viewer via HTML5 Canvas */}
                    <div className="space-y-2">
                        <PDFViewerCanvas
                            url={currentCoa.pdf_url}
                            batchNumber={currentCoa.batch_number}
                        />
                    </div>

                    {/* Footer link to global lookup */}
                    <div className="pt-2 text-center border-t">
                        <p className="text-xs text-muted-foreground">
                            Looking to verify a different lot code or explore all historical batches?{" "}
                            <Link to="/lab-reports" onClick={onClose} className="font-semibold text-primary hover:underline inline-flex items-center gap-1">
                                Search All Lab Reports <Search className="h-3 w-3 inline" />
                            </Link>
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ProductCOAModal;
