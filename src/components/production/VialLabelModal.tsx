import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, Download, Copy, Check, ExternalLink, QrCode as QrIcon, ShieldCheck, Sparkles, Layers } from "lucide-react";
import { toast } from "sonner";

interface VialBatchInfo {
  id: string;
  batch_number: string;
  quantity: number;
  product_name?: string;
  vial_capacity_ml?: number | string;
  vial_type_name?: string;
  color?: string | null;
  created_at?: string;
}

interface VialLabelModalProps {
  batch: VialBatchInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type LabelSizePreset = "small_vial" | "standard_vial" | "large_vial";
type PrintLayout = "thermal_roll" | "avery_sheet";

export const VialLabelModal: React.FC<VialLabelModalProps> = ({
  batch,
  open,
  onOpenChange,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [printCopies, setPrintCopies] = useState<number>(batch?.quantity || 10);
  const [labelSize, setLabelSize] = useState<LabelSizePreset>("small_vial");
  const [printLayout, setPrintLayout] = useState<PrintLayout>("thermal_roll");
  const [customDosage, setCustomDosage] = useState<string>("");
  const [storageNote, setStorageNote] = useState<string>("Store at -20°C • Lyophilized");
  const [customSubtitle, setCustomSubtitle] = useState<string>("RESEARCH USE ONLY");
  const [retestDate, setRetestDate] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Derive initial values when batch opens
  useEffect(() => {
    if (!batch) return;

    setPrintCopies(batch.quantity > 0 ? batch.quantity : 10);

    // Default retest date 2 years after batch creation date
    const baseDate = batch.created_at ? new Date(batch.created_at) : new Date();
    const expYear = baseDate.getFullYear() + 2;
    const expMonth = String(baseDate.getMonth() + 1).padStart(2, "0");
    setRetestDate(`${expMonth}/${expYear}`);

    // Parse dosage if present in product name (e.g. "BPC-157 5mg" -> dosage "5mg")
    const match = batch.product_name?.match(/(\d+(?:\.\d+)?\s*(?:mg|mcg|g|iu|ml))/i);
    if (match) {
      setCustomDosage(match[1]);
    } else {
      setCustomDosage("");
    }
  }, [batch]);

  // Generate dynamic QR code URL pointing to public COA verification
  const coaPublicUrl = typeof window !== "undefined" && batch?.batch_number
    ? `${window.location.origin}/coa/${encodeURIComponent(batch.batch_number.trim())}`
    : "";

  useEffect(() => {
    if (!coaPublicUrl) return;

    QRCode.toDataURL(coaPublicUrl, {
      width: 250,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("Error generating QR code:", err));
  }, [coaPublicUrl]);

  if (!batch) return null;

  const handleCopyLink = () => {
    if (!coaPublicUrl) return;
    navigator.clipboard.writeText(coaPublicUrl);
    setCopied(true);
    toast.success("COA verification URL copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  // Dimensions configuration for preview & print
  // Small vial (2-3ml): ~1.5" x 0.75" (approx 38mm x 19mm)
  // Standard vial (5ml): ~1.75" x 0.85" (approx 44mm x 22mm)
  // Large vial (10-30ml): ~2.0" x 1.0" (approx 50mm x 25mm)
  const labelDimensions = {
    small_vial: { width: "38mm", height: "19mm", name: "2ml - 3ml Vial (1.5\" × 0.75\")" },
    standard_vial: { width: "44mm", height: "22mm", name: "5ml Vial (1.75\" × 0.875\")" },
    large_vial: { width: "50mm", height: "25mm", name: "10ml - 30ml Vial (2.0\" × 1.0\")" },
  }[labelSize];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <DialogTitle className="text-xl flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  🏷️
                </span>
                Vial Label Designer & Print Engine
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm mt-1">
                Design and print physical vial labels with dynamic QR verification linked to third-party COA.
              </DialogDescription>
            </div>

            <div className="flex items-center gap-1.5 bg-muted/60 px-2.5 py-1 rounded-full border text-xs font-mono font-semibold">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Lot: {batch.batch_number}</span>
            </div>
          </div>
        </DialogHeader>

        {/* Content Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-2">
          {/* Left Column: Settings / Options */}
          <div className="md:col-span-6 space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Product Display Name</Label>
              <Input
                value={batch.product_name || "Peptide Solution"}
                readOnly
                className="bg-muted text-xs h-8 font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Dose / Spec (Optional)</Label>
                <Input
                  value={customDosage}
                  onChange={(e) => setCustomDosage(e.target.value)}
                  placeholder="e.g. 5mg, 10mg"
                  className="text-xs h-8"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Retest / Exp Date</Label>
                <Input
                  value={retestDate}
                  onChange={(e) => setRetestDate(e.target.value)}
                  placeholder="MM/YYYY"
                  className="text-xs h-8"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Label Size (Vial Type)</Label>
                <Select
                  value={labelSize}
                  onValueChange={(val: LabelSizePreset) => setLabelSize(val)}
                >
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small_vial">2ml - 3ml (1.5" × 0.75")</SelectItem>
                    <SelectItem value="standard_vial">5ml (1.75" × 0.875")</SelectItem>
                    <SelectItem value="large_vial">10ml - 30ml (2.0" × 1.0")</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Print Layout</Label>
                <Select
                  value={printLayout}
                  onValueChange={(val: PrintLayout) => setPrintLayout(val)}
                >
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thermal_roll">Thermal Roll (Zebra / Dymo)</SelectItem>
                    <SelectItem value="avery_sheet">Sheet Grid (Avery Letter)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Storage / Handling Instructions</Label>
              <Input
                value={storageNote}
                onChange={(e) => setStorageNote(e.target.value)}
                placeholder="e.g. Store at -20°C • Lyophilized"
                className="text-xs h-8"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Labels to Print (Copies)</Label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={printCopies}
                  onChange={(e) => setPrintCopies(parseInt(e.target.value) || 1)}
                  className="text-xs h-8"
                />
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="text-xs h-8 gap-1.5 font-semibold text-muted-foreground hover:text-foreground"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                Copy COA Link
              </Button>
            </div>

            {/* Direct Link Preview */}
            <div className="p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-[11px] text-emerald-900 dark:text-emerald-300">
              <span className="font-semibold flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-emerald-600 shrink-0" />
                Live QR Target:
              </span>
              <p className="font-mono truncate text-[10px] opacity-80 mt-0.5">
                {coaPublicUrl}
              </p>
            </div>
          </div>

          {/* Right Column: Interactive Real-Time Preview */}
          <div className="md:col-span-6 flex flex-col items-center justify-center p-4 bg-muted/30 border rounded-xl space-y-4">
            <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1.5">
              <QrIcon className="h-3.5 w-3.5 text-primary" />
              Live Vial Label Preview ({labelDimensions.name})
            </span>

            {/* Flat Printable Label Preview Card */}
            <div
              className="bg-white text-black border-2 border-black rounded shadow-md flex overflow-hidden select-none"
              style={{
                width: labelSize === "small_vial" ? "290px" : labelSize === "standard_vial" ? "320px" : "340px",
                height: labelSize === "small_vial" ? "145px" : labelSize === "standard_vial" ? "160px" : "175px",
                padding: "8px",
                boxSizing: "border-box",
                fontFamily: "Arial, Helvetica, sans-serif",
              }}
            >
              {/* Left Column: QR Code + Scan Instruction */}
              <div className="w-[85px] flex flex-col items-center justify-center border-r border-black/20 pr-1.5 mr-2 shrink-0">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="COA QR Code"
                    className="w-[72px] h-[72px] object-contain border border-black/20 p-0.5 rounded"
                  />
                ) : (
                  <div className="w-[72px] h-[72px] bg-gray-100 flex items-center justify-center border text-[9px] text-gray-500">
                    QR
                  </div>
                )}
                <span className="text-[7.5px] font-bold uppercase tracking-tight text-center mt-1 text-black">
                  Scan for COA
                </span>
                <span className="text-[6.5px] text-gray-600 text-center font-mono">
                  3rd Party Lab
                </span>
              </div>

              {/* Right Column: Chemical & Batch Details */}
              <div className="flex-1 flex flex-col justify-between overflow-hidden">
                <div>
                  <div className="flex items-center justify-between border-b border-black pb-0.5">
                    <span className="text-[7.5px] font-black uppercase tracking-wider text-black">
                      RESEARCH PEPTIDE
                    </span>
                    {customDosage && (
                      <span className="text-[8.5px] font-black bg-black text-white px-1 rounded-xs">
                        {customDosage}
                      </span>
                    )}
                  </div>

                  <h4 className="text-[12px] font-black leading-tight truncate text-black mt-1">
                    {batch.product_name?.replace(/\s*\d+(?:\.\d+)?\s*(?:mg|mcg|g|iu|ml).*/i, "") || "Peptide Product"}
                  </h4>

                  <div className="mt-1 space-y-0.5">
                    <div className="flex items-center gap-1 text-[8.5px] font-bold">
                      <span className="text-gray-600">LOT:</span>
                      <span className="font-mono font-black text-black bg-yellow-200 px-0.5 rounded">
                        {batch.batch_number}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[7px] text-gray-700 font-semibold">
                      <span>Exp/Retest: <strong>{retestDate}</strong></span>
                      <span>Purity: <strong>≥99%</strong></span>
                    </div>

                    <div className="text-[6.5px] text-gray-600 truncate">
                      {storageNote}
                    </div>
                  </div>
                </div>

                {/* RUO Warning Footer */}
                <div className="border-t border-black pt-0.5 mt-0.5">
                  <p className="text-[6.5px] font-bold uppercase text-red-700 leading-tight text-center">
                    FOR RESEARCH USE ONLY • NOT FOR HUMAN CONSUMPTION
                  </p>
                </div>
              </div>
            </div>

            {/* Vial Simulation Graphic */}
            <div className="text-center">
              <span className="text-[10px] text-muted-foreground font-medium">
                Designed to wrap neatly around standard {batch.vial_capacity_ml ? `${batch.vial_capacity_ml}ml` : "2ml / 3ml"} vials with clear scan alignment.
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-4 mt-2">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <span>
              Total: <strong>{printCopies} labels</strong> ({labelDimensions.name})
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 sm:flex-none text-xs"
            >
              Close
            </Button>

            <Button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2 text-xs"
            >
              <Printer className="h-4 w-4" />
              Print {printCopies} Labels
            </Button>
          </div>
        </div>

        {/* HIDDEN PRINT CONTAINER (Rendered only on window.print()) */}
        <div
          ref={printAreaRef}
          className="hidden print:block fixed inset-0 bg-white z-[99999] p-0 m-0"
          id="vial-label-print-sheet"
        >
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #vial-label-print-sheet, #vial-label-print-sheet * {
                visibility: visible !important;
              }
              #vial-label-print-sheet {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: ${printLayout === "thermal_roll" ? "0 !important" : "10mm !important"};
              }
              @page {
                size: ${printLayout === "thermal_roll" ? `${labelDimensions.width} ${labelDimensions.height}` : "letter portrait"};
                margin: 0;
              }
              .label-print-item {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                ${printLayout === "thermal_roll" ? "page-break-after: always !important;" : ""}
              }
            }
          `}</style>

          <div
            className={
              printLayout === "thermal_roll"
                ? "flex flex-col"
                : "grid grid-cols-2 sm:grid-cols-3 gap-2"
            }
          >
            {Array.from({ length: printCopies }).map((_, idx) => (
              <div
                key={idx}
                className="label-print-item bg-white text-black border border-black overflow-hidden flex"
                style={{
                  width: labelDimensions.width,
                  height: labelDimensions.height,
                  padding: "1.5mm",
                  boxSizing: "border-box",
                  fontFamily: "Arial, Helvetica, sans-serif",
                  margin: printLayout === "thermal_roll" ? "0 auto" : "1mm",
                }}
              >
                {/* QR Section */}
                <div
                  style={{ width: "14mm", marginRight: "1.5mm" }}
                  className="flex flex-col items-center justify-center border-r border-black/20 pr-1 shrink-0"
                >
                  {qrDataUrl && (
                    <img
                      src={qrDataUrl}
                      alt="QR"
                      style={{ width: "11mm", height: "11mm" }}
                      className="object-contain"
                    />
                  )}
                  <span style={{ fontSize: "5pt" }} className="font-bold uppercase tracking-tight text-center mt-0.5">
                    SCAN COA
                  </span>
                </div>

                {/* Text Content */}
                <div className="flex-1 flex flex-col justify-between overflow-hidden">
                  <div>
                    <div className="flex items-center justify-between border-b border-black pb-0.5">
                      <span style={{ fontSize: "5pt" }} className="font-black uppercase tracking-wider">
                        RESEARCH PEPTIDE
                      </span>
                      {customDosage && (
                        <span style={{ fontSize: "5pt" }} className="font-black bg-black text-white px-0.5 rounded-xs">
                          {customDosage}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: "7.5pt" }} className="font-black leading-tight truncate mt-0.5 text-black">
                      {batch.product_name?.replace(/\s*\d+(?:\.\d+)?\s*(?:mg|mcg|g|iu|ml).*/i, "") || "Peptide Product"}
                    </div>

                    <div className="mt-0.5">
                      <div style={{ fontSize: "6pt" }} className="font-bold flex items-center gap-0.5">
                        <span>LOT:</span>
                        <strong className="font-mono">{batch.batch_number}</strong>
                      </div>
                      <div style={{ fontSize: "5pt" }} className="text-gray-800 flex justify-between">
                        <span>Retest: {retestDate}</span>
                        <span>≥99%</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-black pt-0.5">
                    <p style={{ fontSize: "4pt" }} className="font-bold uppercase text-center leading-none text-red-700">
                      FOR RESEARCH USE ONLY • NOT FOR HUMAN CONSUMPTION
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VialLabelModal;
