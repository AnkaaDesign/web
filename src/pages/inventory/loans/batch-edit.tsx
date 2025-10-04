import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useBorrows } from "../../../hooks";
import { routes } from "../../../constants";
import { BorrowBatchEditTable } from "@/components/inventory/borrow/batch-edit/borrow-batch-edit-table";
import { Card } from "@/components/ui/card";
import { IconLoader } from "@tabler/icons-react";

export default function LoanBatchEditPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [borrowIds, setBorrowIds] = useState<string[]>([]);

  useEffect(() => {
    const ids = searchParams.get("ids");
    if (!ids) {
      navigate(routes.inventory.loans.root);
      return;
    }
    setBorrowIds(ids.split(","));
  }, [searchParams, navigate]);

  const { data: response, isLoading } = useBorrows({
    where: {
      id: { in: borrowIds },
    },
    include: {
      item: {
        include: {
          brand: true,
          category: true,
        },
      },
      user: {
        include: {
          position: true,
        },
      },
    },
    enabled: borrowIds.length > 0,
  });

  const borrows = response?.data || [];

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

  if (borrows.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-center p-8">
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Nenhum empréstimo selecionado para edição em lote.</p>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <BorrowBatchEditTable borrows={borrows} onCancel={() => navigate(routes.inventory.loans.root)} />
    </div>
  );
}
