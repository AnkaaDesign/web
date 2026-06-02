import { useState, useMemo, useEffect } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { IconCategory, IconCalculator } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";
import { useItemCategoryMutations, useItemCategoryTree } from "../../../../hooks";
import type { ItemCreateFormData, ItemUpdateFormData } from "../../../../schemas";
import type { ItemCategory } from "../../../../types";
import { ITEM_CATEGORY_TYPE, ACCOUNTING_TYPE_LABELS } from "../../../../constants";

type FormData = ItemCreateFormData | ItemUpdateFormData;

interface CategorySelectorProps {
  disabled?: boolean;
  required?: boolean;
  onCategoryChange?: (categoryId: string | undefined) => void;
  initialCategory?: ItemCategory;
}

// Flatten the tree to a lookup so we can resolve any node (parent or leaf) by id.
function indexTree(nodes: ItemCategory[], acc: Map<string, ItemCategory> = new Map()): Map<string, ItemCategory> {
  for (const node of nodes) {
    acc.set(node.id, node);
    if (node.children && node.children.length > 0) {
      indexTree(node.children, acc);
    }
  }
  return acc;
}

export function CategorySelector({ disabled, required, onCategoryChange, initialCategory }: CategorySelectorProps) {
  const form = useFormContext<FormData>();
  const [isCreating, setIsCreating] = useState(false);
  const { createMutation } = useItemCategoryMutations();

  // Operational tree: top-level Categorias (level 1) each with their Subcategorias (level 2).
  const { data: tree = [], isLoading } = useItemCategoryTree();

  const byId = useMemo(() => indexTree(tree), [tree]);

  // The form's canonical value: the chosen LEAF (subcategory) id, or a top-level id when
  // that top-level category has no subcategories.
  const categoryId = form.watch("categoryId") as string | undefined;

  // Derive the currently-selected parent (top Categoria) from the form value.
  // If the selected node is a subcategory, its parent is the top selection; otherwise the node itself.
  const selectedNode = categoryId ? byId.get(categoryId) : undefined;
  const initialParentId = useMemo(() => {
    if (selectedNode) {
      return selectedNode.categoryLevel === 2 ? selectedNode.parentId ?? undefined : selectedNode.id;
    }
    // Fall back to the eagerly-provided category (edit mode before tree loads).
    if (initialCategory) {
      return initialCategory.categoryLevel === 2 ? initialCategory.parentId ?? undefined : initialCategory.id;
    }
    return undefined;
  }, [selectedNode, initialCategory]);

  const [parentId, setParentId] = useState<string | undefined>(initialParentId);

  // Keep local parent selection in sync when the resolved parent changes (e.g. tree finished loading).
  useEffect(() => {
    if (initialParentId && initialParentId !== parentId) {
      setParentId(initialParentId);
    }
  }, [initialParentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const parentNode = parentId ? byId.get(parentId) : undefined;
  const subcategories = parentNode?.children ?? [];
  const hasSubcategories = subcategories.length > 0;

  // Rolled-up accounting type (read-only): from the leaf if chosen, else from the parent.
  const rollupNode = selectedNode ?? parentNode ?? initialCategory;
  const accountingType = rollupNode?.accountingType;

  const parentOptions = useMemo(
    () =>
      tree
        .filter((c) => c.categoryLevel === 1)
        .map((c) => ({ value: c.id, label: c.name })),
    [tree],
  );

  const subcategoryOptions = useMemo(
    () => subcategories.map((c) => ({ value: c.id, label: c.name })),
    [subcategories],
  );

  const handleParentChange = (value: string | string[] | null | undefined) => {
    const newParentId = typeof value === "string" && value ? value : undefined;
    setParentId(newParentId);

    const node = newParentId ? byId.get(newParentId) : undefined;
    const children = node?.children ?? [];

    // When the chosen Categoria has no Subcategoria, the item points at the top node itself.
    // Otherwise clear the leaf until the user picks a Subcategoria.
    const nextLeaf = children.length === 0 ? newParentId : undefined;
    form.setValue("categoryId", nextLeaf as any, { shouldDirty: true, shouldValidate: true });
    onCategoryChange?.(nextLeaf);
  };

  const handleSubcategoryChange = (value: string | string[] | null | undefined) => {
    const leafId = typeof value === "string" && value ? value : undefined;
    form.setValue("categoryId", leafId as any, { shouldDirty: true, shouldValidate: true });
    onCategoryChange?.(leafId);
  };

  // Inline create: create a Subcategoria under the chosen parent, inheriting its accountingType.
  const handleCreateSubcategory = async (name: string) => {
    if (!parentId) return undefined;
    setIsCreating(true);
    try {
      const result = await createMutation.mutateAsync({
        data: {
          name,
          type: parentNode?.type ?? ITEM_CATEGORY_TYPE.REGULAR,
          parentId,
          categoryLevel: 2,
          accountingType: parentNode?.accountingType,
        } as any,
      });

      if (result.success && result.data) {
        const newId = result.data.id;
        form.setValue("categoryId", newId as any, { shouldDirty: true, shouldValidate: true });
        onCategoryChange?.(newId);
        return newId;
      }
      return undefined;
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error creating subcategory:", error);
      }
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <FormField
      control={form.control}
      name="categoryId"
      render={() => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconCategory className="h-4 w-4" />
            Categoria {required && <span className="text-destructive">*</span>}
          </FormLabel>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Top-level Categoria */}
            <FormControl>
              <Combobox
                options={parentOptions}
                value={parentId || ""}
                onValueChange={handleParentChange}
                placeholder="Selecione a categoria..."
                emptyText={isLoading ? "Carregando..." : "Nenhuma categoria encontrada"}
                searchPlaceholder="Buscar categoria..."
                disabled={disabled || isCreating || isLoading}
                minSearchLength={0}
              />
            </FormControl>

            {/* Subcategoria (children of the chosen Categoria) */}
            <Combobox
              options={subcategoryOptions}
              value={(selectedNode?.categoryLevel === 2 ? selectedNode.id : undefined) || ""}
              onValueChange={handleSubcategoryChange}
              placeholder={parentId ? "Selecione a subcategoria..." : "Escolha uma categoria primeiro"}
              emptyText="Nenhuma subcategoria"
              searchPlaceholder="Buscar subcategoria..."
              disabled={disabled || isCreating || !parentId || !hasSubcategories}
              minSearchLength={0}
              allowCreate={!!parentId}
              createLabel={(value) => `Criar subcategoria "${value}"`}
              onCreate={handleCreateSubcategory}
              isCreating={isCreating}
            />
          </div>

          {/* Read-only rolled-up accounting type */}
          {accountingType && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <IconCalculator className="h-3.5 w-3.5" />
                Tipo contábil
              </span>
              <Badge variant="secondary" className="text-xs">
                {ACCOUNTING_TYPE_LABELS[accountingType] ?? accountingType}
              </Badge>
            </div>
          )}

          <FormMessage />
        </FormItem>
      )}
    />
  );
}
