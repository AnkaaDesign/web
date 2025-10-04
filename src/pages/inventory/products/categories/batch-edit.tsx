import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useItemCategories } from "../../../../hooks";
import { routes } from "../../../../constants";
import { CategoryBatchEditTable } from "@/components/inventory/item/category/batch-edit/category-batch-edit-table";
import { Card } from "@/components/ui/card";
import { IconLoader } from "@tabler/icons-react";

export default function CategoryBatchEditPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [categoryIds, setCategoryIds] = useState<string[]>([]);

  useEffect(() => {
    const ids = searchParams.get("ids");
    if (!ids) {
      navigate(routes.inventory.products.categories.list);
      return;
    }
    setCategoryIds(ids.split(","));
  }, [searchParams, navigate]);

  const { data: response, isLoading } = useItemCategories({
    where: {
      id: { in: categoryIds },
    },
    include: {
      items: true,
      count: {
        select: {
          items: true,
        },
      },
    },
    enabled: categoryIds.length > 0,
  });

  const categories = response?.data || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <IconLoader className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Nenhuma categoria selecionada para edição em lote.</p>
      </Card>
    );
  }

  return <CategoryBatchEditTable categories={categories} onCancel={() => navigate(routes.inventory.products.categories.list)} />;
}
