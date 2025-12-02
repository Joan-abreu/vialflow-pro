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
        try {
          const base64Image = reader.result as string;

          setProcessingMessage("Analyzing shipping label with AI...");
          console.log("Sending image to AI for analysis...");

          // Call edge function to extract data
          const { data, error } = await supabase.functions.invoke('extract-label-data', {
            body: { imageBase64: base64Image }
          });

          if (error) throw error;

          if (data?.data) {
            if (data.data.ups_tracking_number) {
              data.data.ups_tracking_number = data.data.ups_tracking_number.replace(/\s+/g, '');
            }
            if (data.data.dimension_height_in && data.data.dimension_width_in) {
              const height = parseFloat(data.data.dimension_height_in);
              data.data.dimension_height_in = data.data.dimension_width_in;
              data.data.dimension_width_in = height;
            }
            console.log("Data extracted from label:", data.data);
            setProcessingMessage("Loading extracted data...");
            onDataExtracted(data.data);
            toast.success("Data extracted from label successfully");
          } else {
            throw new Error("No data extracted from image");
          }
        } catch (error: any) {
          console.error('Error processing image:', error);
          toast.error(error.message || "Error processing image");
        } finally {
          setLoading(false);
          setProcessingMessage("");
        }
      };

      reader.onerror = () => {
        setLoading(false);
        setProcessingMessage("");
        toast.error("Error reading image file");
      };

      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Error processing image:', error);
      toast.error(error.message || "Error processing image");
      setLoading(false);
      setProcessingMessage("");
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
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => cameraInputRef.current?.click()}
        disabled={loading}
        title="Take Photo"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        title="Upload Image"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
      </Button>

      {loading && processingMessage && (
        <span className="text-xs text-muted-foreground animate-pulse ml-2">{processingMessage}</span>
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
    </div>
  );
};
