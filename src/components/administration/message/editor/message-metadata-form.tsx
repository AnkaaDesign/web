import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IconCalendar, IconFileText, IconUsers, IconAlertTriangle } from "@tabler/icons-react";
import { getUsers, getSectors, getPositions } from "@/api-client";

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
}

interface MessageMetadataFormProps {
  data: MessageMetadata;
  onChange: (data: MessageMetadata) => void;
}

export const MessageMetadataForm = ({ data, onChange }: MessageMetadataFormProps) => {
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
              onChange={(value) => handleChange({ title: value as string || '' })}
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
                      isActive: true,
                      ...(searchTerm ? {
                        OR: [
                          { name: { contains: searchTerm, mode: 'insensitive' as const } },
                          { email: { contains: searchTerm, mode: 'insensitive' as const } },
                        ],
                      } : {}),
                    },
                    orderBy: [
                      { status: 'asc' as const },
                      { name: 'asc' as const },
                    ],
                    include: {
                      sector: true,
                    },
                  });

                  const usersData = result.data || [];
                  const total = result.total || 0;
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
                  const total = result.total || 0;
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
                  const total = result.total || 0;
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
          <div className="space-y-2">
            <Label htmlFor="date-range">Período de Exibição</Label>
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
          </div>

          <p className="text-xs text-muted-foreground">
            Deixe em branco para exibir indefinidamente
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
