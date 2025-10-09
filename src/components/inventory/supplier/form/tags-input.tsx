import { useFieldArray, useWatch } from "react-hook-form";
import { useState } from "react";
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconPlus, IconX, IconTag } from "@tabler/icons-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TagsInputProps<TFieldValues extends FieldValues = FieldValues> {
  control: any;
  disabled?: boolean;
}

export function TagsInput<TFieldValues extends FieldValues = FieldValues>({ control, disabled }: TagsInputProps<TFieldValues>) {
  const [newTag, setNewTag] = useState<string>("");

  // Watch the tags array with explicit typing
  const watchedTags = useWatch({
    control,
    name: "tags" as Path<TFieldValues>,
  });

  // Ensure tags is always an array with proper type assertion
  const tags: string[] = Array.isArray(watchedTags) ? watchedTags : [];

  const { append, remove } = useFieldArray({
    control,
    name: "tags" as ArrayPath<TFieldValues>,
  });

  const handleAddTag = () => {
    const trimmedTag = newTag.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      append(trimmedTag as any);
      setNewTag("");
    }
  };

  return (
    <FormField
      control={control}
      name={"tags" as Path<TFieldValues>}
      render={({ field }) => {
        // Ensure field.value is always an array with proper type assertion
        const fieldValue: string[] = Array.isArray(field.value) ? field.value : [];

        return (
          <FormItem>
            <FormLabel className="flex items-center gap-1">
              <IconTag className="h-4 w-4" />
              Tags
            </FormLabel>

            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newTag}
                  onChange={(value) => {
                    // Handle both event and direct value from custom Input component
                    if (typeof value === "string") {
                      setNewTag(value);
                    } else if (value && typeof value === "object" && "target" in value) {
                      setNewTag((value as any).target.value);
                    }
                  }}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Digite uma tag e pressione Enter ou clique em +"
                  disabled={disabled}
                  className="flex-1"
                />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        onClick={handleAddTag}
                        disabled={disabled || newTag.trim().length === 0}
                        size="icon"
                        variant={newTag.trim().length === 0 ? "outline" : "default"}
                      >
                        <IconPlus className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{!newTag.trim() ? "Digite uma tag primeiro" : "Adicionar tag"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {fieldValue.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {fieldValue.map((tag: string, index: number) => (
                    <Badge
                      key={`tag-${index}`}
                      variant="secondary"
                      className="flex items-center gap-1 text-xs pr-1"
                    >
                      <span>{tag}</span>
                      <Button
                        type="button"
                        onClick={() => remove(index)}
                        disabled={disabled}
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground ml-1"
                      >
                        <IconX className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
