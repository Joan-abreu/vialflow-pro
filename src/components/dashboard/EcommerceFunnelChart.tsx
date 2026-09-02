import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Filter, ArrowDown, TrendingUp, AlertTriangle, CheckCircle2, ShoppingCart, CreditCard, PackageCheck, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface FunnelStepData {
    step: string;
    label: string;
    count: number;
    icon: any;
    color: string;
}

interface EcommerceFunnelChartProps {
    viewsCount?: number;
    cartsCount?: number;
    checkoutsCount?: number;
    addressesCount?: number;
    shippingCount?: number;
    paymentCount?: number;
    ordersCount?: number;
    periodLabel?: string;
}

export default function EcommerceFunnelChart({
    viewsCount = 0,
    cartsCount = 0,
    checkoutsCount = 0,
    addressesCount = 0,
    shippingCount = 0,
    paymentCount = 0,
    ordersCount = 0,
    periodLabel = "Last 30 Days",
}: EcommerceFunnelChartProps) {

    const funnelSteps: FunnelStepData[] = useMemo(() => [
        {
            step: "views",
            label: "1. Product Views",
            count: viewsCount,
            icon: Eye,
            color: "bg-blue-500",
        },
        {
            step: "carts",
            label: "2. Added to Cart",
            count: cartsCount,
            icon: ShoppingCart,
            color: "bg-indigo-500",
        },
        {
            step: "checkouts",
            label: "3. Started Checkout",
            count: checkoutsCount,
            icon: CreditCard,
            color: "bg-purple-500",
        },
        {
            step: "addresses",
            label: "4. Address Entered",
            count: addressesCount,
            icon: PackageCheck,
            color: "bg-amber-500",
        },
        {
            step: "orders",
            label: "5. Completed Orders",
            count: ordersCount,
            icon: CheckCircle2,
            color: "bg-emerald-500",
        },
    ], [viewsCount, cartsCount, checkoutsCount, addressesCount, ordersCount]);

    const maxCount = Math.max(...funnelSteps.map(s => s.count), 1);
    const overallConversion = viewsCount > 0 ? ((ordersCount / viewsCount) * 100).toFixed(2) : "0.00";
    const cartToOrderConversion = cartsCount > 0 ? ((ordersCount / cartsCount) * 100).toFixed(1) : "0.0";

    return (
        <Card className="col-span-1 lg:col-span-2 shadow-xs border">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-2">
                <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Filter className="h-4 w-4 text-primary" />
                        <span>E-Commerce Conversion Funnel & Drop-Offs</span>
                    </CardTitle>
                    <CardDescription>
                        Visual path from first product discovery to completed checkout ({periodLabel})
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs font-bold">
                        🛒 Cart &rarr; Order: {cartToOrderConversion}%
                    </Badge>
                    <Badge variant="secondary" className="text-xs font-semibold">
                        Overall CVR: {overallConversion}%
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {funnelSteps.map((step, idx) => {
                        const prevStep = idx > 0 ? funnelSteps[idx - 1] : null;
                        const dropOff = prevStep && prevStep.count > 0 
                            ? Math.max(0, 100 - (step.count / prevStep.count) * 100)
                            : 0;
                        const percentageOfMax = Math.max(8, (step.count / maxCount) * 100);
                        const Icon = step.icon;

                        return (
                            <div key={step.step} className="space-y-1.5">
                                <div className="flex justify-between items-center text-xs">
                                    <div className="flex items-center gap-2 font-semibold text-foreground">
                                        <Icon className="h-4 w-4 text-muted-foreground" />
                                        <span>{step.label}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-sm text-foreground">
                                            {step.count.toLocaleString()}
                                        </span>
                                        {prevStep && prevStep.count > 0 && (
                                            <span className={`text-[11px] font-medium ${dropOff > 50 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                                ({dropOff > 0 ? `-${dropOff.toFixed(1)}% drop` : '100%'})
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="h-4 w-full bg-muted/50 rounded-full overflow-hidden flex items-center p-0.5">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-500 ${step.color}`}
                                        style={{ width: `${percentageOfMax}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
