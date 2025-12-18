import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";

interface RawMaterial {
    id: string;
    name: string;
    category: string;
    unit: string;
    current_stock: number;
    min_stock_level: number;
    cost_per_unit: number | null;
    order_index: number;
}

export default function InventoryReport() {
    const [materials, setMaterials] = useState<RawMaterial[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalValue, setTotalValue] = useState(0);

    useEffect(() => {
        const fetchInventory = async () => {
            try {
                const { data, error } = await supabase
                    .from("raw_materials")
                    .select("*")
                    .order("order_index")
                    .order("name");

                if (error) throw error;

                if (data) {
                    setMaterials(data);
                    const total = data.reduce((sum, item) => {
                        const cost = item.cost_per_unit || 0;
                        return sum + (item.current_stock * cost);
                    }, 0);
                    setTotalValue(total);
                }
            } catch (error) {
                console.error("Error fetching inventory:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchInventory();
    }, []);

    useEffect(() => {
        document.title = `Inventory-Report-${format(new Date(), "yyyy-MM-dd")}`;
        return () => {
            document.title = "VialFlow Pro";
        };
    }, []);

    const handlePrint = () => {
        window.print();
    };

    const handleBack = () => {
        window.close();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-lg">Loading Inventory Report...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-4 sm:p-8 print:p-8">
            {/* Action buttons - hidden when printing */}
            <div className="flex flex-col sm:flex-row justify-between mb-4 sm:mb-6 gap-2 print:hidden">
                <Button variant="outline" onClick={handleBack} className="w-full sm:w-auto">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Close
                </Button>
                <Button onClick={handlePrint} className="w-full sm:w-auto">
                    <Printer className="w-4 h-4 mr-2" />
                    Print Report
                </Button>
            </div>

            {/* Inventory Report */}
            <div className="max-w-5xl mx-auto bg-white text-black p-4 sm:p-12 shadow-lg print:shadow-none">
                {/* Header */}
                <div className="text-center mb-6 sm:mb-8 border-b-2 border-gray-800 pb-4">
                    <h1 className="text-xl sm:text-3xl font-bold mb-2">INVENTORY STATUS REPORT</h1>
                    <p className="text-xs sm:text-sm text-gray-600">VialFlow Pro Manufacturing</p>
                </div>

                {/* Report Information */}
                {/* Report Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8 bg-gray-50 p-4 sm:p-6 rounded">
                    <div>
                        <p className="text-sm text-gray-600">Report Date</p>
                        <p className="text-lg font-semibold">{format(new Date(), "PPP")}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Generated At</p>
                        <p className="text-lg font-semibold">{format(new Date(), "p")}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Total Items</p>
                        <p className="text-lg font-semibold">{materials.length}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Total Value</p>
                        <p className="text-lg font-semibold">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                </div>

                {/* Materials Table */}
                <div className="mb-6 sm:mb-8 overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-800 text-white">
                                <th className="border border-gray-300 p-2 sm:p-3 text-left text-xs sm:text-sm">Material Name</th>
                                <th className="border border-gray-300 p-2 sm:p-3 text-left text-xs sm:text-sm">Category</th>
                                <th className="border border-gray-300 p-2 sm:p-3 text-right text-xs sm:text-sm">Current Stock</th>
                                <th className="border border-gray-300 p-2 sm:p-3 text-center text-xs sm:text-sm">Unit</th>
                                <th className="border border-gray-300 p-2 sm:p-3 text-right text-xs sm:text-sm">Unit Cost</th>
                                <th className="border border-gray-300 p-2 sm:p-3 text-right text-xs sm:text-sm">Total Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {materials.length > 0 ? (
                                materials.map((material) => {
                                    const currentValue = (material.current_stock * (material.cost_per_unit || 0));
                                    const isLowStock = material.current_stock <= material.min_stock_level;

                                    return (
                                        <tr key={material.id} className={`hover:bg-gray-50 ${isLowStock ? 'bg-red-50' : ''}`}>
                                            <td className="border border-gray-300 p-3 font-medium">
                                                {material.name}
                                                {isLowStock && (
                                                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 print:border print:border-red-200">
                                                        Low Stock
                                                    </span>
                                                )}
                                            </td>
                                            <td className="border border-gray-300 p-3">{material.category}</td>
                                            <td className={`border border-gray-300 p-3 text-right font-mono ${isLowStock ? 'text-red-700 font-bold' : ''}`}>
                                                {material.current_stock}
                                            </td>
                                            <td className="border border-gray-300 p-3 text-center text-sm text-gray-600">{material.unit}</td>
                                            <td className="border border-gray-300 p-3 text-right text-gray-600">
                                                {material.cost_per_unit ? `$${material.cost_per_unit.toFixed(2)}` : '-'}
                                            </td>
                                            <td className="border border-gray-300 p-3 text-right font-semibold">
                                                ${currentValue.toFixed(2)}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={6} className="border border-gray-300 p-4 text-center text-gray-500">
                                        No materials found in inventory
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gray-100 font-bold">
                                <td colSpan={5} className="border border-gray-300 p-3 text-right">
                                    TOTAL INVENTORY VALUE:
                                </td>
                                <td className="border border-gray-300 p-3 text-right text-lg">
                                    ${totalValue.toFixed(2)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Footer */}
                <div className="text-xs text-gray-500 text-center pt-4 border-t border-gray-300">
                    <p>This document is auto-generated by VialFlow Pro</p>
                </div>
            </div>

            {/* Print styles */}
            <style>{`
        @media print {
          body {
            background: white;
          }
          .print\\:hidden {
            display: none !important;
          }
          @page {
            margin: 1cm;
            size: landscape;
          }
        }
      `}</style>
        </div>
    );
}
