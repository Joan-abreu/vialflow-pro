import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";

interface BarcodeScannerProps {
  onScan: (result: string) => void;
}

const BarcodeScanner = ({ onScan }: BarcodeScannerProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraId, setCameraId] = useState<string>("");

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const startScanning = async () => {
    try {
      const devices = await Html5Qrcode.getCameras();
      
      if (devices && devices.length > 0) {
        const selectedCamera = devices[0].id;
        setCameraId(selectedCamera);
        
        // Primero mostrar el contenedor
        setIsScanning(true);
        
        // Esperar a que el elemento esté en el DOM
        setTimeout(async () => {
          try {
            const scanner = new Html5Qrcode("barcode-reader");
            scannerRef.current = scanner;

            await scanner.start(
              selectedCamera,
              {
                fps: 10,
                qrbox: { width: 250, height: 150 },
              },
              (decodedText) => {
                onScan(decodedText);
                toast.success("Código escaneado correctamente");
                stopScanning();
              },
              (errorMessage) => {
                // Silent error - scanning in progress
              }
            );
          } catch (error) {
            console.error("Error initializing scanner:", error);
            toast.error("Error al iniciar el escáner");
            setIsScanning(false);
          }
        }, 100);
      } else {
        toast.error("No se encontró ninguna cámara");
      }
    } catch (error) {
      console.error("Error getting cameras:", error);
      toast.error("Error al acceder a la cámara");
    }
  };

  const stopScanning = async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
      setIsScanning(false);
    } catch (error) {
      console.error("Error stopping scanner:", error);
    }
  };

  return (
    <div className="space-y-2">
      {!isScanning ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={startScanning}
          className="w-full"
        >
          <Camera className="mr-2 h-4 w-4" />
          Escanear Código de Barras
        </Button>
      ) : (
        <div className="space-y-2">
          <div id="barcode-reader" className="w-full rounded-lg overflow-hidden border"></div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={stopScanning}
            className="w-full"
          >
            <X className="mr-2 h-4 w-4" />
            Detener Escáner
          </Button>
        </div>
      )}
    </div>
  );
};

export default BarcodeScanner;
