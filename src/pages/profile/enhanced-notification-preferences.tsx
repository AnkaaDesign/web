import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bell,
  Mail,
  MessageCircle,
  Smartphone,
  Shield,
  AlertCircle,
  Check,
  X,
  RotateCcw,
  Save,
  Filter,
  Building2,
  User,
  Clock,
  Zap,
  BellOff
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Fake data for demo
const FAKE_USER = {
  id: '1',
  name: 'João Silva',
  email: 'joao.silva@ankaa.com',
  sector: 'PRODUCTION',
  role: 'Team Lead',
  avatar: 'JS'
};

const NOTIFICATION_CONFIGS = [
  {
    key: 'task.created',
    type: 'TASK',
    eventType: 'created',
    label: 'New Task Assigned',
    description: 'When a new task is assigned to you',
    importance: 'HIGH',
    defaultChannels: [
      { channel: 'IN_APP', enabled: true, mandatory: true },
      { channel: 'PUSH', enabled: true, mandatory: true },
      { channel: 'EMAIL', enabled: true, mandatory: false },
      { channel: 'WHATSAPP', enabled: true, mandatory: false }
    ],
    sectorOverride: null
  },
  {
    key: 'task.deadline_approaching',
    type: 'TASK',
    eventType: 'deadline_approaching',
    label: 'Deadline Approaching',
    description: 'Reminders for upcoming task deadlines',
    importance: 'URGENT',
    defaultChannels: [
      { channel: 'IN_APP', enabled: true, mandatory: true },
      { channel: 'PUSH', enabled: true, mandatory: true },
      { channel: 'EMAIL', enabled: true, mandatory: false },
      { channel: 'WHATSAPP', enabled: true, mandatory: true }
    ],
    sectorOverride: {
      PRODUCTION: [
        { channel: 'IN_APP', enabled: true, mandatory: true },
        { channel: 'PUSH', enabled: true, mandatory: true },
        { channel: 'EMAIL', enabled: false, mandatory: false },
        { channel: 'WHATSAPP', enabled: true, mandatory: true }
      ]
    }
  },
  {
    key: 'task.status_changed',
    type: 'TASK',
    eventType: 'status_changed',
    label: 'Task Status Update',
    description: 'When task status changes',
    importance: 'NORMAL',
    defaultChannels: [
      { channel: 'IN_APP', enabled: true, mandatory: false },
      { channel: 'PUSH', enabled: true, mandatory: false },
      { channel: 'EMAIL', enabled: false, mandatory: false },
      { channel: 'WHATSAPP', enabled: false, mandatory: false }
    ]
  },
  {
    key: 'order.created',
    type: 'ORDER',
    eventType: 'created',
    label: 'New Order',
    description: 'When a new order is created',
    importance: 'NORMAL',
    defaultChannels: [
      { channel: 'IN_APP', enabled: true, mandatory: false },
      { channel: 'EMAIL', enabled: true, mandatory: false },
      { channel: 'PUSH', enabled: false, mandatory: false },
      { channel: 'WHATSAPP', enabled: false, mandatory: false }
    ]
  },
  {
    key: 'order.invoice_ready',
    type: 'ORDER',
    eventType: 'invoice_ready',
    label: 'Invoice Ready',
    description: 'When an invoice is generated for your order',
    importance: 'HIGH',
    defaultChannels: [
      { channel: 'IN_APP', enabled: true, mandatory: true },
      { channel: 'EMAIL', enabled: true, mandatory: true },
      { channel: 'PUSH', enabled: true, mandatory: false },
      { channel: 'WHATSAPP', enabled: false, mandatory: false }
    ],
    sectorOverride: {
      FINANCIAL: [
        { channel: 'IN_APP', enabled: true, mandatory: true },
        { channel: 'EMAIL', enabled: true, mandatory: true },
        { channel: 'PUSH', enabled: true, mandatory: true },
        { channel: 'WHATSAPP', enabled: true, mandatory: false }
      ]
    }
  },
  {
    key: 'service_order.completed',
    type: 'SERVICE_ORDER',
    eventType: 'completed',
    label: 'Service Order Completed',
    description: 'When a service order you created is completed',
    importance: 'HIGH',
    defaultChannels: [
      { channel: 'IN_APP', enabled: true, mandatory: true },
      { channel: 'PUSH', enabled: true, mandatory: true },
      { channel: 'EMAIL', enabled: false, mandatory: false },
      { channel: 'WHATSAPP', enabled: true, mandatory: true }
    ]
  },
  {
    key: 'stock.low',
    type: 'STOCK',
    eventType: 'low',
    label: 'Low Stock Alert',
    description: 'When inventory items are running low',
    importance: 'NORMAL',
    defaultChannels: [
      { channel: 'IN_APP', enabled: true, mandatory: false },
      { channel: 'EMAIL', enabled: true, mandatory: false },
      { channel: 'PUSH', enabled: false, mandatory: false },
      { channel: 'WHATSAPP', enabled: false, mandatory: false }
    ]
  },
  {
    key: 'system.maintenance',
    type: 'SYSTEM',
    eventType: 'maintenance',
    label: 'System Maintenance',
    description: 'Scheduled maintenance notifications',
    importance: 'LOW',
    defaultChannels: [
      { channel: 'IN_APP', enabled: true, mandatory: true },
      { channel: 'EMAIL', enabled: true, mandatory: false },
      { channel: 'PUSH', enabled: false, mandatory: false },
      { channel: 'WHATSAPP', enabled: false, mandatory: false }
    ]
  }
];

interface UserPreference {
  configKey: string;
  enabled: boolean;
  channels: {
    IN_APP: boolean;
    EMAIL: boolean;
    PUSH: boolean;
    WHATSAPP: boolean;
  };
}

const channelIcons = {
  IN_APP: Bell,
  EMAIL: Mail,
  PUSH: Smartphone,
  WHATSAPP: MessageCircle
};

const channelLabels = {
  IN_APP: 'In-App',
  EMAIL: 'Email',
  PUSH: 'Push',
  WHATSAPP: 'WhatsApp'
};

const importanceColors = {
  LOW: 'bg-gray-100 text-gray-700 border-gray-300',
  NORMAL: 'bg-blue-100 text-blue-700 border-blue-300',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-300',
  URGENT: 'bg-red-100 text-red-700 border-red-300'
};

const importanceIcons = {
  LOW: null,
  NORMAL: null,
  HIGH: Zap,
  URGENT: AlertCircle
};

export default function EnhancedNotificationPreferences() {
  const [preferences, setPreferences] = useState<UserPreference[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Initialize preferences from configurations
    const initialPreferences = NOTIFICATION_CONFIGS.map(config => {
      // Apply sector overrides if applicable
      const effectiveChannels = config.sectorOverride?.[FAKE_USER.sector] || config.defaultChannels;

      return {
        configKey: config.key,
        enabled: true,
        channels: {
          IN_APP: effectiveChannels.find(c => c.channel === 'IN_APP')?.enabled || false,
          EMAIL: effectiveChannels.find(c => c.channel === 'EMAIL')?.enabled || false,
          PUSH: effectiveChannels.find(c => c.channel === 'PUSH')?.enabled || false,
          WHATSAPP: effectiveChannels.find(c => c.channel === 'WHATSAPP')?.enabled || false
        }
      };
    });
    setPreferences(initialPreferences);
  }, []);

  const getEffectiveChannelConfig = (configKey: string) => {
    const config = NOTIFICATION_CONFIGS.find(c => c.key === configKey);
    if (!config) return null;

    // Check for sector-specific overrides
    if (config.sectorOverride?.[FAKE_USER.sector]) {
      return config.sectorOverride[FAKE_USER.sector];
    }

    return config.defaultChannels;
  };

  const updateChannelPreference = (configKey: string, channel: string, enabled: boolean) => {
    const config = NOTIFICATION_CONFIGS.find(c => c.key === configKey);
    if (!config) return;

    const effectiveChannels = getEffectiveChannelConfig(configKey);
    const channelConfig = effectiveChannels?.find(c => c.channel === channel);

    // Check if channel is mandatory
    if (channelConfig?.mandatory && !enabled) {
      toast.error(`${channelLabels[channel]} is mandatory for this notification type`, {
        description: 'This channel cannot be disabled due to your sector requirements'
      });
      return;
    }

    setPreferences(prev => prev.map(pref => {
      if (pref.configKey === configKey) {
        return {
          ...pref,
          channels: {
            ...pref.channels,
            [channel]: enabled
          }
        };
      }
      return pref;
    }));
    setHasChanges(true);
  };

  const toggleNotification = (configKey: string) => {
    const config = NOTIFICATION_CONFIGS.find(c => c.key === configKey);
    if (!config) return;

    // Check if any channels are mandatory
    const effectiveChannels = getEffectiveChannelConfig(configKey);
    const hasMandatoryChannels = effectiveChannels?.some(c => c.mandatory);

    if (hasMandatoryChannels) {
      const pref = preferences.find(p => p.configKey === configKey);
      if (pref?.enabled) {
        toast.error('This notification cannot be disabled', {
          description: 'This notification has mandatory channels for your sector'
        });
        return;
      }
    }

    setPreferences(prev => prev.map(pref => {
      if (pref.configKey === configKey) {
        return {
          ...pref,
          enabled: !pref.enabled
        };
      }
      return pref;
    }));
    setHasChanges(true);
  };

  const resetToDefaults = () => {
    const defaultPreferences = NOTIFICATION_CONFIGS.map(config => {
      const effectiveChannels = config.sectorOverride?.[FAKE_USER.sector] || config.defaultChannels;

      return {
        configKey: config.key,
        enabled: true,
        channels: {
          IN_APP: effectiveChannels.find(c => c.channel === 'IN_APP')?.enabled || false,
          EMAIL: effectiveChannels.find(c => c.channel === 'EMAIL')?.enabled || false,
          PUSH: effectiveChannels.find(c => c.channel === 'PUSH')?.enabled || false,
          WHATSAPP: effectiveChannels.find(c => c.channel === 'WHATSAPP')?.enabled || false
        }
      };
    });
    setPreferences(defaultPreferences);
    setHasChanges(false);
    toast.success('Preferences reset to defaults');
  };

  const savePreferences = () => {
    // In real implementation, this would call an API
    console.log('Saving preferences:', preferences);
    setHasChanges(false);
    toast.success('Preferences saved successfully');
  };

  const getFilteredConfigs = () => {
    let filtered = [...NOTIFICATION_CONFIGS];

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(c => c.type === selectedCategory);
    }

    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  };

  const categories = ['all', ...Array.from(new Set(NOTIFICATION_CONFIGS.map(c => c.type)))];

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Notification Preferences</h1>
        <p className="text-muted-foreground mt-2">
          Manage how you receive notifications for different events
        </p>
      </div>

      {/* User Info Card */}
      <Card className="mb-6">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback>{FAKE_USER.avatar}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-semibold">{FAKE_USER.name}</div>
              <div className="text-sm text-muted-foreground">{FAKE_USER.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="gap-1">
              <Building2 className="h-3 w-3" />
              {FAKE_USER.sector}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <User className="h-3 w-3" />
              {FAKE_USER.role}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Sector-specific Alert */}
      {FAKE_USER.sector === 'PRODUCTION' && (
        <Alert className="mb-6">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Sector-Specific Settings:</strong> Some notification channels are mandatory for your sector (Production) and cannot be disabled.
          </AlertDescription>
        </Alert>
      )}

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="mb-6">
        <TabsList className="grid grid-cols-6 w-full max-w-2xl">
          {categories.map(cat => (
            <TabsTrigger key={cat} value={cat}>
              {cat === 'all' ? 'All' : cat.replace('_', ' ')}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Notification Settings */}
      <div className="space-y-4 mb-6">
        {getFilteredConfigs().map(config => {
          const pref = preferences.find(p => p.configKey === config.key);
          const effectiveChannels = getEffectiveChannelConfig(config.key);
          const ImportanceIcon = importanceIcons[config.importance];

          return (
            <Card key={config.key} className={!pref?.enabled ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{config.label}</CardTitle>
                      <Badge
                        variant="outline"
                        className={`text-xs ${importanceColors[config.importance]}`}
                      >
                        {ImportanceIcon && <ImportanceIcon className="h-3 w-3 mr-1" />}
                        {config.importance}
                      </Badge>
                      {config.sectorOverride?.[FAKE_USER.sector] && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="secondary" className="text-xs gap-1">
                                <Building2 className="h-3 w-3" />
                                Sector Override
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>This notification has custom settings for your sector</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <CardDescription className="text-sm">
                      {config.description}
                    </CardDescription>
                  </div>
                  <Switch
                    checked={pref?.enabled ?? true}
                    onCheckedChange={() => toggleNotification(config.key)}
                    disabled={effectiveChannels?.some(c => c.mandatory)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-3">
                  {Object.entries(channelLabels).map(([channel, label]) => {
                    const Icon = channelIcons[channel];
                    const channelConfig = effectiveChannels?.find(c => c.channel === channel);
                    const isEnabled = pref?.channels?.[channel] ?? false;
                    const isMandatory = channelConfig?.mandatory ?? false;
                    const isAvailable = channelConfig?.enabled ?? false;

                    if (!isAvailable) return null;

                    return (
                      <div
                        key={channel}
                        className={`
                          flex items-center justify-between p-2 rounded-lg border transition-colors
                          ${isEnabled ? 'bg-primary/5 border-primary/20' : 'bg-background'}
                          ${!pref?.enabled ? 'opacity-50' : ''}
                          ${isMandatory ? 'border-dashed' : ''}
                        `}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span className="text-sm font-medium">{label}</span>
                          {isMandatory && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Shield className="h-3 w-3 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Mandatory for your sector</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        <Switch
                          size="sm"
                          checked={isEnabled}
                          onCheckedChange={(checked) => updateChannelPreference(config.key, channel, checked)}
                          disabled={!pref?.enabled || isMandatory}
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={resetToDefaults}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset to Defaults
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!hasChanges}>
            Cancel
          </Button>
          <Button onClick={savePreferences} disabled={!hasChanges}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Info Section */}
      <div className="mt-8 grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Channel Availability</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <span>In-App: Real-time notifications in the app</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>Email: Sent to {FAKE_USER.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <span>Push: Mobile app notifications</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                <span>WhatsApp: Business messages</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Delivery Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>Work Hours: 7:30 - 18:00 (Mon-Fri)</span>
              </div>
              <div className="flex items-center gap-2 text-orange-600">
                <Zap className="h-4 w-4" />
                <span>High/Urgent: Sent immediately</span>
              </div>
              <div className="flex items-center gap-2">
                <BellOff className="h-4 w-4 text-muted-foreground" />
                <span>Do Not Disturb: Respected for low priority</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}