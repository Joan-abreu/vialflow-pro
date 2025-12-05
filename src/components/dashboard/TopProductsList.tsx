import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";

interface TopProduct {
    name: string;
    quantity: number;
    revenue: number;
}

interface TopProductsListProps {
    products: TopProduct[];
}

const TopProductsList = ({ products }: TopProductsListProps) => {
    return (
        <Card className="col-span-1">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Top Products
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {products.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No sales data available.</p>
                    ) : (
                        products.map((product, index) => (
                            <div key={index} className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium leading-none">{product.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {product.quantity} units sold
                                    </p>
                                </div>
                                <div className="font-medium">
                                    ${product.revenue.toFixed(2)}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default TopProductsList;
