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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const processImage = async (file: File) => {
    setLoading(true);
    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Image = reader.result as string;
        
        console.log("Sending image to AI for analysis...");
        
        // Call edge function to extract data
        const { data, error } = await supabase.functions.invoke('extract-label-data', {
          body: { imageBase64: base64Image }
        });

        if (error) throw error;

        if (data?.data) {
          console.log("Data extracted from label:", data.data);
          onDataExtracted(data.data);
          toast.success("Datos extraídos de la etiqueta exitosamente");
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
      toast.error(error.message || "Error al procesar la imagen");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error("Por favor selecciona una imagen");
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
          Tomar Foto
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
          Cargar Imagen
        </Button>
      </div>

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
        Escanea o carga una foto de la etiqueta de envío para auto-completar los datos
      </p>
    </div>
  );
};
