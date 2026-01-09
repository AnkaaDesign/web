import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { IconCalendar, IconUsers } from "@tabler/icons-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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

  // Targeting type options
  const targetingTypeOptions = [
    { value: 'all', label: 'Todos os Usuários' },
    { value: 'specific', label: 'Usuários Específicos' },
    { value: 'sector', label: 'Por Setor' },
    { value: 'position', label: 'Por Cargo' },
  ];

  return (
    <div className="space-y-4">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Informações Básicas</CardTitle>
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

          {/* Show message when "all" is selected */}
          {data.targeting.type === 'all' && (
            <p className="text-sm text-muted-foreground">
              Esta mensagem será exibida para todos os usuários.
            </p>
          )}

          {/* Show user combobox when "specific" is selected */}
          {data.targeting.type === 'specific' && (
            <div className="space-y-2">
              <Label htmlFor="targeting-users">Selecione os Usuários</Label>
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
            </div>
          )}

          {/* Show sector combobox when "sector" is selected */}
          {data.targeting.type === 'sector' && (
            <div className="space-y-2">
              <Label htmlFor="targeting-sectors">Selecione os Setores</Label>
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
            </div>
          )}

          {/* Show position combobox when "position" is selected */}
          {data.targeting.type === 'position' && (
            <div className="space-y-2">
              <Label htmlFor="targeting-positions">Selecione os Cargos</Label>
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Data de Início</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <IconCalendar className="mr-2 h-4 w-4" />
                    {data.scheduling.startDate ? (
                      format(data.scheduling.startDate, "PPP", { locale: ptBR })
                    ) : (
                      <span>Selecione uma data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={data.scheduling.startDate}
                    onSelect={(date) =>
                      handleChange({
                        scheduling: { ...data.scheduling, startDate: date },
                      })
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date">Data de Término</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <IconCalendar className="mr-2 h-4 w-4" />
                    {data.scheduling.endDate ? (
                      format(data.scheduling.endDate, "PPP", { locale: ptBR })
                    ) : (
                      <span>Selecione uma data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={data.scheduling.endDate}
                    onSelect={(date) =>
                      handleChange({
                        scheduling: { ...data.scheduling, endDate: date },
                      })
                    }
                    disabled={(date) =>
                      data.scheduling.startDate
                        ? date < data.scheduling.startDate
                        : false
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Deixe em branco para exibir indefinidamente
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
