import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Boxes, Truck, AlertTriangle } from "lucide-react";
import Layout from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface Activity {
  id: string;
  type: "batch" | "shipment" | "inventory";
  description: string;
  timestamp: string;
  status?: string;
}

const Dashboard = () => {
  const [stats, setStats] = useState({
    activeBatches: 0,
    lowStockItems: 0,
    activeShipments: 0,
  });
  const [activities, setActivities] = useState<Activity[]>([]);

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

    const fetchActivities = async () => {
      const recentActivities: Activity[] = [];

      // Fetch recent batches
      const { data: batchData } = await supabase
        .from("production_batches")
        .select("id, batch_number, status, created_at, vial_types(name)")
        .order("created_at", { ascending: false })
        .limit(5);

      if (batchData) {
        batchData.forEach((batch: any) => {
          recentActivities.push({
            id: batch.id,
            type: "batch",
            description: `Batch ${batch.batch_number} created - ${batch.vial_types?.name || 'Unknown Type'}`,
            timestamp: batch.created_at,
            status: batch.status,
          });
        });
      }

      // Fetch recent shipments
      const { data: shipmentData } = await supabase
        .from("shipments")
        .select("id, shipment_number, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      if (shipmentData) {
        shipmentData.forEach((shipment) => {
          recentActivities.push({
            id: shipment.id,
            type: "shipment",
            description: `Shipment ${shipment.shipment_number} created`,
            timestamp: shipment.created_at,
            status: shipment.status,
          });
        });
      }

      // Sort all activities by timestamp and take the most recent 10
      recentActivities.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setActivities(recentActivities.slice(0, 10));
    };

    fetchStats();
    fetchActivities();
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
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
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
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recent activity to display
              </p>
            ) : (
              <div className="space-y-4">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start justify-between border-b pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {activity.type === "batch" && (
                          <Package className="h-4 w-4 text-primary" />
                        )}
                        {activity.type === "shipment" && (
                          <Truck className="h-4 w-4 text-secondary" />
                        )}
                        {activity.type === "inventory" && (
                          <Boxes className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {activity.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.timestamp), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                    {activity.status && (
                      <Badge
                        variant={
                          activity.status === "completed" || activity.status === "delivered"
                            ? "default"
                            : activity.status === "in_progress" || activity.status === "shipped"
                            ? "secondary"
                            : "outline"
                        }
                        className="ml-2 flex-shrink-0 capitalize"
                      >
                        {activity.status.replace("_", " ")}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Dashboard;
