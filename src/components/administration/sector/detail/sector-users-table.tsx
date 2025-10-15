import { IconUsers } from "@tabler/icons-react";

import type { Sector } from "../../../../types";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserTable } from "@/components/administration/user/list/user-table";

interface SectorUsersTableProps {
  sector: Sector;
}

// Define comprehensive visible columns for sector detail view
const SECTOR_DETAIL_VISIBLE_COLUMNS = new Set([
  "payrollNumber",
  "name",
  "email",
  "phone",
  "position.name",
  "status",
]);

export function SectorUsersTable({ sector }: SectorUsersTableProps) {
  // Filter to only show users from this sector
  const filters = {
    where: {
      sectorId: sector.id,
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconUsers className="h-5 w-5" />
            Usuários do Setor
          </div>
          <Badge variant="secondary">
            {sector._count?.users || 0} usuário{(sector._count?.users || 0) !== 1 ? "s" : ""}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <UserTable
          visibleColumns={SECTOR_DETAIL_VISIBLE_COLUMNS}
          filters={filters}
          className="border-0"
        />
      </CardContent>
    </Card>
  );
}
