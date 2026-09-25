import { useCallback } from "react";
import { IconCopy, IconPhoto } from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ApprovedLayoutPicker,
  type LayoutOption,
} from "@/components/financial/common/approved-layout-picker";
import type { FileWithPreview } from "@/components/common/file";

export interface BudgetLayoutVehicle {
  taskId: string;
  label: string;
  paintName?: string | null;
  paintHex?: string | null;
}

interface BudgetVehicleLayoutsFieldProps {
  vehicles: BudgetLayoutVehicle[];
  /** Um layout para cada veículo (`PER_VEHICLE`) ou o mesmo para todos (`SHARED`). */
  perVehicle: boolean;
  onPerVehicleChange: (perVehicle: boolean) => void;
  /** As artes que podem ser escolhidas — as aprovadas de TODOS os veículos, sem repetição. */
  options: LayoutOption[];
  sharedFiles: FileWithPreview[];
  onSharedFilesChange: (files: FileWithPreview[]) => void;
  filesByTask: Record<string, FileWithPreview[] | undefined>;
  onTaskFilesChange: (taskId: string, files: FileWithPreview[]) => void;
  /** Copia a escolha deste veículo para todos os outros. */
  onUseForAll: (taskId: string) => void;
  disabled?: boolean;
}

const withPreview = (picked: File[]): FileWithPreview[] =>
  picked.map(
    (f) =>
      Object.assign(f, { preview: URL.createObjectURL(f) }) as FileWithPreview,
  );

/**
 * O LAYOUT APROVADO de um orçamento de N veículos.
 *
 * Dois modos, numa chave só:
 *   • o mesmo layout para todos — o de sempre, e o que o orçamento de sessenta
 *     caminhões iguais quer;
 *   • um layout para cada veículo — o da Carlotti: mesmo preço, cada caminhão com a
 *     sua arte. A API aprova cada arte SÓ no caminhão dela, e o documento a mostra com
 *     a legenda do veículo.
 *
 * As opções são as artes aprovadas de TODOS os veículos (a equipe de arte sobe o layout
 * na tarefa de cada caminhão). A mesma arte escolhida em dois caminhões é uma arte só
 * cobrindo os dois. Subir uma arte nova aqui a aprova no(s) caminhão(ões) em que ela
 * foi escolhida.
 */
export function BudgetVehicleLayoutsField({
  vehicles,
  perVehicle,
  onPerVehicleChange,
  options,
  sharedFiles,
  onSharedFilesChange,
  filesByTask,
  onTaskFilesChange,
  onUseForAll,
  disabled,
}: BudgetVehicleLayoutsFieldProps) {
  const handleSharedUpload = useCallback(
    (picked: File[]) =>
      onSharedFilesChange([...sharedFiles, ...withPreview(picked)].slice(0, 2)),
    [sharedFiles, onSharedFilesChange],
  );

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <IconPhoto className="h-4 w-4 text-muted-foreground" />
            Layout dos {vehicles.length} veículos
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-start gap-3">
          <Switch
            id="budget-layout-per-vehicle"
            checked={perVehicle}
            onCheckedChange={(checked) => onPerVehicleChange(!!checked)}
            disabled={disabled}
            data-testid="budget-layout-per-vehicle"
          />
          <div className="space-y-1">
            <Label
              htmlFor="budget-layout-per-vehicle"
              className="cursor-pointer"
            >
              Um layout para cada veículo
            </Label>
            <p className="text-xs text-muted-foreground">
              {perVehicle
                ? "Cada implemento recebe só a arte escolhida para ele. No documento, cada layout sai com o número do veículo."
                : `O mesmo layout vale para os ${vehicles.length} veículos. Ligue quando os implementos tiverem artes diferentes.`}
            </p>
          </div>
        </CardContent>
      </Card>

      {!perVehicle ? (
        <div data-testid="budget-vehicle-layout-shared">
          <ApprovedLayoutPicker
            layouts={options}
            layoutFiles={sharedFiles}
            onChange={onSharedFilesChange}
            onUploadFiles={handleSharedUpload}
            uploadLabel="Selecione ou envie um layout"
            title="Layout Aprovados — todos os veículos"
            disabled={disabled}
          />
        </div>
      ) : (
        vehicles.map((v, index) => {
          const files = filesByTask[v.taskId] ?? [];
          return (
            <div
              key={v.taskId}
              data-testid={`budget-vehicle-layout-${index + 1}`}
            >
              <ApprovedLayoutPicker
                layouts={options}
                layoutFiles={files}
                onChange={(next) => onTaskFilesChange(v.taskId, next)}
                onUploadFiles={(picked) =>
                  onTaskFilesChange(
                    v.taskId,
                    [...files, ...withPreview(picked)].slice(0, 2),
                  )
                }
                uploadLabel="Selecione ou envie um layout"
                disabled={disabled}
                title={
                  <span className="flex items-center gap-2">
                    <span>
                      Veículo {index + 1} · {v.label}
                    </span>
                    {v.paintHex && (
                      <span
                        className="h-3 w-3 rounded-full border border-border"
                        style={{ backgroundColor: v.paintHex }}
                        title={v.paintName ?? undefined}
                      />
                    )}
                    {files.length === 0 && (
                      <span className="text-xs font-normal text-amber-600 dark:text-amber-400">
                        sem layout
                      </span>
                    )}
                  </span>
                }
                headerAction={
                  vehicles.length > 1 && files.length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() => onUseForAll(v.taskId)}
                      disabled={disabled}
                    >
                      <IconCopy className="h-3.5 w-3.5" />
                      Usar em todos
                    </Button>
                  ) : null
                }
              />
            </div>
          );
        })
      )}
    </div>
  );
}
