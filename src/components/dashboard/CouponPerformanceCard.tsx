import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tag, TrendingUp, DollarSign, ShoppingCart, Percent, ArrowUpRight, Gift } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface CouponStatItem {
    code: string;
    uses: number;
    revenue: number;
    discount: number;
}

export interface CouponPerformanceStats {
    totalCouponOrders: number;
    totalOrders: number;
    adoptionRate: number;
    totalDiscountGiven: number;
    revenueWithCoupons: number;
    avgOrderWithCoupon: number;
    avgOrderWithoutCoupon: number;
    topCoupons: CouponStatItem[];
}

interface CouponPerformanceCardProps {
    stats: CouponPerformanceStats;
    periodLabel: string;
}

export default function CouponPerformanceCard({ stats, periodLabel }: CouponPerformanceCardProps) {
    const aovDiff = stats.avgOrderWithoutCoupon > 0 
        ? ((stats.avgOrderWithCoupon - stats.avgOrderWithoutCoupon) / stats.avgOrderWithoutCoupon) * 100 
        : 0;

    return (
        <Card className="flex flex-col h-full border-border/80 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <Tag className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            <span>Coupon & Promotion Performance</span>
                        </CardTitle>
                        <Badge variant="outline" className="text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300">
                            {periodLabel}
                        </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Impact of discount codes, promotions, and special offers on sales revenue
                    </p>
                </div>
                <Link to="/manufacturing/coupons">
                    <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary/80 gap-1 h-8 px-2 font-semibold">
                        <span>Manage</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                    </Button>
                </Link>
            </CardHeader>

            <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
                {/* 4 Core Promotion Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/30 dark:bg-muted/10 p-3 rounded-xl border border-border/50">
                    <div className="space-y-0.5">
                        <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                            <ShoppingCart className="h-3 w-3 text-primary" />
                            Coupon Orders
                        </span>
                        <div className="text-lg font-extrabold text-foreground">
                            {stats.totalCouponOrders}
                            <span className="text-[11px] font-medium text-muted-foreground ml-1 font-normal">
                                ({stats.adoptionRate.toFixed(1)}%)
                            </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground block truncate">
                            out of {stats.totalOrders} total orders
                        </span>
                    </div>

                    <div className="space-y-0.5">
                        <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                            <Percent className="h-3 w-3 text-emerald-600" />
                            Discounts Given
                        </span>
                        <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                            ${stats.totalDiscountGiven.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <span className="text-[10px] text-muted-foreground block truncate">
                            customer savings
                        </span>
                    </div>

                    <div className="space-y-0.5">
                        <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-sky-600" />
                            Coupon Sales
                        </span>
                        <div className="text-lg font-extrabold text-sky-600 dark:text-sky-400">
                            ${stats.revenueWithCoupons.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <span className="text-[10px] text-muted-foreground block truncate">
                            gross sales generated
                        </span>
                    </div>

                    <div className="space-y-0.5">
                        <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-amber-600" />
                            Average Order Value (AOV)
                        </span>
                        <div className="text-lg font-extrabold text-foreground flex items-center gap-1">
                            ${stats.avgOrderWithCoupon.toFixed(0)}
                            {aovDiff !== 0 && (
                                <span className={cn(
                                    "text-[10px] font-bold px-1 py-0.2 rounded",
                                    aovDiff > 0 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-100 text-rose-800"
                                )}>
                                    {aovDiff > 0 ? `+${aovDiff.toFixed(0)}%` : `${aovDiff.toFixed(0)}%`}
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] text-muted-foreground block truncate" title={`Without coupon: $${stats.avgOrderWithoutCoupon.toFixed(2)}`}>
                            vs ${stats.avgOrderWithoutCoupon.toFixed(0)} without coupon
                        </span>
                    </div>
                </div>

                {/* Top Coupons Breakdown List */}
                <div className="space-y-2 flex-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-1">
                        <span>Coupon Code</span>
                        <div className="flex items-center gap-6">
                            <span>Uses</span>
                            <span className="w-20 text-right">Sales ($)</span>
                            <span className="w-16 text-right">Discount</span>
                        </div>
                    </div>

                    {stats.topCoupons.length === 0 ? (
                        <div className="p-6 text-center rounded-lg border border-dashed border-border/80 bg-muted/20 space-y-2">
                            <Gift className="h-7 w-7 text-muted-foreground/60 mx-auto" />
                            <p className="text-xs font-medium text-foreground">
                                No coupons recorded in {periodLabel}
                            </p>
                            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                                Orders placed with promo codes or welcome discounts will appear here with their sales impact.
                            </p>
                            <Link to="/manufacturing/coupons">
                                <Button size="sm" variant="outline" className="text-xs h-7 mt-1">
                                    Create New Coupon &rarr;
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-1.5 divide-y divide-border/40">
                            {stats.topCoupons.map((c) => (
                                <div 
                                    key={c.code}
                                    className="flex items-center justify-between pt-1.5 first:pt-0 group hover:bg-muted/40 p-1.5 rounded-lg transition-colors"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Badge 
                                            variant="outline" 
                                            className="font-mono text-xs font-black bg-background border-emerald-300 text-emerald-700 dark:text-emerald-300 dark:border-emerald-700 shadow-2xs shrink-0"
                                        >
                                            {c.code}
                                        </Badge>
                                        <Link 
                                            to={`/manufacturing/orders?coupon=${encodeURIComponent(c.code)}`}
                                            className="text-[11px] text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-0.5 hover:underline truncate"
                                            title={`Filter orders by ${c.code}`}
                                        >
                                            <span>View orders</span>
                                            <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </Link>
                                    </div>

                                    <div className="flex items-center gap-6 text-xs shrink-0 font-medium">
                                        <span className="font-bold text-foreground">
                                            {c.uses} {c.uses === 1 ? "order" : "orders"}
                                        </span>
                                        <span className="w-20 text-right font-bold text-foreground">
                                            ${c.revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                        <span className="w-16 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                                            -${c.discount.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer link to Orders filtered by coupons */}
                <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-muted-foreground">
                        {stats.totalCouponOrders} orders with active promotions
                    </span>
                    <Link 
                        to="/manufacturing/orders?coupon=any_coupon"
                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                    >
                        <span>View all coupon orders &rarr;</span>
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}
