import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { IconCalendar, IconClock, IconUsers, IconUserCheck } from "@tabler/icons-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MessageMetadata {
  title: string;
  targeting: {
    type: 'all' | 'specific' | 'roles';
    userIds?: string[];
    roleIds?: string[];
  };
  scheduling: {
    startDate?: Date;
    endDate?: Date;
  };
  priority: 'low' | 'normal' | 'high';
}

interface MessageMetadataFormProps {
  data: MessageMetadata;
  onChange: (data: MessageMetadata) => void;
}

export const MessageMetadataForm = ({ data, onChange }: MessageMetadataFormProps) => {
  const handleChange = (updates: Partial<MessageMetadata>) => {
    onChange({ ...data, ...updates });
  };

  return (
    <div className="space-y-4">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Informações Básicas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Título da Mensagem</Label>
            <Input
              value={data.title}
              onChange={(e) => handleChange({ title: e.target.value })}
              placeholder="Digite o título da mensagem..."
            />
          </div>

          <div>
            <Label>Prioridade</Label>
            <Select
              value={data.priority}
              onValueChange={(value: any) => handleChange({ priority: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
              </SelectContent>
            </Select>
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
          <Tabs
            value={data.targeting.type}
            onValueChange={(value: any) =>
              handleChange({
                targeting: { ...data.targeting, type: value },
              })
            }
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="specific">Específicos</TabsTrigger>
              <TabsTrigger value="roles">Por Cargo</TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <p className="text-sm text-muted-foreground">
                Esta mensagem será exibida para todos os usuários.
              </p>
            </TabsContent>

            <TabsContent value="specific">
              <div className="space-y-2">
                <Label>Selecione os Usuários</Label>
                <Input placeholder="Buscar usuários..." />
                <div className="text-sm text-muted-foreground">
                  {data.targeting.userIds?.length || 0} usuários selecionados
                </div>
                {/* TODO: Add user multi-select component */}
              </div>
            </TabsContent>

            <TabsContent value="roles">
              <div className="space-y-2">
                <Label>Selecione os Cargos</Label>
                <Input placeholder="Buscar cargos..." />
                <div className="text-sm text-muted-foreground">
                  {data.targeting.roleIds?.length || 0} cargos selecionados
                </div>
                {/* TODO: Add role multi-select component */}
              </div>
            </TabsContent>
          </Tabs>
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
            <div>
              <Label>Data de Início</Label>
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

            <div>
              <Label>Data de Término</Label>
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
