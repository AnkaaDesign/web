import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FormCombobox } from "@/components/ui/form-combobox";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import {
  IconBell,
  IconSend,
  IconClock,
  IconMail,
  IconDeviceMobile,
  IconBrandWhatsapp,
  IconBellRinging,
  IconX,
} from "@tabler/icons-react";
import { FAVORITE_PAGES } from "../../../constants";
import { apiClient } from "@/api-client/axiosClient";
import { useUsersInfinite } from "@/hooks/useUser";
import { useSectorsInfinite } from "@/hooks/useSector";

// =====================
// Types & Schema
// =====================

const notificationSchema = z.object({
  title: z.string().min(3, "Título deve ter no mínimo 3 caracteres"),
  body: z.string().min(10, "Mensagem deve ter no mínimo 10 caracteres"),
  type: z.enum(["SYSTEM", "GENERAL", "WARNING"]),
  importance: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  channels: z.array(z.enum(["IN_APP", "EMAIL", "PUSH", "WHATSAPP"])).min(1, "Selecione pelo menos um canal"),
  actionUrl: z.string().optional(),
  scheduledAt: z.date().nullable().optional(),
  targetType: z.enum(["all", "sectors", "users"]),
  targetSectors: z.array(z.string()).optional(),
  targetUsers: z.array(z.string()).optional(),
});

type NotificationFormData = z.infer<typeof notificationSchema>;

// =====================
// Main Component
// =====================

export const CreateNotificationPage = () => {
  const navigate = useNavigate();
  const [isSending, setIsSending] = useState(false);
  const [scheduleLater, setScheduleLater] = useState(false);

  // Fetch users with infinite scroll support
  const {
    data: usersData,
    fetchNextPage: fetchNextUsers,
    hasNextPage: hasNextUsers,
    isFetchingNextPage: isFetchingNextUsers,
  } = useUsersInfinite({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: { name: "asc" },
    take: 50, // Load 50 users at a time
  });

  // Fetch sectors with infinite scroll support
  const {
    data: sectorsData,
    fetchNextPage: fetchNextSectors,
    hasNextPage: hasNextSectors,
    isFetchingNextPage: isFetchingNextSectors,
  } = useSectorsInfinite({
    orderBy: { name: "asc" },
    take: 50, // Load 50 sectors at a time
  });

  // Flatten paginated data for users
  const allUsers = usersData?.pages.flatMap((page) => page.data) || [];

  // Flatten paginated data for sectors
  const allSectors = sectorsData?.pages.flatMap((page) => page.data) || [];

  const form = useForm<NotificationFormData>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      type: "SYSTEM", // SYSTEM type is mandatory - users cannot hide these
      importance: "NORMAL",
      channels: ["IN_APP", "PUSH"], // In-app and push mobile enabled by default, email disabled
      targetType: "all",
      targetSectors: [],
      targetUsers: [],
    },
  });

  const onSubmit = async (data: NotificationFormData) => {
    try {
      setIsSending(true);

      // Prepare payload based on target type
      const payload: any = {
        title: data.title,
        body: data.body,
        type: data.type,
        importance: data.importance,
        channel: data.channels,
        actionUrl: data.actionUrl || undefined,
        scheduledAt: scheduleLater && data.scheduledAt ? data.scheduledAt.toISOString() : undefined,
      };

      // Add targeting based on selection
      if (data.targetType === "sectors" && data.targetSectors && data.targetSectors.length > 0) {
        payload.targetSectors = data.targetSectors;
      } else if (data.targetType === "users" && data.targetUsers && data.targetUsers.length > 0) {
        payload.targetUsers = data.targetUsers;
      }
      // If targetType is "all", send to all users (handled by backend)

      // Send notification via admin endpoint
      await apiClient.post("/admin/notifications/send", payload);

      // API already shows success toast, so we don't need to show another one here

      // Navigate back to notifications list
      navigate("/administracao/notificacoes");
    } catch (error: any) {
      console.error("Error sending notification:", error);
      toast.error(error?.message || "Erro ao enviar notificação");
    } finally {
      setIsSending(false);
    }
  };

  const handleCancel = () => {
    navigate("/administracao/notificacoes");
  };

  const handleSubmit = () => {
    form.handleSubmit(onSubmit)();
  };

  const selectedChannels = form.watch("channels") || [];
  const notificationType = form.watch("type");
  const targetType = form.watch("targetType");

  return (
    <FormProvider {...form}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-3xl flex-shrink-0">
          <PageHeader
            title="Nova Notificação Manual"
            icon={IconBell}
            favoritePage={FAVORITE_PAGES.ADMINISTRACAO_NOTIFICACOES_CADASTRAR}
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Administração", href: "/administracao" },
              { label: "Notificações", href: "/administracao/notificacoes" },
              { label: "Nova Notificação" },
            ]}
            variant="form"
            actions={[
              {
                key: "cancel",
                label: "Cancelar",
                icon: IconX,
                onClick: handleCancel,
                variant: "outline",
                disabled: isSending,
              },
              {
                key: "submit",
                label: scheduleLater ? "Agendar" : "Enviar Agora",
                icon: scheduleLater ? IconClock : IconSend,
                onClick: handleSubmit,
                variant: "default",
                disabled: isSending,
              },
            ]}
          />
        </div>

        <div className="flex-1 overflow-y-auto pb-6">
          <div className="container mx-auto max-w-3xl space-y-4">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
              <CardDescription>
                Defina o título e conteúdo da notificação
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">
                  Título <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="Ex: Atualização Importante do Sistema"
                  {...form.register("title")}
                />
                {form.formState.errors.title && (
                  <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="body">
                  Mensagem <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="body"
                  rows={5}
                  placeholder="Digite a mensagem completa da notificação..."
                  {...form.register("body")}
                />
                {form.formState.errors.body && (
                  <p className="text-sm text-destructive">{form.formState.errors.body.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormCombobox
                  name="type"
                  label="Tipo"
                  required
                  placeholder="Selecione o tipo"
                  options={[
                    { value: "SYSTEM", label: "Sistema (Obrigatória)" },
                    { value: "WARNING", label: "Aviso" },
                    { value: "GENERAL", label: "Geral" },
                  ]}
                  searchable={false}
                />

                <FormCombobox
                  name="importance"
                  label="Importância"
                  required
                  placeholder="Selecione a importância"
                  options={[
                    { value: "LOW", label: "Baixa" },
                    { value: "NORMAL", label: "Normal" },
                    { value: "HIGH", label: "Alta" },
                    { value: "URGENT", label: "Urgente" },
                  ]}
                  searchable={false}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="actionUrl">URL de Ação (Opcional)</Label>
                <Input
                  id="actionUrl"
                  placeholder="/administracao/configuracoes"
                  {...form.register("actionUrl")}
                />
                <p className="text-xs text-muted-foreground">
                  URL para onde o usuário será direcionado ao clicar na notificação
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Channels */}
          <Card>
            <CardHeader>
              <CardTitle>Canais de Entrega</CardTitle>
              <CardDescription>
                Selecione os canais para enviar a notificação
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-3 border border-border/40 rounded-lg p-4">
                  <Checkbox
                    id="channel-in-app"
                    checked={selectedChannels.includes("IN_APP")}
                    onCheckedChange={(checked) => {
                      const current = selectedChannels;
                      if (checked) {
                        form.setValue("channels", [...current, "IN_APP"]);
                      } else {
                        form.setValue("channels", current.filter((c) => c !== "IN_APP"));
                      }
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <IconBellRinging className="w-5 h-5 text-orange-500" />
                    <Label htmlFor="channel-in-app" className="cursor-pointer">
                      In-App
                    </Label>
                  </div>
                </div>

                <div className="flex items-center space-x-3 border border-border/40 rounded-lg p-4">
                  <Checkbox
                    id="channel-email"
                    checked={selectedChannels.includes("EMAIL")}
                    onCheckedChange={(checked) => {
                      const current = selectedChannels;
                      if (checked) {
                        form.setValue("channels", [...current, "EMAIL"]);
                      } else {
                        form.setValue("channels", current.filter((c) => c !== "EMAIL"));
                      }
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <IconMail className="w-5 h-5 text-purple-500" />
                    <Label htmlFor="channel-email" className="cursor-pointer">
                      E-mail
                    </Label>
                  </div>
                </div>

                <div className="flex items-center space-x-3 border border-border/40 rounded-lg p-4">
                  <Checkbox
                    id="channel-push"
                    checked={selectedChannels.includes("PUSH")}
                    onCheckedChange={(checked) => {
                      const current = selectedChannels;
                      if (checked) {
                        form.setValue("channels", [...current, "PUSH"]);
                      } else {
                        form.setValue("channels", current.filter((c) => c !== "PUSH"));
                      }
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <IconDeviceMobile className="w-5 h-5 text-blue-500" />
                    <Label htmlFor="channel-push" className="cursor-pointer">
                      Push Mobile
                    </Label>
                  </div>
                </div>

                <div className="flex items-center space-x-3 border border-border/40 rounded-lg p-4">
                  <Checkbox
                    id="channel-whatsapp"
                    checked={selectedChannels.includes("WHATSAPP")}
                    onCheckedChange={(checked) => {
                      const current = selectedChannels;
                      if (checked) {
                        form.setValue("channels", [...current, "WHATSAPP"]);
                      } else {
                        form.setValue("channels", current.filter((c) => c !== "WHATSAPP"));
                      }
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <IconBrandWhatsapp className="w-5 h-5 text-green-500" />
                    <Label htmlFor="channel-whatsapp" className="cursor-pointer">
                      WhatsApp
                    </Label>
                  </div>
                </div>
              </div>
              {form.formState.errors.channels && (
                <p className="text-sm text-destructive">{form.formState.errors.channels.message}</p>
              )}
            </CardContent>
          </Card>

          {/* Target Audience */}
          <Card>
            <CardHeader>
              <CardTitle>Destinatários</CardTitle>
              <CardDescription>
                Selecione quem receberá esta notificação
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormCombobox
                name="targetType"
                label="Enviar para"
                required
                placeholder="Selecione os destinatários"
                options={[
                  { value: "all", label: "Todos os usuários" },
                  { value: "sectors", label: "Setores específicos" },
                  { value: "users", label: "Usuários específicos" },
                ]}
                searchable={false}
              />

              {targetType === "sectors" && (
                <div className="space-y-2">
                  <FormCombobox
                    name="targetSectors"
                    label="Setores"
                    placeholder="Selecione os setores"
                    options={
                      allSectors.map((sector) => ({
                        value: sector.privileges, // Use privileges (ADMIN, PRODUCTION, etc.) not ID
                        label: sector.name,
                      }))
                    }
                    multiple
                    searchable
                  />
                  {hasNextSectors && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => fetchNextSectors()}
                      disabled={isFetchingNextSectors}
                      className="w-full mt-2"
                    >
                      {isFetchingNextSectors ? "Carregando..." : "Carregar mais setores"}
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Selecione um ou mais setores que receberão a notificação
                  </p>
                </div>
              )}

              {targetType === "users" && (
                <div className="space-y-2">
                  <FormCombobox
                    name="targetUsers"
                    label="Usuários"
                    placeholder="Selecione os usuários"
                    options={
                      allUsers.map((user) => ({
                        value: user.id,
                        label: `${user.name} (${user.email})`,
                      }))
                    }
                    multiple
                    searchable
                  />
                  {hasNextUsers && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => fetchNextUsers()}
                      disabled={isFetchingNextUsers}
                      className="w-full mt-2"
                    >
                      {isFetchingNextUsers ? "Carregando..." : "Carregar mais usuários"}
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Selecione um ou mais usuários que receberão a notificação
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scheduling */}
          <Card>
            <CardHeader>
              <CardTitle>Agendamento</CardTitle>
              <CardDescription>
                Enviar agora ou agendar para mais tarde
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Agendar para depois</Label>
                  <p className="text-sm text-muted-foreground">
                    Defina data e hora para envio automático
                  </p>
                </div>
                <Switch
                  checked={scheduleLater}
                  onCheckedChange={setScheduleLater}
                />
              </div>

              {scheduleLater && (
                <FormField
                  control={form.control}
                  name="scheduledAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data e Hora</FormLabel>
                      <FormControl>
                        <DateTimeInput
                          field={field}
                          mode="datetime"
                          placeholder="Selecione data e hora"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>

          </div>
        </div>
      </div>
    </FormProvider>
  );
};
