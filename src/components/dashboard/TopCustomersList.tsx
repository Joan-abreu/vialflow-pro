import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface TopCustomer {
    name: string;
    email?: string;
    orderCount: number;
    totalSpent: number;
}

interface TopCustomersListProps {
    customers: TopCustomer[];
}

const TopCustomersList = ({ customers }: TopCustomersListProps) => {
    return (
        <Card className="col-span-1">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-indigo-500 fill-indigo-500" />
                    Top Customers
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {customers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No customer data available.</p>
                    ) : (
                        customers.map((c, index) => (
                            <div key={index} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9">
                                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                            {c.name ? c.name.charAt(0).toUpperCase() : "?"}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium leading-none">{c.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {c.orderCount} order{c.orderCount !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="font-medium text-right">
                                    <p className="text-sm">${c.totalSpent.toFixed(2)}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default TopCustomersList;
