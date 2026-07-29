import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DollarSign } from "lucide-react";

interface RevenueTrendChartProps {
    data: { date: string; revenue: number }[];
    periodLabel?: string;
}

const RevenueTrendChart = ({ data, periodLabel }: RevenueTrendChartProps) => {
    return (
        <Card className="col-span-1 lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span>Revenue Trend</span>
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                        ({periodLabel || "Selected Period"})
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data}>
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
                                tickFormatter={(value) => `$${value}`}
                            />
                            <Tooltip
                                cursor={{ fill: 'rgba(22, 163, 74, 0.08)' }}
                                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                            />
                            <Bar
                                dataKey="revenue"
                                fill="#16a34a"
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
};

export default RevenueTrendChart;
