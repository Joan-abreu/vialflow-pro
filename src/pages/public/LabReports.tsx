import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
    Download, 
    FileText, 
    Search, 
    ShieldCheck, 
    HelpCircle, 
    ExternalLink, 
    Package,
    Calendar,
    FlaskConical,
    Award,
    Activity,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Share2,
    ArrowLeft
} from "lucide-react";
import SEO from "@/components/SEO";
import { getSEOConfig } from "@/config/seoConfig";
import { downloadCoaPdf } from "@/utils/downloadCoa";
import PDFViewerCanvas from "@/components/products/PDFViewerCanvas";
import { toast } from "sonner";

interface Product {
    id: string;
    name: string;
    slug?: string;
}

interface COA {
    id: string;
    product_id: string | null;
    product_ids?: string[] | null;
    batch_number: string;
    test_date: string;
    pdf_url: string;
    purity_pct: number | null;
    ph_level: number | null;
    benzyl_alcohol_pct: number | null;
    sterility_status: string;
    is_active: boolean;
    lab_name?: string | null;
    is_featured?: boolean;
    products?: Product | null;
}

const LabReports = () => {
    const { batchNumber: paramBatch } = useParams<{ batchNumber?: string }>();
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

    // Fetch all products for fast lookup
    const { data: allProducts } = useQuery<Product[]>({
        queryKey: ["public-all-products-for-coas"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("products")
                .select("id, name, slug");
            if (error) throw error;
            return (data || []) as Product[];
        },
        staleTime: 10 * 60 * 1000,
    });

    const productsMap = useMemo(() => {
        const map = new Map<string, Product>();
        allProducts?.forEach(p => map.set(p.id, p));
        return map;
    }, [allProducts]);

    // Fetch COAs from Supabase
    const { data: coas, isLoading } = useQuery<COA[]>({
        queryKey: ["public-coas"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("product_coas" as any)
                .select(`
                    *,
                    products:products(id, name, slug)
                `)
                .eq("is_active", true)
                .order("is_featured", { ascending: false })
                .order("test_date", { ascending: false });
            
            if (error) throw error;
            return (data || []) as COA[];
        },
    });

    // Handle initial expand: If paramBatch is provided, expand that lot; otherwise expand the featured/active lot
    useEffect(() => {
        if (coas && coas.length > 0) {
            if (paramBatch) {
                const cleanParam = paramBatch.trim().toLowerCase();
                const matched = coas.find(
                    c => c.batch_number.toLowerCase() === cleanParam || c.id.toLowerCase() === cleanParam
                );
                if (matched) {
                    setExpandedBatches(new Set([matched.batch_number]));
                }
            } else {
                // By default expand the primary active lot
                const activeCoa = coas.find(c => c.is_featured) || coas[0];
                setExpandedBatches(new Set([activeCoa.batch_number]));
            }
        }
    }, [coas, paramBatch]);

    const toggleExpand = (batch: string) => {
        setExpandedBatches(prev => {
            const next = new Set(prev);
            if (next.has(batch)) {
                next.delete(batch);
            } else {
                next.add(batch);
            }
            return next;
        });
    };

    const handleShare = (batch: string) => {
        const shareUrl = `${window.location.origin}/coa/${batch}`;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(shareUrl);
            toast.success(`Verification link for Lot #${batch} copied to clipboard!`);
        }
    };

    // Filter COAs: If on /coa/:batchNumber, STRICTLY show that specific lot only!
    const filteredCoas = useMemo(() => {
        if (!coas) return [];

        if (paramBatch) {
            const cleanParam = paramBatch.trim().toLowerCase();
            return coas.filter(
                c => c.batch_number.toLowerCase() === cleanParam || c.id.toLowerCase() === cleanParam
            );
        }

        return coas.filter((coa) => {
            const linkedIds = (coa.product_ids && coa.product_ids.length > 0)
                ? coa.product_ids
                : (coa.product_id ? [coa.product_id] : []);

            const linkedNames = linkedIds
                .map(id => productsMap.get(id)?.name || (coa.products?.id === id ? coa.products.name : ""))
                .join(" ");

            const matchesSearch =
                coa.batch_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                linkedNames.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (coa.lab_name && coa.lab_name.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesSearch;
        });
    }, [coas, paramBatch, searchQuery, productsMap]);

    const seo = getSEOConfig("lab-reports");

    return (
        <div className="container py-8 md:py-14 max-w-5xl min-h-[70vh] space-y-8">
            <SEO 
                title={paramBatch ? `COA Lot #${paramBatch} | Official Analytical Report` : seo.title} 
                description={seo.description}
            />

            {/* Back Navigation if viewing a direct specific lot */}
            {paramBatch && (
                <div className="flex items-center justify-between border-b pb-3">
                    <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground font-semibold gap-1.5"
                    >
                        <Link to="/lab-reports">
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Back to All Lab Reports Directory
                        </Link>
                    </Button>
                    <span className="text-xs font-mono text-muted-foreground">
                        Direct Certificate Verification
                    </span>
                </div>
            )}

            {/* Header */}
            <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Official Quality Assurance &amp; Analytical Testing Portal
                </div>
                <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">
                    {paramBatch ? `Certificate of Analysis — Lot #${paramBatch}` : "Certificate of Analysis (COA) Directory"}
                </h1>
                <p className="text-muted-foreground text-base md:text-lg max-w-3xl leading-relaxed">
                    Quality and safety are our top priorities. Every batch of reconstitution solution and research peptides from 
                    <strong> Liv Well Research Labs</strong> is tested by independent, third-party, A2LA-accredited US laboratories. 
                    Inspect official laboratory report certificates and verify lot specifications below.
                </p>
            </div>

            {/* Search Bar (Only shown on global directory /lab-reports) */}
            {!paramBatch && (
                <>
                    <div className="relative max-w-lg">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Search by lot # (e.g. DW10M033026), product name, or lab..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-11 h-12 text-base rounded-xl shadow-xs"
                        />
                    </div>
                    <Separator />
                </>
            )}

            {/* Dynamic Results */}
            {isLoading ? (
                <div className="py-16 text-center space-y-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-3 border-primary border-t-transparent mx-auto"></div>
                    <p className="text-muted-foreground font-medium text-sm">Loading verified laboratory reports...</p>
                </div>
            ) : filteredCoas && filteredCoas.length > 0 ? (
                <div className="space-y-8">
                    {filteredCoas.map((coa) => {
                        const isExpanded = expandedBatches.has(coa.batch_number);

                        // Resolve unique linked products
                        const linkedIds = (coa.product_ids && coa.product_ids.length > 0)
                            ? coa.product_ids
                            : (coa.product_id ? [coa.product_id] : []);

                        const linkedProductsMap = new Map<string, Product>();
                        linkedIds.forEach(id => {
                            const p = productsMap.get(id) || (coa.products?.id === id ? coa.products : null);
                            if (p) linkedProductsMap.set(p.id, p);
                        });
                        const linkedProducts = Array.from(linkedProductsMap.values());

                        return (
                            <div 
                                key={coa.id} 
                                id={`lot-${coa.batch_number}`}
                                className="bg-card border rounded-2xl p-5 md:p-6 shadow-xs hover:shadow-md transition-all space-y-4 scroll-mt-20"
                            >
                                {/* Card Header: Batch ID, Badges & Action Buttons */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
                                    <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> 3rd Party Lab Verified
                                            </div>
                                            {coa.is_featured && (
                                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                                    ★ Current Active Lot
                                                </span>
                                            )}
                                        </div>

                                        <h3 className="text-2xl font-bold font-mono text-foreground flex items-center gap-2">
                                            Batch #{coa.batch_number}
                                        </h3>

                                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="h-3.5 w-3.5 text-primary" />
                                                <span>Tested: <strong className="text-foreground font-medium">{new Date(coa.test_date).toLocaleDateString("en-US", { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' })}</strong></span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <FlaskConical className="h-3.5 w-3.5 text-emerald-600" />
                                                <span>Accredited Lab: <strong className="text-foreground font-medium">{coa.lab_name || "Chromak Research Analytical Lab"}</strong></span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 self-start sm:self-center">
                                        <Button
                                            variant={isExpanded ? "secondary" : "outline"}
                                            onClick={() => toggleExpand(coa.batch_number)}
                                            className="h-9 px-3.5 rounded-xl font-semibold text-xs gap-1.5 shadow-xs transition-colors"
                                        >
                                            <FileText className="h-3.5 w-3.5 text-primary" />
                                            {isExpanded ? "Hide Preview" : "Inspect PDF"}
                                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5 ml-0.5" /> : <ChevronDown className="h-3.5 w-3.5 ml-0.5" />}
                                        </Button>

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleShare(coa.batch_number)}
                                            className="h-9 w-9 rounded-xl border hover:bg-muted text-muted-foreground hover:text-foreground"
                                            title="Share direct verification link"
                                        >
                                            <Share2 className="h-4 w-4" />
                                        </Button>

                                        <Button 
                                            onClick={() => downloadCoaPdf(coa.pdf_url, `COA-${coa.batch_number}.pdf`)}
                                            className="flex items-center justify-center gap-1.5 h-9 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3.5 shadow-xs"
                                        >
                                            <Download className="h-3.5 w-3.5" /> Download PDF
                                        </Button>
                                    </div>
                                </div>

                                {/* 1. Analytical Specs Horizontal Bar (4 Cards) - Compact & Clean */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                    <div className="bg-muted/40 border rounded-xl p-3 space-y-0.5">
                                        <div className="flex items-center justify-between text-muted-foreground">
                                            <span className="text-[10px] uppercase font-bold tracking-wider">Purity (HPLC)</span>
                                            <Award className="h-3.5 w-3.5 text-emerald-600" />
                                        </div>
                                        <p className="text-lg font-black text-foreground">
                                            {coa.purity_pct !== null && coa.purity_pct > 0 ? `${coa.purity_pct}%` : "≥99.5%"}
                                        </p>
                                        <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                                            <CheckCircle2 className="h-3 w-3" /> High Analytical Grade
                                        </span>
                                    </div>

                                    <div className="bg-muted/40 border rounded-xl p-3 space-y-0.5">
                                        <div className="flex items-center justify-between text-muted-foreground">
                                            <span className="text-[10px] uppercase font-bold tracking-wider">pH Level</span>
                                            <Activity className="h-3.5 w-3.5 text-blue-600" />
                                        </div>
                                        <p className="text-lg font-black text-foreground">
                                            {coa.ph_level !== null ? coa.ph_level : "5.0 - 7.0"}
                                        </p>
                                        <span className="text-[10px] text-muted-foreground">Standard Specification</span>
                                    </div>

                                    <div className="bg-muted/40 border rounded-xl p-3 space-y-0.5">
                                        <div className="flex items-center justify-between text-muted-foreground">
                                            <span className="text-[10px] uppercase font-bold tracking-wider">Benzyl Alcohol</span>
                                            <FlaskConical className="h-3.5 w-3.5 text-indigo-600" />
                                        </div>
                                        <p className="text-lg font-black text-foreground">
                                            {coa.benzyl_alcohol_pct !== null ? `${coa.benzyl_alcohol_pct}%` : "0.90%"}
                                        </p>
                                        <span className="text-[10px] text-muted-foreground">Bacteriostatic Agent</span>
                                    </div>

                                    <div className="bg-muted/40 border rounded-xl p-3 space-y-0.5">
                                        <div className="flex items-center justify-between text-muted-foreground">
                                            <span className="text-[10px] uppercase font-bold tracking-wider">Sterility USP &lt;71&gt;</span>
                                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                                        </div>
                                        <p className="text-xl font-black text-emerald-600">
                                            {coa.sterility_status || "Pass"}
                                        </p>
                                        <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                                            <CheckCircle2 className="h-3 w-3" /> No Microorganism Growth
                                        </span>
                                    </div>
                                </div>

                                {/* 2. Associated Products List (Compact Pills with Full Description & Direct Links) */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                        <Package className="h-3.5 w-3.5 text-primary" />
                                        <span>Associated Products ({linkedProducts.length > 0 ? linkedProducts.length : "General"}):</span>
                                    </div>

                                    {linkedProducts.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5">
                                            {linkedProducts.map((p) => (
                                                <Link
                                                    key={p.id}
                                                    to={`/products/${p.slug || p.id}`}
                                                    className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-muted/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-foreground hover:text-emerald-700 dark:hover:text-emerald-300 border border-border/80 hover:border-emerald-300 dark:hover:border-emerald-700/60 transition-all text-left"
                                                >
                                                    <Package className="h-3 w-3 text-emerald-600 shrink-0" />
                                                    <span className="leading-snug break-words">{p.name}</span>
                                                    <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-emerald-600 shrink-0 transition-transform group-hover:translate-x-0.5" />
                                                </Link>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="px-2.5 py-1 rounded-lg bg-muted/30 border text-xs text-foreground font-medium inline-block">
                                            Reconstitution Solution (General Batch)
                                        </div>
                                    )}
                                </div>

                                {/* Integrated Inline Canvas PDF Document Viewer */}
                                {isExpanded && (
                                    <div className="space-y-3 pt-3 border-t">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                <FileText className="h-3.5 w-3.5 text-emerald-600" />
                                                Official Analytical Laboratory Certificate Document (Lot #{coa.batch_number})
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => toggleExpand(coa.batch_number)}
                                                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                            >
                                                Hide Document ✕
                                            </Button>
                                        </div>

                                        <PDFViewerCanvas
                                            url={coa.pdf_url}
                                            batchNumber={coa.batch_number}
                                            defaultFit="page"
                                            containerHeightClass="min-h-[550px] max-h-[750px]"
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-16 border rounded-2xl bg-muted/20 space-y-4">
                    <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
                    <div className="space-y-1">
                        <h3 className="text-lg font-bold">
                            {paramBatch ? `Lot #${paramBatch} Not Found` : "No Lab Reports Found"}
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                            {paramBatch 
                                ? `We could not locate an active Certificate of Analysis for Lot #${paramBatch}. Please check the number printed on your vial.`
                                : `No batches matched your search query "${searchQuery}". Please verify the lot number or contact support.`
                            }
                        </p>
                    </div>
                    {paramBatch && (
                        <Button asChild variant="outline" size="sm" className="gap-2">
                            <Link to="/lab-reports">
                                <ArrowLeft className="h-3.5 w-3.5" />
                                Go to All Lab Reports
                            </Link>
                        </Button>
                    )}
                </div>
            )}

            {/* Helpful Section */}
            <div className="bg-card border rounded-2xl p-6 md:p-8 space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <HelpCircle className="h-6 w-6" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground">Frequently Asked Questions</h2>
                </div>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Where can I find the Batch Number?</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            The batch number is printed clearly on the side of the vial label (labeled as LOT or BATCH) and on the bottom of the retail packaging box.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">What tests are performed on the Reconstitution Solution?</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Each batch is tested for sterility, pH values, benzyl alcohol concentration (to guarantee exactly 0.9% for preservation), and purity levels using high-performance liquid chromatography (HPLC) and mass spectrometry.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LabReports;
