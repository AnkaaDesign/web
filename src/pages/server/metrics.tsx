import { useAuth } from "@/contexts/auth-context";
import { SECTOR_PRIVILEGES, routes } from "../../constants";
import { hasPrivilege } from "../../utils";
import {
  IconChartLine,
  IconRefresh,
  IconCpu,
  IconDeviceDesktop,
  IconDatabase,
  IconNetwork,
  IconServer,
  IconActivity,
  IconTemperature,
  IconThermometer,
  IconShield,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconLoader,
  IconExclamationMark,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { PageHeader } from "@/components/ui/page-header";
import { useServerMetrics, useCpuTemperature, useSsdHealth, useRaidStatus } from "../../hooks";
import { useToast } from "@/hooks/common/use-toast";

export function ServerMetricsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { success } = useToast();

  // Check admin privileges
  const isAdmin = user?.sector?.privileges ? hasPrivilege(user as any, SECTOR_PRIVILEGES.ADMIN) : false;

  // Track page access
  usePageTracker({
    title: "Métricas do Sistema",
    icon: "systemMetrics",
  });

  // Fetch metrics
  const { data: metrics, isLoading, error: metricsError, refetch } = useServerMetrics();
  const { data: temperatureData, isLoading: isTemperatureLoading, error: _temperatureError, refetch: refetchTemperature } = useCpuTemperature();
  const { data: ssdHealthData, isLoading: isSsdHealthLoading, error: ssdHealthError, refetch: refetchSsdHealth } = useSsdHealth();
  const { data: raidStatus, isLoading: isRaidLoading, error: raidError, refetch: refetchRaid } = useRaidStatus();

  // Redirect if not admin
  useEffect(() => {
    if (!isAdmin) {
      navigate(routes.home);
    }
  }, [isAdmin, navigate]);

  if (!isAdmin) {
    return null;
  }

  const formatBytes = (bytes: number | undefined) => {
    const sizes = ["B", "KB", "MB", "GB", "TB"];

    // Handle invalid input more comprehensively
    if (bytes === null || bytes === undefined || isNaN(Number(bytes)) || !isFinite(Number(bytes)) || Number(bytes) < 0) {
      return "N/A";
    }

    const numBytes = Number(bytes);

    if (numBytes === 0) return "0 B";

    const i = Math.floor(Math.log(numBytes) / Math.log(1024));

    // Ensure index is within bounds
    if (i < 0 || i >= sizes.length) return "0 B";

    const value = numBytes / Math.pow(1024, i);

    // Handle very small or very large values
    if (!isFinite(value) || isNaN(value)) return "N/A";

    return `${value.toFixed(1)} ${sizes[i]}`;
  };

  const formatPercentage = (value: number | undefined) => {
    if (value === undefined || value === null || isNaN(value)) return "0.0";
    return Math.max(0, Math.min(100, value)).toFixed(1);
  };

  const getMemoryData = () => {
    // Check for network/API errors first
    if (metricsError) {
      return {
        percentage: 0,
        used: 0,
        available: 0,
        total: 0,
        hasError: true,
        errorMessage: "Erro ao conectar com o servidor",
      };
    }

    // Check if metrics or its data is available
    if (!metrics?.data || typeof metrics.data !== "object") {
      return {
        percentage: 0,
        used: 0,
        available: 0,
        total: 0,
        hasError: true,
        errorMessage: "Dados de memória não disponíveis",
      };
    }

    const memory = metrics.data.memory;

    // Comprehensive validation of memory data
    if (!memory || typeof memory !== "object") {
      return {
        percentage: 0,
        used: 0,
        available: 0,
        total: 0,
        hasError: true,
        errorMessage: "Dados de memória inválidos",
      };
    }

    // Validate and sanitize each field
    const sanitizeNumber = (value: any): number => {
      if (value === null || value === undefined) return 0;
      const num = Number(value);
      return isNaN(num) || !isFinite(num) || num < 0 ? 0 : num;
    };

    const total = sanitizeNumber(memory.total);
    const used = sanitizeNumber(memory.used);
    const available = sanitizeNumber(memory.available);
    let percentage = sanitizeNumber(memory.percentage);

    // Check if all values are zero or invalid (indicating a data fetch issue)
    if (total === 0 && used === 0 && available === 0 && percentage === 0) {
      return {
        percentage: 0,
        used: 0,
        available: 0,
        total: 0,
        hasError: true,
        errorMessage: "Não foi possível obter dados de memória do sistema",
      };
    }

    // Recalculate percentage if it seems invalid
    if (percentage <= 0 && total > 0 && used >= 0) {
      percentage = Math.round((used / total) * 100);
    }

    // Ensure percentage is within valid bounds
    percentage = Math.max(0, Math.min(100, percentage));

    return {
      percentage,
      used,
      available,
      total,
      hasError: false,
      errorMessage: undefined,
    };
  };

  const getCpuData = () => {
    const cpu = metrics?.data?.cpu;
    if (!cpu || typeof cpu !== "object") {
      return {
        usage: 0,
        cores: 0,
        loadAverage: [0, 0, 0],
      };
    }

    // Sanitize CPU usage (0-100%)
    const usage = (() => {
      const val = Number(cpu.usage);
      return isNaN(val) || !isFinite(val) ? 0 : Math.max(0, Math.min(100, val));
    })();

    // Sanitize core count
    const cores = (() => {
      const val = Number(cpu.cores);
      return isNaN(val) || !isFinite(val) || val < 1 ? 1 : Math.max(1, Math.floor(val));
    })();

    // Sanitize load average array
    const loadAverage = Array.isArray(cpu.loadAverage)
      ? cpu.loadAverage
          .map((val) => {
            const num = Number(val);
            return isNaN(num) || !isFinite(num) ? 0 : Math.max(0, num);
          })
          .slice(0, 3) // Ensure max 3 values
      : [0, 0, 0];

    // Ensure we have exactly 3 values
    while (loadAverage.length < 3) {
      loadAverage.push(0);
    }

    return {
      usage,
      cores,
      loadAverage,
    };
  };

  const getDiskData = () => {
    const disk = metrics?.data?.disk;
    if (!disk || typeof disk !== "object") {
      return {
        percentage: 0,
        used: 0,
        available: 0,
        total: 0,
      };
    }

    // Validate and sanitize each field
    const sanitizeNumber = (value: any): number => {
      if (value === null || value === undefined) return 0;
      const num = Number(value);
      return isNaN(num) || !isFinite(num) || num < 0 ? 0 : num;
    };

    const total = sanitizeNumber(disk.total);
    const used = sanitizeNumber(disk.used);
    const available = sanitizeNumber(disk.available);
    let percentage = sanitizeNumber(disk.percentage);

    // Recalculate percentage if it seems invalid
    if (percentage <= 0 && total > 0 && used >= 0) {
      percentage = Math.round((used / total) * 100);
    }

    // Ensure percentage is within valid bounds
    percentage = Math.max(0, Math.min(100, percentage));

    return {
      percentage,
      used,
      available,
      total,
    };
  };

  const formatUptime = (seconds: number) => {
    // Handle invalid input
    if (seconds === null || seconds === undefined || isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
      return "N/A";
    }

    const totalSeconds = Math.floor(seconds);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return "text-red-700 dark:text-red-400";
    if (percentage >= 70) return "text-amber-700 dark:text-amber-400";
    return "text-green-700 dark:text-green-400";
  };

  const getTemperatureColor = (temp: number) => {
    if (temp >= 80) return "text-red-700 dark:text-red-400";
    if (temp >= 70) return "text-amber-700 dark:text-amber-400";
    if (temp >= 60) return "text-orange-700 dark:text-orange-400";
    return "text-green-700 dark:text-green-400";
  };

  const calculateSsdHealthPercentage = (ssd: any): number => {
    let healthScore = 100;

    // Factor 1: Overall SMART health status (40% weight)
    if (ssd.health.overall === "FAILED") {
      healthScore -= 40;
    } else if (ssd.health.overall !== "PASSED") {
      healthScore -= 20;
    }

    // Factor 2: Wear level (30% weight) - inverted because higher wear = lower health
    if (ssd.wearLevel?.percentage !== undefined) {
      const wearPenalty = (ssd.wearLevel.percentage / 100) * 30;
      healthScore -= wearPenalty;
    }

    // Factor 3: Temperature (15% weight)
    if (ssd.temperature?.current) {
      const temp = ssd.temperature.current;
      if (temp > 70) {
        healthScore -= 15;
      } else if (temp > 60) {
        healthScore -= 10;
      } else if (temp > 50) {
        healthScore -= 5;
      }
    }

    // Factor 4: Error counts (15% weight)
    const hasErrors = ssd.errorCounts?.reallocatedSectors > 0 || ssd.errorCounts?.pendingSectors > 0 || ssd.errorCounts?.uncorrectableErrors > 0;
    if (hasErrors) {
      healthScore -= 15;
    }

    // Ensure the score is between 0 and 100
    return Math.max(0, Math.min(100, Math.round(healthScore)));
  };

  const getSsdHealthColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-700 dark:text-green-400";
    if (percentage >= 60) return "text-amber-700 dark:text-amber-400";
    if (percentage >= 40) return "text-orange-700 dark:text-orange-400";
    return "text-red-700 dark:text-red-400";
  };

  const getRaidStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "healthy":
      case "clean":
      case "active":
        return "text-green-600";
      case "degraded":
      case "recovering":
      case "resyncing":
        return "text-yellow-600";
      case "failed":
        return "text-red-600";
      case "rebuilding":
        return "text-blue-600";
      default:
        return "text-gray-600";
    }
  };

  const getRaidStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "healthy":
      case "clean":
      case "active":
        return <IconCheck className="h-4 w-4" />;
      case "degraded":
      case "recovering":
      case "resyncing":
        return <IconExclamationMark className="h-4 w-4" />;
      case "failed":
        return <IconX className="h-4 w-4" />;
      case "rebuilding":
        return <IconLoader className="h-4 w-4 animate-spin" />;
      default:
        return <IconAlertTriangle className="h-4 w-4" />;
    }
  };

  const getRaidData = () => {
    if (!raidStatus?.data) {
      return {
        arrays: [],
        overall: {
          status: "unknown",
          totalArrays: 0,
          healthyArrays: 0,
          degradedArrays: 0,
          failedArrays: 0,
          rebuildingArrays: 0,
        },
        hasError: true,
        errorMessage: raidError ? "Erro ao carregar status RAID" : "Dados RAID não disponíveis",
      };
    }

    return {
      ...raidStatus.data,
      hasError: false,
      errorMessage: undefined,
    };
  };

  const hasRaidAlerts = () => {
    const data = getRaidData();
    if (data.hasError) return false;

    return (
      data.overall.failedArrays > 0 ||
      data.arrays.some((array) => array.state === "failed" || array.state === "degraded" || array.devices?.some((device) => device.role === "faulty"))
    );
  };

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <PageHeader
          title="Métricas do Sistema"
          icon={IconChartLine}
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Servidor", href: routes.server.root }, { label: "Métricas do Sistema" }]}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: () => {
                refetch();
                refetchTemperature();
                refetchSsdHealth();
                refetchRaid();
                success("Métricas atualizadas");
              },
              variant: "outline" as const,
              disabled: isLoading,
            },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        {/* Critical RAID Alerts */}
        {hasRaidAlerts() && (
          <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 mt-4">
            <CardContent className="px-8 py-4">
              <div className="flex items-center gap-3">
                <IconAlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-red-800 dark:text-red-200">Problemas detectados no sistema RAID</div>
                  <div className="text-xs text-red-700 dark:text-red-300 mt-1">
                    {(() => {
                      const data = getRaidData();
                      const issues = [];
                      if (data.overall.failedArrays > 0) {
                        issues.push(`${data.overall.failedArrays} array(s) com falha`);
                      }
                      if (data.overall.degradedArrays > 0) {
                        issues.push(`${data.overall.degradedArrays} array(s) degradado(s)`);
                      }
                      const faultyDevices = data.arrays.reduce((count, array) => count + (array.devices?.filter((device) => device.role === "faulty").length || 0), 0);
                      if (faultyDevices > 0) {
                        issues.push(`${faultyDevices} dispositivo(s) com falha`);
                      }
                      return issues.join(", ");
                    })()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Content Card */}
        <Card className="flex-1 flex flex-col min-h-0 mt-4">
          <CardContent className="flex-1 overflow-auto px-8 py-6 space-y-6">
          {/* System Overview */}
          <Card className="flex-shrink-0">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                  <IconServer className="h-5 w-5" />
                </div>
                Visão Geral do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-3">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-muted-foreground">Hostname</div>
                    <div className="text-2xl font-semibold text-foreground">{metrics?.data?.hostname || "N/A"}</div>
                  </div>
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-muted-foreground">Uptime</div>
                    <div className="text-2xl font-semibold text-foreground">{metrics?.data?.uptime ? formatUptime(metrics.data.uptime) : "N/A"}</div>
                  </div>
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-muted-foreground">CPU Cores</div>
                    <div className="text-2xl font-semibold text-foreground">{metrics?.data?.cpu?.cores ?? "N/A"}</div>
                  </div>
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-muted-foreground">Interfaces de Rede</div>
                    <div className="text-2xl font-semibold text-foreground">{metrics?.data?.network?.interfaces?.length ?? "N/A"}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resource Usage */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 flex-shrink-0">
            {/* CPU Usage */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                    <IconCpu className="h-5 w-5" />
                  </div>
                  CPU
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-20" />
                    <Skeleton className="h-2" />
                    <div className="space-y-2">
                      <Skeleton className="h-3" />
                      <Skeleton className="h-3" />
                    </div>
                  </div>
                ) : (
                  (() => {
                    const cpuData = getCpuData();
                    return (
                      <div className="space-y-4">
                        <div className="text-center">
                          <div className={`text-4xl font-bold ${getUsageColor(cpuData.usage)}`}>{formatPercentage(cpuData.usage)}%</div>
                          <div className="text-sm text-muted-foreground">Uso atual</div>
                        </div>

                        <div
                          className="h-2"
                          style={{
                            backgroundColor: "rgb(229 231 235)",
                          }}
                        >
                          <Progress value={cpuData.usage} />
                        </div>

                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Núcleos:</span>
                            <span className="font-medium">{cpuData.cores}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Load Avg (1m):</span>
                            <span className="font-medium">{(cpuData.loadAverage[0] || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Load Avg (5m):</span>
                            <span className="font-medium">{(cpuData.loadAverage[1] || 0).toFixed(2)}</span>
                          </div>
                          {(() => {
                            const temp = metrics?.data.cpu?.temperature;
                            if (temp !== undefined && temp !== null && isFinite(temp) && temp > 0) {
                              return (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Temperatura:</span>
                                  <span className={`font-medium ${getTemperatureColor(temp)}`}>{temp.toFixed(1)}°C</span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                    );
                  })()
                )}
              </CardContent>
            </Card>

            {/* Memory Usage */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg">
                    <IconDeviceDesktop className="h-5 w-5" />
                  </div>
                  Memória
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-20" />
                    <Skeleton className="h-2" />
                    <div className="space-y-2">
                      <Skeleton className="h-3" />
                      <Skeleton className="h-3" />
                    </div>
                  </div>
                ) : (
                  (() => {
                    const memoryData = getMemoryData();

                    // Show error state if data is invalid
                    if (memoryData.hasError) {
                      return (
                        <div className="text-center py-8 text-muted-foreground">
                          <IconDeviceDesktop className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <div className="text-sm">{memoryData.errorMessage}</div>
                          <div className="text-xs mt-1">Verifique a conectividade do sistema</div>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-4">
                        <div className="text-center">
                          <div className={`text-4xl font-bold ${getUsageColor(memoryData.percentage)}`}>{formatPercentage(memoryData.percentage)}%</div>
                          <div className="text-sm text-muted-foreground">Uso atual</div>
                        </div>

                        <div className="h-2">
                          <Progress value={memoryData.percentage} />
                        </div>

                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Usado:</span>
                            <span className="font-medium">{formatBytes(memoryData.used)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Disponível:</span>
                            <span className="font-medium">{formatBytes(memoryData.available)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total:</span>
                            <span className="font-medium">{formatBytes(memoryData.total)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}
              </CardContent>
            </Card>

            {/* Disk Usage */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg">
                    <IconDeviceDesktop className="h-5 w-5" />
                  </div>
                  Disco
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-20" />
                    <Skeleton className="h-2" />
                    <div className="space-y-2">
                      <Skeleton className="h-3" />
                      <Skeleton className="h-3" />
                    </div>
                  </div>
                ) : (
                  (() => {
                    const diskData = getDiskData();
                    return (
                      <div className="space-y-4">
                        <div className="text-center">
                          <div className={`text-4xl font-bold ${getUsageColor(diskData.percentage)}`}>{formatPercentage(diskData.percentage)}%</div>
                          <div className="text-sm text-muted-foreground">Uso atual</div>
                        </div>

                        <div className="h-2">
                          <Progress value={diskData.percentage} />
                        </div>

                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Usado:</span>
                            <span className="font-medium">{formatBytes(diskData.used)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Disponível:</span>
                            <span className="font-medium">{formatBytes(diskData.available)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total:</span>
                            <span className="font-medium">{formatBytes(diskData.total)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}
              </CardContent>
            </Card>

            {/* CPU Temperature */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-3">
                  <div className="p-2 bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg">
                    <IconTemperature className="h-5 w-5" />
                  </div>
                  Temperatura da CPU
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isTemperatureLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-16 bg-gray-200 rounded"></div>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded"></div>
                      <div className="h-3 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                ) : temperatureData?.data ? (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className={`text-4xl font-bold ${getTemperatureColor(temperatureData.data.primary.value)}`}>{temperatureData.data.primary.value.toFixed(1)}°C</div>
                      <div className="text-sm text-muted-foreground">Temperatura atual</div>
                    </div>

                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fonte:</span>
                        <span className="font-medium">{temperatureData.data.source}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sensores:</span>
                        <span className="font-medium">{temperatureData.data.sensors.length}</span>
                      </div>
                      {temperatureData.data.sensors.length > 1 && (
                        <div className="mt-2 pt-2 border-t border-muted">
                          <div className="text-xs text-muted-foreground mb-1">Outros sensores:</div>
                          {temperatureData.data.sensors.slice(1).map((sensor, index) => (
                            <div key={index} className="flex justify-between text-xs">
                              <span className="text-muted-foreground">{sensor.label || sensor.name}:</span>
                              <span className="font-medium">{sensor.value.toFixed(1)}°C</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <IconThermometer className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <div className="text-sm">Dados de temperatura não disponíveis</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* SSD Health */}
          <Card className="flex-shrink-0">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
                  <IconDatabase className="h-5 w-5" />
                </div>
                Saúde dos SSDs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isSsdHealthLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="animate-pulse border rounded-lg p-4">
                      <div className="space-y-3">
                        <div className="h-4 bg-muted rounded w-20"></div>
                        <div className="h-6 bg-muted rounded w-16"></div>
                        <div className="space-y-2">
                          <div className="h-3 bg-muted rounded w-24"></div>
                          <div className="h-3 bg-muted rounded w-20"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : ssdHealthError ? (
                <div className="text-center py-8 text-muted-foreground">
                  <IconAlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                  <div className="text-sm">Erro ao carregar dados de saúde dos SSDs</div>
                  <div className="text-xs text-muted-foreground mt-1">{ssdHealthError?.message || "Erro desconhecido"}</div>
                </div>
              ) : ssdHealthData?.data && ssdHealthData.data.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ssdHealthData.data.map((ssd, index) => (
                    <div key={index} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                      <div className="space-y-3">
                        {/* Device Header */}
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-sm text-foreground">{ssd.device.replace("/dev/", "")}</div>
                          <div className="flex items-center gap-1">
                            {ssd.health.overall === "PASSED" ? (
                              <IconCheck className="h-4 w-4 text-green-600" />
                            ) : ssd.health.overall === "FAILED" ? (
                              <IconX className="h-4 w-4 text-red-600" />
                            ) : (
                              <IconAlertTriangle className="h-4 w-4 text-yellow-600" />
                            )}
                            <span
                              className={`text-xs font-medium ${
                                ssd.health.overall === "PASSED" ? "text-green-600" : ssd.health.overall === "FAILED" ? "text-red-600" : "text-yellow-600"
                              }`}
                            >
                              {ssd.health.overall}
                            </span>
                          </div>
                        </div>

                        {/* Device Info */}
                        <div className="text-xs text-muted-foreground">
                          <div className="truncate">{ssd.model}</div>
                          <div>{ssd.capacity}</div>
                        </div>

                        {/* Health Percentage */}
                        <div className="bg-muted/50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-muted-foreground">Saúde Geral</span>
                            <span className={`text-lg font-bold ${getSsdHealthColor(calculateSsdHealthPercentage(ssd))}`}>{calculateSsdHealthPercentage(ssd)}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                calculateSsdHealthPercentage(ssd) >= 80
                                  ? "bg-green-600"
                                  : calculateSsdHealthPercentage(ssd) >= 60
                                    ? "bg-amber-600"
                                    : calculateSsdHealthPercentage(ssd) >= 40
                                      ? "bg-orange-600"
                                      : "bg-red-600"
                              }`}
                              style={{ width: `${calculateSsdHealthPercentage(ssd)}%` }}
                            />
                          </div>
                        </div>

                        {/* Metrics */}
                        <div className="space-y-2 text-xs">
                          {ssd.temperature.current && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Temperatura:</span>
                              <span
                                className={`font-medium ${ssd.temperature.current > 70 ? "text-red-600" : ssd.temperature.current > 60 ? "text-yellow-600" : "text-green-600"}`}
                              >
                                {ssd.temperature.current}°{ssd.temperature.unit}
                              </span>
                            </div>
                          )}

                          {ssd.powerOn.hours && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Power On:</span>
                              <span className="font-medium">{Math.floor(ssd.powerOn.hours / 24).toLocaleString()}d</span>
                            </div>
                          )}

                          {ssd.wearLevel.percentage !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Desgaste:</span>
                              <span
                                className={`font-medium ${ssd.wearLevel.percentage > 80 ? "text-red-600" : ssd.wearLevel.percentage > 60 ? "text-yellow-600" : "text-green-600"}`}
                              >
                                {ssd.wearLevel.percentage}%
                              </span>
                            </div>
                          )}

                          {/* Error Counts - only show if there are errors */}
                          {(ssd.errorCounts.reallocatedSectors > 0 || ssd.errorCounts.pendingSectors > 0 || ssd.errorCounts.uncorrectableErrors > 0) && (
                            <div className="pt-2 border-t border-muted">
                              <div className="flex items-center gap-1 text-red-600">
                                <IconAlertTriangle className="h-3 w-3" />
                                <span className="font-medium">Erros detectados</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <IconDatabase className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <div className="text-sm">Nenhum SSD encontrado ou dados indisponíveis</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Network Interfaces */}
          <Card className="flex-shrink-0">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-lg">
                  <IconNetwork className="h-5 w-5" />
                </div>
                Interfaces de Rede
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                        <div className="space-y-2">
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {metrics?.data.network.interfaces.map((interface_, index) => (
                    <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-semibold text-lg text-secondary-foreground mb-1">{interface_.name}</div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div>IP: {interface_.ip}</div>
                            {interface_.mac && <div>MAC: {interface_.mac}</div>}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div className="flex items-center gap-2">
                              <IconActivity className="h-3 w-3 text-green-500" />
                              <span>RX: {formatBytes(interface_.rx)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <IconActivity className="h-3 w-3 text-blue-500" />
                              <span>TX: {formatBytes(interface_.tx)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {(!metrics?.data.network.interfaces || metrics.data.network.interfaces.length === 0) && !isLoading && (
                    <div className="text-center py-8 text-muted-foreground">Nenhuma interface de rede encontrada</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* RAID Status */}
          <Card className="flex-shrink-0">
            <CardHeader className="px-8 py-6 pb-4">
              <CardTitle className="text-xl flex items-center gap-3">
                <div className="p-2 bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg">
                  <IconShield className="h-5 w-5" />
                </div>
                Status dos Arrays RAID
              </CardTitle>
            </CardHeader>
            <CardContent className="px-8 py-6 pt-2">
              {isRaidLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="animate-pulse border rounded p-4">
                      <div className="flex justify-between items-center">
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-32"></div>
                          <div className="h-3 bg-gray-200 rounded w-24"></div>
                        </div>
                        <div className="space-y-2">
                          <div className="h-3 bg-gray-200 rounded w-20"></div>
                          <div className="h-3 bg-gray-200 rounded w-16"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                (() => {
                  const data = getRaidData();

                  if (data.hasError) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        <IconShield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <div className="text-sm">{data.errorMessage}</div>
                        <div className="text-xs mt-1">Arrays RAID podem não estar configurados ou disponíveis</div>
                      </div>
                    );
                  }

                  if (!data.arrays || data.arrays.length === 0) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        <IconShield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <div className="text-sm">Nenhum array RAID encontrado</div>
                        <div className="text-xs mt-1">Sistema não possui arrays RAID configurados</div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-6">
                      {/* Overall Status */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-foreground">{data.overall.totalArrays}</div>
                          <div className="text-sm text-muted-foreground">Total Arrays</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">{data.overall.healthyArrays}</div>
                          <div className="text-sm text-muted-foreground">Saudáveis</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-yellow-600">{data.overall.degradedArrays + data.overall.rebuildingArrays}</div>
                          <div className="text-sm text-muted-foreground">Com Problemas</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-600">{data.overall.failedArrays}</div>
                          <div className="text-sm text-muted-foreground">Com Falha</div>
                        </div>
                      </div>

                      {/* Individual Arrays */}
                      <div className="space-y-4">
                        {data.arrays.map((array, index) => (
                          <div
                            key={index}
                            className={`border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors ${
                              array.state === "failed"
                                ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                                : array.state === "degraded"
                                  ? "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20"
                                  : "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                            }`}
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="font-semibold text-lg text-secondary-foreground">{array.name || array.device}</div>
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getRaidStatusColor(array.state)}`}>
                                    {getRaidStatusIcon(array.state)}
                                    {array.state.toUpperCase()}
                                  </span>
                                </div>
                                <div className="text-sm text-muted-foreground space-y-1">
                                  <div>
                                    Nível: <span className="font-medium">{array.level}</span>
                                  </div>
                                  <div>
                                    UUID: <span className="font-mono text-xs">{array.uuid}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm space-y-1">
                                  <div className="flex items-center gap-2 justify-end">
                                    <span className="text-muted-foreground">Dispositivos:</span>
                                    <span className="font-medium">
                                      {array.activeDevices}/{array.totalDevices}
                                    </span>
                                  </div>
                                  {array.failedDevices > 0 && (
                                    <div className="flex items-center gap-2 justify-end">
                                      <IconX className="h-3 w-3 text-red-500" />
                                      <span className="text-red-600 font-medium">{array.failedDevices} com falha</span>
                                    </div>
                                  )}
                                  {array.spareDevices > 0 && (
                                    <div className="flex items-center gap-2 justify-end">
                                      <IconShield className="h-3 w-3 text-blue-500" />
                                      <span className="text-blue-600 font-medium">{array.spareDevices} spare(s)</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Rebuild Progress */}
                            {array.rebuildProgress && (
                              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                  <IconLoader className="h-4 w-4 text-blue-600 animate-spin" />
                                  <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Reconstrução em andamento ({array.rebuildProgress.percentage}%)</span>
                                </div>
                                <Progress value={array.rebuildProgress.percentage} className="h-2 mb-2" />
                                <div className="flex justify-between text-xs text-blue-700 dark:text-blue-300">
                                  <span>Velocidade: {array.rebuildProgress.speed}</span>
                                  {array.rebuildProgress.timeRemaining && <span>Tempo restante: {array.rebuildProgress.timeRemaining}</span>}
                                </div>
                              </div>
                            )}

                            {/* Device Details */}
                            {array.devices && array.devices.length > 0 && (
                              <div className="mt-3">
                                <div className="text-xs text-muted-foreground mb-2">Dispositivos:</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {array.devices.map((device, deviceIndex) => (
                                    <div
                                      key={deviceIndex}
                                      className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                                        device.role === "faulty"
                                          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
                                          : device.role === "spare"
                                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                                            : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                                      }`}
                                    >
                                      {device.role === "faulty" ? (
                                        <IconX className="h-3 w-3" />
                                      ) : device.role === "spare" ? (
                                        <IconShield className="h-3 w-3" />
                                      ) : (
                                        <IconCheck className="h-3 w-3" />
                                      )}
                                      <span className="font-mono">{device.device}</span>
                                      <span className="text-xs opacity-75">({device.state})</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Last Updated */}
                      <div className="text-center text-xs text-muted-foreground pt-4 border-t">
                        Última atualização: {data.lastUpdated ? new Date(data.lastUpdated).toLocaleString("pt-BR") : "Nunca"}
                      </div>
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
