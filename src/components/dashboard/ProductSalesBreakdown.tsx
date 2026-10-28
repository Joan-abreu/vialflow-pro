import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    FlaskConical,
    Droplets,
    Package,
    Search,
    Download,
    TrendingUp,
    DollarSign,
    Barcode,
    X,
} from "lucide-react";
import { format } from "date-fns";

export interface ProductSalesItem {
    id: string;
    sku: string;
    name: string;
    category: "water" | "peptide";
    categoryLabel: string;
    packsSold: number;
    vialsSold: number;
    revenue: number;
    distinctOrders: number;
    avgVialsPerPack: number;
}

export interface ProductSalesBreakdownProps {
    items: ProductSalesItem[];
    periodLabel?: string;
    isLoading?: boolean;
}

export function ProductSalesBreakdown({ items, periodLabel, isLoading }: ProductSalesBreakdownProps) {
    const [categoryFilter, setCategoryFilter] = useState<"all" | "water" | "peptide">("all");
    const [skuFilter, setSkuFilter] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [sortBy, setSortBy] = useState<"vials" | "packs" | "revenue" | "sku" | "name">("vials");

    // Extract unique available SKUs for dropdown filter
    const availableSkus = useMemo(() => {
        const skuSet = new Set<string>();
        items.forEach(item => {
            if (item.sku && item.sku !== "N/A" && item.sku !== "NO-SKU") {
                skuSet.add(item.sku);
            }
        });
        return Array.from(skuSet).sort();
    }, [items]);

    // Aggregate overall KPI metrics
    const totals = useMemo(() => {
        let totalPacks = 0;
        let totalVials = 0;
        let totalRevenue = 0;

        let waterPacks = 0;
        let waterVials = 0;
        let waterRevenue = 0;

        let peptidePacks = 0;
        let peptideVials = 0;
        let peptideRevenue = 0;

        items.forEach(p => {
            totalPacks += p.packsSold;
            totalVials += p.vialsSold;
            totalRevenue += p.revenue;

            if (p.category === "water") {
                waterPacks += p.packsSold;
                waterVials += p.vialsSold;
                waterRevenue += p.revenue;
            } else {
                peptidePacks += p.packsSold;
                peptideVials += p.vialsSold;
                peptideRevenue += p.revenue;
            }
        });

        return {
            totalPacks,
            totalVials,
            totalRevenue,
            waterPacks,
            waterVials,
            waterRevenue,
            peptidePacks,
            peptideVials,
            peptideRevenue,
            waterVialShare: totalVials > 0 ? ((waterVials / totalVials) * 100).toFixed(1) : "0",
            peptideVialShare: totalVials > 0 ? ((peptideVials / totalVials) * 100).toFixed(1) : "0",
            peptideRevShare: totalRevenue > 0 ? ((peptideRevenue / totalRevenue) * 100).toFixed(1) : "0",
        };
    }, [items]);

    // Filtered & Sorted items
    const filteredItems = useMemo(() => {
        return items
            .filter(item => {
                // Category filter
                if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
                
                // SKU specific filter
                if (skuFilter !== "all" && item.sku !== skuFilter) return false;

                // Search query filter (matches both product name and SKU)
                if (searchTerm.trim() !== "") {
                    const term = searchTerm.toLowerCase();
                    const matchesName = item.name.toLowerCase().includes(term);
                    const matchesSku = item.sku.toLowerCase().includes(term);
                    return matchesName || matchesSku;
                }
                return true;
            })
            .sort((a, b) => {
                if (sortBy === "vials") return b.vialsSold - a.vialsSold;
                if (sortBy === "packs") return b.packsSold - a.packsSold;
                if (sortBy === "revenue") return b.revenue - a.revenue;
                if (sortBy === "sku") return a.sku.localeCompare(b.sku);
                if (sortBy === "name") return a.name.localeCompare(b.name);
                return 0;
            });
    }, [items, categoryFilter, skuFilter, searchTerm, sortBy]);

    // CSV Export
    const handleExportCSV = () => {
        const headers = ["Rank", "SKU", "Product Name", "Category", "Packs Sold", "Total Vials Sold", "Revenue ($)", "Distinct Orders", "Avg Vials Per Pack"];
        const rows = filteredItems.map((p, idx) => [
            idx + 1,
            `"${(p.sku || 'N/A').replace(/"/g, '""')}"`,
            `"${p.name.replace(/"/g, '""')}"`,
            p.categoryLabel,
            p.packsSold,
            p.vialsSold,
            p.revenue.toFixed(2),
            p.distinctOrders,
            p.avgVialsPerPack.toFixed(1)
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `product_sales_vials_${format(new Date(), "yyyy-MM-dd")}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Total Physical Vials */}
                <Card className="border shadow-xs bg-linear-to-br from-card to-muted/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">Total Physical Vials Sold</CardTitle>
                        <Package className="h-5 w-5 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black tracking-tight text-foreground">
                            {totals.totalVials.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">vials</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                            <span className="font-semibold text-foreground">{totals.totalPacks.toLocaleString()}</span> total packs fulfilled
                        </p>
                    </CardContent>
                </Card>

                {/* Card 2: Water Vials */}
                <Card className="border shadow-xs bg-sky-500/5 border-sky-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                            <CardTitle className="text-sm font-semibold text-sky-700 dark:text-sky-300">Water / Reconstitution</CardTitle>
                            <span className="text-[11px] text-sky-600/80 font-medium">Bac Water Vials</span>
                        </div>
                        <Droplets className="h-5 w-5 text-sky-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-sky-700 dark:text-sky-300">
                            {totals.waterVials.toLocaleString()} <span className="text-sm font-medium opacity-80">vials</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                            <span className="font-semibold text-sky-600">{totals.waterPacks.toLocaleString()}</span> packs • <span className="font-semibold text-foreground">${totals.waterRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </p>
                        <div className="mt-2 text-[11px] text-sky-700/80 dark:text-sky-400 font-medium bg-sky-500/10 px-2 py-0.5 rounded w-fit">
                            {totals.waterVialShare}% of total physical vial volume
                        </div>
                    </CardContent>
                </Card>

                {/* Card 3: Peptide Vials */}
                <Card className="border shadow-xs bg-purple-500/5 border-purple-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                            <CardTitle className="text-sm font-semibold text-purple-700 dark:text-purple-300">Research Peptides</CardTitle>
                            <span className="text-[11px] text-purple-600/80 font-medium">Peptide Vials Sold</span>
                        </div>
                        <FlaskConical className="h-5 w-5 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-purple-700 dark:text-purple-300">
                            {totals.peptideVials.toLocaleString()} <span className="text-sm font-medium opacity-80">vials</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                            <span className="font-semibold text-purple-600">{totals.peptidePacks.toLocaleString()}</span> units • <span className="font-semibold text-foreground">${totals.peptideRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </p>
                        <div className="mt-2 text-[11px] text-purple-700/80 dark:text-purple-400 font-medium bg-purple-500/10 px-2 py-0.5 rounded w-fit">
                            {totals.peptideRevShare}% of total product revenue
                        </div>
                    </CardContent>
                </Card>

                {/* Card 4: Total Revenue */}
                <Card className="border shadow-xs bg-emerald-500/5 border-emerald-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                            <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Product Revenue</CardTitle>
                            <span className="text-[11px] text-emerald-600/80 font-medium">Net Product Sales (Excl. Shipping)</span>
                        </div>
                        <DollarSign className="h-5 w-5 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-emerald-700 dark:text-emerald-300">
                            ${totals.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                            Avg. revenue per vial: <span className="font-semibold text-foreground">${totals.totalVials > 0 ? (totals.totalRevenue / totals.totalVials).toFixed(2) : "0.00"}</span>
                        </p>
                        <div className="mt-2 text-[11px] text-emerald-700/80 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded w-fit">
                            {items.length} variants / SKUs tracked
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Interactive Table Section */}
            <Card className="border shadow-xs">
                <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-primary" />
                                Product Sales & Physical Vials Breakdown
                            </CardTitle>
                            <CardDescription>
                                Track sales by SKU, variant pack sizes, and total individual vials {periodLabel && `(${periodLabel})`}
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExportCSV}
                                className="h-9 gap-1.5 font-medium"
                                disabled={filteredItems.length === 0}
                            >
                                <Download className="h-4 w-4" />
                                Export CSV
                            </Button>
                        </div>
                    </div>

                    {/* Filter and Search Bar */}
                    <div className="pt-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 border-t">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <Button
                                size="sm"
                                variant={categoryFilter === "all" ? "default" : "outline"}
                                onClick={() => setCategoryFilter("all")}
                                className="h-8 text-xs font-semibold gap-1.5"
                            >
                                All Products
                                <span className="ml-1 inline-flex items-center justify-center text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-muted-foreground/15 text-foreground leading-none">
                                    {items.length}
                                </span>
                            </Button>
                            <Button
                                size="sm"
                                variant={categoryFilter === "water" ? "default" : "outline"}
                                onClick={() => setCategoryFilter("water")}
                                className={`h-8 text-xs font-semibold gap-1.5 ${categoryFilter === "water" ? "bg-sky-600 hover:bg-sky-700 text-white" : "text-sky-700 dark:text-sky-300 border-sky-300"}`}
                            >
                                <Droplets className="h-3.5 w-3.5" />
                                💧 Water ({items.filter(i => i.category === "water").length})
                            </Button>
                            <Button
                                size="sm"
                                variant={categoryFilter === "peptide" ? "default" : "outline"}
                                onClick={() => setCategoryFilter("peptide")}
                                className={`h-8 text-xs font-semibold gap-1.5 ${categoryFilter === "peptide" ? "bg-purple-600 hover:bg-purple-700 text-white" : "text-purple-700 dark:text-purple-300 border-purple-300"}`}
                            >
                                <FlaskConical className="h-3.5 w-3.5" />
                                🧪 Peptides ({items.filter(i => i.category === "peptide").length})
                            </Button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {/* SKU Filter Dropdown */}
                            <div className="flex items-center gap-1.5">
                                <Select value={skuFilter} onValueChange={setSkuFilter}>
                                    <SelectTrigger className="h-8 text-xs w-[170px] font-mono">
                                        <Barcode className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                                        <SelectValue placeholder="Filter by SKU" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-64 font-mono text-xs">
                                        <SelectItem value="all">All SKUs ({availableSkus.length})</SelectItem>
                                        {availableSkus.map(sku => (
                                            <SelectItem key={sku} value={sku}>
                                                {sku}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {skuFilter !== "all" && (
                                    <Badge
                                        variant="secondary"
                                        className="h-8 px-2 text-xs font-mono font-bold flex items-center gap-1 cursor-pointer bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                                        onClick={() => setSkuFilter("all")}
                                        title="Click to clear SKU filter"
                                    >
                                        {skuFilter}
                                        <X className="h-3 w-3" />
                                    </Badge>
                                )}
                            </div>

                            {/* Search by Name or SKU */}
                            <div className="relative w-full sm:w-56">
                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Search name or SKU..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="h-8 text-xs pl-8 font-medium"
                                />
                            </div>

                            {/* Sort Dropdown */}
                            <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                                <SelectTrigger className="h-8 text-xs w-[140px]">
                                    <SelectValue placeholder="Sort by" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="vials">Vials (High to Low)</SelectItem>
                                    <SelectItem value="packs">Packs (High to Low)</SelectItem>
                                    <SelectItem value="revenue">Revenue (High to Low)</SelectItem>
                                    <SelectItem value="sku">SKU (A-Z)</SelectItem>
                                    <SelectItem value="name">Product Name (A-Z)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="py-16 text-center text-sm text-muted-foreground">
                            Loading sales breakdown...
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="py-16 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
                            <Package className="h-8 w-8 text-muted-foreground/40" />
                            <p className="font-semibold text-foreground">No product sales found</p>
                            <p className="text-xs text-muted-foreground">Try adjusting your SKU filter, search query, or date range.</p>
                            {(skuFilter !== "all" || searchTerm !== "" || categoryFilter !== "all") && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSkuFilter("all");
                                        setSearchTerm("");
                                        setCategoryFilter("all");
                                    }}
                                    className="mt-2 text-xs h-7"
                                >
                                    Reset Filters
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="rounded-md border-t overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/40">
                                        <TableHead className="w-12 text-center font-bold">#</TableHead>
                                        <TableHead className="font-bold min-w-[130px]">SKU</TableHead>
                                        <TableHead className="font-bold min-w-[260px]">Product</TableHead>
                                        <TableHead className="font-bold">Category</TableHead>
                                        <TableHead className="font-bold text-center">Packs Sold</TableHead>
                                        <TableHead className="font-bold text-center bg-primary/5">
                                            Total Physical Vials
                                        </TableHead>
                                        <TableHead className="font-bold text-right">Revenue ($)</TableHead>
                                        <TableHead className="font-bold text-center">Orders</TableHead>
                                        <TableHead className="font-bold text-right">% Share</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredItems.map((item, idx) => {
                                        const share = totals.totalVials > 0
                                            ? ((item.vialsSold / totals.totalVials) * 100).toFixed(1)
                                            : "0.0";
                                        const isWater = item.category === "water";
                                        const hasSku = item.sku && item.sku !== "N/A" && item.sku !== "NO-SKU";

                                        return (
                                            <TableRow key={item.id} className="hover:bg-muted/30">
                                                <TableCell className="font-mono text-xs text-muted-foreground text-center">
                                                    {idx + 1}
                                                </TableCell>
                                                <TableCell>
                                                    {hasSku ? (
                                                        <Badge
                                                            variant="outline"
                                                            className="font-mono text-xs font-bold bg-muted/50 hover:bg-primary/10 hover:text-primary hover:border-primary/40 cursor-pointer transition-colors"
                                                            onClick={() => setSkuFilter(item.sku)}
                                                            title={`Filter by SKU: ${item.sku}`}
                                                        >
                                                            {item.sku}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground/60 italic font-mono">
                                                            N/A
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-semibold text-sm">
                                                    <div className="flex flex-col">
                                                        <span className="text-foreground font-medium leading-snug">{item.name}</span>
                                                        {item.avgVialsPerPack > 1 && (
                                                            <span className="text-[11px] text-muted-foreground font-normal">
                                                                Pack of {item.avgVialsPerPack} vials per unit
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    <div
                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap border ${
                                                            isWater
                                                                ? "border-sky-300 bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:border-sky-800 dark:text-sky-300"
                                                                : "border-purple-300 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-300"
                                                        }`}
                                                    >
                                                        {isWater ? (
                                                            <Droplets className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
                                                        ) : (
                                                            <FlaskConical className="h-3.5 w-3.5 shrink-0 text-purple-600 dark:text-purple-400" />
                                                        )}
                                                        <span className="font-medium">{isWater ? "Water" : "Peptide"}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center font-medium text-sm">
                                                    {item.packsSold.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-center font-bold text-sm bg-primary/5">
                                                    <Badge className={`text-xs px-2.5 py-0.5 font-bold ${isWater ? "bg-sky-600 hover:bg-sky-700 text-white" : "bg-purple-600 hover:bg-purple-700 text-white"}`}>
                                                        {item.vialsSold.toLocaleString()} vials
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-semibold text-sm">
                                                    ${item.revenue.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-center text-xs text-muted-foreground">
                                                    {item.distinctOrders}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                                    {share}%
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default ProductSalesBreakdown;
