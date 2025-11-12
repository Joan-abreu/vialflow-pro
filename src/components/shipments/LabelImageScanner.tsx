import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface LabelImageScannerProps {
  onDataExtracted: (data: any) => void;
}

export const LabelImageScanner = ({ onDataExtracted }: LabelImageScannerProps) => {
  const [loading, setLoading] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const processImage = async (file: File) => {
    setLoading(true);
    setProcessingMessage("Processing image...");
    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Image = reader.result as string;
        
        setProcessingMessage("Analyzing shipping label with AI...");
        console.log("Sending image to AI for analysis...");
        
        // Call edge function to extract data
        const { data, error } = await supabase.functions.invoke('extract-label-data', {
          body: { imageBase64: base64Image }
        });

        if (error) throw error;

        if (data?.data) {
          console.log("Data extracted from label:", data.data);
          setProcessingMessage("Data extracted successfully!");
          onDataExtracted(data.data);
          toast.success("Data extracted from label successfully");
        } else {
          throw new Error("No data extracted from image");
        }
      };
      
      reader.onerror = () => {
        throw new Error("Error reading image file");
      };
      
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Error processing image:', error);
      toast.error(error.message || "Error processing image");
      setProcessingMessage("");
    } finally {
      setTimeout(() => {
        setLoading(false);
        setProcessingMessage("");
      }, 1000);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error("Please select an image");
        return;
      }
      processImage(file);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => cameraInputRef.current?.click()}
          disabled={loading}
          className="flex-1"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Camera className="mr-2 h-4 w-4" />
          )}
          Take Photo
        </Button>
        
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="flex-1"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Upload Image
        </Button>
      </div>

      {loading && processingMessage && (
        <div className="flex items-center justify-center gap-2 p-3 bg-primary/10 rounded-lg animate-pulse">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium text-primary">{processingMessage}</span>
        </div>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <p className="text-xs text-muted-foreground text-center">
        Scan or upload a photo of the shipping label to auto-fill the data
      </p>
    </div>
  );
};
