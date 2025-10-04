import { useState } from 'react';
import { useDeployments, useCancelDeployment } from '../../hooks';
import {
  DEPLOYMENT_STATUS,
  DEPLOYMENT_STATUS_LABELS,
  DEPLOYMENT_ENVIRONMENT,
  DEPLOYMENT_ENVIRONMENT_LABELS,
} from '../../constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, GitCommit, XCircle, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export function DeploymentHistory() {
  const navigate = useNavigate();
  const [environmentFilter, setEnvironmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  // Build where clause based on filters
  const where = {
    ...(environmentFilter !== 'all' && { environment: environmentFilter }),
    ...(statusFilter !== 'all' && { status: statusFilter }),
  };

  // Fetch deployments
  const { data, isLoading } = useDeployments({
    where,
    orderBy: { createdAt: 'desc' },
    page,
    limit: 20,
  });

  const deployments = data?.data || [];
  const meta = data?.meta;

  // Cancel deployment mutation
  const { mutate: cancelDeployment, isPending: isCancelling } = useCancelDeployment();

  const getStatusBadge = (status: string) => {
    const variants = {
      COMPLETED: 'default',
      IN_PROGRESS: 'secondary',
      BUILDING: 'secondary',
      TESTING: 'secondary',
      DEPLOYING: 'secondary',
      PENDING: 'outline',
      FAILED: 'destructive',
      CANCELLED: 'outline',
      ROLLED_BACK: 'destructive',
    } as const;

    const icons = {
      COMPLETED: <CheckCircle2 className="h-3 w-3" />,
      FAILED: <XCircle className="h-3 w-3" />,
      IN_PROGRESS: <Loader2 className="h-3 w-3 animate-spin" />,
      BUILDING: <Loader2 className="h-3 w-3 animate-spin" />,
      TESTING: <Loader2 className="h-3 w-3 animate-spin" />,
      DEPLOYING: <Loader2 className="h-3 w-3 animate-spin" />,
      PENDING: <Clock className="h-3 w-3" />,
      ROLLED_BACK: <AlertCircle className="h-3 w-3" />,
    };

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'} className="gap-1">
        {icons[status as keyof typeof icons]}
        {DEPLOYMENT_STATUS_LABELS[status] || status}
      </Badge>
    );
  };

  const getEnvironmentBadge = (environment: string) => {
    const colors = {
      PRODUCTION: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
      STAGING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
      DEVELOPMENT: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
    };

    return (
      <Badge className={colors[environment as keyof typeof colors] || ''}>
        {DEPLOYMENT_ENVIRONMENT_LABELS[environment] || environment}
      </Badge>
    );
  };

  const canCancel = (status: string) => {
    return [
      DEPLOYMENT_STATUS.PENDING,
      DEPLOYMENT_STATUS.IN_PROGRESS,
      DEPLOYMENT_STATUS.BUILDING,
      DEPLOYMENT_STATUS.TESTING,
      DEPLOYMENT_STATUS.DEPLOYING,
    ].includes(status as any);
  };

  const handleCancel = (id: string) => {
    cancelDeployment(id);
  };

  const handleViewLogs = (id: string) => {
    navigate(`/deployments/${id}/logs`);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Histórico de Deployments</h1>
        <p className="text-muted-foreground">Visualize todos os deployments realizados</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium">Ambiente</label>
            <Select value={environmentFilter} onValueChange={setEnvironmentFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os ambientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os ambientes</SelectItem>
                <SelectItem value={DEPLOYMENT_ENVIRONMENT.PRODUCTION}>Produção</SelectItem>
                <SelectItem value={DEPLOYMENT_ENVIRONMENT.STAGING}>Teste</SelectItem>
                <SelectItem value={DEPLOYMENT_ENVIRONMENT.DEVELOPMENT}>Desenvolvimento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="text-sm font-medium">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value={DEPLOYMENT_STATUS.COMPLETED}>Concluído</SelectItem>
                <SelectItem value={DEPLOYMENT_STATUS.IN_PROGRESS}>Em Progresso</SelectItem>
                <SelectItem value={DEPLOYMENT_STATUS.FAILED}>Falhou</SelectItem>
                <SelectItem value={DEPLOYMENT_STATUS.CANCELLED}>Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ambiente</TableHead>
                    <TableHead>Commit</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Iniciado</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deployments.map((deployment) => (
                    <TableRow key={deployment.id}>
                      <TableCell>{getEnvironmentBadge(deployment.environment)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <GitCommit className="h-4 w-4 text-muted-foreground" />
                          <code className="rounded bg-muted px-2 py-1 text-xs">
                            {deployment.commitSha?.substring(0, 7)}
                          </code>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm">{deployment.branch}</code>
                      </TableCell>
                      <TableCell>{getStatusBadge(deployment.status)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm">
                            {format(new Date(deployment.createdAt), 'dd/MM/yyyy HH:mm')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(deployment.createdAt), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {deployment.startedAt && deployment.completedAt ? (
                          <span className="text-sm">
                            {Math.round(
                              (new Date(deployment.completedAt).getTime() -
                                new Date(deployment.startedAt).getTime()) /
                                1000,
                            )}
                            s
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleViewLogs(deployment.id)}>
                            Ver Logs
                          </Button>
                          {canCancel(deployment.status) && (
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={isCancelling}
                              onClick={() => handleCancel(deployment.id)}
                            >
                              {isCancelling ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Cancelar'
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {meta && (
                <div className="flex items-center justify-between border-t p-4">
                  <div className="text-sm text-muted-foreground">
                    Total: {meta.totalRecords} deployments
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!meta.hasNextPage}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
