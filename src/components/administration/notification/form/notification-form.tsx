import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { notificationCreateSchema, type NotificationCreateFormData } from "../../../../schemas";
import {
  NOTIFICATION_TYPE,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_IMPORTANCE,
  NOTIFICATION_ACTION_TYPE,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_CHANNEL_LABELS,
  NOTIFICATION_IMPORTANCE_LABELS,
  NOTIFICATION_ACTION_TYPE_LABELS,
} from "../../../../constants";
import { useUsers } from "../../../../hooks";
import { AlertCircle, Users, MessageSquare, Send, CheckCircle2 } from "lucide-react";

interface NotificationFormProps {
  onSubmit: (data: NotificationCreateFormData) => void | Promise<void>;
  defaultValues?: Partial<NotificationCreateFormData>;
  isLoading?: boolean;
  isEdit?: boolean;
}

export function NotificationForm({ onSubmit, defaultValues, isLoading, isEdit = false }: NotificationFormProps) {
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [messageLength, setMessageLength] = useState(0);
  const [titleLength, setTitleLength] = useState(0);

  const { data: users } = useUsers({
    limit: 1000,
    orderBy: { name: "asc" },
    where: {
      status: "ACTIVE",
    },
  });

  const form = useForm<NotificationCreateFormData>({
    resolver: zodResolver(notificationCreateSchema),
    defaultValues: {
      title: "",
      body: "",
      type: NOTIFICATION_TYPE.GENERAL,
      channel: [NOTIFICATION_CHANNEL.IN_APP],
      importance: NOTIFICATION_IMPORTANCE.NORMAL,
      actionType: null,
      actionUrl: null,
      userId: null,
      ...defaultValues,
    },
    mode: "onChange",
  });

  // Watch form values for dynamic updates
  const currentImportance = form.watch("importance");
  const currentChannels = form.watch("channel");
  const currentTitle = form.watch("title");
  const currentBody = form.watch("body");
  const currentActionType = form.watch("actionType");
  const currentUserId = form.watch("userId");

  // Update character counts
  useEffect(() => {
    setTitleLength(currentTitle?.length || 0);
  }, [currentTitle]);

  useEffect(() => {
    setMessageLength(currentBody?.length || 0);
  }, [currentBody]);

  useEffect(() => {
    setSelectedChannels(currentChannels || []);
  }, [currentChannels]);

  const handleSubmit = async (data: NotificationCreateFormData) => {
    try {
      // Validate at least one channel is selected
      if (!data.channel || data.channel.length === 0) {
        form.setError("channel", {
          type: "required",
          message: "Pelo menos um canal deve ser selecionado",
        });
        return;
      }

      // Validate action URL if action type is provided
      if (data.actionType && !data.actionUrl) {
        form.setError("actionUrl", {
          type: "required",
          message: "URL da ação é obrigatória quando tipo de ação é especificado",
        });
        return;
      }

      await onSubmit(data);
    } catch (error) {
      console.error("Erro ao salvar notificação:", error);
    }
  };

  // Helper function to get importance badge
  const getImportanceBadge = (importance: string) => {
    const variants = {
      [NOTIFICATION_IMPORTANCE.LOW]: "secondary" as const,
      [NOTIFICATION_IMPORTANCE.NORMAL]: "outline" as const,
      [NOTIFICATION_IMPORTANCE.HIGH]: "default" as const,
      [NOTIFICATION_IMPORTANCE.URGENT]: "destructive" as const,
    };
    return (
      <Badge variant={variants[importance as keyof typeof variants]} className="ml-2">
        {NOTIFICATION_IMPORTANCE_LABELS[importance as keyof typeof NOTIFICATION_IMPORTANCE_LABELS]}
      </Badge>
    );
  };

  // Get channel count for display
  const selectedChannelCount = selectedChannels.length;
  const allUsers = users?.data || [];
  const recipientCount = currentUserId ? 1 : allUsers.length;

  // Character limits
  const TITLE_MAX_LENGTH = 200;
  const MESSAGE_MAX_LENGTH = 1000;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          {isEdit ? "Editar Notificação" : "Nova Notificação"}
        </CardTitle>
        {recipientCount > 0 && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>
                {recipientCount} destinatário{recipientCount !== 1 ? "s" : ""}
              </span>
            </div>
            {selectedChannelCount > 0 && (
              <div className="flex items-center gap-1">
                <Send className="h-4 w-4" />
                <span>
                  {selectedChannelCount} canal{selectedChannelCount !== 1 ? "is" : ""}
                </span>
              </div>
            )}
            {currentImportance && <div className="flex items-center">{getImportanceBadge(currentImportance)}</div>}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
            {/* Header Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center justify-between">
                      <span>Título *</span>
                      <span className={`text-xs ${titleLength > TITLE_MAX_LENGTH ? "text-destructive" : "text-muted-foreground"}`}>
                        {titleLength}/{TITLE_MAX_LENGTH}
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Digite o título da notificação" maxLength={TITLE_MAX_LENGTH} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Type */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo *</FormLabel>
                    <FormControl>
                      <Combobox
                        value={field.value}
                        onValueChange={field.onChange}
                        options={Object.values(NOTIFICATION_TYPE).map((type) => ({
                          value: type,
                          label: NOTIFICATION_TYPE_LABELS[type],
                        }))}
                        placeholder="Selecione o tipo"
                        searchable={false}
                        clearable={false}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Message Body */}
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center justify-between">
                    <span>Mensagem *</span>
                    <span className={`text-xs ${messageLength > MESSAGE_MAX_LENGTH ? "text-destructive" : "text-muted-foreground"}`}>
                      {messageLength}/{MESSAGE_MAX_LENGTH}
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Textarea placeholder="Digite o conteúdo da notificação" className="min-h-[120px] resize-none" maxLength={MESSAGE_MAX_LENGTH} {...field} />
                  </FormControl>
                  <FormMessage />
                  {messageLength > MESSAGE_MAX_LENGTH * 0.9 && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>Você está próximo do limite de caracteres. Considere encurtar a mensagem.</AlertDescription>
                    </Alert>
                  )}
                </FormItem>
              )}
            />

            <Separator />

            {/* Recipients and Importance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* User */}
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Destinatário
                    </FormLabel>
                    <FormControl>
                      <Combobox
                        value={field.value || ""}
                        onValueChange={field.onChange}
                        options={[
                          { value: "", label: `Todos os usuários (${allUsers.length})` },
                          ...allUsers.map((user) => ({
                            value: user.id,
                            label: user.name,
                            sublabel: user.email || undefined,
                          })),
                        ]}
                        placeholder="Selecione o usuário (opcional)"
                        searchable={true}
                        clearable={false}
                      />
                    </FormControl>
                    <FormMessage />
                    {!currentUserId && allUsers.length > 0 && (
                      <div className="text-xs text-muted-foreground">A notificação será enviada para todos os {allUsers.length} usuários ativos</div>
                    )}
                  </FormItem>
                )}
              />

              {/* Importance */}
              <FormField
                control={form.control}
                name="importance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Importância *</FormLabel>
                    <FormControl>
                      <Combobox
                        value={field.value}
                        onValueChange={field.onChange}
                        options={Object.values(NOTIFICATION_IMPORTANCE).map((importance) => ({
                          value: importance,
                          label: NOTIFICATION_IMPORTANCE_LABELS[importance],
                        }))}
                        placeholder="Selecione a importância"
                        searchable={false}
                        clearable={false}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notification Channels */}
            <FormField
              control={form.control}
              name="channel"
              render={() => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Canais de Notificação *
                  </FormLabel>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.values(NOTIFICATION_CHANNEL).map((channel) => (
                      <FormField
                        key={channel}
                        control={form.control}
                        name="channel"
                        render={({ field }) => {
                          const isSelected = field.value?.includes(channel);
                          return (
                            <FormItem
                              key={channel}
                              className={`flex flex-row items-center space-x-3 space-y-0 rounded-lg border p-4 transition-colors ${
                                isSelected ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50"
                              }`}
                            >
                              <FormControl>
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => {
                                    const updatedValue = checked ? [...(field.value || []), channel] : field.value?.filter((value) => value !== channel) || [];
                                    field.onChange(updatedValue);
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-normal cursor-pointer flex-1">{NOTIFICATION_CHANNEL_LABELS[channel]}</FormLabel>
                            </FormItem>
                          );
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                  {selectedChannelCount === 0 && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>Selecione pelo menos um canal para enviar a notificação.</AlertDescription>
                    </Alert>
                  )}
                  {selectedChannelCount > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {selectedChannelCount} canal{selectedChannelCount !== 1 ? "is" : ""} selecionado{selectedChannelCount !== 1 ? "s" : ""}
                    </div>
                  )}
                </FormItem>
              )}
            />

            <Separator />

            {/* Action Configuration */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Configuração de Ação (Opcional)</Label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Action Type */}
                <FormField
                  control={form.control}
                  name="actionType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Ação</FormLabel>
                      <FormControl>
                        <Combobox
                          value={field.value || ""}
                          onValueChange={field.onChange}
                          options={[
                            { value: "", label: "Nenhuma ação" },
                            ...Object.values(NOTIFICATION_ACTION_TYPE).map((actionType) => ({
                              value: actionType,
                              label: NOTIFICATION_ACTION_TYPE_LABELS[actionType],
                            })),
                          ]}
                          placeholder="Selecione o tipo de ação"
                          searchable={false}
                          clearable={false}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Action URL */}
                <FormField
                  control={form.control}
                  name="actionUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL da Ação {currentActionType && <span className="text-destructive">*</span>}</FormLabel>
                      <FormControl>
                        <Input placeholder="https://exemplo.com/acao" type="url" disabled={!currentActionType} {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                      {currentActionType && !field.value && <div className="text-xs text-amber-600">URL é obrigatória quando um tipo de ação é selecionado</div>}
                    </FormItem>
                  )}
                />
              </div>

              {currentActionType && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Esta notificação terá uma ação associada: <strong>{NOTIFICATION_ACTION_TYPE_LABELS[currentActionType as keyof typeof NOTIFICATION_ACTION_TYPE_LABELS]}</strong>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Separator />

            {/* Submit Section */}
            <div className="flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center">
              <div className="text-sm text-muted-foreground">
                {selectedChannelCount > 0 && recipientCount > 0 && (
                  <span>
                    Será enviada para {recipientCount} destinatário{recipientCount !== 1 ? "s" : ""}
                    via {selectedChannelCount} canal{selectedChannelCount !== 1 ? "is" : ""}
                  </span>
                )}
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={isLoading || selectedChannelCount === 0 || messageLength === 0 || titleLength === 0} className="min-w-[120px]">
                  {isLoading ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      {isEdit ? "Atualizar" : "Criar"} Notificação
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
