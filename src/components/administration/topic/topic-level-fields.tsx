import { useEffect } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ScoreBadge } from "@/components/production/skill-assessment/score-badge";

/**
 * Inline sub-form rendering the 6 fixed score rows (0..5) of a Topic.
 *
 * Reads/writes form path `levels[]` where each entry is
 *   { score: number, name: string, description: string }
 *
 * Always renders exactly 6 rows. If the bound `levels` array is shorter
 * we seed missing scores so the field array shape is preserved.
 */
export function TopicLevelFields({ disabled }: { disabled?: boolean }) {
  const { control, getValues, setValue } = useFormContext();

  const { fields } = useFieldArray({ control, name: "levels" });

  // Ensure 6 rows exist with the expected scores (0..5)
  useEffect(() => {
    const current = (getValues("levels") as Array<{ score?: number }>) ?? [];
    const byScore = new Map<number, any>();
    current.forEach((row) => {
      if (typeof row?.score === "number") byScore.set(row.score, row);
    });
    const seeded = Array.from({ length: 6 }, (_, score) =>
      byScore.get(score) ?? { score, name: "", description: "" },
    );
    setValue("levels", seeded, { shouldDirty: false, shouldTouch: false, shouldValidate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Níveis (0 a 5)</CardTitle>
        <CardDescription>
          Cada tópico exige 6 níveis com nome e descrição personalizados. Estes textos
          aparecem para o líder no momento da avaliação.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((field, idx) => (
          <div
            key={field.id}
            className="flex items-start gap-3 rounded-md border border-border/40 p-3"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <FormField
                control={control}
                name={`levels.${idx}.name`}
                render={({ field: f }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Nome do nível</FormLabel>
                    <div className="flex items-center gap-3">
                      <ScoreBadge
                        score={idx}
                        label={String(idx)}
                        className="h-10 w-10 shrink-0 justify-center rounded-md px-0 text-sm"
                      />
                      <FormControl>
                        <Input
                          {...f}
                          value={f.value ?? ""}
                          placeholder={`Nome (score ${idx})`}
                          maxLength={120}
                          disabled={disabled}
                          transparent
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name={`levels.${idx}.description`}
                render={({ field: f }) => (
                  <FormItem className="pl-[52px]">
                    <FormLabel className="text-xs">Descrição</FormLabel>
                    <FormControl>
                      <Textarea
                        {...f}
                        value={f.value ?? ""}
                        placeholder={`O que caracteriza um colaborador neste nível?`}
                        rows={2}
                        maxLength={2000}
                        disabled={disabled}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Hidden score field — kept in sync with the row index */}
              <FormField
                control={control}
                name={`levels.${idx}.score`}
                render={({ field: f }) => (
                  <input type="hidden" value={idx} onChange={() => f.onChange(idx)} />
                )}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
