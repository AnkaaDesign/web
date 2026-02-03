import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bell,
  Mail,
  MessageCircle,
  Smartphone,
  Send,
  Users,
  Filter,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Building2,
  User,
  Shield,
  Zap,
  Package,
  FileText,
  Wrench,
  DollarSign,
  Truck,
  Home,
  PenTool,
  Settings,
  UserX
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Fake Users with different sectors
const FAKE_USERS = [
  {
    id: '1',
    name: 'João Silva',
    email: 'joao.silva@ankaa.com',
    sector: 'PRODUCTION',
    role: 'Team Lead',
    avatar: 'JS',
    deviceTokens: ['ios_token_123', 'android_token_456'],
    whatsapp: '+5511999887766',
    preferences: {
      'task.created': { IN_APP: true, PUSH: true, EMAIL: true, WHATSAPP: true },
      'task.deadline_approaching': { IN_APP: true, PUSH: true, EMAIL: false, WHATSAPP: true },
      'order.invoice_ready': { IN_APP: true, PUSH: false, EMAIL: true, WHATSAPP: false }
    }
  },
  {
    id: '2',
    name: 'Maria Santos',
    email: 'maria.santos@ankaa.com',
    sector: 'FINANCIAL',
    role: 'Analyst',
    avatar: 'MS',
    deviceTokens: ['android_token_789'],
    whatsapp: '+5511988776655',
    preferences: {
      'task.created': { IN_APP: true, PUSH: false, EMAIL: true, WHATSAPP: false },
      'task.deadline_approaching': { IN_APP: true, PUSH: false, EMAIL: true, WHATSAPP: false },
      'order.invoice_ready': { IN_APP: true, PUSH: true, EMAIL: true, WHATSAPP: true }
    }
  },
  {
    id: '3',
    name: 'Pedro Oliveira',
    email: 'pedro.oliveira@ankaa.com',
    sector: 'COMMERCIAL',
    role: 'Sales Manager',
    avatar: 'PO',
    deviceTokens: ['ios_token_321'],
    whatsapp: '+5511977665544',
    preferences: {
      'task.created': { IN_APP: true, PUSH: true, EMAIL: false, WHATSAPP: true },
      'task.deadline_approaching': { IN_APP: true, PUSH: true, EMAIL: false, WHATSAPP: true },
      'order.invoice_ready': { IN_APP: true, PUSH: true, EMAIL: false, WHATSAPP: true }
    }
  },
  {
    id: '4',
    name: 'Ana Costa',
    email: 'ana.costa@ankaa.com',
    sector: 'ADMIN',
    role: 'Administrator',
    avatar: 'AC',
    deviceTokens: ['ios_token_654', 'android_token_987', 'web_token_111'],
    whatsapp: '+5511966554433',
    preferences: {
      'task.created': { IN_APP: true, PUSH: true, EMAIL: true, WHATSAPP: true },
      'task.deadline_approaching': { IN_APP: true, PUSH: true, EMAIL: true, WHATSAPP: true },
      'order.invoice_ready': { IN_APP: true, PUSH: true, EMAIL: true, WHATSAPP: true }
    }
  },
  {
    id: '5',
    name: 'Carlos Ferreira',
    email: 'carlos.ferreira@ankaa.com',
    sector: 'WAREHOUSE',
    role: 'Stock Manager',
    avatar: 'CF',
    deviceTokens: ['android_token_222'],
    whatsapp: '+5511955443322',
    preferences: {
      'task.created': { IN_APP: true, PUSH: true, EMAIL: false, WHATSAPP: false },
      'task.deadline_approaching': { IN_APP: true, PUSH: true, EMAIL: false, WHATSAPP: false },
      'order.invoice_ready': { IN_APP: true, PUSH: false, EMAIL: false, WHATSAPP: false }
    }
  },
  {
    id: '6',
    name: 'Lucia Almeida',
    email: 'lucia.almeida@ankaa.com',
    sector: 'DESIGNER',
    role: 'Senior Designer',
    avatar: 'LA',
    deviceTokens: [],
    whatsapp: '',
    preferences: {
      'task.created': { IN_APP: true, PUSH: false, EMAIL: true, WHATSAPP: false },
      'task.deadline_approaching': { IN_APP: true, PUSH: false, EMAIL: true, WHATSAPP: false },
      'order.invoice_ready': { IN_APP: true, PUSH: false, EMAIL: false, WHATSAPP: false }
    }
  }
];

// Notification configurations
const NOTIFICATION_CONFIGS = {
  'task.created': {
    label: 'Task Created',
    allowedSectors: ['ADMIN', 'PRODUCTION', 'DESIGNER', 'COMMERCIAL'],
    customFilter: (user: any, context: any) => {
      // Task creator, assigned user, or sector members
      return user.id === context.assignedTo ||
             user.id === context.createdBy ||
             user.sector === context.taskSector;
    },
    defaultChannels: ['IN_APP', 'PUSH', 'WHATSAPP'],
    mandatoryChannels: ['IN_APP', 'PUSH'],
    sectorOverrides: {
      PRODUCTION: { mandatoryChannels: ['IN_APP', 'PUSH', 'WHATSAPP'] },
      FINANCIAL: { defaultChannels: ['IN_APP', 'EMAIL'], mandatoryChannels: ['IN_APP'] }
    }
  },
  'task.deadline_approaching': {
    label: 'Task Deadline Approaching',
    allowedSectors: [],  // Custom filter only
    customFilter: (user: any, context: any) => {
      return user.id === context.assignedTo || user.id === context.supervisorId;
    },
    defaultChannels: ['IN_APP', 'PUSH', 'EMAIL', 'WHATSAPP'],
    mandatoryChannels: ['IN_APP', 'PUSH'],
    sectorOverrides: {}
  },
  'order.invoice_ready': {
    label: 'Invoice Ready',
    allowedSectors: ['ADMIN', 'FINANCIAL', 'COMMERCIAL'],
    customFilter: (user: any, context: any) => {
      return user.id === context.createdBy || user.id === context.salesRepId;
    },
    defaultChannels: ['IN_APP', 'EMAIL'],
    mandatoryChannels: ['EMAIL'],
    sectorOverrides: {
      FINANCIAL: { mandatoryChannels: ['IN_APP', 'EMAIL', 'PUSH'] }
    }
  },
  'service_order.completed': {
    label: 'Service Order Completed',
    allowedSectors: ['ADMIN', 'PRODUCTION', 'LOGISTIC'],
    customFilter: (user: any, context: any) => {
      return user.id === context.createdBy || user.id === context.assignedTo;
    },
    defaultChannels: ['IN_APP', 'PUSH', 'WHATSAPP'],
    mandatoryChannels: ['IN_APP', 'PUSH', 'WHATSAPP'],
    sectorOverrides: {}
  }
};

const sectorIcons = {
  ADMIN: Shield,
  PRODUCTION: Settings,
  FINANCIAL: DollarSign,
  COMMERCIAL: Package,
  WAREHOUSE: Home,
  LOGISTIC: Truck,
  DESIGNER: PenTool,
  HUMAN_RESOURCES: Users,
  MAINTENANCE: Wrench,
  EXTERNAL: UserX
};

interface DeliveryResult {
  userId: string;
  userName: string;
  userSector: string;
  channels: {
    channel: string;
    status: 'sent' | 'blocked' | 'disabled' | 'unavailable';
    reason?: string;
  }[];
  eligibility: {
    eligible: boolean;
    reason: string;
  };
}

export default function NotificationTestingDashboard() {
  const [selectedConfig, setSelectedConfig] = useState('task.created');
  const [testContext, setTestContext] = useState({
    assignedTo: '1',
    createdBy: '3',
    supervisorId: '4',
    salesRepId: '3',
    taskSector: 'PRODUCTION'
  });
  const [simulationResults, setSimulationResults] = useState<DeliveryResult[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  const simulateNotification = () => {
    setIsSimulating(true);

    // Simulate processing delay
    setTimeout(() => {
      const config = NOTIFICATION_CONFIGS[selectedConfig];
      const results: DeliveryResult[] = [];

      FAKE_USERS.forEach(user => {
        // Check eligibility
        let eligible = false;
        let eligibilityReason = '';

        // Check sector-based access
        if (config.allowedSectors.length > 0) {
          if (config.allowedSectors.includes(user.sector)) {
            eligible = true;
            eligibilityReason = `User sector (${user.sector}) is allowed`;
          }
        }

        // Check custom filter
        if (config.customFilter) {
          const customResult = config.customFilter(user, testContext);
          if (customResult) {
            eligible = true;
            eligibilityReason = 'Passed custom filter (assigned/creator/supervisor)';
          }
        }

        if (!eligible) {
          eligibilityReason = 'User not eligible (sector/role mismatch)';
        }

        // Determine channels
        const channels: any[] = [];
        const userPrefs = user.preferences[selectedConfig] || {};

        // Get effective channel config
        const sectorOverride = config.sectorOverrides?.[user.sector];
        const effectiveChannels = sectorOverride?.defaultChannels || config.defaultChannels;
        const mandatoryChannels = sectorOverride?.mandatoryChannels || config.mandatoryChannels;

        ['IN_APP', 'EMAIL', 'PUSH', 'WHATSAPP'].forEach(channel => {
          let status: 'sent' | 'blocked' | 'disabled' | 'unavailable' = 'unavailable';
          let reason = '';

          if (!effectiveChannels.includes(channel)) {
            status = 'unavailable';
            reason = 'Channel not configured for this notification';
          } else if (mandatoryChannels.includes(channel)) {
            if (!eligible) {
              status = 'blocked';
              reason = 'User not eligible';
            } else {
              status = 'sent';
              reason = 'Mandatory channel';
            }
          } else if (!userPrefs[channel]) {
            status = 'disabled';
            reason = 'User disabled this channel';
          } else if (!eligible) {
            status = 'blocked';
            reason = 'User not eligible';
          } else {
            // Check availability
            if (channel === 'PUSH' && (!user.deviceTokens || user.deviceTokens.length === 0)) {
              status = 'unavailable';
              reason = 'No device tokens';
            } else if (channel === 'WHATSAPP' && !user.whatsapp) {
              status = 'unavailable';
              reason = 'No WhatsApp number';
            } else {
              status = 'sent';
              reason = 'User preference enabled';
            }
          }

          channels.push({ channel, status, reason });
        });

        results.push({
          userId: user.id,
          userName: user.name,
          userSector: user.sector,
          channels,
          eligibility: {
            eligible,
            reason: eligibilityReason
          }
        });
      });

      setSimulationResults(results);
      setIsSimulating(false);

      // Count delivered
      const delivered = results.filter(r => r.eligibility.eligible).length;
      const totalChannels = results.reduce((acc, r) =>
        acc + r.channels.filter(c => c.status === 'sent').length, 0
      );

      toast.success(`Simulation complete!`, {
        description: `${delivered} users would receive this notification across ${totalChannels} channels`
      });
    }, 1500);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'blocked':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'disabled':
        return <XCircle className="h-4 w-4 text-orange-500" />;
      case 'unavailable':
        return <XCircle className="h-4 w-4 text-gray-400" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string, reason: string) => {
    const colors = {
      sent: 'bg-green-100 text-green-700',
      blocked: 'bg-red-100 text-red-700',
      disabled: 'bg-orange-100 text-orange-700',
      unavailable: 'bg-gray-100 text-gray-700'
    };

    return (
      <div className="flex items-center gap-1">
        {getStatusIcon(status)}
        <span className={`text-xs px-1.5 py-0.5 rounded ${colors[status]}`}>
          {reason}
        </span>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Notification Testing Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Simulate notification delivery to understand who receives what
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Notification Type</Label>
                <Select value={selectedConfig} onValueChange={setSelectedConfig}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(NOTIFICATION_CONFIGS).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Test Context</Label>

                <div className="space-y-2">
                  <Label className="text-xs">Assigned To</Label>
                  <Select
                    value={testContext.assignedTo}
                    onValueChange={(v) => setTestContext({...testContext, assignedTo: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FAKE_USERS.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.sector})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Created By</Label>
                  <Select
                    value={testContext.createdBy}
                    onValueChange={(v) => setTestContext({...testContext, createdBy: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FAKE_USERS.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.sector})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Task Sector</Label>
                  <Select
                    value={testContext.taskSector}
                    onValueChange={(v) => setTestContext({...testContext, taskSector: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">ADMIN</SelectItem>
                      <SelectItem value="PRODUCTION">PRODUCTION</SelectItem>
                      <SelectItem value="FINANCIAL">FINANCIAL</SelectItem>
                      <SelectItem value="COMMERCIAL">COMMERCIAL</SelectItem>
                      <SelectItem value="WAREHOUSE">WAREHOUSE</SelectItem>
                      <SelectItem value="DESIGNER">DESIGNER</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={simulateNotification}
                disabled={isSimulating}
              >
                {isSimulating ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Simulating...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Simulate Notification
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Configuration Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="font-medium mb-1">Allowed Sectors:</div>
                  <div className="flex flex-wrap gap-1">
                    {NOTIFICATION_CONFIGS[selectedConfig].allowedSectors.length > 0 ? (
                      NOTIFICATION_CONFIGS[selectedConfig].allowedSectors.map(sector => (
                        <Badge key={sector} variant="outline" className="text-xs">
                          {sector}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground">Custom filter only</span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="font-medium mb-1">Default Channels:</div>
                  <div className="flex gap-2">
                    {NOTIFICATION_CONFIGS[selectedConfig].defaultChannels.map(channel => (
                      <Badge key={channel} variant="secondary" className="text-xs">
                        {channel}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="font-medium mb-1">Mandatory Channels:</div>
                  <div className="flex gap-2">
                    {NOTIFICATION_CONFIGS[selectedConfig].mandatoryChannels.map(channel => (
                      <Badge key={channel} className="text-xs">
                        {channel}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Panel */}
        <div className="col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Simulation Results</CardTitle>
              <CardDescription>
                See who would receive this notification and through which channels
              </CardDescription>
            </CardHeader>
            <CardContent>
              {simulationResults.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Run a simulation to see delivery results</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Sector</TableHead>
                      <TableHead>Eligible</TableHead>
                      <TableHead>In-App</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Push</TableHead>
                      <TableHead>WhatsApp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {simulationResults.map(result => {
                      const user = FAKE_USERS.find(u => u.id === result.userId);
                      const SectorIcon = sectorIcons[result.userSector] || Building2;

                      return (
                        <TableRow key={result.userId}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">
                                  {user?.avatar}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium text-sm">{result.userName}</div>
                                <div className="text-xs text-muted-foreground">{user?.role}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              <SectorIcon className="h-3 w-3" />
                              {result.userSector}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {result.eligibility.eligible ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500" />
                            )}
                          </TableCell>
                          {['IN_APP', 'EMAIL', 'PUSH', 'WHATSAPP'].map(channel => {
                            const channelResult = result.channels.find(c => c.channel === channel);
                            return (
                              <TableCell key={channel}>
                                {channelResult && getStatusBadge(channelResult.status, channelResult.reason)}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Legend */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm">Status Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Sent: Notification would be delivered</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span>Blocked: User not eligible</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-orange-500" />
              <span>Disabled: User disabled channel</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-gray-400" />
              <span>Unavailable: Channel not available</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}