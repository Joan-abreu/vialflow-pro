import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Camera, X, SwitchCamera } from "lucide-react";
import { toast } from "sonner";

interface BarcodeScannerProps {
  onScan: (result: string) => void;
}

const BarcodeScanner = ({ onScan }: BarcodeScannerProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraId, setCameraId] = useState<string>("");
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const startScanning = async (cameraIndex: number = 0) => {
    try {
      const devices = await Html5Qrcode.getCameras();
      
      if (devices && devices.length > 0) {
        setAvailableCameras(devices);
        const selectedCamera = devices[cameraIndex].id;
        setCameraId(selectedCamera);
        setCurrentCameraIndex(cameraIndex);
        
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
                toast.success("Code scanned successfully");
                stopScanning();
              },
              (errorMessage) => {
                // Silent error - scanning in progress
              }
            );
          } catch (error) {
            console.error("Error initializing scanner:", error);
            toast.error("Error starting scanner");
            setIsScanning(false);
          }
        }, 100);
      } else {
        toast.error("No camera found");
      }
    } catch (error) {
      console.error("Error getting cameras:", error);
      toast.error("Error accessing camera");
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

  const switchCamera = async () => {
    if (availableCameras.length <= 1) {
      toast.error("No other cameras available");
      return;
    }

    const nextIndex = (currentCameraIndex + 1) % availableCameras.length;
    await stopScanning();
    setTimeout(() => {
      startScanning(nextIndex);
    }, 100);
  };

  return (
    <div className="space-y-2">
      {!isScanning ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => startScanning()}
          className="w-full"
        >
          <Camera className="mr-2 h-4 w-4" />
          Scan Barcode
        </Button>
      ) : (
        <div className="space-y-2">
          <div id="barcode-reader" className="w-full rounded-lg overflow-hidden border"></div>
          <div className="flex gap-2">
            {availableCameras.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={switchCamera}
                className="flex-1"
              >
                <SwitchCamera className="mr-2 h-4 w-4" />
                Switch Camera
              </Button>
            )}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={stopScanning}
              className="flex-1"
            >
              <X className="mr-2 h-4 w-4" />
              Stop
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BarcodeScanner;
