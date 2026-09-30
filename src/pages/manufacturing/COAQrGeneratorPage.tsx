import React, { useState, useEffect, useMemo } from "react";
import QRCode from "qrcode";
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
import { Badge } from "@/components/ui/badge";
import {
  QrCode,
  Download,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  FileCode2,
  RotateCcw,
  CheckCircle2,
  Tag,
  Eye,
  Printer,
  ArrowLeft
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface QuickPreset {
  label: string;
  slug: string;
  url: string;
  type: string;
}

const QUICK_PRESETS: QuickPreset[] = [
  { label: "Retatrutide (RT)", slug: "rt", url: "https://www.livwellresearchlabs.com/coa/rt", type: "🔬 Peptide" },
  { label: "Tirzepatide (TR)", slug: "tr", url: "https://www.livwellresearchlabs.com/coa/tr", type: "🔬 Peptide" },
  { label: "Semaglutide (SM)", slug: "sm", url: "https://www.livwellresearchlabs.com/coa/sm", type: "🔬 Peptide" },
  { label: "BAC Water (BAC)", slug: "bac", url: "https://www.livwellresearchlabs.com/coa/bac", type: "💧 Solution" },
  { label: "BPC-157", slug: "bpc157", url: "https://www.livwellresearchlabs.com/coa/bpc157", type: "🔬 Peptide" },
  { label: "TB-500", slug: "tb500", url: "https://www.livwellresearchlabs.com/coa/tb500", type: "🔬 Peptide" },
  { label: "KLOW Blend", slug: "klow", url: "https://www.livwellresearchlabs.com/coa/klow", type: "🔬 Peptide" },
  { label: "Lab Reports Hub", slug: "lab-reports", url: "https://www.livwellresearchlabs.com/lab-reports", type: "📋 All COAs" },
];

export const COAQrGeneratorPage: React.FC = () => {
  const [url, setUrl] = useState<string>("https://www.livwellresearchlabs.com/coa/rt");
  const [resolution, setResolution] = useState<number>(1024);
  const [errorCorrection, setErrorCorrection] = useState<"L" | "M" | "Q" | "H">("H");
  const [margin, setMargin] = useState<number>(1);
  const [transparentBg, setTransparentBg] = useState<boolean>(false);
  const [includeLabelText, setIncludeLabelText] = useState<boolean>(false);
  const [topText, setTopText] = useState<string>("LIVWELL RESEARCH LABS");
  const [bottomText, setBottomText] = useState<string>("SCAN FOR COA LAB REPORT");

  // Output states
  const [qrPngDataUrl, setQrPngDataUrl] = useState<string>("");
  const [compositePngDataUrl, setCompositePngDataUrl] = useState<string>("");
  const [svgString, setSvgString] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedSvg, setCopiedSvg] = useState<boolean>(false);

  // Generate QR code whenever settings change
  useEffect(() => {
    let isCancelled = false;
    const cleanUrl = url.trim() || "https://www.livwellresearchlabs.com/coa/rt";

    const generateCodes = async () => {
      setIsGenerating(true);
      try {
        // 1. Generate high-resolution PNG
        const png = await QRCode.toDataURL(cleanUrl, {
          width: resolution,
          margin: margin,
          errorCorrectionLevel: errorCorrection,
          color: {
            dark: "#000000",
            light: transparentBg ? "#00000000" : "#ffffff",
          },
        });

        // 2. Generate pure vector SVG
        const svg = await QRCode.toString(cleanUrl, {
          type: "svg",
          margin: margin,
          errorCorrectionLevel: errorCorrection,
          color: {
            dark: "#000000",
            light: transparentBg ? "#00000000" : "#ffffff",
          },
        });

        if (isCancelled) return;
        setQrPngDataUrl(png);
        setSvgString(svg);

        // 3. Composite text if enabled
        if (includeLabelText) {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const qrImg = new Image();
            qrImg.crossOrigin = "anonymous";
            qrImg.onload = () => {
              if (isCancelled) return;
              const padding = Math.round(resolution * 0.05);
              const headerHeight = Math.round(resolution * 0.12);
              const footerHeight = Math.round(resolution * 0.1);
              canvas.width = resolution;
              canvas.height = resolution + headerHeight + footerHeight;

              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, canvas.width, canvas.height);

              ctx.fillStyle = "#0f172a";
              ctx.font = `bold ${Math.round(resolution * 0.045)}px sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(topText, canvas.width / 2, headerHeight / 2 + padding / 2);

              ctx.drawImage(qrImg, 0, headerHeight, resolution, resolution);

              ctx.fillStyle = "#334155";
              ctx.font = `600 ${Math.round(resolution * 0.035)}px sans-serif`;
              ctx.fillText(bottomText, canvas.width / 2, headerHeight + resolution + footerHeight / 2 - padding / 2);

              setCompositePngDataUrl(canvas.toDataURL("image/png"));
            };
            qrImg.src = png;
          }
        } else {
          setCompositePngDataUrl(png);
        }
      } catch (err) {
        console.error("Error generating QR code:", err);
      } finally {
        if (!isCancelled) setIsGenerating(false);
      }
    };

    generateCodes();

    return () => {
      isCancelled = true;
    };
  }, [url, resolution, errorCorrection, margin, transparentBg, includeLabelText, topText, bottomText]);

  // Derive slug/filename based on current URL
  const filenameBase = useMemo(() => {
    try {
      const u = new URL(url.trim());
      const pathParts = u.pathname.split("/").filter(Boolean);
      const lastPart = pathParts[pathParts.length - 1] || "coa-rt";
      return `coa-${lastPart.toLowerCase().replace(/[^a-z0-9_-]/g, "-")}`;
    } catch {
      return "coa-qr-code";
    }
  }, [url]);

  const handleDownloadPng = () => {
    const dataToDownload = includeLabelText ? compositePngDataUrl : qrPngDataUrl;
    if (!dataToDownload) return;

    const a = document.createElement("a");
    a.href = dataToDownload;
    a.download = `${filenameBase}-${resolution}px.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`Downloaded ${filenameBase}-${resolution}px.png (${resolution}×${resolution})`);
  };

  const handleDownloadSvg = () => {
    if (!svgString) return;

    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${filenameBase}-vector.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    toast.success(`Downloaded vector ${filenameBase}-vector.svg (Lossless SVG for labels)`);
  };

  const handleCopyImage = async () => {
    const dataToCopy = includeLabelText ? compositePngDataUrl : qrPngDataUrl;
    if (!dataToCopy) return;

    try {
      const res = await fetch(dataToCopy);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      setCopied(true);
      toast.success("QR image copied to clipboard! Paste it directly into your label software (Canva, Bartender, Photoshop).");
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      navigator.clipboard.writeText(url);
      toast.info("Copied COA URL to clipboard");
    }
  };

  const handleCopySvg = () => {
    if (!svgString) return;
    navigator.clipboard.writeText(svgString);
    setCopiedSvg(true);
    toast.success("SVG vector code copied to clipboard!");
    setTimeout(() => setCopiedSvg(false), 2000);
  };

  const handleTestUrl = () => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const activeDisplayImg = includeLabelText ? compositePngDataUrl : qrPngDataUrl;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/manufacturing/coas"
              className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to COA Management
            </Link>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <QrCode className="h-7 w-7 text-emerald-600" />
            Peptide COA QR Code Generator
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Dynamic QR generator optimized for physical peptide vial labels. Download high-resolution PNG or vector SVG.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestUrl}
            className="text-xs gap-1.5 font-semibold"
          >
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            Open &amp; Test URL
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): URL & Settings */}
        <div className="lg:col-span-7 space-y-4">
          {/* Dynamic URL Card */}
          <div className="p-4 rounded-xl border bg-card shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="page-coa-url" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Target COA URL (Dynamic)
              </Label>
              <button
                type="button"
                onClick={() => setUrl("https://www.livwellresearchlabs.com/coa/rt")}
                className="text-[11px] text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-semibold"
              >
                <RotateCcw className="h-3 w-3" />
                Reset to /coa/rt
              </button>
            </div>

            <Input
              id="page-coa-url"
              type="url"
              placeholder="https://www.livwellresearchlabs.com/coa/rt"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="font-mono text-sm h-10 bg-background"
            />

            {/* Quick Presets */}
            <div className="space-y-1.5 pt-1">
              <span className="text-xs font-semibold text-muted-foreground block">
                Quick Presets:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PRESETS.map((preset) => {
                  const isSelected = url.toLowerCase().trim() === preset.url.toLowerCase().trim();
                  return (
                    <button
                      key={preset.slug}
                      type="button"
                      onClick={() => setUrl(preset.url)}
                      className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all border ${
                        isSelected
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs font-bold"
                          : "bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Label Printing Configuration */}
          <div className="p-4 rounded-xl border bg-card shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Vial Label Printing Configuration
              </span>
              <Badge variant="outline" className="text-[10px] text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40">
                Curved Glass Optimized
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Resolution */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Resolution</Label>
                <Select
                  value={resolution.toString()}
                  onValueChange={(val) => setResolution(parseInt(val))}
                >
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder="Resolution" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="512">512 × 512 px (Standard)</SelectItem>
                    <SelectItem value="1024">1024 × 1024 px (300 DPI Print)</SelectItem>
                    <SelectItem value="2048">2048 × 2048 px (600 DPI Ultra)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Error Correction */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Error Correction</Label>
                <Select
                  value={errorCorrection}
                  onValueChange={(val: "L" | "M" | "Q" | "H") => setErrorCorrection(val)}
                >
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder="Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="H">Level H (30% Recovery - Recommended)</SelectItem>
                    <SelectItem value="Q">Level Q (25% Recovery)</SelectItem>
                    <SelectItem value="M">Level M (15% Recovery)</SelectItem>
                    <SelectItem value="L">Level L (7% Recovery)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Quiet Margin */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Quiet Margin</Label>
                <Select
                  value={margin.toString()}
                  onValueChange={(val) => setMargin(parseInt(val))}
                >
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder="Margin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 (Flush / Maximum Size)</SelectItem>
                    <SelectItem value="1">1 (Compact - Recommended)</SelectItem>
                    <SelectItem value="2">2 (Standard)</SelectItem>
                    <SelectItem value="4">4 (Wide)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Toggles */}
            <div className="pt-2 border-t flex flex-wrap items-center gap-4 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={transparentBg}
                  onChange={(e) => setTransparentBg(e.target.checked)}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>Transparent background</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={includeLabelText}
                  onChange={(e) => setIncludeLabelText(e.target.checked)}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>Render text headers on image</span>
              </label>
            </div>

            {includeLabelText && (
              <div className="pt-2 border-t space-y-2 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Top Header</Label>
                    <Input
                      value={topText}
                      onChange={(e) => setTopText(e.target.value)}
                      className="h-8 text-xs font-semibold"
                      placeholder="LIVWELL RESEARCH LABS"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Bottom Subtitle</Label>
                    <Input
                      value={bottomText}
                      onChange={(e) => setBottomText(e.target.value)}
                      className="h-8 text-xs font-semibold"
                      placeholder="SCAN FOR COA"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Static Files Fast Link */}
          <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-xs space-y-2">
            <span className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Direct Static Assets on Server (Instant Download)
            </span>
            <p className="text-[11px] text-emerald-800/80 dark:text-emerald-400">
              Files are pre-generated and accessible directly:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href="/qr-codes/coa-rt.png"
                download="coa-rt-2048.png"
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-800 text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Download className="h-3.5 w-3.5" /> coa-rt.png (2048px Ultra)
              </a>
              <a
                href="/qr-codes/coa-rt-1024.png"
                download="coa-rt-1024.png"
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-800 text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Download className="h-3.5 w-3.5" /> coa-rt-1024.png (1024px Print)
              </a>
              <a
                href="/qr-codes/coa-rt.svg"
                download="coa-rt.svg"
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-800 text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Download className="h-3.5 w-3.5" /> coa-rt.svg (Vector SVG)
              </a>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Preview & Downloads */}
        <div className="lg:col-span-5 flex flex-col justify-between p-6 rounded-xl border bg-card shadow-xs space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                Generated Preview
              </span>
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {resolution}×{resolution} px • Level {errorCorrection}
              </span>
            </div>

            <div className="relative mx-auto flex items-center justify-center p-4 bg-white rounded-2xl border shadow-sm max-w-[280px] aspect-square">
              {activeDisplayImg ? (
                <img
                  src={activeDisplayImg}
                  alt="Generated QR Code"
                  className="max-h-full max-w-full object-contain select-none"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground text-xs p-6">
                  <QrCode className="h-12 w-12 stroke-[1.5] animate-pulse mb-2 text-emerald-600" />
                  <span>Generating QR...</span>
                </div>
              )}
            </div>

            <div className="text-center pt-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted border text-xs font-mono text-muted-foreground max-w-full truncate">
                <span className="text-emerald-600 font-bold">Target:</span>
                <span className="truncate">{url}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2.5 pt-4 border-t">
            <Button
              onClick={handleDownloadPng}
              disabled={!activeDisplayImg || isGenerating}
              className="w-full h-11 font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs text-sm"
            >
              <Download className="h-4 w-4" />
              Download High-Res PNG ({resolution}px)
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={handleDownloadSvg}
                variant="outline"
                disabled={!svgString || isGenerating}
                className="h-10 text-xs font-bold gap-1.5 border-emerald-600/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              >
                <FileCode2 className="h-4 w-4 text-emerald-600" />
                Download Vector SVG
              </Button>

              <Button
                onClick={handleCopyImage}
                variant="outline"
                disabled={!activeDisplayImg}
                className="h-10 text-xs font-semibold gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600" />
                    Copied to Clipboard!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy Image (Ctrl+V)
                  </>
                )}
              </Button>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>Use SVG for Bartender, Dymo, Zebra Designer.</span>
              <button
                type="button"
                onClick={handleCopySvg}
                className="text-primary hover:underline font-mono"
              >
                {copiedSvg ? "SVG Copied!" : "Copy SVG Code"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Vial Label Mockup Reference Card */}
      <div className="p-6 rounded-2xl border bg-gradient-to-r from-slate-900 to-slate-800 text-white space-y-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-emerald-400" />
            <span className="text-sm font-bold tracking-wide uppercase text-slate-200">
              Vial Label Physical Placement (3ml / 1.5" × 0.75" / 38mm × 19mm)
            </span>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Optimized for thermal barcode printers (Zebra, Rollo, Munbyn, Brother)
          </span>
        </div>

        <div className="flex items-center justify-center p-4">
          <div className="w-[360px] h-[105px] rounded-lg bg-white text-slate-900 p-2.5 shadow-2xl flex items-center justify-between border-2 border-slate-300 relative select-none">
            <div className="flex flex-col justify-between h-full max-w-[220px] pr-2">
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                  LivWell Research Labs
                </div>
                <div className="text-sm font-extrabold uppercase leading-tight text-slate-900">
                  {url.includes("/coa/rt") ? "Retatrutide (GLP3-RT)" : "Peptide Vial"}
                </div>
                <div className="text-[11px] font-bold text-slate-700 font-mono">
                  30mg • 99.8% Analytical Purity
                </div>
              </div>
              <div className="text-[9px] font-semibold text-slate-500 leading-tight">
                <div>Batch: RT-2026-09A • Exp: 09/2028</div>
                <div className="text-[8px] text-emerald-600 font-bold uppercase">Store -20°C • Research Use Only</div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center shrink-0 border-l border-slate-200 pl-2.5">
              {qrPngDataUrl ? (
                <img
                  src={qrPngDataUrl}
                  alt="Vial Label QR"
                  className="w-[70px] h-[70px] object-contain border border-slate-200 rounded-sm"
                />
              ) : (
                <div className="w-[70px] h-[70px] bg-slate-100 flex items-center justify-center">
                  <QrCode className="h-6 w-6 text-slate-400 animate-pulse" />
                </div>
              )}
              <span className="text-[8px] font-mono font-bold tracking-tight text-slate-600 mt-0.5">
                SCAN FOR COA
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default COAQrGeneratorPage;
