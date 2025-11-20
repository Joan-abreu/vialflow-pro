import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";

interface MaterialItem {
  id: string;
  name: string;
  unit: string;
  quantity_per_unit: number;
  total_quantity: number;
  cost_per_unit: number | null;
  total_cost: number;
}

interface BatchData {
  batch_number: string;
  products: {
    name: string;
  } | null;
  sale_type: string;
  quantity: number;
  started_at: string;
  pack_quantity: number | null;
  created_at: string;
  vial_type_name: string;
  vial_type_size: number;
}

export default function BillOfMaterials() {
  const { batchId } = useParams<{ batchId: string }>();
  const [batch, setBatch] = useState<BatchData | null>(null);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCost, setTotalCost] = useState(0);

  useEffect(() => {
    const fetchBoM = async () => {
      if (!batchId) return;

      try {
        // Fetch batch data
        const { data: batchData, error: batchError } = await supabase
          .from("production_batches")
          .select(`
            batch_number,
            products (name),
            sale_type,
            pack_quantity,
            quantity,
            started_at,
            created_at,
            vial_types (
              name,
              size_ml
            )
          `)
          .eq("id", batchId)
          .single();

        if (batchError) throw batchError;

        setBatch({
          batch_number: batchData.batch_number,
          products: batchData.products,
          sale_type: batchData.sale_type,
          quantity: batchData.quantity,
          pack_quantity: batchData.pack_quantity,
          started_at: batchData.started_at,
          created_at: batchData.created_at,
          vial_type_name: batchData.vial_types.name,
          vial_type_size: batchData.vial_types.size_ml,
        });

        // Fetch vial type ID
        const { data: vialTypeData } = await supabase
          .from("production_batches")
          .select("vial_type_id")
          .eq("id", batchId)
          .single();

        if (!vialTypeData) return;

        // Fetch materials for this vial type
        const { data: materialsData, error: materialsError } = await supabase
          .from("vial_type_materials")
          .select(`
            id,
            quantity_per_unit,
            raw_materials (
              id,
              name,
              unit,
              cost_per_unit
            )
          `)
          .eq("vial_type_id", vialTypeData.vial_type_id);

        if (materialsError) throw materialsError;

        // Calculate quantities and costs
        const processedMaterials: MaterialItem[] = materialsData.map((item: any) => {
          const totalQty = item.quantity_per_unit * batchData.quantity;
          const costPerUnit = item.raw_materials.cost_per_unit || 0;
          const totalCost = totalQty * costPerUnit;

          return {
            id: item.raw_materials.id,
            name: item.raw_materials.name,
            unit: item.raw_materials.unit,
            quantity_per_unit: item.quantity_per_unit,
            total_quantity: totalQty,
            cost_per_unit: costPerUnit,
            total_cost: totalCost,
          };
        });

        setMaterials(processedMaterials);
        setTotalCost(processedMaterials.reduce((sum, item) => sum + item.total_cost, 0));
      } catch (error) {
        console.error("Error fetching BoM:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBoM();
  }, [batchId]);

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    window.close();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading Bill of Materials...</div>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Batch not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8 print:p-8">
      {/* Action buttons - hidden when printing */}
      <div className="flex flex-col sm:flex-row justify-between mb-4 sm:mb-6 gap-2 print:hidden">
        <Button variant="outline" onClick={handleBack} className="w-full sm:w-auto">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={handlePrint} className="w-full sm:w-auto">
          <Printer className="w-4 h-4 mr-2" />
          Print
        </Button>
      </div>

      {/* BoM Report */}
      <div className="max-w-4xl mx-auto bg-white text-black p-4 sm:p-12 shadow-lg print:shadow-none">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8 border-b-2 border-gray-800 pb-4">
          <h1 className="text-xl sm:text-3xl font-bold mb-2">BILL OF MATERIALS</h1>
          <p className="text-xs sm:text-sm text-gray-600">VialFlow Pro Manufacturing</p>
        </div>

        {/* Batch Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8 bg-gray-50 p-4 sm:p-6 rounded">
          <div>
            <p className="text-sm text-gray-600">Batch Number</p>
            <p className="text-lg font-semibold">{batch.batch_number}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Product</p>
            <p className="text-lg font-semibold">{batch.products?.name || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Date</p>
            <p className="text-lg font-semibold">{format(new Date(batch.started_at), "PPP")}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Vial Type</p>
            <p className="text-lg font-semibold">{batch.vial_type_name} ({batch.vial_type_size}ml)</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Production Quantity</p>
            <p className="text-lg font-semibold">{batch.quantity.toLocaleString()} units</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Sales Type</p>
            <p className="text-lg font-semibold">{batch.sale_type === "pack" && batch.pack_quantity
                            ? `${(batch.quantity / batch.pack_quantity).toFixed(0)} packs`
                            : batch.quantity
                          }</p>
          </div>
        </div>

        {/* Materials Table */}
        <div className="mb-6 sm:mb-8 overflow-x-auto">
          <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Required Materials</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="border border-gray-300 p-2 sm:p-3 text-left text-xs sm:text-sm">Material</th>
                <th className="border border-gray-300 p-2 sm:p-3 text-right text-xs sm:text-sm">Qty/Unit</th>
                <th className="border border-gray-300 p-2 sm:p-3 text-center text-xs sm:text-sm">Unit</th>
                <th className="border border-gray-300 p-2 sm:p-3 text-right text-xs sm:text-sm">Total Qty</th>
                <th className="hidden sm:table-cell border border-gray-300 p-2 sm:p-3 text-right text-xs sm:text-sm">Unit Cost</th>
                <th className="border border-gray-300 p-2 sm:p-3 text-right text-xs sm:text-sm">Total</th>
              </tr>
            </thead>
            <tbody>
              {materials.length > 0 ? (
                materials.map((material) => (
                  <tr key={material.id} className="hover:bg-gray-50">
                    <td className="border border-gray-300 p-3">{material.name}</td>
                    <td className="border border-gray-300 p-3 text-right">
                      {material.quantity_per_unit.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 p-3 text-center">{material.unit}</td>
                    <td className="border border-gray-300 p-3 text-right">
                      {material.total_quantity.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 p-3 text-right">
                      ${material.cost_per_unit.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 p-3 text-right font-semibold">
                      ${material.total_cost.toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="border border-gray-300 p-4 text-center text-gray-500">
                    No materials configured for this vial type
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-bold">
                <td colSpan={5} className="border border-gray-300 p-3 text-right">
                  TOTAL MATERIAL COST:
                </td>
                <td className="border border-gray-300 p-3 text-right text-lg">
                  ${totalCost.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer */}
        <div className="text-xs text-gray-500 text-center pt-4 border-t border-gray-300">
          <p>Generated on {format(new Date(), "PPP 'at' p")}</p>
          <p className="mt-1">This document is auto-generated by VialFlow Pro</p>
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
          }
        }
      `}</style>
    </div>
  );
}
