import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const AccessDenied = () => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Acceso Pendiente</CardTitle>
          <CardDescription className="text-base mt-2">
            Tu cuenta está pendiente de aprobación
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">
            Tu cuenta ha sido creada exitosamente, pero necesitas que un administrador te otorgue permisos antes de poder acceder al sistema.
          </p>
          <p className="text-sm text-muted-foreground font-medium">
            Por favor, contacta al administrador del sistema para solicitar acceso.
          </p>
          <div className="pt-4">
            <Button 
              onClick={handleSignOut}
              variant="outline"
              className="w-full"
            >
              Cerrar Sesión
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccessDenied;
