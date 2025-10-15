import { IconUsers } from "@tabler/icons-react";

import type { Position } from "../../../../types";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserTable } from "@/components/administration/user/list/user-table";

interface RelatedUsersCardProps {
  position: Position;
}

// Define comprehensive visible columns for position detail view
const POSITION_DETAIL_VISIBLE_COLUMNS = new Set([
  "payrollNumber",
  "name",
  "email",
  "phone",
  "sector.name",
  "status",
]);

export function RelatedUsersCard({ position }: RelatedUsersCardProps) {
  // Filter to only show users from this position
  const filters = {
    where: {
      positionId: position.id,
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconUsers className="h-5 w-5" />
            Funcionários com este Cargo
          </div>
          <Badge variant="secondary">
            {position._count?.users || 0} funcionário{(position._count?.users || 0) !== 1 ? "s" : ""}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <UserTable
          visibleColumns={POSITION_DETAIL_VISIBLE_COLUMNS}
          filters={filters}
          className="border-0"
        />
      </CardContent>
    </Card>
  );
}
