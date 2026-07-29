import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ShoppingCart } from "lucide-react";

interface OrderVolumeTrendChartProps {
    data: { date: string; orders: number }[];
    periodLabel?: string;
}

const OrderVolumeTrendChart = ({ data, periodLabel }: OrderVolumeTrendChartProps) => {
    return (
        <Card className="col-span-1 lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-blue-600" />
                    <span>Order Volume Trend</span>
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                        ({periodLabel || "Selected Period"})
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="orderColor" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="date"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                allowDecimals={false}
                            />
                            <Tooltip
                                cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '3 3' }}
                                formatter={(value: number) => [`${value} Orders`, 'Volume']}
                            />
                            <Area
                                type="monotone"
                                dataKey="orders"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#orderColor)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
};

export default OrderVolumeTrendChart;
