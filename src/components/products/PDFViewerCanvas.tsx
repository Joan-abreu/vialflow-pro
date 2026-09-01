import React, { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.js?url";
import { 
    ChevronLeft, 
    ChevronRight, 
    ZoomIn, 
    ZoomOut, 
    Download, 
    ExternalLink, 
    FileText, 
    Maximize2,
    Minimize2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCoaPdf } from "@/utils/downloadCoa";

// Configure local PDF.js Worker via Vite asset URL
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PDFViewerCanvasProps {
    url: string;
    batchNumber?: string;
    className?: string;
    defaultFit?: "page" | "width";
    containerHeightClass?: string;
}

export const PDFViewerCanvas: React.FC<PDFViewerCanvasProps> = ({
    url,
    batchNumber = "",
    className = "",
    defaultFit = "page",
    containerHeightClass = "min-h-[500px] max-h-[750px]"
}) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [pageNum, setPageNum] = useState(1);
    const [numPages, setNumPages] = useState(1);
    const [scale, setScale] = useState(0.8);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const renderTaskRef = useRef<any>(null);

    // Calculate Fit-to-Page scale (fits entire document on screen comfortably)
    const calculateFitPageScale = useCallback(async (doc: any) => {
        if (!doc || !containerRef.current) return 0.8;
        try {
            const page = await doc.getPage(1);
            const unscaledViewport = page.getViewport({ scale: 1.0 });
            const containerWidth = containerRef.current.clientWidth || window.innerWidth;
            const containerHeight = containerRef.current.clientHeight || 650;
            
            // Available space with generous padding
            const availW = Math.max(280, containerWidth - 48);
            const availH = Math.max(380, containerHeight - 48);
            
            const scaleW = availW / unscaledViewport.width;
            const scaleH = availH / unscaledViewport.height;
            
            // Scale so the whole page fits without overflowing vertically or horizontally
            const optimalScale = Math.min(scaleW, scaleH);
            return Math.min(0.95, Math.max(0.4, Number(optimalScale.toFixed(2))));
        } catch {
            return 0.8;
        }
    }, []);

    // Calculate Fit-to-Width scale
    const calculateFitWidthScale = useCallback(async (doc: any) => {
        if (!doc || !containerRef.current) return 0.9;
        try {
            const page = await doc.getPage(1);
            const unscaledViewport = page.getViewport({ scale: 1.0 });
            const containerWidth = containerRef.current.clientWidth || window.innerWidth;
            const availW = Math.max(280, containerWidth - 48);
            const computedScale = availW / unscaledViewport.width;
            return Math.min(1.05, Math.max(0.4, Number(computedScale.toFixed(2))));
        } catch {
            return 0.9;
        }
    }, []);

    // Load Document via byte buffer to eliminate CORS / worker network issues
    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        setError(null);
        setPageNum(1);

        const loadPDF = async () => {
            try {
                const res = await fetch(url);
                if (!res.ok) {
                    throw new Error(`Failed to fetch PDF (${res.status} ${res.statusText})`);
                }
                const arrayBuffer = await res.arrayBuffer();
                const data = new Uint8Array(arrayBuffer);

                const loadingTask = pdfjsLib.getDocument({
                    data,
                    cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/",
                    cMapPacked: true,
                });
                
                const doc = await loadingTask.promise;
                if (!isMounted) return;
                setPdfDoc(doc);
                setNumPages(doc.numPages);
                
                // Initial scale: Fit to page for balanced, non-giant presentation
                const initialScale = defaultFit === "width" 
                    ? await calculateFitWidthScale(doc)
                    : await calculateFitPageScale(doc);

                if (isMounted) {
                    setScale(initialScale);
                    setLoading(false);
                }
            } catch (err: any) {
                if (!isMounted) return;
                console.error("PDF.js render error:", err);
                setError(err.message || "Unable to render PDF preview");
                setLoading(false);
            }
        };

        if (url) {
            loadPDF();
        }

        return () => {
            isMounted = false;
        };
    }, [url, defaultFit, calculateFitPageScale, calculateFitWidthScale]);

    // Handle container resize
    useEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver(async () => {
            if (pdfDoc && containerRef.current) {
                const fitScale = defaultFit === "width"
                    ? await calculateFitWidthScale(pdfDoc)
                    : await calculateFitPageScale(pdfDoc);
                setScale((prev) => Math.abs(prev - fitScale) > 0.15 ? fitScale : prev);
            }
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, [pdfDoc, defaultFit, calculateFitPageScale, calculateFitWidthScale]);

    // Render Page to Canvas
    const renderPage = useCallback(async (num: number, currentDoc: any, currentScale: number) => {
        if (!currentDoc || !canvasRef.current) return;

        try {
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
            }

            const page = await currentDoc.getPage(num);
            const canvas = canvasRef.current;
            const context = canvas.getContext("2d");
            if (!context) return;

            const viewport = page.getViewport({ scale: currentScale });
            
            // High DPI rendering for crisp sharp text
            const outputScale = window.devicePixelRatio || 1;
            canvas.width = Math.floor(viewport.width * outputScale);
            canvas.height = Math.floor(viewport.height * outputScale);
            canvas.style.width = `${Math.floor(viewport.width)}px`;
            canvas.style.height = `${Math.floor(viewport.height)}px`;

            const transform = outputScale !== 1 
                ? [outputScale, 0, 0, outputScale, 0, 0] 
                : null;

            const renderContext = {
                canvasContext: context,
                transform: transform,
                viewport: viewport
            };

            const renderTask = page.render(renderContext);
            renderTaskRef.current = renderTask;
            await renderTask.promise;
        } catch (err: any) {
            if (err?.name !== "RenderingCancelledException") {
                console.error("Page rendering error:", err);
            }
        }
    }, []);

    useEffect(() => {
        if (pdfDoc) {
            renderPage(pageNum, pdfDoc, scale);
        }
    }, [pdfDoc, pageNum, scale, renderPage]);

    const handleFitPage = async () => {
        if (pdfDoc) {
            const fitScale = await calculateFitPageScale(pdfDoc);
            setScale(fitScale);
        }
    };

    const handleFitWidth = async () => {
        if (pdfDoc) {
            const fitScale = await calculateFitWidthScale(pdfDoc);
            setScale(fitScale);
        }
    };

    return (
        <div className={`flex flex-col bg-slate-900 border rounded-2xl overflow-hidden shadow-xl text-white ${className}`}>
            {/* Responsive Document Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 sm:px-4 sm:py-2.5 bg-slate-950/95 border-b border-slate-800 text-xs backdrop-blur-xs">
                {/* Mobile Top Row / Desktop Left Side: Title & Download Button */}
                <div className="flex items-center justify-between gap-2 w-full sm:w-auto">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-slate-200 flex items-center gap-1.5 text-xs truncate">
                            <FileText className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            <span className="hidden md:inline">Official Laboratory Certificate</span>
                            <span className="md:hidden">Official COA</span>
                        </span>
                        {numPages > 1 && (
                            <div className="flex items-center gap-0.5 bg-slate-800/90 px-1.5 py-0.5 rounded-md text-slate-300 border border-slate-700/60">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 text-slate-300 hover:text-white p-0"
                                    disabled={pageNum <= 1}
                                    onClick={() => setPageNum((p) => Math.max(1, p - 1))}
                                >
                                    <ChevronLeft className="h-3 w-3" />
                                </Button>
                                <span className="font-mono text-[10px] sm:text-[11px] px-1">
                                    {pageNum}/{numPages}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 text-slate-300 hover:text-white p-0"
                                    disabled={pageNum >= numPages}
                                    onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
                                >
                                    <ChevronRight className="h-3 w-3" />
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Prominent Download Button on Mobile (Top Right) */}
                    <div className="flex sm:hidden">
                        <Button
                            size="sm"
                            className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-2.5 shadow-xs shrink-0"
                            onClick={() => downloadCoaPdf(url, `COA-${batchNumber || "report"}.pdf`)}
                        >
                            <Download className="h-3.5 w-3.5" />
                            <span>Download</span>
                        </Button>
                    </div>
                </div>

                {/* Mobile Bottom Row / Desktop Right Side: View & Zoom Controls */}
                <div className="flex items-center justify-between sm:justify-end gap-1 sm:gap-1.5 w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-6.5 sm:h-7 px-2 text-[10px] sm:text-[11px] font-semibold border-slate-700 bg-slate-800/80 text-slate-200 hover:text-white hover:bg-slate-700 gap-1"
                            title="Fit entire page to view"
                            onClick={handleFitPage}
                        >
                            <Minimize2 className="h-3 w-3" />
                            <span>Fit Page</span>
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            className="h-6.5 sm:h-7 px-2 text-[10px] sm:text-[11px] font-semibold border-slate-700 bg-slate-800/80 text-slate-200 hover:text-white hover:bg-slate-700 gap-1"
                            title="Fit to Container Width"
                            onClick={handleFitWidth}
                        >
                            <Maximize2 className="h-3 w-3" />
                            <span>Fit Width</span>
                        </Button>
                    </div>

                    <div className="flex items-center gap-0.5 sm:gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6.5 w-6.5 sm:h-7 sm:w-7 text-slate-300 hover:text-white hover:bg-slate-800"
                            title="Zoom Out"
                            onClick={() => setScale((s) => Math.max(0.35, Number((s - 0.1).toFixed(2))))}
                        >
                            <ZoomOut className="h-3.5 w-3.5" />
                        </Button>
                        <span className="font-mono text-[10px] sm:text-[11px] text-slate-400 w-8 sm:w-10 text-center select-none">
                            {Math.round(scale * 100)}%
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6.5 w-6.5 sm:h-7 sm:w-7 text-slate-300 hover:text-white hover:bg-slate-800"
                            title="Zoom In"
                            onClick={() => setScale((s) => Math.min(2.0, Number((s + 0.1).toFixed(2))))}
                        >
                            <ZoomIn className="h-3.5 w-3.5" />
                        </Button>

                        {/* Desktop Download Button */}
                        <div className="hidden sm:flex items-center gap-1.5 ml-1">
                            <div className="h-4 w-px bg-slate-700" />
                            <Button
                                size="sm"
                                className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-2.5 shadow-xs"
                                onClick={() => downloadCoaPdf(url, `COA-${batchNumber || "report"}.pdf`)}
                            >
                                <Download className="h-3 w-3" />
                                <span>Download</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Document Canvas Body */}
            <div 
                ref={containerRef}
                className={`relative flex-1 overflow-auto p-4 sm:p-6 md:p-8 flex items-start justify-center ${containerHeightClass} bg-slate-900/90`}
            >
                {loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/70 backdrop-blur-xs z-10">
                        <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-500 border-t-transparent" />
                        <span className="text-xs font-medium text-slate-300">Rendering Analytical Document...</span>
                    </div>
                )}

                {error ? (
                    <div className="flex flex-col items-center justify-center text-center p-8 space-y-4 max-w-md bg-slate-950/80 border border-slate-800 rounded-2xl my-auto">
                        <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-400 border border-emerald-500/20">
                            <FileText className="h-8 w-8" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="font-bold text-sm text-white">Official Certificate of Analysis</h4>
                            <p className="text-xs text-slate-400">
                                Direct document preview is available via external view or download.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                            <Button
                                variant="outline"
                                className="text-xs h-9 px-4 gap-1.5 rounded-lg border-slate-700 text-slate-200 hover:bg-slate-800"
                                onClick={() => downloadCoaPdf(url, `COA-${batchNumber || "report"}.pdf`)}
                            >
                                <Download className="h-3.5 w-3.5" /> Download PDF
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="shadow-2xl rounded-md overflow-hidden bg-white max-w-full my-auto transition-all border border-slate-700/60 ring-1 ring-black/10">
                        <canvas ref={canvasRef} className="block max-w-full h-auto" />
                    </div>
                )}
            </div>
        </div>
    );
};

export default PDFViewerCanvas;
