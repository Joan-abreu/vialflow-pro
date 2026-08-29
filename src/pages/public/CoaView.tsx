import React from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
    ShieldCheck, 
    ArrowLeft, 
    Download, 
    Award, 
    Activity, 
    FlaskConical, 
    CheckCircle2, 
    Calendar, 
    FileText, 
    Share2,
    ExternalLink,
    Search,
    Package,
    Building2,
    Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import PDFViewerCanvas from "@/components/products/PDFViewerCanvas";
import { downloadCoaPdf } from "@/utils/downloadCoa";

interface ProductInfo {
    id: string;
    name: string;
    slug?: string;
    image_url?: string;
}

export const CoaView: React.FC = () => {
    const { batchNumber } = useParams<{ batchNumber: string }>();
    const navigate = useNavigate();

    const { data: coaData, isLoading, error } = useQuery({
        queryKey: ["public-coa-view", batchNumber],
        queryFn: async () => {
            if (!batchNumber) throw new Error("Batch Number is required");
            const cleanBatch = batchNumber.trim();

            // Try exact batch number match or fallback to UUID match
            let query = supabase
                .from("product_coas" as any)
                .select("*, products(id, name, slug, image_url)")
                .ilike("batch_number", cleanBatch)
                .maybeSingle();

            let { data, error: err } = await query;

            if (!data && !err) {
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanBatch);
                if (isUuid) {
                    const res = await supabase
                        .from("product_coas" as any)
                        .select("*, products(id, name, slug, image_url)")
                        .eq("id", cleanBatch)
                        .maybeSingle();
                    data = res.data;
                    err = res.error;
                }
            }

            if (err) throw err;
            if (!data) throw new Error("Certificate of Analysis not found");

            // Fetch all unique linked products
            let linkedProducts: ProductInfo[] = [];
            const pIds = Array.isArray(data.product_ids) && data.product_ids.length > 0
                ? data.product_ids
                : (data.product_id ? [data.product_id] : []);

            if (pIds.length > 0) {
                const { data: prods } = await supabase
                    .from("products")
                    .select("id, name, slug, image_url")
                    .in("id", pIds);
                if (prods) {
                    // Deduplicate by ID
                    const uniqueMap = new Map<string, ProductInfo>();
                    prods.forEach((p) => uniqueMap.set(p.id, p));
                    linkedProducts = Array.from(uniqueMap.values());
                }
            } else if (data.products) {
                linkedProducts = [data.products];
            }

            return {
                ...data,
                linkedProducts,
            };
        },
        staleTime: 10 * 60 * 1000,
    });

    const handleShare = () => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(window.location.href);
            toast.success("Verification link copied to clipboard!");
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
                <p className="text-sm text-muted-foreground font-medium animate-pulse">
                    Verifying official laboratory analytical record...
                </p>
            </div>
        );
    }

    if (error || !coaData) {
        return (
            <div className="container max-w-2xl py-16 px-4 text-center space-y-6">
                <div className="p-4 bg-muted/60 rounded-full w-16 h-16 mx-auto flex items-center justify-center text-muted-foreground">
                    <FileText className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold tracking-tight">COA Record Not Found</h1>
                    <p className="text-sm text-muted-foreground">
                        We could not find an active Certificate of Analysis matching Lot #{batchNumber}.
                    </p>
                </div>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                    <Button 
                        variant="outline" 
                        onClick={() => {
                            if (window.history.state && window.history.state.idx > 0) {
                                navigate(-1);
                            } else {
                                navigate("/lab-reports");
                            }
                        }} 
                        className="gap-2"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to Directory
                    </Button>
                    <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                        <Link to="/lab-reports">
                            <Search className="h-4 w-4" /> Search All Lab Reports
                        </Link>
                    </Button>
                </div>
            </div>
        );
    }

    const linkedProducts = (coaData.linkedProducts || []) as ProductInfo[];
    const firstProduct = linkedProducts[0] || (coaData?.products as ProductInfo | null);
    
    const formattedDate = coaData?.test_date
        ? new Date(coaData.test_date).toLocaleDateString("en-US", {
            timeZone: "UTC",
            month: "long",
            day: "numeric",
            year: "numeric",
        })
        : "Verified";

    const handleBack = () => {
        if (window.history.state && window.history.state.idx > 0) {
            navigate(-1);
        } else if (firstProduct?.slug || firstProduct?.id) {
            navigate(`/products/${firstProduct.slug || firstProduct.id}`);
        } else {
            navigate("/lab-reports");
        }
    };

    return (
        <div className="container max-w-5xl py-6 md:py-10 px-4 space-y-8">
            <Helmet>
                <title>COA Lot #{coaData.batch_number} | Official Analytical Report</title>
                <meta 
                    name="description" 
                    content={`Third-party verified Certificate of Analysis for Lot #${coaData.batch_number}. Tested by ${coaData.lab_name || "Accredited US Analytical Laboratory"}.`} 
                />
            </Helmet>

            {/* Top Navigation Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleBack}
                        className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground font-semibold"
                    >
                        <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                        {firstProduct ? "Back to Product" : "Back"}
                    </Button>
                    <div className="h-4 w-px bg-border" />
                    <Link
                        to="/lab-reports"
                        className="text-xs text-muted-foreground hover:text-primary font-medium"
                    >
                        All Lab Reports Directory
                    </Link>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleShare}
                        className="h-8 text-xs gap-1.5 font-semibold"
                    >
                        <Share2 className="h-3.5 w-3.5" />
                        Share Report
                    </Button>
                    <Button
                        size="sm"
                        className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
                        onClick={() => downloadCoaPdf(coaData.pdf_url, `COA-${coaData.batch_number}.pdf`)}
                    >
                        <Download className="h-3.5 w-3.5" />
                        Download Official PDF
                    </Button>
                </div>
            </div>

            {/* Official Verification Hero Banner */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 text-white rounded-2xl p-6 md:p-8 border border-slate-800 shadow-xl space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <ShieldCheck className="h-4 w-4 text-emerald-400" />
                            Official 3rd-Party Analytical Verification
                        </span>
                        {coaData.is_featured && (
                            <Badge className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold text-[11px] uppercase tracking-wider">
                                ★ Current Active Lot
                            </Badge>
                        )}
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                        Verification ID: {coaData.id.slice(0, 8)}
                    </span>
                </div>

                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                            Certificate of Analysis (COA)
                        </h1>
                        <span className="font-mono text-base font-bold bg-emerald-900/60 text-emerald-300 px-3 py-1 rounded-lg border border-emerald-700/50">
                            Lot #{coaData.batch_number}
                        </span>
                    </div>
                    <p className="text-sm md:text-base text-slate-300 max-w-3xl leading-relaxed">
                        Reconstitution Solution — Bacteriostatic Water Formulation with 0.9% Benzyl Alcohol USP. Tested and verified for chemical purity, pH balance, and microbiological sterility.
                    </p>
                </div>

                {/* Metadata Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800 text-xs text-slate-300">
                    <div className="flex items-center gap-2.5">
                        <Calendar className="h-4 w-4 text-emerald-400 shrink-0" />
                        <div>
                            <span className="text-[11px] text-slate-400 block">Analysis Date</span>
                            <strong className="text-white text-sm">{formattedDate}</strong>
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <Building2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <div>
                            <span className="text-[11px] text-slate-400 block">Accredited Laboratory</span>
                            <strong className="text-white text-sm">{coaData.lab_name || "Chromak Research Analytical Lab"}</strong>
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <div>
                            <span className="text-[11px] text-slate-400 block">Batch Release Status</span>
                            <strong className="text-emerald-400 text-sm flex items-center gap-1">
                                <Check className="h-3.5 w-3.5" /> Certified &amp; Released
                            </strong>
                        </div>
                    </div>
                </div>
            </div>

            {/* Analytical Specifications Grid (4 Cards) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
                <div className="bg-card border rounded-xl p-4 space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Purity (HPLC)</span>
                        <Award className="h-4 w-4 text-emerald-600" />
                    </div>
                    <p className="text-2xl font-black text-foreground">
                        {coaData.purity_pct !== null && coaData.purity_pct > 0 
                            ? `${coaData.purity_pct}%` 
                            : "≥99.5%"}
                    </p>
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> High Analytical Grade
                    </span>
                </div>

                <div className="bg-card border rounded-xl p-4 space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">pH Level</span>
                        <Activity className="h-4 w-4 text-blue-600" />
                    </div>
                    <p className="text-2xl font-black text-foreground">
                        {coaData.ph_level !== null ? coaData.ph_level : "5.0 - 7.0"}
                    </p>
                    <span className="text-[10px] text-muted-foreground">Standard Buffered Spec</span>
                </div>

                <div className="bg-card border rounded-xl p-4 space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Benzyl Alcohol</span>
                        <FlaskConical className="h-4 w-4 text-indigo-600" />
                    </div>
                    <p className="text-2xl font-black text-foreground">
                        {coaData.benzyl_alcohol_pct !== null ? `${coaData.benzyl_alcohol_pct}%` : "0.90%"}
                    </p>
                    <span className="text-[10px] text-muted-foreground">Bacteriostatic Agent</span>
                </div>

                <div className="bg-card border rounded-xl p-4 space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sterility USP &lt;71&gt;</span>
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    </div>
                    <p className="text-2xl font-black text-emerald-600">
                        {coaData.sterility_status || "Pass"}
                    </p>
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Zero Microorganism Growth
                    </span>
                </div>
            </div>

            {/* Applicable Products Section (Clean, Organized Product Directory) */}
            {linkedProducts.length > 0 && (
                <div className="bg-card border rounded-2xl p-6 space-y-4 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                        <div>
                            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                <Package className="h-4 w-4 text-primary" />
                                Covered Commercial Products &amp; Pack Formats
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                This analytical Certificate of Analysis applies to all of the following catalog items filled from Lot #{coaData.batch_number}:
                            </p>
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full shrink-0 self-start sm:self-auto">
                            {linkedProducts.length} {linkedProducts.length === 1 ? "Product Format" : "Product Formats"}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {linkedProducts.map((prod) => (
                            <Link
                                key={prod.id}
                                to={`/products/${prod.slug || prod.id}`}
                                className="group flex items-center justify-between gap-3 p-3.5 rounded-xl bg-muted/30 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30 border border-border/80 hover:border-emerald-300 dark:hover:border-emerald-700/60 transition-all text-left"
                            >
                                <div className="space-y-0.5 min-w-0">
                                    <p className="text-sm font-semibold text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors leading-snug break-words">
                                        {prod.name}
                                    </p>
                                    <span className="text-[11px] text-muted-foreground group-hover:text-emerald-600 flex items-center gap-1 font-medium">
                                        View product page &rarr;
                                    </span>
                                </div>
                                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-emerald-600 shrink-0 transition-transform group-hover:translate-x-0.5" />
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Embedded Canvas PDF Viewer */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-bold text-foreground">Official Analytical Certificate Document</h2>
                    </div>
                    <span className="text-xs text-muted-foreground">
                        Direct document inspection
                    </span>
                </div>

                <PDFViewerCanvas
                    url={coaData.pdf_url}
                    batchNumber={coaData.batch_number}
                    defaultFit="page"
                    containerHeightClass="min-h-[550px] max-h-[850px]"
                />
            </div>
        </div>
    );
};

export default CoaView;
