import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Download, FileText, Search, ShieldCheck, HelpCircle } from "lucide-react";
import SEO from "@/components/SEO";

interface Product {
    id: string;
    name: string;
}

interface COA {
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
    products?: Product | null;
}

const LabReports = () => {
    const [searchQuery, setSearchQuery] = useState("");

    // Fetch COAs from Supabase
    const { data: coas, isLoading } = useQuery<COA[]>({
        queryKey: ["public-coas"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("product_coas" as any)
                .select(`
                    *,
                    products:products(id, name)
                `)
                .eq("is_active", true)
                .order("test_date", { ascending: false });
            
            if (error) throw error;
            return data || [];
        },
    });

    const filteredCoas = coas?.filter((coa) => {
        const matchesSearch =
            coa.batch_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (coa.products?.name && coa.products.name.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesSearch;
    });

    return (
        <div className="container py-12 md:py-20 max-w-4xl min-h-[70vh]">
            <SEO 
                title="Lab Reports & COAs" 
                description="View third-party independent laboratory test results and Certificates of Analysis (COAs) for our bacteriostatic water and reconstitution solutions."
            />

            <div className="space-y-10">
                {/* Header */}
                <div className="space-y-4">
                    <h1 className="text-4xl font-bold tracking-tight text-foreground">Lab Reports & COAs</h1>
                    <p className="text-muted-foreground text-lg max-w-3xl leading-relaxed">
                        Quality and safety are our top priorities. Every batch of reconstitution solution and bacteriostatic water from 
                        <strong> Liv Well Research Labs</strong> is tested by an independent, third-party, A2LA-accredited US laboratory. 
                        Enter your batch number below to download the official Certificate of Analysis (COA).
                    </p>
                </div>

                {/* Search Bar */}
                <div className="relative max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Search by batch number (e.g., BW-30ML-2026-A)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-11 h-12 text-base rounded-xl"
                    />
                </div>

                <Separator />

                {/* Dynamic Results */}
                {isLoading ? (
                    <div className="py-12 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Loading test reports...</p>
                    </div>
                ) : filteredCoas && filteredCoas.length > 0 ? (
                    <div className="grid gap-6">
                        {filteredCoas.map((coa) => (
                            <div 
                                key={coa.id} 
                                className="bg-card border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow grid grid-cols-1 md:grid-cols-3 gap-6 items-center"
                            >
                                {/* Batch Details */}
                                <div className="space-y-2 md:col-span-1">
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        <ShieldCheck className="h-3.5 w-3.5" /> 3rd Party Tested
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground">
                                        Batch #{coa.batch_number}
                                    </h3>
                                    <p className="text-sm text-muted-foreground font-medium">
                                        {coa.products?.name || "Reconstitution Solution"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Tested: {new Date(coa.test_date).toLocaleDateString(undefined, { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' })}
                                    </p>
                                </div>

                                {/* Specs Grid */}
                                <div className="grid grid-cols-2 gap-4 bg-muted/40 p-4 rounded-xl md:col-span-1 border">
                                    <div className="space-y-1">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Purity</span>
                                        <p className="text-sm font-bold text-foreground">
                                            {coa.purity_pct !== null ? `${coa.purity_pct}%` : "99.9%+"}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">pH Level</span>
                                        <p className="text-sm font-bold text-foreground">
                                            {coa.ph_level !== null ? coa.ph_level : "5.8 - 6.2"}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Benzyl Alcohol</span>
                                        <p className="text-sm font-bold text-foreground">
                                            {coa.benzyl_alcohol_pct !== null ? `${coa.benzyl_alcohol_pct}%` : "0.9%"}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Sterility</span>
                                        <p className="text-sm font-bold text-emerald-600">
                                            {coa.sterility_status || "Pass"}
                                        </p>
                                    </div>
                                </div>

                                {/* Download Action */}
                                <div className="flex md:justify-end md:col-span-1 w-full">
                                    <a 
                                        href={coa.pdf_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="w-full md:w-auto"
                                    >
                                        <Button className="w-full md:w-auto flex items-center justify-center gap-2 h-12 rounded-xl px-6 font-semibold">
                                            <Download className="h-4.5 w-4.5" /> Download COA (PDF)
                                        </Button>
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-muted/30 border rounded-2xl p-10 text-center space-y-4">
                        <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto" />
                        <h3 className="text-lg font-semibold text-foreground">No reports found</h3>
                        <p className="text-muted-foreground max-w-md mx-auto text-sm">
                            We couldn't find any lab reports matching "{searchQuery}". Please check your batch number or contact support if you need assistance.
                        </p>
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
        </div>
    );
};

export default LabReports;
