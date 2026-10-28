import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Droplets, FlaskConical, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export interface TopProduct {
    name: string;
    quantity: number;
    revenue: number;
    vials?: number;
    category?: "water" | "peptide";
    distinctOrders?: number;
}

export interface CategorySummary {
    waterVials: number;
    waterRevenue: number;
    peptideVials: number;
    peptideRevenue: number;
    totalVials: number;
}

interface TopProductsListProps {
    products: TopProduct[];
    periodLabel?: string;
    categorySummary?: CategorySummary;
}

const TopProductsList = ({ products, periodLabel, categorySummary }: TopProductsListProps) => {
    const [selectedTab, setSelectedTab] = useState<"all" | "water" | "peptide">("all");

    const filtered = products.filter(p => {
        if (selectedTab === "all") return true;
        const isWater = p.category === "water" || p.name.toLowerCase().includes("water") || p.name.toLowerCase().includes("reconstitution");
        if (selectedTab === "water") return isWater;
        return !isWater;
    });

    return (
        <Card className="col-span-1">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-yellow-500" />
                        Top Products
                    </CardTitle>
                    {periodLabel && (
                        <span className="text-xs text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded">
                            {periodLabel}
                        </span>
                    )}
                </div>

                {/* Category quick badges */}
                {categorySummary && (
                    <div className="grid grid-cols-2 gap-2 pt-2">
                        <div className="bg-sky-500/10 border border-sky-500/20 rounded-md p-2 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300">
                                <Droplets className="h-3.5 w-3.5 text-sky-500" />
                                <span>Water Vials:</span>
                            </div>
                            <span className="font-bold text-xs text-sky-700 dark:text-sky-300">
                                {categorySummary.waterVials.toLocaleString()}
                            </span>
                        </div>
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-md p-2 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300">
                                <FlaskConical className="h-3.5 w-3.5 text-purple-600" />
                                <span>Peptide Vials:</span>
                            </div>
                            <span className="font-bold text-xs text-purple-700 dark:text-purple-300">
                                {categorySummary.peptideVials.toLocaleString()}
                            </span>
                        </div>
                    </div>
                )}

                {/* Sub-filter tabs */}
                <div className="flex items-center gap-1 pt-2">
                    <Button
                        variant={selectedTab === "all" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setSelectedTab("all")}
                        className="h-7 text-xs px-2.5"
                    >
                        All
                    </Button>
                    <Button
                        variant={selectedTab === "water" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setSelectedTab("water")}
                        className={`h-7 text-xs px-2.5 ${selectedTab === "water" ? "bg-sky-600 hover:bg-sky-700 text-white" : "text-sky-600"}`}
                    >
                        💧 Water
                    </Button>
                    <Button
                        variant={selectedTab === "peptide" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setSelectedTab("peptide")}
                        className={`h-7 text-xs px-2.5 ${selectedTab === "peptide" ? "bg-purple-600 hover:bg-purple-700 text-white" : "text-purple-600"}`}
                    >
                        🧪 Peptides
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {filtered.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">No sales data for this category.</p>
                    ) : (
                        filtered.slice(0, 6).map((product, index) => {
                            const isWater = product.category === "water" || product.name.toLowerCase().includes("water") || product.name.toLowerCase().includes("reconstitution");
                            const vials = product.vials || product.quantity;

                            return (
                                <div key={index} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0 last:pb-0">
                                    <div className="space-y-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-[11px] text-muted-foreground font-mono">{index + 1}.</span>
                                            <p className="text-sm font-medium leading-none truncate max-w-[180px] sm:max-w-[220px]">
                                                {product.name}
                                            </p>
                                            {product.sku && product.sku !== "N/A" && product.sku !== "NO-SKU" && (
                                                <Badge variant="outline" className="font-mono text-[9px] px-1 py-0 h-3.5 bg-muted/40 text-muted-foreground shrink-0">
                                                    {product.sku}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-3.5">
                                            <span>{product.quantity} {product.quantity === 1 ? "pack" : "packs"}</span>
                                            {vials !== product.quantity && (
                                                <>
                                                    <span>•</span>
                                                    <span className={`font-semibold ${isWater ? "text-sky-600 dark:text-sky-400" : "text-purple-600 dark:text-purple-400"}`}>
                                                        {vials} vials
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="font-semibold text-sm">
                                            ${product.revenue.toFixed(2)}
                                        </div>
                                        <span
                                            className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border whitespace-nowrap ${
                                                isWater
                                                    ? "border-sky-300 text-sky-700 bg-sky-50 dark:bg-sky-950/20"
                                                    : "border-purple-300 text-purple-700 bg-purple-50 dark:bg-purple-950/20"
                                            }`}
                                        >
                                            {isWater ? <Droplets className="h-2.5 w-2.5 text-sky-600" /> : <FlaskConical className="h-2.5 w-2.5 text-purple-600" />}
                                            <span>{isWater ? "Water" : "Peptide"}</span>
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="pt-4 mt-2 border-t text-center">
                    <Link
                        to="/manufacturing/analytics?tab=sales"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                        View full vials & sales report
                        <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
};

export default TopProductsList;
