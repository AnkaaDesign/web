import { useState } from "react";
import { FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconX, IconPlus } from "@tabler/icons-react";

interface TagsCellProps<TFieldValues extends FieldValues = FieldValues> {
  control: any;
  index: number;
  disabled?: boolean;
}

export function TagsCell<TFieldValues extends FieldValues = FieldValues>({ control, index, disabled }: TagsCellProps<TFieldValues>) {
  const [inputValue, setInputValue] = useState("");

  return (
    <FormField
      control={control}
      name={`customers.${index}.data.tags` as unknown as Path<TFieldValues>}
      render={({ field }) => (
        <FormItem className="space-y-2">
          <FormControl>
            <div className="space-y-2">
              {/* Tags display */}
              {field.value && field.value.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {field.value.map((tag: string, tagIndex: number) => (
                    <Badge
                      key={tagIndex}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors bg-neutral-400/20 text-neutral-600 border-neutral-300 hover:bg-red-700 hover:text-white hover:border-red-700 dark:bg-neutral-600 dark:text-neutral-300 dark:border-neutral-600 dark:hover:bg-red-700 dark:hover:text-white dark:hover:border-red-700 rounded-full cursor-pointer"
                      onClick={() => {
                        if (!disabled) {
                          const newTags = [...field.value];
                          newTags.splice(tagIndex, 1);
                          field.onChange(newTags);
                        }
                      }}
                    >
                      {tag}
                      <IconX className="h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              )}

              {/* Tag input */}
              <div className="flex gap-1">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && inputValue.trim()) {
                      e.preventDefault();
                      const newTag = inputValue.trim();
                      if (!field.value?.includes(newTag)) {
                        field.onChange([...(field.value || []), newTag]);
                      }
                      setInputValue("");
                    }
                  }}
                  placeholder="Adicionar tag..."
                  className="h-8 flex-1"
                  disabled={disabled}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 px-2"
                  onClick={() => {
                    const newTag = inputValue.trim();
                    if (newTag && !field.value?.includes(newTag)) {
                      field.onChange([...(field.value || []), newTag]);
                    }
                    setInputValue("");
                  }}
                  disabled={disabled || !inputValue.trim()}
                >
                  <IconPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
