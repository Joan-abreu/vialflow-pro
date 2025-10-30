import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Boxes, Truck, AlertTriangle } from "lucide-react";
import Layout from "@/components/Layout";

const Dashboard = () => {
  const [stats, setStats] = useState({
    activeBatches: 0,
    lowStockItems: 0,
    activeShipments: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const [batches, materials, shipments] = await Promise.all([
        supabase
          .from("production_batches")
          .select("*", { count: "exact", head: true })
          .in("status", ["pending", "in_progress"]),
        supabase
          .from("raw_materials")
          .select("current_stock, min_stock_level"),
        supabase
          .from("shipments")
          .select("*", { count: "exact", head: true })
          .in("status", ["preparing", "shipped"]),
      ]);

      const lowStock = materials.data?.filter(
        (item) => item.current_stock < item.min_stock_level
      ) || [];

      setStats({
        activeBatches: batches.count || 0,
        lowStockItems: lowStock.length,
        activeShipments: shipments.count || 0,
      });
    };

    fetchStats();
  }, []);

  const cards = [
    {
      title: "Active Batches",
      value: stats.activeBatches,
      icon: Package,
      color: "text-primary",
    },
    {
      title: "Low Stock Alerts",
      value: stats.lowStockItems,
      icon: AlertTriangle,
      color: "text-destructive",
    },
    {
      title: "Active Shipments",
      value: stats.activeShipments,
      icon: Truck,
      color: "text-secondary",
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your production operations
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((card) => (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {card.title}
                </CardTitle>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No recent activity to display
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Dashboard;
