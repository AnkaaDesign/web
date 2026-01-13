import { useState } from "react";
import { useAvailableCommits, useCurrentDeployment, useCreateDeployment } from "../../../hooks";
import { DEPLOYMENT_ENVIRONMENT, DEPLOYMENT_STATUS_LABELS } from "../../../constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, GitBranch, GitCommit, User, Calendar, CheckCircle2, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DeploymentTable } from "./list/deployment-table";
import { cn } from "@/lib/utils";

interface DeploymentManagerProps {
  className?: string;
}

export function DeploymentManager({ className }: DeploymentManagerProps) {
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);

  // Fetch available commits
  const { data: commitsData, isLoading: isLoadingCommits } = useAvailableCommits(20);
  const commits = Array.isArray(commitsData?.data) ? commitsData.data : [];

  // Fetch current deployments
  const { data: testDeployment, isLoading: isLoadingTest } = useCurrentDeployment(
    DEPLOYMENT_ENVIRONMENT.STAGING,
    undefined,
    'WEB'
  );

  const { data: prodDeployment, isLoading: isLoadingProd } = useCurrentDeployment(
    DEPLOYMENT_ENVIRONMENT.PRODUCTION,
    undefined,
    'WEB'
  );

  // Deploy mutation
  const { mutate: deploy, isPending: isDeploying } = useCreateDeployment();

  const handleDeploy = (environment: DEPLOYMENT_ENVIRONMENT) => {
    if (!selectedCommit) return;

    deploy(
      { commitHash: selectedCommit, environment, application: 'WEB' },
      {
        onSuccess: () => {
          setSelectedCommit(null);
        },
      },
    );
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      COMPLETED: "default",
      IN_PROGRESS: "secondary",
      BUILDING: "secondary",
      TESTING: "secondary",
      DEPLOYING: "secondary",
      FAILED: "destructive",
      CANCELLED: "outline",
      ROLLED_BACK: "destructive",
    } as const;

    const icons = {
      COMPLETED: <CheckCircle2 className="h-3 w-3" />,
      FAILED: <XCircle className="h-3 w-3" />,
      IN_PROGRESS: <Loader2 className="h-3 w-3 animate-spin" />,
    };

    return (
      <Badge variant={variants[status as keyof typeof variants] || "outline"} className="gap-1">
        {icons[status as keyof typeof icons]}
        {DEPLOYMENT_STATUS_LABELS[status] || status}
      </Badge>
    );
  };

  return (
    <div className={cn("flex flex-col h-full space-y-4", className)}>
      <Tabs defaultValue="deploy" className="flex-1 flex flex-col">
        <TabsList>
          <TabsTrigger value="deploy">Implantar</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="deploy" className="flex-1 space-y-4 mt-4">
          {/* Current Deployments */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Test Environment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Teste (test.ankaadesign.com.br)</span>
                  {testDeployment?.data?.status && getStatusBadge(testDeployment.data.status)}
                </CardTitle>
                <CardDescription>Ambiente de teste automático</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingTest ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : testDeployment?.data ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <GitCommit className="h-4 w-4 text-muted-foreground" />
                      <code className="rounded bg-muted px-2 py-1">
                        {testDeployment.data.gitCommit?.shortHash || testDeployment.data.gitCommit?.hash?.substring(0, 7) || 'N/A'}
                      </code>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <GitBranch className="h-4 w-4 text-muted-foreground" />
                      <span>{testDeployment.data.gitCommit?.branch || 'N/A'}</span>
                    </div>
                    {testDeployment.data.completedAt && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {formatDistanceToNow(new Date(testDeployment.data.completedAt), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum deployment encontrado</p>
                )}
              </CardContent>
            </Card>

            {/* Production Environment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Produção (ankaadesign.com.br)</span>
                  {prodDeployment?.data?.status && getStatusBadge(prodDeployment.data.status)}
                </CardTitle>
                <CardDescription>Ambiente de produção</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingProd ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : prodDeployment?.data ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <GitCommit className="h-4 w-4 text-muted-foreground" />
                      <code className="rounded bg-muted px-2 py-1">
                        {prodDeployment.data.gitCommit?.shortHash || prodDeployment.data.gitCommit?.hash?.substring(0, 7) || 'N/A'}
                      </code>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <GitBranch className="h-4 w-4 text-muted-foreground" />
                      <span>{prodDeployment.data.gitCommit?.branch || 'N/A'}</span>
                    </div>
                    {prodDeployment.data.completedAt && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {formatDistanceToNow(new Date(prodDeployment.data.completedAt), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum deployment encontrado</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Available Commits */}
          <Card>
            <CardHeader>
              <CardTitle>Commits Disponíveis</CardTitle>
              <CardDescription>Selecione um commit para fazer deploy</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingCommits ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {commits.map((commit) => (
                    <div
                      key={commit.hash}
                      className={`flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50 ${
                        selectedCommit === commit.hash ? "border-primary bg-muted" : ""
                      }`}
                      onClick={() => setSelectedCommit(commit.hash)}
                      style={{ cursor: "pointer" }}
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="rounded bg-muted px-2 py-1 text-xs">
                            {commit.shortHash}
                          </code>
                          <span className="font-medium">{commit.message}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>{commit.author}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {formatDistanceToNow(new Date(commit.date), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!selectedCommit || isDeploying || selectedCommit !== commit.hash}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeploy(DEPLOYMENT_ENVIRONMENT.STAGING);
                          }}
                        >
                          {isDeploying && selectedCommit === commit.hash ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Deploy para Teste"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          disabled={!selectedCommit || isDeploying || selectedCommit !== commit.hash}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeploy(DEPLOYMENT_ENVIRONMENT.PRODUCTION);
                          }}
                        >
                          {isDeploying && selectedCommit === commit.hash ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Deploy para Produção"
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="flex-1 mt-4">
          <DeploymentTable className="h-full" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
