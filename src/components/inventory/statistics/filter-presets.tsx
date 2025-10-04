import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { IconBookmark, IconBookmarkFilled, IconChevronDown, IconRefresh, IconCheck } from "@tabler/icons-react";

interface FilterPreset {
  id: string;
  name: string;
  description: string;
  filters: any;
  isDefault?: boolean;
}

interface FilterPresetsProps {
  presets: FilterPreset[];
  currentPreset?: FilterPreset;
  onApplyPreset: (presetId: string) => void;
  onReset: () => void;
  disabled?: boolean;
  className?: string;
}

export function FilterPresets({
  presets,
  currentPreset,
  onApplyPreset,
  onReset,
  disabled = false,
  className,
}: FilterPresetsProps) {
  const [open, setOpen] = useState(false);

  const handlePresetSelect = (presetId: string) => {
    onApplyPreset(presetId);
    setOpen(false);
  };

  const handleReset = () => {
    onReset();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={className}
          disabled={disabled}
        >
          <div className="flex items-center gap-2">
            {currentPreset ? (
              <IconBookmarkFilled className="h-4 w-4 text-primary" />
            ) : (
              <IconBookmark className="h-4 w-4" />
            )}
            <span>
              {currentPreset ? currentPreset.name : 'Presets'}
            </span>
            {currentPreset && (
              <Badge variant="secondary" className="text-xs">
                Ativo
              </Badge>
            )}
          </div>
          <IconChevronDown className="h-4 w-4 opacity-50 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Presets de Filtros</CardTitle>
            <CardDescription>
              Configurações pré-definidas para análises comuns
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-1 px-4">
              {presets.map((preset) => (
                <Button
                  key={preset.id}
                  variant={currentPreset?.id === preset.id ? "secondary" : "ghost"}
                  className="w-full justify-start h-auto p-3"
                  onClick={() => handlePresetSelect(preset.id)}
                >
                  <div className="flex items-start gap-3 w-full">
                    <div className="flex-shrink-0 mt-0.5">
                      {currentPreset?.id === preset.id ? (
                        <IconCheck className="h-4 w-4 text-primary" />
                      ) : preset.isDefault ? (
                        <IconBookmarkFilled className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <IconBookmark className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <div className="font-medium flex items-center gap-2">
                        {preset.name}
                        {preset.isDefault && (
                          <Badge variant="outline" className="text-xs">
                            Padrão
                          </Badge>
                        )}
                        {currentPreset?.id === preset.id && (
                          <Badge variant="default" className="text-xs">
                            Atual
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {preset.description}
                      </div>
                    </div>
                  </div>
                </Button>
              ))}
            </div>

            <Separator className="mt-4" />

            <div className="p-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleReset}
              >
                <IconRefresh className="h-4 w-4 mr-2" />
                Restaurar Padrão
              </Button>
            </div>

            {/* Preset Details */}
            {currentPreset && (
              <>
                <Separator />
                <div className="p-4 bg-muted/50">
                  <div className="text-sm">
                    <div className="font-medium mb-2 flex items-center gap-2">
                      <IconBookmarkFilled className="h-4 w-4 text-primary" />
                      Preset Atual: {currentPreset.name}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {currentPreset.description}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Quick Info */}
            <div className="p-4 border-t bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <div className="text-xs text-blue-700 dark:text-blue-200">
                <div className="font-medium mb-1">💡 Dica</div>
                <div>
                  Os presets aplicam configurações otimizadas para diferentes tipos de análise.
                  Você pode modificar as configurações após aplicar um preset.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}

// Mini preset selector for compact spaces
export function MiniFilterPresets({
  presets,
  currentPreset,
  onApplyPreset,
  disabled = false,
  className,
}: Omit<FilterPresetsProps, 'onReset'>) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={className}
          disabled={disabled}
        >
          {currentPreset ? (
            <IconBookmarkFilled className="h-4 w-4 text-primary" />
          ) : (
            <IconBookmark className="h-4 w-4" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <div className="space-y-1">
          {presets.map((preset) => (
            <Button
              key={preset.id}
              variant={currentPreset?.id === preset.id ? "secondary" : "ghost"}
              size="sm"
              className="w-full justify-start"
              onClick={() => onApplyPreset(preset.id)}
            >
              <div className="flex items-center gap-2 w-full">
                {currentPreset?.id === preset.id ? (
                  <IconCheck className="h-3 w-3 text-primary" />
                ) : (
                  <IconBookmark className="h-3 w-3 text-muted-foreground" />
                )}
                <span className="truncate">{preset.name}</span>
                {preset.isDefault && (
                  <Badge variant="outline" className="text-xs ml-auto">
                    Padrão
                  </Badge>
                )}
              </div>
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}