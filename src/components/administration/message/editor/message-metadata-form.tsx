import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { IconCalendar, IconFileText, IconUsers, IconAlertTriangle } from "@tabler/icons-react";
import { MessageRecurrenceForm } from "./message-recurrence-form";
import { SCHEDULE_FREQUENCY } from "@/constants";
import type { MessageRecurrenceFormData } from "./types";
import { getUsers, getSectors, getPositions } from "@/api-client";
import { CONTRACT_STATUS } from "@/constants";

interface MessageMetadata {
  title: string;
  targeting: {
    type: 'all' | 'specific' | 'sector' | 'position';
    userIds?: string[];
    sectorIds?: string[];
    positionIds?: string[];
  };
  scheduling: {
    startDate?: Date;
    endDate?: Date;
  };
  recurrence?: MessageRecurrenceFormData;
}

interface MessageMetadataFormProps {
  data: MessageMetadata;
  onChange: (data: MessageMetadata) => void;
  /** Próximas datas devolvidas pelo `preview-occurrences` da API. */
  recurrencePreview?: Date[];
  recurrencePreviewError?: string | null;
  /**
   * Falso na tela de EDIÇÃO. Editar uma mensagem existente é editar aquela
   * mensagem; transformá-la numa regra recorrente no mesmo formulário deixaria
   * ambíguo o que acontece com a linha que já está publicada e já foi lida.
   * Tornar recorrente é criar um agendamento.
   */
  allowRecurrence?: boolean;
}

/**
 * Padrão de um comunicado recorrente recém-ligado: toda segunda-feira, visível
 * por 7 dias, publicado às 8h. É a forma mais pedida, e sai configurada de
 * primeira em vez de deixar o autor diante de um formulário vazio.
 */
const DEFAULT_RECURRENCE: MessageRecurrenceFormData = {
  enabled: true,
  frequency: SCHEDULE_FREQUENCY.WEEKLY,
  frequencyCount: 1,
  weeklySchedule: { monday: true },
  displayDurationDays: 7,
  publishHour: 8,
  maxOccurrences: null,
};

export const MessageMetadataForm = ({
  data,
  onChange,
  recurrencePreview,
  recurrencePreviewError,
  allowRecurrence = true,
}: MessageMetadataFormProps) => {
  const handleChange = (updates: Partial<MessageMetadata>) => {
    onChange({ ...data, ...updates });
  };

  // Targeting type options (note: we can't easily get total user count here without adding a query)
  const targetingTypeOptions = [
    { value: 'all', label: 'Todos os Usuários (Broadcast)' },
    { value: 'specific', label: 'Usuários Específicos' },
    { value: 'sector', label: 'Por Setor' },
    { value: 'position', label: 'Por Cargo' },
  ];

  return (
    <div className="space-y-4">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconFileText className="h-5 w-5" />
            Informações Básicas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message-title">
              Título da Mensagem <span className="text-destructive">*</span>
            </Label>
            <Input
              id="message-title"
              value={data.title}
              onChange={(value: string | number | null) => handleChange({ title: value as string || '' })}
              placeholder="Digite o título da mensagem..."
              className="bg-transparent"
              required
            />
            <p className="text-xs text-muted-foreground">
              Necessário para publicar ou salvar como rascunho
            </p>
          </div>
        </CardContent>
      </Card>

      {/* User Targeting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconUsers className="h-5 w-5" />
            Público Alvo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="targeting-type">Tipo de Público</Label>
            <Combobox
              value={data.targeting.type}
              onValueChange={(value) =>
                handleChange({
                  targeting: { type: value as 'all' | 'specific' | 'sector' | 'position', userIds: [], sectorIds: [], positionIds: [] },
                })
              }
              options={targetingTypeOptions}
              placeholder="Selecione o tipo de público..."
              searchable={false}
              clearable={false}
            />
          </div>

          {/* Show warning when "all" is selected */}
          {data.targeting.type === 'all' && (
            <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950">
              <IconAlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <strong>Atenção:</strong> Esta mensagem será exibida para <strong>todos os usuários</strong> do sistema.
                Se deseja enviar apenas para usuários específicos, selecione "Usuários Específicos", "Por Setor" ou "Por Cargo".
              </AlertDescription>
            </Alert>
          )}

          {/* Show user combobox when "specific" is selected */}
          {data.targeting.type === 'specific' && (
            <div className="space-y-2">
              <Label htmlFor="targeting-users">
                Selecione os Usuários <span className="text-destructive">*</span>
              </Label>
              <Combobox
                mode="multiple"
                async
                value={data.targeting.userIds || []}
                onValueChange={(value) =>
                  handleChange({
                    targeting: { ...data.targeting, userIds: value as string[] },
                  })
                }
                queryKey={['users', 'message-targeting']}
                queryFn={async (searchTerm: string, page: number = 1) => {
                  const pageSize = 50;
                  const result = await getUsers({
                    take: pageSize,
                    skip: (page - 1) * pageSize,
                    where: {
                      currentContractStatus: CONTRACT_STATUS.ACTIVE,
                      ...(searchTerm ? {
                        OR: [
                          { name: { contains: searchTerm, mode: 'insensitive' as const } },
                          { email: { contains: searchTerm, mode: 'insensitive' as const } },
                        ],
                      } : {}),
                    },
                    orderBy: { name: 'asc' as const },
                    include: {
                      sector: true,
                    },
                  });

                  const usersData = result.data || [];
                  const total = result.meta?.totalRecords || 0;
                  const hasMore = (page * pageSize) < total;

                  return {
                    data: usersData.map((user) => {
                      const parts = [user.name];
                      if (user.sector?.name) {
                        parts.push(user.sector.name);
                      }
                      return {
                        value: user.id,
                        label: parts.join(' - '),
                      };
                    }),
                    hasMore,
                    total,
                  };
                }}
                pageSize={50}
                minSearchLength={0}
                debounceMs={300}
                placeholder="Selecione os usuários..."
                searchPlaceholder="Buscar usuários..."
                emptyText="Nenhum usuário encontrado"
              />
              {(!data.targeting.userIds || data.targeting.userIds.length === 0) && (
                <p className="text-xs text-destructive">
                  Selecione pelo menos um usuário para continuar.
                </p>
              )}
            </div>
          )}

          {/* Show sector combobox when "sector" is selected */}
          {data.targeting.type === 'sector' && (
            <div className="space-y-2">
              <Label htmlFor="targeting-sectors">
                Selecione os Setores <span className="text-destructive">*</span>
              </Label>
              <Combobox
                mode="multiple"
                async
                value={data.targeting.sectorIds || []}
                onValueChange={(value) =>
                  handleChange({
                    targeting: { ...data.targeting, sectorIds: value as string[] },
                  })
                }
                queryKey={['sectors', 'message-targeting']}
                queryFn={async (searchTerm: string, page: number = 1) => {
                  const pageSize = 50;
                  const result = await getSectors({
                    take: pageSize,
                    skip: (page - 1) * pageSize,
                    where: searchTerm ? {
                      name: { contains: searchTerm, mode: 'insensitive' as const }
                    } : undefined,
                    orderBy: { name: 'asc' as const },
                  });

                  const sectorsData = result.data || [];
                  const total = result.meta?.totalRecords || 0;
                  const hasMore = (page * pageSize) < total;

                  return {
                    data: sectorsData.map((sector) => ({
                      value: sector.id,
                      label: sector.name,
                    })),
                    hasMore,
                    total,
                  };
                }}
                pageSize={50}
                minSearchLength={0}
                debounceMs={300}
                placeholder="Selecione os setores..."
                searchPlaceholder="Buscar setores..."
                emptyText="Nenhum setor encontrado"
              />
              {(!data.targeting.sectorIds || data.targeting.sectorIds.length === 0) && (
                <p className="text-xs text-destructive">
                  Selecione pelo menos um setor para continuar.
                </p>
              )}
            </div>
          )}

          {/* Show position combobox when "position" is selected */}
          {data.targeting.type === 'position' && (
            <div className="space-y-2">
              <Label htmlFor="targeting-positions">
                Selecione os Cargos <span className="text-destructive">*</span>
              </Label>
              <Combobox
                mode="multiple"
                async
                value={data.targeting.positionIds || []}
                onValueChange={(value) =>
                  handleChange({
                    targeting: { ...data.targeting, positionIds: value as string[] },
                  })
                }
                queryKey={['positions', 'message-targeting']}
                queryFn={async (searchTerm: string, page: number = 1) => {
                  const pageSize = 50;
                  const result = await getPositions({
                    take: pageSize,
                    skip: (page - 1) * pageSize,
                    where: searchTerm ? {
                      name: { contains: searchTerm, mode: 'insensitive' as const }
                    } : undefined,
                    orderBy: { name: 'asc' as const },
                  });

                  const positionsData = result.data || [];
                  const total = result.meta?.totalRecords || 0;
                  const hasMore = (page * pageSize) < total;

                  return {
                    data: positionsData.map((position) => ({
                      value: position.id,
                      label: position.name,
                    })),
                    hasMore,
                    total,
                  };
                }}
                pageSize={50}
                minSearchLength={0}
                debounceMs={300}
                placeholder="Selecione os cargos..."
                searchPlaceholder="Buscar cargos..."
                emptyText="Nenhum cargo encontrado"
              />
              {(!data.targeting.positionIds || data.targeting.positionIds.length === 0) && (
                <p className="text-xs text-destructive">
                  Selecione pelo menos um cargo para continuar.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scheduling */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconCalendar className="h-5 w-5" />
            Agendamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Recorrência: o interruptor que troca "uma mensagem" por "uma regra" */}
          {allowRecurrence && (
          <Card level={2}>
            <CardContent className="flex items-start justify-between gap-4 p-4">
              <div className="space-y-1">
                <Label htmlFor="recurrence-toggle" className="cursor-pointer">
                  Repetir esta mensagem
                </Label>
                <p className="text-xs text-muted-foreground">
                  Publica um comunicado novo a cada período (toda segunda, todo dia 5,
                  primeira segunda do mês...). Cada publicação é lida e dispensada
                  separadamente.
                </p>
              </div>
              <Switch
                id="recurrence-toggle"
                checked={!!data.recurrence?.enabled}
                onCheckedChange={(checked) =>
                  handleChange({
                    recurrence: checked
                      ? { ...DEFAULT_RECURRENCE, ...data.recurrence, enabled: true }
                      : { ...(data.recurrence ?? DEFAULT_RECURRENCE), enabled: false },
                    // Ligar a recorrência muda o SENTIDO do intervalo de datas
                    // (janela de exibição → vigência do agendamento), então o
                    // valor anterior deixa de fazer sentido. Em branco = sem
                    // limite, que é o padrão certo para um comunicado que se
                    // repete.
                    ...(checked ? { scheduling: {} } : {}),
                  })
                }
              />
            </CardContent>
          </Card>
          )}

          <div className="space-y-2">
            <Label htmlFor="date-range">
              {data.recurrence?.enabled ? "Vigência da Recorrência" : "Período de Exibição"}
            </Label>
            <DateRangePicker
              dateRange={{
                from: data.scheduling.startDate,
                to: data.scheduling.endDate,
              }}
              onDateRangeChange={(range) =>
                handleChange({
                  scheduling: {
                    startDate: range?.from,
                    endDate: range?.to,
                  },
                })
              }
              placeholder="Selecione o período"
            />
            <p className="text-xs text-muted-foreground">
              {data.recurrence?.enabled
                ? "Quando o agendamento começa e quando para de gerar publicações. Em branco = sem limite."
                : "Deixe em branco para exibir indefinidamente"}
            </p>
          </div>

          {data.recurrence?.enabled && (
            <MessageRecurrenceForm
              data={data.recurrence}
              onChange={(recurrence) => handleChange({ recurrence })}
              preview={recurrencePreview}
              previewError={recurrencePreviewError}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};
