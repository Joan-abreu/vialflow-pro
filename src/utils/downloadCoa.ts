import { toast } from "sonner";

/**
 * Downloads a COA PDF file directly using browser Blobs so the external Supabase URL is completely hidden from the user.
 */
export async function downloadCoaPdf(url: string, filename: string) {
    try {
        const cleanName = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to download PDF`);
        
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = cleanName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Clean up object URL after download trigger
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    } catch (err: any) {
        console.error("COA download error:", err);
        // Fallback: open in new tab
        window.open(url, "_blank");
    }
}
