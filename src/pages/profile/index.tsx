import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/components/ui/sonner";
import { Loader2, Camera, Trash2, User as UserIcon, MapPin, Ruler, KeyRound } from "lucide-react";
import { IconUser, IconDeviceFloppy } from "@tabler/icons-react";
import { getProfile, updateProfile, uploadPhoto, deletePhoto, authService } from "@/api-client";
import type { User } from "@/types";
import type { UserUpdateFormData, ChangePasswordFormData } from "@/schemas";
import { userUpdateSchema, changePasswordSchema } from "@/schemas";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  routes,
  SHIRT_SIZE_LABELS,
  PANTS_SIZE_LABELS,
  BOOT_SIZE_LABELS,
  GLOVES_SIZE_LABELS,
  MASK_SIZE_LABELS,
  SLEEVES_SIZE_LABELS,
  RAIN_BOOTS_SIZE_LABELS,
} from "@/constants";
import { useCepLookup } from "@/hooks/common/use-cep-lookup";
import { DETAIL_PAGE_SPACING } from "@/lib/layout-constants";
import { cn } from "@/lib/utils";
import { UserAvatarDisplay } from "@/components/ui/avatar-display";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showDeletePhotoDialog, setShowDeletePhotoDialog] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");

  // Separate form for the change-password card
  const passwordForm = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onChange",
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  const form = useForm<UserUpdateFormData>({
    resolver: zodResolver(userUpdateSchema),
    defaultValues: {
      email: "",
      phone: "",
      address: "",
      addressNumber: "",
      addressComplement: "",
      neighborhood: "",
      city: "",
      state: "",
      zipCode: "",
    },
  });

  // Setup CEP lookup
  const { lookupCep, isLoading: isLoadingCep } = useCepLookup({
    onSuccess: (data) => {
      form.setValue("address", data.street || "", { shouldDirty: true });
      form.setValue("neighborhood", data.bairro || "", { shouldDirty: true });
      form.setValue("city", data.localidade || "", { shouldDirty: true });
      form.setValue("state", data.uf || "", { shouldDirty: true });
      toast.success("Endereço encontrado!");
    },
    onError: () => {
      toast.error("CEP não encontrado");
    },
  });

  // Watch zipCode field for changes
  const zipCode = form.watch("zipCode");

  // Auto-lookup CEP when it's complete
  useEffect(() => {
    if (zipCode && zipCode.replace(/\D/g, "").length === 8) {
      lookupCep(zipCode);
    }
  }, [zipCode, lookupCep]);

  const handleSave = () => {
    form.handleSubmit(onSubmit)();
  };

  // Load user profile
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const response = await getProfile();

      if (response.success && response.data) {
        setUser(response.data);

        // Set form values
        form.reset({
          email: response.data.email || "",
          phone: response.data.phone || "",
          address: response.data.address || "",
          addressNumber: response.data.addressNumber || "",
          addressComplement: response.data.addressComplement || "",
          neighborhood: response.data.neighborhood || "",
          city: response.data.city || "",
          state: response.data.state || "",
          zipCode: response.data.zipCode || "",
        });
      }
    } catch {
      // Error toast is emitted by the axios error interceptor.
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: UserUpdateFormData) => {
    try {
      setIsSaving(true);
      const response = await updateProfile(data);

      if (response.success) {
        setUser(response.data ?? null);
      }
    } catch (error: any) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error updating profile:", error);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Step 1: validate the new password fields, then prompt for the current
  // password in a confirmation dialog before actually changing it.
  const handleRequestPasswordChange = async () => {
    const isValid = await passwordForm.trigger(["newPassword", "confirmNewPassword"]);
    if (isValid) {
      setCurrentPasswordInput("");
      setShowPasswordDialog(true);
    }
  };

  // Step 2: confirm with the current password and submit.
  const handleConfirmPasswordChange = async () => {
    try {
      setIsChangingPassword(true);
      await authService.changePassword({
        currentPassword: currentPasswordInput,
        newPassword: passwordForm.getValues("newPassword"),
        confirmNewPassword: passwordForm.getValues("confirmNewPassword"),
      });
      // Success toast is emitted by the axios success interceptor.
      passwordForm.reset();
      setCurrentPasswordInput("");
      setShowPasswordDialog(false);
    } catch {
      // Error toast is emitted by the axios error interceptor (e.g. wrong password).
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type - check both MIME type and extension
    const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const fileName = file.name.toLowerCase();
    const hasValidMimeType = validMimeTypes.includes(file.type.toLowerCase());
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));

    if (!hasValidMimeType && !hasValidExtension) {
      toast.error("Formato de arquivo inválido. Use JPG, JPEG, PNG, GIF ou WEBP.");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Tamanho máximo: 5MB");
      return;
    }

    try {
      setIsUploadingPhoto(true);

      // Upload photo with user name for proper file organization
      const response = await uploadPhoto(file, user?.name);

      if (response.success) {
        setUser(response.data ?? null);
      }
    } catch (error: any) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error uploading photo:", error);
      }
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async () => {
    try {
      setIsUploadingPhoto(true);
      const response = await deletePhoto();

      if (response.success) {
        setUser(response.data ?? null);
      }
    } catch (error: any) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error deleting photo:", error);
      }
    } finally {
      setIsUploadingPhoto(false);
      setShowDeletePhotoDialog(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Usuário não encontrado</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", DETAIL_PAGE_SPACING.CONTAINER)}>
      <div className="flex-shrink-0">
        <PageHeader
          title="Meu Perfil"
          icon={IconUser}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Meu Perfil" }
          ]}
          actions={[
            {
              key: "save",
              label: "Salvar Alterações",
              icon: IconDeviceFloppy,
              onClick: handleSave,
              variant: "default",
              disabled: isSaving || !form.formState.isDirty,
              loading: isSaving,
            }
          ]}
        />
      </div>

      <div className={cn("flex-1 min-h-0 overflow-auto", DETAIL_PAGE_SPACING.HEADER_TO_GRID)}>
        <div className="min-h-full">
          <div className="grid gap-6 md:grid-cols-[300px,1fr] min-h-full md:items-stretch">
            {/* First Column: Profile Photo (Full Height) */}
            <Card className="md:h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Foto de Perfil
              </CardTitle>
              <CardDescription>Atualize sua foto de perfil</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <div className="relative">
                <UserAvatarDisplay
                  avatar={user.avatar}
                  userName={user.name}
                  size="2xl"
                  shape="circle"
                  bordered={true}
                />

                {isUploadingPhoto && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 w-full">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={isUploadingPhoto}
                  onClick={() => document.getElementById("photo-upload")?.click()}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  {user.avatarId ? "Alterar Foto" : "Adicionar Foto"}
                </Button>

                <input
                  id="photo-upload"
                  type="file"
                  accept=".jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={isUploadingPhoto}
                />

                {user.avatarId && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    disabled={isUploadingPhoto}
                    onClick={() => setShowDeletePhotoDialog(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remover Foto
                  </Button>
                )}
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Formatos aceitos: JPG, PNG, GIF, WEBP
                <br />
                Tamanho máximo: 5MB
              </p>
            </CardContent>
          </Card>

          {/* Second Column: Basic Info, Measures, and Address */}
          <div className="space-y-6">
            {/* Basic Information Card with Email and Phone */}
            <div className="grid gap-6 lg:grid-cols-2 items-stretch">
              {/* Basic Information Card with Email and Phone */}
              <Form {...form}>
                <Card className="h-full flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserIcon className="w-5 h-5" />
                      Informações Básicas
                    </CardTitle>
                    <CardDescription>Seus dados básicos e de contato</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 flex-1 content-start">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Nome</label>
                      <Input value={user.name} disabled />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Cargo</label>
                      <Input value={user.position?.name || "Não definido"} disabled />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Setor</label>
                      <Input value={user.sector?.name || "Não definido"} disabled />
                    </div>
                    <FormInput
                      name="email"
                      type="email"
                      label="E-mail"
                      placeholder="Digite seu e-mail"
                      disabled={isSaving}
                    />
                    <FormInput
                      name="phone"
                      type="phone"
                      label="Telefone"
                      placeholder="Digite seu telefone"
                      disabled={isSaving}
                    />
                  </CardContent>
                </Card>
              </Form>

              {/* Security Card: Change Password */}
              <Form {...passwordForm}>
                <Card className="h-full flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <KeyRound className="w-5 h-5" />
                      Segurança
                    </CardTitle>
                    <CardDescription>Altere sua senha de acesso</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 flex-1 content-start">
                    <FormInput
                      name="newPassword"
                      type="password"
                      label="Nova senha"
                      placeholder="Mínimo de 6 caracteres"
                      disabled={isChangingPassword}
                      autoComplete="new-password"
                    />
                    <FormInput
                      name="confirmNewPassword"
                      type="password"
                      label="Confirmar nova senha"
                      placeholder="Repita a nova senha"
                      disabled={isChangingPassword}
                      autoComplete="new-password"
                    />
                  </CardContent>
                  <CardFooter className="justify-end">
                    <Button
                      type="button"
                      onClick={handleRequestPasswordChange}
                      disabled={isChangingPassword}
                    >
                      <KeyRound className="w-4 h-4 mr-2" />
                      Alterar Senha
                    </Button>
                  </CardFooter>
                </Card>
              </Form>
            </div>

            {/* Bottom Row: Measures and Address */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Measures Card */}
              {user.ppeSize && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Ruler className="w-5 h-5" />
                      Medidas
                    </CardTitle>
                    <CardDescription>Suas medidas para EPIs (somente leitura)</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {user.ppeSize.shirts && (
                      <div>
                        <label className="text-sm font-medium">Camisa</label>
                        <p className="text-sm text-muted-foreground mt-1">{SHIRT_SIZE_LABELS[user.ppeSize.shirts]}</p>
                      </div>
                    )}
                    {user.ppeSize.pants && (
                      <div>
                        <label className="text-sm font-medium">Calça</label>
                        <p className="text-sm text-muted-foreground mt-1">{PANTS_SIZE_LABELS[user.ppeSize.pants]}</p>
                      </div>
                    )}
                    {user.ppeSize.boots && (
                      <div>
                        <label className="text-sm font-medium">Bota</label>
                        <p className="text-sm text-muted-foreground mt-1">{BOOT_SIZE_LABELS[user.ppeSize.boots]}</p>
                      </div>
                    )}
                    {user.ppeSize.gloves && (
                      <div>
                        <label className="text-sm font-medium">Luvas</label>
                        <p className="text-sm text-muted-foreground mt-1">{GLOVES_SIZE_LABELS[user.ppeSize.gloves]}</p>
                      </div>
                    )}
                    {user.ppeSize.mask && (
                      <div>
                        <label className="text-sm font-medium">Máscara</label>
                        <p className="text-sm text-muted-foreground mt-1">{MASK_SIZE_LABELS[user.ppeSize.mask]}</p>
                      </div>
                    )}
                    {user.ppeSize.sleeves && (
                      <div>
                        <label className="text-sm font-medium">Mangas</label>
                        <p className="text-sm text-muted-foreground mt-1">{SLEEVES_SIZE_LABELS[user.ppeSize.sleeves]}</p>
                      </div>
                    )}
                    {user.ppeSize.rainBoots && (
                      <div>
                        <label className="text-sm font-medium">Galocha</label>
                        <p className="text-sm text-muted-foreground mt-1">{RAIN_BOOTS_SIZE_LABELS[user.ppeSize.rainBoots]}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Address Card (Editable Form) */}
              <Form {...form}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      Endereço
                    </CardTitle>
                    <CardDescription>Atualize seu endereço</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <FormInput
                          name="address"
                          label="Endereço"
                          placeholder="Rua, avenida..."
                          disabled={isSaving || isLoadingCep}
                        />
                      </div>
                      <FormInput
                        name="addressNumber"
                        label="Número"
                        placeholder="Nº"
                        disabled={isSaving}
                      />
                    </div>
                    <FormInput
                      name="addressComplement"
                      label="Complemento"
                      placeholder="Apto, bloco..."
                      disabled={isSaving}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormInput
                        name="neighborhood"
                        label="Bairro"
                        placeholder="Digite o bairro"
                        disabled={isSaving || isLoadingCep}
                      />
                      <div className="relative">
                        <FormInput
                          name="zipCode"
                          type="cep"
                          label="CEP"
                          placeholder="00000-000"
                          disabled={isSaving}
                        />
                        {isLoadingCep && (
                          <div className="absolute right-3 top-9">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormInput
                        name="city"
                        label="Cidade"
                        placeholder="Digite a cidade"
                        disabled={isSaving || isLoadingCep}
                      />
                      <FormInput
                        name="state"
                        label="Estado"
                        placeholder="UF"
                        disabled={isSaving || isLoadingCep}
                        maxLength={2}
                      />
                    </div>
                  </CardContent>
                </Card>
              </Form>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Delete Photo Confirmation Dialog */}
      <AlertDialog open={showDeletePhotoDialog} onOpenChange={setShowDeletePhotoDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Foto de Perfil</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover sua foto de perfil? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUploadingPhoto}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePhoto}
              disabled={isUploadingPhoto}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isUploadingPhoto ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Current Password Dialog */}
      <Dialog
        open={showPasswordDialog}
        onOpenChange={(open) => {
          if (!isChangingPassword) {
            setShowPasswordDialog(open);
            if (!open) setCurrentPasswordInput("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              Confirme sua senha atual
            </DialogTitle>
            <DialogDescription>
              Para alterar sua senha, digite sua senha atual para confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Senha atual</label>
            <Input
              type="password"
              placeholder="Digite sua senha atual"
              value={currentPasswordInput}
              onChange={(value) => setCurrentPasswordInput((value as string) ?? "")}
              disabled={isChangingPassword}
              autoComplete="current-password"
              onKeyDown={(e) => {
                if (e.key === "Enter" && currentPasswordInput.length >= 6 && !isChangingPassword) {
                  handleConfirmPasswordChange();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordDialog(false);
                setCurrentPasswordInput("");
              }}
              disabled={isChangingPassword}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmPasswordChange}
              disabled={isChangingPassword || currentPasswordInput.length < 6}
            >
              {isChangingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Alterando...
                </>
              ) : (
                "Alterar Senha"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
