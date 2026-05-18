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
            className="grid grid-cols-1 md:grid-cols-[60px_240px_1fr] gap-3 items-start rounded-md border p-3"
          >
            <div className="flex items-center justify-center">
              <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-muted font-bold text-lg">
                {idx}
              </span>
            </div>

            <FormField
              control={control}
              name={`levels.${idx}.name`}
              render={({ field: f }) => (
                <FormItem>
                  <FormLabel className="text-xs">Nome do nível</FormLabel>
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name={`levels.${idx}.description`}
              render={({ field: f }) => (
                <FormItem>
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
        ))}
      </CardContent>
    </Card>
  );
}
