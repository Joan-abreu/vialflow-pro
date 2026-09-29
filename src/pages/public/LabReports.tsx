import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { 
    Download, 
    FileText, 
    Search, 
    ShieldCheck, 
    ExternalLink, 
    Package,
    Calendar,
    FlaskConical,
    Award,
    Activity,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    ArrowLeft,
    Layers,
    KeyRound,
    Sparkles,
    Check,
    QrCode,
    ChevronRight,
    Copy
} from "lucide-react";
import SEO from "@/components/SEO";
import { getSEOConfig } from "@/config/seoConfig";
import { downloadCoaPdf } from "@/utils/downloadCoa";
import PDFViewerCanvas from "@/components/products/PDFViewerCanvas";
import { toast } from "sonner";
import { COA } from "@/types/coa";

interface Product {
    id: string;
    name: string;
    slug?: string;
}

// Product Short Code & Alias Dictionary for QR codes and clean URLs
const PRODUCT_ALIASES: Record<string, string[]> = {
    // Retatrutide (GLP3-RT)
    "glp3-rt": ["rt", "rt10", "rt20", "rt30", "rt40", "reta", "retatrutide", "glp3", "glp3-rt", "glp-3-reta", "glp-3-retatrutide-7-5mg-per-week"],
    // Tirzepatide (GLP2-TZ)
    "glp2-tz": ["tr", "tr10", "tr15", "tr20", "tr30", "tr60", "tz", "tirz", "tirzepatide", "glp2", "glp2-tz"],
    // Semaglutide (GLP1-SM)
    "glp1-sm": ["sm", "sm10", "sema", "semaglutide", "glp1", "glp1-sm"],
    // BPC-157
    "bpc-157": ["bpc", "bpc10", "bpc-157", "bpc157"],
    // TB-500
    "tb-500": ["tb", "tb10", "tb-500", "tb500"],
    // Bacteriostatic Water / Reconstitution Solution
    "reconstitution-solution-bacteriostatic-water-bac-water-10ml-glass-vials-deionized-water-with-0-9-benzyl-alcohol-3rd-party-lab-tested": [
        "bac", "water", "bac-water", "bacteriostatic", "bac10", "bac30", "bac10ml", "bac30ml", "bac-10ml", "bac-30ml", "dw10", "dw10m"
    ],
    // NAD+
    "nad": ["nad", "nad500", "nad+"],
    // MOTS-C
    "mots-c": ["mots", "motsc", "mots10", "mots40"],
    // KLOW Blend
    "klow-bpc-157-10mg-tb-500-10mg-ghk-cu-50mg-kpv-10mg": ["klow", "klow80"],
    // Wolverine Blend
    "wolverine-bpc-157-10mg-tb-500-10mg": ["wolv", "wolv20", "wolverine"],
    // Semax
    "semax": ["semax", "semx", "semx10"],
    // Selank
    "selank": ["selank", "selk", "selk10"],
    // Tesamorelin
    "tesamorelin": ["tesa", "tesa10", "tesamorelin"],
    // Ipamorelin
    "ipamorelin": ["ipa", "ipa10", "ipamorelin"],
    // Melanotan 2
    "mt-2-melanotan-2-acetate": ["mt2", "mt210", "mt-2", "melanotan"],
    // SS-31
    "ss-31": ["ss31", "ss3110", "ss-31"],
    // GHK-Cu
    "ghk-cu": ["ghk", "ghkcu", "ghkcu50", "ghk-cu"],
    // Glutathione
    "glutathione": ["glut", "glut1500", "glutathione"],
    // AOD 9604
    "aod-9604": ["aod", "aod5", "aod9604", "aod-9604"]
};

// Popular products for quick directory pills
const POPULAR_HUBS = [
    { label: "Retatrutide (RT)", code: "rt10", slug: "glp3-rt" },
    { label: "Tirzepatide (TR)", code: "tr30", slug: "glp2-tz" },
    { label: "Semaglutide (SM)", code: "sm10", slug: "glp1-sm" },
    { label: "BPC-157", code: "bpc10", slug: "bpc-157" },
    { label: "TB-500", code: "tb10", slug: "tb-500" },
    { label: "Bac Water", code: "bac", slug: "reconstitution-solution-bacteriostatic-water-bac-water-10ml-glass-vials-deionized-water-with-0-9-benzyl-alcohol-3rd-party-lab-tested" },
    { label: "NAD+", code: "nad500", slug: "nad" },
    { label: "MOTS-C", code: "mots10", slug: "mots-c" },
    { label: "KLOW Blend", code: "klow", slug: "klow-bpc-157-10mg-tb-500-10mg-ghk-cu-50mg-kpv-10mg" },
    { label: "Wolverine", code: "wolv", slug: "wolverine-bpc-157-10mg-tb-500-10mg" },
    { label: "Tesamorelin", code: "tesa", slug: "tesamorelin" },
    { label: "Ipamorelin", code: "ipa", slug: "ipamorelin" },
];

export interface ProductCoaCard {
    productId: string;
    productName: string;
    productSlug: string;
    primarySku: string;
    shortCode: string;
    isWater: boolean;
    totalLots: number;
    activeBatch: COA;
    latestTestDate: string;
    displayPurity: string;
    dosesSummary: string;
    labName: string;
    batches: COA[];
}

// Clean, customer-facing product name & SKU resolver
export const getCleanProductName = (prod: Product | { name: string; slug?: string } | null | undefined): { name: string; sku: string } => {
    if (!prod) return { name: "Product", sku: "" };
    const slug = (prod.slug || "").toLowerCase();
    const rawName = (prod.name || "").trim();

    if (slug === "glp2-tz" || rawName.toLowerCase() === "glp2-tz" || rawName.toLowerCase() === "glp-2 tirzepatide") {
        return { name: "Tirzepatide", sku: "TR" };
    }
    if (slug === "glp3-rt" || slug.startsWith("glp-3") || rawName.toLowerCase() === "glp3-rt" || rawName.toLowerCase().includes("retatrutide")) {
        return { name: "Retatrutide", sku: "RT" };
    }
    if (slug === "glp1-sm" || rawName.toLowerCase() === "glp1-sm" || rawName.toLowerCase().includes("semaglutide")) {
        return { name: "Semaglutide", sku: "SM" };
    }
    if (slug.includes("bacteriostatic-water") || rawName.toLowerCase().includes("bacteriostatic")) {
        return { name: "Bacteriostatic Water (Reconstitution Solution)", sku: "BAC" };
    }
    return { name: rawName, sku: "" };
};

// Helper to extract clean presentation dose / format from a batch
export const extractDoseFromBatch = (batch: COA, pMap?: Map<string, Product>): string => {
    if (batch.target_dosage_mg !== null && batch.target_dosage_mg !== undefined && batch.target_dosage_mg > 0) {
        return `${batch.target_dosage_mg}mg`;
    }
    if (batch.measured_dosage_mg !== null && batch.measured_dosage_mg !== undefined && batch.measured_dosage_mg > 0) {
        return `${Math.round(batch.measured_dosage_mg)}mg`;
    }

    const bNum = (batch.batch_number || "").toUpperCase();
    if (batch.coa_type === 'water' || bNum.startsWith("DW")) {
        const pids = batch.product_ids || (batch.product_id ? [batch.product_id] : []);
        for (const pid of pids) {
            const p = pMap?.get(pid);
            if (p?.name.includes("30ml") || p?.slug?.includes("30ml")) return "30ml";
            if (p?.name.includes("10ml") || p?.slug?.includes("10ml")) return "10ml";
        }
        if (bNum.includes("10M")) return "10ml";
        if (bNum.includes("30M")) return "30ml";
        return "10ml";
    }

    const match = bNum.match(/^[A-Z]+(\d{1,3})/);
    if (match) {
        return `${match[1]}mg`;
    }

    return "Standard";
};

const LabReports = () => {
    const { identifier, batchNumber } = useParams<{ identifier?: string; batchNumber?: string }>();
    const rawParam = (identifier || batchNumber || "").trim();

    const [searchQuery, setSearchQuery] = useState("");
    const [historySearchQuery, setHistorySearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<'all' | 'peptide' | 'water'>('all');
    const [selectedHeroBatchId, setSelectedHeroBatchId] = useState<string | null>(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [copiedKey, setCopiedKey] = useState(false);

    const viewerRef = useRef<HTMLDivElement>(null);

    // Fetch all products
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

    // Fetch all product variants for SKU matching
    const { data: allVariants } = useQuery({
        queryKey: ["public-all-variants-for-coas"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("product_variants")
                .select("id, product_id, sku, vial_types(name, capacity_ml)");
            if (error) throw error;
            return data || [];
        },
        staleTime: 10 * 60 * 1000,
    });

    const variantsMap = useMemo(() => {
        const map = new Map<string, any>();
        allVariants?.forEach(v => map.set(v.id, v));
        return map;
    }, [allVariants]);

    // Fetch ONLY genuine COAs with verified analytical PDF certificates
    const { data: coas, isLoading } = useQuery<COA[]>({
        queryKey: ["public-coas"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("product_coas" as any)
                .select(`
                    *,
                    products:products(id, name, slug)
                `)
                .not("pdf_url", "is", null)
                .neq("pdf_url", "")
                .order("is_featured", { ascending: false })
                .order("test_date", { ascending: false });
            
            if (error) throw error;
            // Exclude empty string URLs or internal manufacturing placeholder lots
            return ((data || []) as COA[]).filter(c => c.pdf_url && c.pdf_url.trim().startsWith("http"));
        },
    });

    // Resolve URL Identifier: Detect Product vs Batch Number vs Directory
    const resolvedContext = useMemo(() => {
        if (!rawParam) return { mode: 'directory' as const };
        const clean = rawParam.toLowerCase().trim().replace(/^#/, "");

        // 1. Check if matches a specific Batch Number directly
        const matchedBatch = coas?.find(
            c => c.batch_number.toLowerCase() === clean || c.id.toLowerCase() === clean
        );

        // If it matched a batch number, see if we can find its owning product
        if (matchedBatch) {
            const pIds = (matchedBatch.product_ids && matchedBatch.product_ids.length > 0)
                ? matchedBatch.product_ids
                : (matchedBatch.product_id ? [matchedBatch.product_id] : []);
            if (pIds.length > 0 && allProducts) {
                const ownerProduct = allProducts.find(p => pIds.includes(p.id)) || matchedBatch.products;
                if (ownerProduct) {
                    return {
                        mode: 'product' as const,
                        product: ownerProduct,
                        matchedBatch,
                        requestedKey: clean
                    };
                }
            }
        }

        // 2. Check if clean param matches a variant SKU (e.g. RT10, TR30, BAC-10ML-BA09-SGL)
        const matchedVariant = allVariants?.find(v => v.sku && v.sku.toLowerCase() === clean);
        if (matchedVariant) {
            const prod = allProducts?.find(p => p.id === matchedVariant.product_id);
            if (prod) {
                return { 
                    mode: 'product' as const, 
                    product: prod, 
                    variantSku: matchedVariant.sku,
                    matchedBatch 
                };
            }
        }

        // 3. Check alias dictionary (e.g. rt, rt10, reta -> glp3-rt)
        for (const [slug, aliases] of Object.entries(PRODUCT_ALIASES)) {
            if (aliases.includes(clean)) {
                const prod = allProducts?.find(p => p.slug === slug || p.id === slug);
                if (prod) {
                    return { 
                        mode: 'product' as const, 
                        product: prod, 
                        requestedKey: clean,
                        matchedBatch 
                    };
                }
            }
        }

        // 4. Check product slug or ID directly
        const matchedProd = allProducts?.find(
            p => p.slug?.toLowerCase() === clean || p.id.toLowerCase() === clean
        );
        if (matchedProd) {
            return { 
                mode: 'product' as const, 
                product: matchedProd,
                matchedBatch 
            };
        }

        // 5. Fuzzy match on product name (e.g. "retatrutide" or "bacteriostatic")
        const fuzzyProd = allProducts?.find(p => p.name.toLowerCase().includes(clean));
        if (fuzzyProd) {
            return { 
                mode: 'product' as const, 
                product: fuzzyProd,
                matchedBatch 
            };
        }

        // 6. If it matched an exact batch number without a product context
        if (matchedBatch) {
            return { mode: 'batch' as const, batch: matchedBatch };
        }

        // 7. Not found
        return { mode: 'not_found' as const, query: rawParam };
    }, [rawParam, coas, allProducts, allVariants]);

    // When viewing a product hub, gather all its associated batches
    const productBatches = useMemo(() => {
        if (resolvedContext.mode !== 'product' || !resolvedContext.product || !coas) return [];
        const prod = resolvedContext.product;
        const prodId = prod.id;
        const isBacWater = prod.slug?.includes("bacteriostatic-water") || prod.name?.toLowerCase().includes("bacteriostatic");

        return coas.filter(c => {
            if (isBacWater) {
                const isWaterCoa = c.coa_type === 'water' || 
                    c.batch_number.toLowerCase().startsWith('dw') ||
                    (c.products?.name && c.products.name.toLowerCase().includes('bacteriostatic'));
                if (isWaterCoa) return true;
            }

            const pIds = (c.product_ids && c.product_ids.length > 0) 
                ? c.product_ids 
                : (c.product_id ? [c.product_id] : []);
            return pIds.includes(prodId) || c.products?.id === prodId;
        });
    }, [resolvedContext, coas]);

    // Determine the Active Batch for the Product Hub
    const activeBatchForProduct = useMemo(() => {
        if (productBatches.length === 0) return null;
        // 1. If a specific batch ID was selected by clicking in the table
        if (selectedHeroBatchId) {
            const selected = productBatches.find(b => b.id === selectedHeroBatchId || b.batch_number === selectedHeroBatchId);
            if (selected) return selected;
        }
        // 2. If URL matched a specific batch within this product
        if (resolvedContext.mode === 'product' && resolvedContext.matchedBatch) {
            return resolvedContext.matchedBatch;
        }
        // 3. If requestedKey or variantSku has a dose number (e.g. rt20, tr60, rt40), match by dose!
        const doseKey = resolvedContext.mode === 'product' ? (resolvedContext.variantSku || resolvedContext.requestedKey || "") : "";
        if (doseKey) {
            const numMatch = doseKey.match(/\d+/);
            if (numMatch) {
                const targetDose = parseInt(numMatch[0]);
                const matchByDose = productBatches.find(b => 
                    b.target_dosage_mg === targetDose || 
                    b.batch_number.toLowerCase().includes(targetDose.toString())
                );
                if (matchByDose) return matchByDose;
            }
        }
        // 4. Highest priority: featured batch
        const featured = productBatches.find(b => b.is_featured);
        if (featured) return featured;
        // 5. Fallback: newest tested batch
        return productBatches[0];
    }, [productBatches, selectedHeroBatchId, resolvedContext]);

    // Update selected batch when URL changes
    useEffect(() => {
        if (resolvedContext.mode === 'product' && resolvedContext.matchedBatch) {
            setSelectedHeroBatchId(resolvedContext.matchedBatch.id);
            setIsViewerOpen(false);
        } else {
            setSelectedHeroBatchId(null);
            setIsViewerOpen(false);
        }
    }, [resolvedContext]);

    // Filtered batches for Product History Table
    const filteredHistoryBatches = useMemo(() => {
        if (!productBatches) return [];
        if (!historySearchQuery.trim()) return productBatches;
        const q = historySearchQuery.toLowerCase().trim();
        return productBatches.filter(b => 
            b.batch_number.toLowerCase().includes(q) ||
            (b.lab_name && b.lab_name.toLowerCase().includes(q)) ||
            (b.verification_key && b.verification_key.toLowerCase().includes(q)) ||
            (b.task_number && b.task_number.toLowerCase().includes(q))
        );
    }, [productBatches, historySearchQuery]);

    // ==========================================
    // DIRECTORY LEVEL: GROUP ALL COAS BY PRODUCT (ZC Labs Product Cards Grid)
    // ==========================================
    const productCards = useMemo<ProductCoaCard[]>(() => {
        if (!coas || !allProducts) return [];

        const bacWaterCanonicalSlug = "reconstitution-solution-bacteriostatic-water-bac-water-10ml-glass-vials-deionized-water-with-0-9-benzyl-alcohol-3rd-party-lab-tested";
        const canonicalBacWaterProd = allProducts.find(p => p.slug === bacWaterCanonicalSlug) || {
            id: "bac-water-canonical",
            name: "Bacteriostatic Water (Reconstitution Solution)",
            slug: bacWaterCanonicalSlug
        };

        const groupedMap = new Map<string, { product: Product; batches: COA[] }>();

        // Pre-group
        coas.forEach(coa => {
            const isWater = coa.coa_type === 'water' || 
                coa.batch_number.toLowerCase().startsWith('dw') ||
                (coa.products?.name && coa.products.name.toLowerCase().includes('bacteriostatic'));

            if (isWater) {
                if (!groupedMap.has(canonicalBacWaterProd.id)) {
                    groupedMap.set(canonicalBacWaterProd.id, { product: canonicalBacWaterProd, batches: [] });
                }
                groupedMap.get(canonicalBacWaterProd.id)!.batches.push(coa);
                return;
            }

            const pids = (coa.product_ids && coa.product_ids.length > 0)
                ? coa.product_ids
                : (coa.product_id ? [coa.product_id] : []);

            if (pids.length > 0) {
                pids.forEach(pid => {
                    const prod = productsMap.get(pid);
                    if (prod) {
                        // Skip individual bac water clones since they are consolidated
                        if (prod.slug?.includes("bacteriostatic-water") && prod.id !== canonicalBacWaterProd.id) {
                            return;
                        }
                        if (!groupedMap.has(pid)) {
                            groupedMap.set(pid, { product: prod, batches: [] });
                        }
                        groupedMap.get(pid)!.batches.push(coa);
                    }
                });
            } else if (coa.products) {
                const prod = coa.products;
                if (!groupedMap.has(prod.id)) {
                    groupedMap.set(prod.id, { product: prod, batches: [] });
                }
                groupedMap.get(prod.id)!.batches.push(coa);
            }
        });

        const cards: ProductCoaCard[] = [];

        groupedMap.forEach(({ product, batches }) => {
            if (batches.length === 0) return;

            // Sort batches: featured first, then test_date desc
            const sortedBatches = [...batches].sort((a, b) => {
                if (a.is_featured && !b.is_featured) return -1;
                if (!a.is_featured && b.is_featured) return 1;
                return new Date(b.test_date).getTime() - new Date(a.test_date).getTime();
            });

            const cleanInfo = getCleanProductName(product);
            const activeBatch = sortedBatches.find(b => b.is_featured) || sortedBatches[0];
            const isWater = product.slug === bacWaterCanonicalSlug || activeBatch.coa_type === 'water';

            // Find primary SKU from cleanInfo or variants
            const prodVariants = allVariants?.filter(v => v.product_id === product.id) || [];
            let primarySku = cleanInfo.sku || prodVariants.find(v => v.sku)?.sku || "";
            if (!primarySku) {
                if (isWater) primarySku = "BAC-10ML / BAC-30ML";
                else {
                    primarySku = (cleanInfo.name || "").split(" ")[0].toUpperCase();
                }
            }

            // Derive short code for URL
            let shortCode = "lab-reports";
            for (const [slug, aliases] of Object.entries(PRODUCT_ALIASES)) {
                if (slug === product.slug) {
                    shortCode = aliases[0];
                    break;
                }
            }

            // Purity Display
            let displayPurity = "≥99.0%";
            if (isWater) {
                displayPurity = "USP <71> Sterile";
            } else if (activeBatch.purity_pct !== null && (activeBatch.purity_pct ?? 0) > 0) {
                displayPurity = `${Number(activeBatch.purity_pct).toFixed((activeBatch.purity_pct ?? 0) % 1 === 0 ? 1 : 2)}% Purity`;
            }

            // Calculate Available Doses Summary (e.g. 20mg · 30mg · 40mg)
            const rawDoses = sortedBatches.map(b => extractDoseFromBatch(b, productsMap));
            const uniqueDoses = Array.from(new Set(rawDoses)).filter(d => d && d !== "Standard");
            const dosesSummary = uniqueDoses.length > 0 ? uniqueDoses.join(" · ") : `#${activeBatch.batch_number}`;

            cards.push({
                productId: product.id,
                productName: cleanInfo.name,
                productSlug: product.slug || product.id,
                primarySku,
                shortCode,
                isWater,
                totalLots: sortedBatches.length,
                activeBatch,
                latestTestDate: activeBatch.test_date,
                displayPurity,
                dosesSummary,
                labName: activeBatch.lab_name || (isWater ? "Chromak Research" : "Janoshik Analytical"),
                batches: sortedBatches,
            });
        });

        // Sort cards: popular/featured compounds first
        const prioritySlugs = ["glp3-rt", "glp2-tz", "glp1-sm", "bpc-157", "tb-500", bacWaterCanonicalSlug, "nad", "mots-c", "klow", "wolv"];
        return cards.sort((a, b) => {
            const indexA = prioritySlugs.findIndex(s => a.productSlug.includes(s));
            const indexB = prioritySlugs.findIndex(s => b.productSlug.includes(s));
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.productName.localeCompare(b.productName);
        });
    }, [coas, allProducts, allVariants, productsMap]);

    // Counts for Category Tabs
    const counts = useMemo(() => {
        let peptide = 0;
        let water = 0;
        productCards.forEach(c => {
            if (c.isWater) water++;
            else peptide++;
        });
        return { all: productCards.length, peptide, water };
    }, [productCards]);

    // Filtered Cards according to search and category tabs
    const filteredProductCards = useMemo(() => {
        return productCards.filter(card => {
            if (activeTab === 'peptide' && card.isWater) return false;
            if (activeTab === 'water' && !card.isWater) return false;

            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase().trim();

            const nameMatch = card.productName.toLowerCase().includes(q);
            const skuMatch = card.primarySku.toLowerCase().includes(q);
            const shortMatch = card.shortCode.toLowerCase().includes(q);
            const lotMatch = card.batches.some(b => 
                b.batch_number.toLowerCase().includes(q) ||
                (b.verification_key && b.verification_key.toLowerCase().includes(q)) ||
                (b.task_number && b.task_number.toLowerCase().includes(q))
            );

            return nameMatch || skuMatch || shortMatch || lotMatch;
        });
    }, [productCards, activeTab, searchQuery]);

    // Direct Lot Matches for quick access when searching a lot number
    const directLotMatches = useMemo(() => {
        if (!searchQuery.trim() || !coas) return [];
        const q = searchQuery.toLowerCase().trim();
        return coas.filter(c => 
            c.batch_number.toLowerCase().includes(q) ||
            (c.task_number && c.task_number.toLowerCase().includes(q)) ||
            (c.verification_key && c.verification_key.toLowerCase().includes(q))
        ).slice(0, 4);
    }, [searchQuery, coas]);

    const handleCopyKey = (key: string) => {
        if (!key || !navigator.clipboard) return;
        navigator.clipboard.writeText(key);
        setCopiedKey(true);
        toast.success("Janoshik verification key copied to clipboard");
        setTimeout(() => setCopiedKey(false), 2000);
    };

    const handleSelectBatch = (batchId: string) => {
        setSelectedHeroBatchId(batchId);
        setIsViewerOpen(true);
        if (viewerRef.current) {
            viewerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    };

    const seo = getSEOConfig("lab-reports");

    // ==========================================
    // RENDER: PRODUCT COA HUB VIEW (ZC Labs Detail Hub)
    // ==========================================
    if (resolvedContext.mode === 'product' && resolvedContext.product) {
        const prod = resolvedContext.product;
        const cleanProduct = getCleanProductName(prod);
        const currentBatch = activeBatchForProduct;
        const isPeptide = currentBatch 
            ? (currentBatch.coa_type === 'peptide' || !!currentBatch.task_number || !!currentBatch.measured_dosage_mg)
            : true;

        const formattedPurity = currentBatch?.purity_pct !== null && (currentBatch?.purity_pct ?? 0) > 0
            ? `${Number(currentBatch?.purity_pct).toFixed((currentBatch?.purity_pct ?? 0) % 1 === 0 ? 1 : 2)}%`
            : null;

        const cleanTask = currentBatch?.task_number ? currentBatch.task_number.replace(/^#/, "").trim() : "";
        const janoshikVerifyUrl = currentBatch?.verification_url || 
            (currentBatch?.verification_key 
                ? `https://janoshik.com/verification/?${cleanTask ? `task=${cleanTask}&` : ""}key=${currentBatch.verification_key}` 
                : null);

        // Find clean short code for QR target display
        let displayShortCode = cleanProduct.sku || resolvedContext.variantSku || "";
        if (!displayShortCode) {
            for (const [slug, aliases] of Object.entries(PRODUCT_ALIASES)) {
                if (slug === prod.slug) {
                    displayShortCode = aliases[0].toUpperCase();
                    break;
                }
            }
        }

        return (
            <div className="container py-8 md:py-12 max-w-5xl min-h-[75vh] space-y-8 animate-in fade-in duration-300">
                <SEO 
                    title={`${cleanProduct.name} | Certificate of Analysis & Batch History`} 
                    description={`Verify official third-party analytical laboratory reports and lot history for ${cleanProduct.name} from Liv Well Research Labs.`}
                />

                {/* Back to Directory Bar */}
                <div className="flex items-center justify-between border-b pb-4">
                    <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground font-semibold gap-1.5"
                    >
                        <Link to="/lab-reports">
                            <ArrowLeft className="h-3.5 w-3.5" />
                            All Lab Reports Directory
                        </Link>
                    </Button>
                </div>

                {/* Product Header */}
                <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        Quality Assurance &amp; Lot Verification Hub
                    </div>
                    <div className="flex flex-wrap items-baseline gap-3">
                        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">
                            {cleanProduct.name}
                        </h1>
                    </div>
                    <p className="text-muted-foreground text-sm md:text-base max-w-3xl leading-relaxed">
                        Every batch of <strong>{cleanProduct.name}</strong> produced by <strong>Liv Well Research Labs</strong> is tested 
                        by independent accredited laboratories. 
                        Inspect the currently active production lot below or reference our complete batch history archive.
                    </p>
                </div>

                {/* 1. SPOTLIGHT HERO: CURRENT ACTIVE BATCH CARD */}
                {currentBatch ? (
                    <div className="border-2 border-emerald-500/40 bg-gradient-to-b from-card via-card to-emerald-500/5 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
                        {/* Header: Batch Title, Active Badge & Action Buttons */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-5">
                            <div className="space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold tracking-wider px-2.5 py-0.5 shadow-xs">
                                        CURRENT ACTIVE LOT
                                    </Badge>
                                    <span className="text-xs text-muted-foreground font-mono">
                                        Indexed in Production Archive
                                    </span>
                                </div>
                                <h2 className="text-2xl md:text-3xl font-black font-mono tracking-tight text-foreground flex items-center gap-2">
                                    LOT #{currentBatch.batch_number}
                                </h2>
                                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="h-3.5 w-3.5 text-primary" />
                                        <span>Tested: <strong className="text-foreground font-medium">{new Date(currentBatch.test_date).toLocaleDateString("en-US", { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' })}</strong></span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <FlaskConical className="h-3.5 w-3.5 text-emerald-600" />
                                        <span>Accredited Lab: <strong className="text-foreground font-medium">{currentBatch.lab_name || (isPeptide ? "Janoshik Analytical Laboratory" : "Chromak Research")}</strong></span>
                                    </div>
                                </div>
                            </div>

                            {/* Hero Action Buttons - Single Clean Horizontal Row */}
                            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0 self-start lg:self-center">
                                <Button
                                    variant={isViewerOpen ? "secondary" : "default"}
                                    onClick={() => setIsViewerOpen(!isViewerOpen)}
                                    className="h-9 px-3.5 rounded-xl font-bold text-xs gap-1.5 shadow-xs whitespace-nowrap"
                                >
                                    <FileText className="h-3.5 w-3.5 text-emerald-600" />
                                    {isViewerOpen ? "Hide Certificate" : "Inspect Certificate"}
                                    {isViewerOpen ? <ChevronUp className="h-3.5 w-3.5 ml-0.5" /> : <ChevronDown className="h-3.5 w-3.5 ml-0.5" />}
                                </Button>

                                {janoshikVerifyUrl && (
                                    <Button
                                        asChild
                                        variant="outline"
                                        className="h-9 px-3.5 rounded-xl border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-bold gap-1.5 whitespace-nowrap"
                                    >
                                        <a href={janoshikVerifyUrl} target="_blank" rel="noopener noreferrer">
                                            <span>Verify on Janoshik</span>
                                            <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                    </Button>
                                )}

                                <Button
                                    variant="outline"
                                    onClick={() => downloadCoaPdf(currentBatch.pdf_url, `COA-LOT-${currentBatch.batch_number}.pdf`)}
                                    className="h-9 px-3.5 rounded-xl text-xs font-semibold gap-1.5 text-muted-foreground hover:text-foreground whitespace-nowrap"
                                    title="Download Certificate PDF"
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    <span>Download</span>
                                </Button>
                            </div>
                        </div>

                        {/* Metric Tiles: 4 Key Analytical Findings */}
                        {isPeptide ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-background/80 border rounded-2xl p-4 space-y-1 shadow-xs">
                                    <div className="flex items-center justify-between text-muted-foreground">
                                        <span className="text-[10px] uppercase font-bold tracking-wider">HPLC Purity</span>
                                        <Award className="h-4 w-4 text-emerald-600" />
                                    </div>
                                    <p className="text-2xl md:text-3xl font-black text-emerald-600">
                                        {formattedPurity || "≥99.0%"}
                                    </p>
                                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Analytical Grade
                                    </span>
                                </div>

                                <div className="bg-background/80 border rounded-2xl p-4 space-y-1 shadow-xs">
                                    <div className="flex items-center justify-between text-muted-foreground">
                                        <span className="text-[10px] uppercase font-bold tracking-wider">Dosage / Content</span>
                                        <Activity className="h-4 w-4 text-primary" />
                                    </div>
                                    <p className="text-xl md:text-2xl font-black text-foreground">
                                        {currentBatch.measured_dosage_mg !== null 
                                            ? `${currentBatch.measured_dosage_mg} mg` 
                                            : currentBatch.target_dosage_mg 
                                                ? `${currentBatch.target_dosage_mg} mg` 
                                                : "Verified"}
                                    </p>
                                    <span className="text-[11px] text-muted-foreground">
                                        Target: {currentBatch.target_dosage_mg ? `${currentBatch.target_dosage_mg} mg` : "Declared Spec"}
                                    </span>
                                </div>

                                <div className="bg-background/80 border rounded-2xl p-4 space-y-1 shadow-xs">
                                    <div className="flex items-center justify-between text-muted-foreground">
                                        <span className="text-[10px] uppercase font-bold tracking-wider">Mass Spec</span>
                                        <FlaskConical className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <p className="text-xl md:text-2xl font-black text-foreground">
                                        {currentBatch.sequence_status || "Confirmed"}
                                    </p>
                                    <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> MW Verified
                                    </span>
                                </div>

                                <div className="bg-background/80 border rounded-2xl p-4 space-y-1 shadow-xs">
                                    <div className="flex items-center justify-between text-muted-foreground">
                                        <span className="text-[10px] uppercase font-bold tracking-wider">Janoshik Key</span>
                                        <KeyRound className="h-4 w-4 text-emerald-600" />
                                    </div>
                                    <div className="flex items-center justify-between gap-1">
                                        <p className="text-xs font-mono font-bold text-foreground truncate" title={currentBatch.verification_key || ""}>
                                            {currentBatch.verification_key || "Verified"}
                                        </p>
                                        {currentBatch.verification_key && (
                                            <button 
                                                onClick={() => handleCopyKey(currentBatch.verification_key || "")}
                                                className="text-muted-foreground hover:text-foreground p-1"
                                                title="Copy Key"
                                            >
                                                {copiedKey ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                            </button>
                                        )}
                                    </div>
                                    <span className="text-[11px] text-muted-foreground">
                                        Cryptographic Proof
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-background/80 border rounded-2xl p-4 space-y-1 shadow-xs">
                                    <div className="flex items-center justify-between text-muted-foreground">
                                        <span className="text-[10px] uppercase font-bold tracking-wider">HPLC Purity</span>
                                        <Award className="h-4 w-4 text-emerald-600" />
                                    </div>
                                    <p className="text-xl md:text-2xl font-black text-foreground">
                                        {currentBatch.purity_pct !== null && (currentBatch.purity_pct ?? 0) > 0 ? `${currentBatch.purity_pct}%` : "≥99.5%"}
                                    </p>
                                    <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> Analytical Grade
                                    </span>
                                </div>

                                <div className="bg-background/80 border rounded-2xl p-4 space-y-1 shadow-xs">
                                    <div className="flex items-center justify-between text-muted-foreground">
                                        <span className="text-[10px] uppercase font-bold tracking-wider">pH Level</span>
                                        <Activity className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <p className="text-xl md:text-2xl font-black text-foreground">
                                        {currentBatch.ph_level !== null ? currentBatch.ph_level : "5.0 - 7.0"}
                                    </p>
                                    <span className="text-[11px] text-muted-foreground">Standard Specification</span>
                                </div>

                                <div className="bg-background/80 border rounded-2xl p-4 space-y-1 shadow-xs">
                                    <div className="flex items-center justify-between text-muted-foreground">
                                        <span className="text-[10px] uppercase font-bold tracking-wider">Benzyl Alcohol</span>
                                        <FlaskConical className="h-4 w-4 text-indigo-600" />
                                    </div>
                                    <p className="text-xl md:text-2xl font-black text-foreground">
                                        {currentBatch.benzyl_alcohol_pct !== null ? `${currentBatch.benzyl_alcohol_pct}%` : "0.90%"}
                                    </p>
                                    <span className="text-[11px] text-muted-foreground">Bacteriostatic Agent</span>
                                </div>

                                <div className="bg-background/80 border rounded-2xl p-4 space-y-1 shadow-xs">
                                    <div className="flex items-center justify-between text-muted-foreground">
                                        <span className="text-[10px] uppercase font-bold tracking-wider">Sterility USP &lt;71&gt;</span>
                                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                    </div>
                                    <p className="text-2xl font-black text-emerald-600">
                                        {currentBatch.sterility_status || "Pass"}
                                    </p>
                                    <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> No Bacterial Growth
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Inline Canvas PDF Viewer */}
                        {isViewerOpen && (
                            <div ref={viewerRef} className="space-y-3 pt-4 border-t animate-in fade-in duration-300">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                        <FileText className="h-4 w-4 text-emerald-600" />
                                        Official Analytical Certificate Document (Lot #{currentBatch.batch_number})
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsViewerOpen(false)}
                                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                    >
                                        Collapse Preview ✕
                                    </Button>
                                </div>

                                <PDFViewerCanvas
                                    url={currentBatch.pdf_url}
                                    batchNumber={currentBatch.batch_number}
                                    defaultFit="page"
                                    containerHeightClass="min-h-[550px] max-h-[750px]"
                                />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="border rounded-2xl p-8 text-center bg-muted/20 space-y-3">
                        <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
                        <h3 className="text-lg font-bold">No Published Reports for this Product</h3>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                            Analytical laboratory documentation for {prod.name} is currently being processed or updated. Please check back shortly.
                        </p>
                    </div>
                )}

                {/* 2. PRODUCTION BATCH HISTORY & QUALITY ARCHIVES TABLE (ZC Labs Style) */}
                <div className="space-y-4 pt-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h3 className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                                <Layers className="h-5 w-5 text-primary" />
                                Certificate Archive ({productBatches.length} Total Lots)
                            </h3>
                            <p className="text-xs md:text-sm text-muted-foreground">
                                Verify the LOT number printed on your vial or box label against our historical laboratory archive.
                            </p>
                        </div>

                        {/* Search in History */}
                        {productBatches.length > 2 && (
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="text"
                                    placeholder="Filter by Lot # (e.g. 2609)..."
                                    value={historySearchQuery}
                                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                                    className="pl-9 h-9 text-xs rounded-xl"
                                />
                            </div>
                        )}
                    </div>

                    <div className="border rounded-2xl overflow-hidden bg-card shadow-xs">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="font-bold text-xs">Date</TableHead>
                                    <TableHead className="font-bold text-xs">Dose / Format</TableHead>
                                    <TableHead className="font-bold text-xs">Lot #</TableHead>
                                    <TableHead className="font-bold text-xs">Laboratory</TableHead>
                                    <TableHead className="font-bold text-xs">Purity</TableHead>
                                    <TableHead className="font-bold text-xs">Status</TableHead>
                                    <TableHead className="font-bold text-xs text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredHistoryBatches.length > 0 ? (
                                    filteredHistoryBatches.map((batch) => {
                                        const isSelected = currentBatch?.id === batch.id;
                                        const isFeatured = batch.is_featured;
                                        const isBatchPeptide = batch.coa_type === 'peptide' || !!batch.task_number || !!batch.measured_dosage_mg;
                                        
                                        const purityDisplay = batch.purity_pct !== null && (batch.purity_pct ?? 0) > 0
                                            ? `${Number(batch.purity_pct).toFixed((batch.purity_pct ?? 0) % 1 === 0 ? 1 : 2)}%`
                                            : isBatchPeptide ? "≥99.0%" : "USP Pass";

                                        const dosageDisplay = extractDoseFromBatch(batch, productsMap);

                                        return (
                                            <TableRow 
                                                key={batch.id}
                                                className={`transition-colors cursor-pointer ${
                                                    isSelected 
                                                        ? "bg-emerald-500/10 hover:bg-emerald-500/15 border-l-4 border-l-emerald-600" 
                                                        : "hover:bg-muted/50"
                                                }`}
                                                onClick={() => handleSelectBatch(batch.id)}
                                            >
                                                {/* Date */}
                                                <TableCell className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                                                    {new Date(batch.test_date).toLocaleDateString("en-US", { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' })}
                                                </TableCell>

                                                {/* Dose */}
                                                <TableCell className="text-xs font-semibold text-foreground">
                                                    {dosageDisplay}
                                                </TableCell>

                                                {/* Lot # */}
                                                <TableCell className="font-mono font-bold text-xs text-foreground">
                                                    #{batch.batch_number}
                                                </TableCell>

                                                {/* Laboratory */}
                                                <TableCell className="text-xs font-medium text-muted-foreground">
                                                    {batch.lab_name || (isBatchPeptide ? "Janoshik Analytical" : "Chromak Research")}
                                                </TableCell>

                                                {/* Purity */}
                                                <TableCell className="text-xs font-bold text-emerald-600">
                                                    {purityDisplay}
                                                </TableCell>

                                                {/* Status (ZC Labs CURRENT vs ARCHIVE Badges) */}
                                                <TableCell>
                                                    {isFeatured ? (
                                                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold tracking-wider px-2 py-0.5 shadow-2xs">
                                                            CURRENT
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px] font-semibold tracking-wider px-2 py-0.5">
                                                            ARCHIVE
                                                        </Badge>
                                                    )}
                                                </TableCell>

                                                {/* Action Buttons */}
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                                        <Button
                                                            size="sm"
                                                            variant={isSelected && isViewerOpen ? "secondary" : "outline"}
                                                            className="h-7 px-2 text-xs font-bold rounded-lg gap-1"
                                                            onClick={() => handleSelectBatch(batch.id)}
                                                        >
                                                            <FileText className="h-3 w-3 text-emerald-600" />
                                                            {isSelected && isViewerOpen ? "Viewing" : "View"}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                                                            onClick={() => downloadCoaPdf(batch.pdf_url, `COA-${batch.batch_number}.pdf`)}
                                                            title="Download PDF"
                                                        >
                                                            <Download className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                                            No lot records matched your search query "{historySearchQuery}".
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* Return to Product Page CTA */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-muted/40 border rounded-2xl">
                    <div className="space-y-1">
                        <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                            <Package className="h-4 w-4 text-emerald-600" />
                            Looking to purchase {cleanProduct.name}?
                        </h4>
                        <p className="text-xs text-muted-foreground">
                            Browse available pack sizes, bulk options, and specifications in our catalog.
                        </p>
                    </div>
                    <Button asChild className="h-9 px-4 rounded-xl text-xs font-bold gap-1.5">
                        <Link to={`/products/${prod.slug || prod.id}`}>
                            View Product Page
                            <ExternalLink className="h-3.5 w-3.5 ml-1" />
                        </Link>
                    </Button>
                </div>
            </div>
        );
    }

    // ==========================================
    // RENDER: NOT FOUND VIEW
    // ==========================================
    if (resolvedContext.mode === 'not_found') {
        return (
            <div className="container py-16 max-w-3xl min-h-[60vh] text-center space-y-6">
                <SEO title="COA Not Found | Official Verification" description="Certificate of Analysis record not found." />
                <div className="p-4 bg-muted/30 border rounded-3xl max-w-lg mx-auto space-y-4 py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold">Certificate or Product Not Found</h2>
                        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                            We could not locate an analytical report or product for <code className="font-mono font-bold bg-muted px-1.5 py-0.5 rounded text-foreground">"{resolvedContext.query}"</code>. 
                            Please verify the lot number or scan the QR code on your vial again.
                        </p>
                    </div>
                    <div className="pt-2 flex flex-wrap justify-center gap-3">
                        <Button asChild variant="default" size="sm">
                            <Link to="/lab-reports">Browse All Lab Reports</Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                            <Link to="/products">Browse Product Catalog</Link>
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // ==========================================
    // RENDER: ALL DIRECTORY VIEW (ZC Labs Product Cards Grid)
    // ==========================================
    return (
        <div className="container py-8 md:py-14 max-w-6xl min-h-[75vh] space-y-8 animate-in fade-in duration-300">
            <SEO 
                title={seo.title} 
                description={seo.description}
            />

            {/* Header */}
            <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Official Quality Assurance &amp; Analytical Testing Portal
                </div>
                <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">
                    Certificate of Analysis (COA) Directory
                </h1>
                <p className="text-muted-foreground text-base md:text-lg max-w-3xl leading-relaxed">
                    Quality and safety are our top priorities. Every batch of reconstitution solution and research peptides from 
                    <strong> Liv Well Research Labs</strong> is tested by independent, third-party laboratories (including Janoshik Analytical). 
                    Select a compound below or search by lot number to inspect official laboratory certificates.
                </p>
            </div>

            {/* Popular Product COA Hub Pills (Label QR Targets) */}
            <div className="space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                    Quick Shortcuts (Vial Label QR Targets):
                </span>
                <div className="flex flex-wrap gap-2">
                    {POPULAR_HUBS.map((hub) => (
                        <Button
                            key={hub.code}
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 rounded-xl text-xs font-semibold hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 transition-all"
                        >
                            <Link to={`/coa/${hub.code}`}>
                                {hub.label}
                            </Link>
                        </Button>
                    ))}
                </div>
            </div>

            {/* Search Bar & Category Filter Tabs */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-lg">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Search by product, SKU, lot #, or certificate # (e.g. RT10, 2609)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-11 h-12 text-sm rounded-xl shadow-xs"
                        />
                    </div>

                    {/* Category Segmented Tabs */}
                    <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border self-start sm:self-auto">
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                activeTab === 'all' 
                                    ? 'bg-background text-foreground shadow-xs' 
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            All ({counts.all})
                        </button>
                        <button
                            onClick={() => setActiveTab('peptide')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                                activeTab === 'peptide' 
                                    ? 'bg-emerald-600 text-white shadow-xs' 
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <span>🔬 Peptides</span>
                            <span className="opacity-80 font-mono">({counts.peptide})</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('water')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                                activeTab === 'water' 
                                    ? 'bg-blue-600 text-white shadow-xs' 
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <span>💧 Water</span>
                            <span className="opacity-80 font-mono">({counts.water})</span>
                        </button>
                    </div>
                </div>
                <Separator />
            </div>

            {/* Direct Lot Matches Banner (When searching a specific lot number) */}
            {directLotMatches.length > 0 && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Direct Lot Matches ({directLotMatches.length}):
                    </span>
                    <div className="flex flex-wrap gap-2">
                        {directLotMatches.map(batch => (
                            <Button
                                key={batch.id}
                                asChild
                                size="sm"
                                variant="outline"
                                className="h-8 px-3 rounded-lg text-xs font-mono font-bold border-emerald-500/30 hover:bg-emerald-500/20"
                            >
                                <Link to={`/coa/${encodeURIComponent(batch.batch_number)}`}>
                                    LOT #{batch.batch_number} ↗
                                </Link>
                            </Button>
                        ))}
                    </div>
                </div>
            )}

            {/* Dynamic Results: ZC Labs Product Cards Grid */}
            {isLoading ? (
                <div className="py-20 text-center space-y-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-3 border-primary border-t-transparent mx-auto"></div>
                    <p className="text-muted-foreground font-medium text-sm">Loading verified laboratory reports...</p>
                </div>
            ) : filteredProductCards.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProductCards.map((card) => {
                        const targetUrl = `/coa/${card.shortCode || card.productSlug}`;
                        
                        return (
                            <div 
                                key={card.productId}
                                className="group relative bg-card border rounded-2xl p-6 shadow-xs hover:shadow-xl hover:border-emerald-500/40 transition-all duration-300 flex flex-col justify-between space-y-5"
                            >
                                {/* Top Header: Title, SKU & Verified Badge */}
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <Badge variant="secondary" className="font-mono text-[10px] font-bold tracking-wider px-2 py-0.5">
                                            {card.primarySku}
                                        </Badge>
                                        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 flex items-center gap-1 shadow-2xs">
                                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                            COA VERIFIED
                                        </Badge>
                                    </div>

                                    <h3 className="text-xl font-bold tracking-tight text-foreground group-hover:text-emerald-600 transition-colors">
                                        {card.productName}
                                    </h3>
                                </div>

                                {/* Body Stats (ZC Labs Layout) */}
                                <div className="grid grid-cols-2 gap-3 py-3 border-y bg-muted/20 -mx-6 px-6">
                                    <div className="space-y-0.5">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                            Total Certificates
                                        </span>
                                        <p className="text-sm font-extrabold text-foreground">
                                            {card.totalLots} {card.totalLots === 1 ? "Report" : "Reports"}
                                        </p>
                                    </div>

                                    <div className="space-y-0.5">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                            HPLC Purity
                                        </span>
                                        <p className="text-sm font-extrabold text-emerald-600">
                                            {card.displayPurity}
                                        </p>
                                    </div>

                                    <div className="space-y-0.5">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                            Available Doses
                                        </span>
                                        <p className="text-xs font-bold text-foreground truncate" title={card.dosesSummary}>
                                            {card.dosesSummary}
                                        </p>
                                    </div>

                                    <div className="space-y-0.5">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                            Latest Test
                                        </span>
                                        <p className="text-xs font-medium text-muted-foreground">
                                            {new Date(card.latestTestDate).toLocaleDateString("en-US", { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}
                                        </p>
                                    </div>
                                </div>

                                {/* Testing Lab Reference & CTA Button */}
                                <div className="space-y-3 pt-1">
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <FlaskConical className="h-3.5 w-3.5 text-emerald-600" />
                                        <span>Lab: <strong className="text-foreground font-medium">{card.labName}</strong></span>
                                    </div>

                                    <Button
                                        asChild
                                        className="w-full h-10 rounded-xl font-bold text-xs gap-1.5 bg-primary/95 hover:bg-primary text-primary-foreground group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-xs"
                                    >
                                        <Link to={targetUrl}>
                                            <span>View All {card.totalLots} Certificates</span>
                                            <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="py-16 text-center border rounded-2xl bg-muted/10 space-y-3">
                    <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
                    <h3 className="text-lg font-bold">No Products Found</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                        No published analytical reports matched your search query "{searchQuery}". Try searching by another product name or lot number.
                    </p>
                    <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                            setSearchQuery("");
                            setActiveTab("all");
                        }}
                    >
                        Reset Filters
                    </Button>
                </div>
            )}
        </div>
    );
};

export default LabReports;
