import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useActivities } from "../../../hooks";
import { ActivityBatchEditTable } from "@/components/inventory/activity/batch-edit/activity-batch-edit-table";
import { routes } from "../../../constants";
import { Card } from "@/components/ui/card";
import { IconLoader } from "@tabler/icons-react";

export default function BatchEditMovementsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activityIds, setActivityIds] = useState<string[]>([]);

  useEffect(() => {
    const ids = searchParams.get("ids");
    if (!ids) {
      navigate(routes.inventory.movements.list);
      return;
    }
    setActivityIds(ids.split(","));
  }, [searchParams, navigate]);

  const { data: response, isLoading } = useActivities({
    where: {
      id: { in: activityIds },
    },
    include: {
      item: {
        include: {
          category: true,
          brand: true,
        },
      },
      user: {
        include: {
          position: true,
        },
      },
    },
    enabled: activityIds.length > 0,
  });

  const activities = response?.data || [];

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <IconLoader className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-center p-8">
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Nenhuma movimentação selecionada para edição em lote.</p>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <ActivityBatchEditTable activities={activities} onCancel={() => navigate(routes.inventory.movements.list)} />
    </div>
  );
}
