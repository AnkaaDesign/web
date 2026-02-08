import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { IconRocket, IconCheck, IconX, IconClock, IconRotateClockwise, IconEye } from "@tabler/icons-react";

import type { Deployment, DeploymentGetManyFormData, DeploymentOrderBy } from "../../../../types";
import { routes, DEPLOYMENT_STATUS, DEPLOYMENT_STATUS_LABELS, DEPLOYMENT_ENVIRONMENT_LABELS } from "../../../../constants";
import { formatDateTime } from "../../../../utils";
import { useDeployments } from "../../../../hooks";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useTableState } from "@/hooks/common/use-table-state";

interface DeploymentTableProps {
  filters?: Partial<DeploymentGetManyFormData>;
  className?: string;
}

function convertSortConfigsToOrderBy(sortConfigs: Array<{ column: string; direction: "asc" | "desc" }>): DeploymentOrderBy | undefined {
  if (sortConfigs.length === 0) return undefined;

  const orderBy: any = {};
  for (const config of sortConfigs) {
    const field = config.column;
    if (field === "createdAt" || field === "startedAt" || field === "completedAt" || field === "environment" || field === "status") {
      orderBy[field] = config.direction;
    }
  }

  // Only return orderBy if it has at least one field
  const keys = Object.keys(orderBy);
  return keys.length > 0 ? orderBy : undefined;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case DEPLOYMENT_STATUS.COMPLETED:
      return <IconCheck className="h-4 w-4" />;
    case DEPLOYMENT_STATUS.FAILED:
      return <IconX className="h-4 w-4" />;
    case DEPLOYMENT_STATUS.IN_PROGRESS:
      return <IconClock className="h-4 w-4" />;
    case DEPLOYMENT_STATUS.ROLLED_BACK:
      return <IconRotateClockwise className="h-4 w-4" />;
    default:
      return <IconRocket className="h-4 w-4" />;
  }
};

const getStatusColor = (status: string): "default" | "destructive" | "warning" | "success" | "secondary" => {
  switch (status) {
    case DEPLOYMENT_STATUS.COMPLETED:
      return "success";
    case DEPLOYMENT_STATUS.FAILED:
      return "destructive";
    case DEPLOYMENT_STATUS.IN_PROGRESS:
      return "warning";
    case DEPLOYMENT_STATUS.PENDING:
      return "secondary";
    case DEPLOYMENT_STATUS.ROLLED_BACK:
      return "default";
    default:
      return "default";
  }
};

const getEnvironmentColor = (environment: string): "default" | "destructive" | "warning" => {
  return environment === "PRODUCTION" ? "destructive" : "warning";
};

export function DeploymentTable({ filters = {}, className }: DeploymentTableProps) {
  const navigate = useNavigate();

  const {
    page,
    pageSize,
    sortConfigs,
    setPage,
    setPageSize,
    toggleSort,
    getSortDirection,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  const orderBy = convertSortConfigsToOrderBy(sortConfigs);

  const queryParams = useMemo(
    () => {
      const params: any = {
        ...filters,
        page: page + 1,
        limit: pageSize,
      };

      // Only add orderBy if it's defined
      if (orderBy) {
        params.orderBy = orderBy;
      }

      return params;
    },
    [filters, page, pageSize, orderBy],
  );

  const { data: response, isLoading } = useDeployments(queryParams);

  const deployments = response?.data || [];
  const totalRecords = response?.meta?.totalRecords || 0;
  const hasNextPage = response?.meta?.hasNextPage || false;

  const handleRowClick = (deployment: Deployment) => {
    navigate(routes.server.deployments.details(deployment.id));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando implantações...</div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex-1 overflow-auto border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ambiente</TableHead>
              <TableHead>Commit</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Implantado por</TableHead>
              <TableHead>Iniciado em</TableHead>
              <TableHead>Concluído em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deployments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Nenhuma implantação encontrada
                </TableCell>
              </TableRow>
            ) : (
              deployments.map((deployment) => (
                <TableRow
                  key={deployment.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(deployment)}
                >
                  <TableCell>
                    <Badge variant={getEnvironmentColor(deployment.environment)}>
                      {DEPLOYMENT_ENVIRONMENT_LABELS[deployment.environment]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-xs">
                        {deployment.gitCommit?.shortHash || deployment.gitCommit?.hash?.substring(0, 8) || 'N/A'}
                      </span>
                      {deployment.gitCommit?.message && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={deployment.gitCommit.message}>
                          {deployment.gitCommit.message}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span>{deployment.gitCommit?.branch || 'N/A'}</span>
                      {deployment.gitCommit?.author && (
                        <span className="text-xs text-muted-foreground">by {deployment.gitCommit.author}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(deployment.status)}
                      <Badge variant={getStatusColor(deployment.status)}>
                        {DEPLOYMENT_STATUS_LABELS[deployment.status]}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>{deployment.user?.name || "Sistema"}</TableCell>
                  <TableCell>{deployment.startedAt ? formatDateTime(deployment.startedAt) : "-"}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span>{deployment.completedAt ? formatDateTime(deployment.completedAt) : "-"}</span>
                      {deployment.duration && (
                        <span className="text-xs text-muted-foreground">{Math.floor(deployment.duration / 60)}m {deployment.duration % 60}s</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(routes.server.deployments.details(deployment.id));
                      }}
                    >
                      <IconEye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalRecords > 0 && (
        <div className="mt-4">
          <SimplePaginationAdvanced
            page={page}
            pageSize={pageSize}
            totalRecords={totalRecords}
            hasNextPage={hasNextPage}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}
    </div>
  );
}
