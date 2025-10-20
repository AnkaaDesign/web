import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Camera, Trash2, User as UserIcon, Mail, Phone, MapPin, Briefcase, Save, RefreshCw } from "lucide-react";
import { getProfile, updateProfile, uploadPhoto, deletePhoto } from "@/api-client";
import type { User } from "@/types";
import type { UserUpdateFormData } from "@/schemas";
import { userUpdateSchema } from "@/schemas";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import { routes } from "@/constants";
import { useAuth } from "@/contexts/auth-context";

export function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const { refreshUser } = useAuth();

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

  const handleSave = () => {
    form.handleSubmit(onSubmit)();
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await refreshUser(); // Refresh auth context user data
      await loadProfile(); // Reload profile data
      toast.success("Dados atualizados com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao atualizar dados");
    } finally {
      setIsRefreshing(false);
    }
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

        // Set photo preview if avatar exists
        if (response.data.avatar) {
          setPhotoPreview(response.data.avatar.url || null);
        }
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Erro ao carregar perfil");
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: UserUpdateFormData) => {
    try {
      setIsSaving(true);
      const response = await updateProfile(data);

      if (response.success) {
        toast.success("Perfil atualizado com sucesso!");
        setUser(response.data);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Erro ao atualizar perfil");
    } finally {
      setIsSaving(false);
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

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload photo with user name for proper file organization
      const response = await uploadPhoto(file, user?.name);

      if (response.success) {
        toast.success("Foto atualizada com sucesso!");
        setUser(response.data);
        if (response.data.avatar) {
          setPhotoPreview(response.data.avatar.url || null);
        }
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Erro ao fazer upload da foto");
      // Restore previous photo on error
      if (user?.avatar) {
        setPhotoPreview(user.avatar.url || null);
      } else {
        setPhotoPreview(null);
      }
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!window.confirm("Tem certeza que deseja remover sua foto de perfil?")) {
      return;
    }

    try {
      setIsUploadingPhoto(true);
      const response = await deletePhoto();

      if (response.success) {
        toast.success("Foto removida com sucesso!");
        setUser(response.data);
        setPhotoPreview(null);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Erro ao remover foto");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
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
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Meu Perfil"
          icon={UserIcon}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Meu Perfil" }
          ]}
          actions={[
            {
              key: "refresh",
              label: "Atualizar Dados",
              icon: RefreshCw,
              onClick: handleRefresh,
              variant: "outline",
              disabled: isRefreshing,
              loading: isRefreshing,
            },
            {
              key: "save",
              label: "Salvar Alterações",
              icon: Save,
              onClick: handleSave,
              variant: "default",
              disabled: isSaving || !form.formState.isDirty,
              loading: isSaving,
            }
          ]}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 w-full">
          <div className="grid gap-6 md:grid-cols-[300px,1fr]">
        {/* Profile Photo Card */}
        <Card>
          <CardHeader>
            <CardTitle>Foto de Perfil</CardTitle>
            <CardDescription>Atualize sua foto de perfil</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <div className="relative">
              <Avatar className="w-32 h-32">
                <AvatarImage src={photoPreview || undefined} alt={user.name} />
                <AvatarFallback className="text-2xl">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>

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
                  onClick={handleDeletePhoto}
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

        {/* Profile Information Form */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="w-5 h-5" />
                Informações Básicas
              </CardTitle>
              <CardDescription>Seus dados básicos (somente leitura)</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div>
                <label className="text-sm font-medium">Nome</label>
                <p className="text-sm text-muted-foreground mt-1">{user.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Cargo</label>
                <p className="text-sm text-muted-foreground mt-1">
                  {user.position?.name || "Não definido"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Setor</label>
                <p className="text-sm text-muted-foreground mt-1">
                  {user.sector?.name || "Não definido"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Form {...form}>
            <form className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    Informações de Contato
                  </CardTitle>
                  <CardDescription>Atualize seus dados de contato</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
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
                        disabled={isSaving}
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
                      disabled={isSaving}
                    />
                    <FormInput
                      name="zipCode"
                      type="cep"
                      label="CEP"
                      placeholder="00000-000"
                      disabled={isSaving}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormInput
                      name="city"
                      label="Cidade"
                      placeholder="Digite a cidade"
                      disabled={isSaving}
                    />
                    <FormInput
                      name="state"
                      label="Estado"
                      placeholder="UF"
                      disabled={isSaving}
                      maxLength={2}
                    />
                  </div>
                </CardContent>
              </Card>

            </form>
          </Form>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}
