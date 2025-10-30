import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shield, Loader2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";

interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
  role: string;
  role_id: string;
}

const Users = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate("/");
      toast.error("No tienes permisos para acceder a esta página");
    }
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      // Get all users from auth.users via profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name");

      if (profilesError) throw profilesError;

      // Get user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("id, user_id, role");

      if (rolesError) throw rolesError;

      // We need to get emails from auth metadata
      const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) {
        console.error("Error fetching auth users:", authError);
        toast.error("Error al cargar usuarios");
        return;
      }

      // Combine data
      const usersWithRoles = authUsers?.map(user => {
        const profile = profilesData?.find(p => p.user_id === user.id);
        const userRole = rolesData?.find(r => r.user_id === user.id);
        
        return {
          id: user.id,
          email: user.email || "No email",
          created_at: user.created_at,
          full_name: profile?.full_name,
          role: userRole?.role || "pending",
          role_id: userRole?.id || "",
        };
      }) || [];

      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, roleId: string, newRole: string) => {
    try {
      setUpdatingUser(userId);

      // Delete old role
      if (roleId) {
        await supabase.from("user_roles").delete().eq("id", roleId);
      }

      // Insert new role
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("user_roles").insert([{
        user_id: userId,
        role: newRole as any,
        granted_by: user?.id,
      }]);

      if (error) throw error;

      toast.success("Rol actualizado exitosamente");
      fetchUsers();
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast.error("Error al actualizar rol");
    } finally {
      setUpdatingUser(null);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "default";
      case "manager":
        return "secondary";
      case "staff":
        return "outline";
      case "pending":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: "Administrador",
      manager: "Gerente",
      staff: "Personal",
      pending: "Pendiente",
    };
    return labels[role] || role;
  };

  if (roleLoading || !isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              Gestión de Usuarios
            </h1>
            <p className="text-muted-foreground mt-2">
              Administra los roles y permisos de los usuarios del sistema
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Usuarios del Sistema</CardTitle>
            <CardDescription>
              Asigna roles a los usuarios para controlar sus permisos de acceso
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No hay usuarios registrados
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Fecha de Registro</TableHead>
                      <TableHead>Rol Actual</TableHead>
                      <TableHead>Cambiar Rol</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell>
                          {new Date(user.created_at).toLocaleDateString("es-ES", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(user.role)}>
                            {getRoleLabel(user.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(value) => handleRoleChange(user.id, user.role_id, value)}
                            disabled={updatingUser === user.id}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Administrador</SelectItem>
                              <SelectItem value="manager">Gerente</SelectItem>
                              <SelectItem value="staff">Personal</SelectItem>
                              <SelectItem value="pending">Pendiente</SelectItem>
                            </SelectContent>
                          </Select>
                          {updatingUser === user.id && (
                            <Loader2 className="h-4 w-4 animate-spin ml-2 inline" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Users;
