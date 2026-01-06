import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../constants";
import { IconUserCog, IconPlus, IconTrash, IconKey, IconRefresh, IconUser, IconCheck, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { cn } from "@/lib/utils";
import { useSystemUsers, useCreateSystemUser, useDeleteSystemUser, useSetSystemUserPassword } from "../../hooks";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createUserSchema, setUserPasswordSchema } from "../../schemas";
import type { CreateUserFormData, SetUserPasswordFormData } from "../../schemas";

export function ServerUsersPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  // Track page access
  usePageTracker({
    title: "Usuários do Sistema",
    icon: "user-cog",
  });

  // Hooks for user management
  const { data: users, isLoading, refetch } = useSystemUsers();
  const { mutate: createUser, isPending: creatingUser } = useCreateSystemUser();
  const { mutate: deleteUser, isPending: deletingUser } = useDeleteSystemUser();
  const { mutate: setUserPassword, isPending: settingPassword } = useSetSystemUserPassword();

  // Create user form
  const createForm = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: "",
      fullName: "",
      password: "",
    },
  });

  // Set password form
  const passwordForm = useForm<SetUserPasswordFormData>({
    resolver: zodResolver(setUserPasswordSchema),
    defaultValues: {
      password: "",
    },
  });

  const handleCreateUser = (data: CreateUserFormData) => {
    createUser(data, {
      onSuccess: (response) => {
        if (response.success) {
          setIsCreateDialogOpen(false);
          createForm.reset();
          refetch();
        }
      },
    });
  };

  const handleDeleteUser = (username: string) => {
    deleteUser(username, {
      onSuccess: (response) => {
        if (response.success) {
          refetch();
        }
      },
    });
  };

  const handleSetPassword = (data: SetUserPasswordFormData) => {
    if (!selectedUser) return;

    setUserPassword(
      { username: selectedUser, data },
      {
        onSuccess: (response) => {
          if (response.success) {
            setIsPasswordDialogOpen(false);
            setSelectedUser(null);
            passwordForm.reset();
          }
        },
      },
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <IconCheck className="h-4 w-4 text-green-700 dark:text-green-400" />;
      case "inactive":
        return <IconX className="h-4 w-4 text-muted-foreground" />;
      case "locked":
        return <IconX className="h-4 w-4 text-red-700 dark:text-red-400" />;
      default:
        return <IconUser className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusVariant = (status: string): "success" | "secondary" | "destructive" => {
    switch (status) {
      case "active":
        return "success";
      case "inactive":
        return "secondary";
      case "locked":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "Ativo";
      case "inactive":
        return "Inativo";
      case "locked":
        return "Bloqueado";
      default:
        return "Desconhecido";
    }
  };

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="h-full flex flex-col px-4 pt-4">
        <div className="flex-shrink-0">
          <PageHeader
            title="Usuários do Sistema"
            icon={IconUserCog}
            favoritePage={FAVORITE_PAGES.SERVIDOR_USUARIOS}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Servidor", href: routes.server.root }, { label: "Usuários do Sistema" }]}
            actions={[
              {
                key: "create",
                label: "Criar Usuário",
                icon: IconPlus,
                onClick: () => setIsCreateDialogOpen(true),
                variant: "default" as const,
              },
              {
                key: "refresh",
                label: "Atualizar",
                icon: IconRefresh,
                onClick: () => {
                  refetch();
                },
                variant: "outline" as const,
                disabled: isLoading,
              },
            ]}
          />
        </div>

        {/* Content Card */}
        <Card className={cn("flex-1 flex flex-col shadow-sm border border-border overflow-hidden mt-4")}>
          <CardContent className="flex-1 flex flex-col overflow-auto pb-6">
            {/* Create User Dialog */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogContent>
                <form onSubmit={createForm.handleSubmit(handleCreateUser)}>
                  <DialogHeader>
                    <DialogTitle>Criar Novo Usuário</DialogTitle>
                    <DialogDescription>Criar um novo usuário no sistema operacional</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Nome de usuário</Label>
                      <Input id="username" {...createForm.register("username")} placeholder="Digite o nome de usuário" />
                      {createForm.formState.errors.username && <p className="text-sm text-red-600">{createForm.formState.errors.username.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Nome completo (opcional)</Label>
                      <Input id="fullName" {...createForm.register("fullName")} placeholder="Digite o nome completo" />
                      {createForm.formState.errors.fullName && <p className="text-sm text-red-600">{createForm.formState.errors.fullName.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Senha (opcional)</Label>
                      <Input id="password" type="password" {...createForm.register("password")} placeholder="Digite a senha" />
                      {createForm.formState.errors.password && <p className="text-sm text-red-600">{createForm.formState.errors.password.message}</p>}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={creatingUser}>
                      {creatingUser ? "Criando..." : "Criar Usuário"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            {/* Users List */}
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex justify-between items-center p-4 border rounded-lg">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-8 w-20" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {users?.data?.map((systemUser) => (
                  <div key={systemUser.username} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {getStatusIcon(systemUser.status)}
                          <h3 className="text-lg font-semibold text-secondary-foreground">{systemUser.username}</h3>
                          <Badge variant={getStatusVariant(systemUser.status)}>{getStatusText(systemUser.status)}</Badge>
                        </div>
                        {systemUser.fullName && <p className="text-muted-foreground mb-2">{systemUser.fullName}</p>}
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div>
                            UID: {systemUser.uid} | GID: {systemUser.gid}
                          </div>
                          <div>Home: {systemUser.home}</div>
                          <div>Shell: {systemUser.shell}</div>
                          {systemUser.lastLogin && <div>Último login: {new Date(systemUser.lastLogin).toLocaleString("pt-BR")}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {/* Set Password */}
                        <Dialog
                          open={isPasswordDialogOpen && selectedUser === systemUser.username}
                          onOpenChange={(open) => {
                            if (open) {
                              setSelectedUser(systemUser.username);
                              setIsPasswordDialogOpen(true);
                            } else {
                              setIsPasswordDialogOpen(false);
                              setSelectedUser(null);
                              passwordForm.reset();
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <IconKey className="h-4 w-4 mr-1" />
                              Senha
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <form onSubmit={passwordForm.handleSubmit(handleSetPassword)}>
                              <DialogHeader>
                                <DialogTitle>Alterar Senha</DialogTitle>
                                <DialogDescription>Definir nova senha para o usuário {systemUser.username}</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label htmlFor="new-password">Nova senha</Label>
                                  <Input id="new-password" type="password" {...passwordForm.register("password")} placeholder="Digite a nova senha" />
                                  {passwordForm.formState.errors.password && <p className="text-sm text-red-600">{passwordForm.formState.errors.password.message}</p>}
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    setIsPasswordDialogOpen(false);
                                    setSelectedUser(null);
                                    passwordForm.reset();
                                  }}
                                >
                                  Cancelar
                                </Button>
                                <Button type="submit" disabled={settingPassword}>
                                  {settingPassword ? "Alterando..." : "Alterar Senha"}
                                </Button>
                              </DialogFooter>
                            </form>
                          </DialogContent>
                        </Dialog>

                        {/* Delete User */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <IconTrash className="h-4 w-4 mr-1" />
                              Remover
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar remoção</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza de que deseja remover o usuário <strong>{systemUser.username}</strong>? Esta ação não pode ser desfeita e removerá permanentemente a
                                conta do usuário do sistema.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteUser(systemUser.username)} disabled={deletingUser} className="bg-red-600 hover:bg-red-700">
                                {deletingUser ? "Removendo..." : "Remover Usuário"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                ))}
                {(!users?.data || users.data.length === 0) && !isLoading && <div className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado</div>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PrivilegeRoute>
  );
}
