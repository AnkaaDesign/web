import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Bell,
  Mail,
  MessageCircle,
  Smartphone,
  Trash2,
  Save,
  Eye,
  AlertCircle,
  CheckCircle,
  Code
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  NOTIFICATION_TYPE,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_IMPORTANCE,
} from '@/constants';

enum SECTOR_PRIVILEGES {
  ADMIN = 'ADMIN',
  PRODUCTION = 'PRODUCTION',
  FINANCIAL = 'FINANCIAL',
  COMMERCIAL = 'COMMERCIAL',
  LOGISTIC = 'LOGISTIC',
  WAREHOUSE = 'WAREHOUSE',
  HUMAN_RESOURCES = 'HUMAN_RESOURCES',
  DESIGNER = 'DESIGNER',
  MAINTENANCE = 'MAINTENANCE',
  EXTERNAL = 'EXTERNAL',
  BASIC = 'BASIC'
}

interface ChannelConfig {
  channel: NOTIFICATION_CHANNEL;
  enabled: boolean;
  mandatory: boolean;
}

interface SectorOverride {
  sector: SECTOR_PRIVILEGES;
  channels: ChannelConfig[];
  importance?: NOTIFICATION_IMPORTANCE;
}

interface NotificationConfiguration {
  key: string;
  notificationType: NOTIFICATION_TYPE;
  eventType: string;
  description: string;
  enabled: boolean;
  importance: NOTIFICATION_IMPORTANCE;

  // Channels
  defaultChannels: ChannelConfig[];
  sectorOverrides: SectorOverride[];

  // Target Rules
  allowedSectors: SECTOR_PRIVILEGES[];
  customFilterCode?: string;

  // Business Rules
  workHoursOnly: boolean;
  maxFrequencyPerDay?: number;
  deduplicationWindow?: number;
  batchingEnabled: boolean;
  batchDelay?: number;

  // Templates
  templates: {
    inApp: string;
    email: {
      subject: string;
      body: string;
    };
    push: string;
    whatsapp: string;
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
  LOW: 'bg-gray-500',
  NORMAL: 'bg-blue-500',
  HIGH: 'bg-orange-500',
  URGENT: 'bg-red-500'
};

export default function CreateNotificationConfiguration() {
  const [config, setConfig] = useState<NotificationConfiguration>({
    key: '',
    notificationType: NOTIFICATION_TYPE.PRODUCTION,
    eventType: '',
    description: '',
    enabled: true,
    importance: NOTIFICATION_IMPORTANCE.NORMAL,
    defaultChannels: [
      { channel: NOTIFICATION_CHANNEL.IN_APP, enabled: true, mandatory: true },
      { channel: NOTIFICATION_CHANNEL.EMAIL, enabled: true, mandatory: false },
      { channel: NOTIFICATION_CHANNEL.PUSH, enabled: true, mandatory: false },
      { channel: NOTIFICATION_CHANNEL.WHATSAPP, enabled: false, mandatory: false }
    ],
    sectorOverrides: [],
    allowedSectors: [],
    workHoursOnly: true,
    batchingEnabled: false,
    templates: {
      inApp: '',
      email: { subject: '', body: '' },
      push: '',
      whatsapp: ''
    }
  });

  const [selectedTab, setSelectedTab] = useState('basic');
  const [showPreview, setShowPreview] = useState(false);

  // Auto-generate key based on type and event
  useEffect(() => {
    if (config.notificationType && config.eventType) {
      setConfig(prev => ({
        ...prev,
        key: `${config.notificationType}.${config.eventType}`.toLowerCase()
      }));
    }
  }, [config.notificationType, config.eventType]);

  const updateChannel = (channel: NOTIFICATION_CHANNEL, field: 'enabled' | 'mandatory', value: boolean) => {
    setConfig(prev => ({
      ...prev,
      defaultChannels: prev.defaultChannels.map(ch =>
        ch.channel === channel ? { ...ch, [field]: value } : ch
      )
    }));
  };

  const toggleSector = (sector: SECTOR_PRIVILEGES) => {
    setConfig(prev => ({
      ...prev,
      allowedSectors: prev.allowedSectors.includes(sector)
        ? prev.allowedSectors.filter(s => s !== sector)
        : [...prev.allowedSectors, sector]
    }));
  };

  const addSectorOverride = (sector: SECTOR_PRIVILEGES) => {
    if (config.sectorOverrides.find(o => o.sector === sector)) {
      toast.error('Sector override already exists');
      return;
    }

    setConfig(prev => ({
      ...prev,
      sectorOverrides: [
        ...prev.sectorOverrides,
        {
          sector,
          channels: [...prev.defaultChannels],
          importance: prev.importance
        }
      ]
    }));
  };

  const removeSectorOverride = (sector: SECTOR_PRIVILEGES) => {
    setConfig(prev => ({
      ...prev,
      sectorOverrides: prev.sectorOverrides.filter(o => o.sector !== sector)
    }));
  };

  const updateSectorChannel = (
    sector: SECTOR_PRIVILEGES,
    channel: NOTIFICATION_CHANNEL,
    field: 'enabled' | 'mandatory',
    value: boolean
  ) => {
    setConfig(prev => ({
      ...prev,
      sectorOverrides: prev.sectorOverrides.map(override =>
        override.sector === sector
          ? {
              ...override,
              channels: override.channels.map(ch =>
                ch.channel === channel ? { ...ch, [field]: value } : ch
              )
            }
          : override
      )
    }));
  };

  const handleSave = () => {
    // Validation
    if (!config.eventType) {
      toast.error('Event type is required');
      return;
    }

    if (!config.description) {
      toast.error('Description is required');
      return;
    }

    if (config.allowedSectors.length === 0 && !config.customFilterCode) {
      toast.error('You must select at least one sector or provide custom filter code');
      return;
    }

    // Check if at least one channel is enabled
    const hasEnabledChannel = config.defaultChannels.some(ch => ch.enabled);
    if (!hasEnabledChannel) {
      toast.error('At least one channel must be enabled');
      return;
    }

    // In real implementation, this would call an API
    console.log('Saving configuration:', config);
    toast.success('Notification configuration saved successfully!');
  };

  return (
    <div className="container mx-auto py-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Create Notification Configuration</h1>
        <p className="text-muted-foreground mt-2">
          Define how notifications are sent for specific events in your system
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Notification Details</CardTitle>
            <CardDescription>Basic information about this notification type</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="targeting">Targeting</TabsTrigger>
                <TabsTrigger value="channels">Channels</TabsTrigger>
                <TabsTrigger value="rules">Business Rules</TabsTrigger>
                <TabsTrigger value="templates">Templates</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Notification Type</Label>
                    <Select
                      value={config.notificationType}
                      onValueChange={(value) => setConfig({...config, notificationType: value as NOTIFICATION_TYPE})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(NOTIFICATION_TYPE).map(type => (
                          <SelectItem key={type} value={type}>
                            {type.replace('_', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="eventType">Event Type</Label>
                    <Input
                      id="eventType"
                      placeholder="e.g., created, completed, assigned"
                      value={config.eventType}
                      onChange={(value) => {
                        setConfig({...config, eventType: String(value || '')});
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="key">Configuration Key (auto-generated)</Label>
                  <Input
                    id="key"
                    value={config.key}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe when this notification is sent and why"
                    value={config.description}
                    onChange={(e) => {
                      setConfig({...config, description: e.target.value});
                    }}
                    rows={3}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enabled">Enabled</Label>
                    <div className="text-sm text-muted-foreground">
                      Allow this notification to be sent
                    </div>
                  </div>
                  <Switch
                    id="enabled"
                    checked={config.enabled}
                    onCheckedChange={(checked) => setConfig({...config, enabled: checked})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="importance">Importance Level</Label>
                  <Select
                    value={config.importance}
                    onValueChange={(value) => setConfig({...config, importance: value as NOTIFICATION_IMPORTANCE})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(NOTIFICATION_IMPORTANCE).map(level => (
                        <SelectItem key={level} value={level}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${importanceColors[level]}`} />
                            {level}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="targeting" className="space-y-4 mt-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Define who receives this notification based on sectors or custom logic
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label>Allowed Sectors</Label>
                  <div className="text-sm text-muted-foreground mb-2">
                    Select which sectors should receive this notification
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.values(SECTOR_PRIVILEGES).map(sector => (
                      <div
                        key={sector}
                        className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors ${
                          config.allowedSectors.includes(sector)
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => toggleSector(sector)}
                      >
                        <span className="text-sm">{sector.replace('_', ' ')}</span>
                        {config.allowedSectors.includes(sector) && (
                          <CheckCircle className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    <Label>Custom Filter Code (Advanced)</Label>
                  </div>
                  <Textarea
                    placeholder="(user, context) => {
  // Return true if user should receive notification
  return user.id === context.order.createdById;
}"
                    value={config.customFilterCode || ''}
                    onChange={(e) => {
                      setConfig({...config, customFilterCode: e.target.value});
                    }}
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>
              </TabsContent>

              <TabsContent value="channels" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Default Channel Configuration</h3>
                    <div className="space-y-2">
                      {config.defaultChannels.map(channelConfig => {
                        const Icon = channelIcons[channelConfig.channel];
                        return (
                          <div
                            key={channelConfig.channel}
                            className="flex items-center justify-between p-3 rounded-lg border"
                          >
                            <div className="flex items-center gap-3">
                              <Icon className="h-5 w-5" />
                              <span className="font-medium">{channelLabels[channelConfig.channel]}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`${channelConfig.channel}-enabled`} className="text-sm">
                                  Enabled
                                </Label>
                                <Switch
                                  id={`${channelConfig.channel}-enabled`}
                                  checked={channelConfig.enabled}
                                  onCheckedChange={(checked) =>
                                    updateChannel(channelConfig.channel, 'enabled', checked)
                                  }
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`${channelConfig.channel}-mandatory`} className="text-sm">
                                  Mandatory
                                </Label>
                                <Switch
                                  id={`${channelConfig.channel}-mandatory`}
                                  checked={channelConfig.mandatory}
                                  disabled={!channelConfig.enabled}
                                  onCheckedChange={(checked) =>
                                    updateChannel(channelConfig.channel, 'mandatory', checked)
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold">Sector-Specific Overrides</h3>
                      <Select onValueChange={(value) => addSectorOverride(value as SECTOR_PRIVILEGES)}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Add sector override" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(SECTOR_PRIVILEGES)
                            .filter(s => !config.sectorOverrides.find(o => o.sector === s))
                            .map(sector => (
                              <SelectItem key={sector} value={sector}>
                                {sector.replace('_', ' ')}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {config.sectorOverrides.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No sector-specific overrides configured
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {config.sectorOverrides.map(override => (
                          <Card key={override.sector}>
                            <CardHeader className="py-3">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base">
                                  {override.sector.replace('_', ' ')}
                                </CardTitle>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeSectorOverride(override.sector)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              {override.channels.map(channelConfig => {
                                const Icon = channelIcons[channelConfig.channel];
                                return (
                                  <div
                                    key={channelConfig.channel}
                                    className="flex items-center justify-between"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Icon className="h-4 w-4" />
                                      <span className="text-sm">{channelLabels[channelConfig.channel]}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <Switch
                                        checked={channelConfig.enabled}
                                        onCheckedChange={(checked) =>
                                          updateSectorChannel(override.sector, channelConfig.channel, 'enabled', checked)
                                        }
                                      />
                                      <Switch
                                        checked={channelConfig.mandatory}
                                        disabled={!channelConfig.enabled}
                                        onCheckedChange={(checked) =>
                                          updateSectorChannel(override.sector, channelConfig.channel, 'mandatory', checked)
                                        }
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="rules" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="workHours">Work Hours Only (7:30 - 18:00)</Label>
                      <div className="text-sm text-muted-foreground">
                        Only send during business hours
                      </div>
                    </div>
                    <Switch
                      id="workHours"
                      checked={config.workHoursOnly}
                      onCheckedChange={(checked) => setConfig({...config, workHoursOnly: checked})}
                    />
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="maxFrequency">Max Frequency (per day)</Label>
                      <Input
                        id="maxFrequency"
                        type="number"
                        placeholder="Unlimited"
                        value={config.maxFrequencyPerDay || ''}
                        onChange={(value) => {
                          setConfig({
                            ...config,
                            maxFrequencyPerDay: value ? Number(value) : undefined
                          });
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dedup">Deduplication Window (seconds)</Label>
                      <Input
                        id="dedup"
                        type="number"
                        placeholder="No deduplication"
                        value={config.deduplicationWindow || ''}
                        onChange={(value) => {
                          setConfig({
                            ...config,
                            deduplicationWindow: value ? Number(value) : undefined
                          });
                        }}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="batching">Enable Batching</Label>
                      <div className="text-sm text-muted-foreground">
                        Combine multiple notifications
                      </div>
                    </div>
                    <Switch
                      id="batching"
                      checked={config.batchingEnabled}
                      onCheckedChange={(checked) => setConfig({...config, batchingEnabled: checked})}
                    />
                  </div>

                  {config.batchingEnabled && (
                    <div className="space-y-2">
                      <Label htmlFor="batchDelay">Batch Delay (seconds)</Label>
                      <Input
                        id="batchDelay"
                        type="number"
                        placeholder="300"
                        value={config.batchDelay || ''}
                        onChange={(value) => {
                          setConfig({
                            ...config,
                            batchDelay: value ? Number(value) : undefined
                          });
                        }}
                      />
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="templates" className="space-y-4 mt-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Use {'{{variableName}}'} for dynamic content that will be replaced when sending
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="template-inapp">
                      <Bell className="inline h-4 w-4 mr-1" />
                      In-App Notification
                    </Label>
                    <Input
                      id="template-inapp"
                      placeholder="Task {{taskTitle}} has been assigned to you"
                      value={config.templates.inApp}
                      onChange={(value) => {
                        setConfig({
                          ...config,
                          templates: { ...config.templates, inApp: String(value || '') }
                        });
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template-push">
                      <Smartphone className="inline h-4 w-4 mr-1" />
                      Push Notification
                    </Label>
                    <Input
                      id="template-push"
                      placeholder="New task: {{taskTitle}}"
                      value={config.templates.push}
                      onChange={(value) => {
                        setConfig({
                          ...config,
                          templates: { ...config.templates, push: String(value || '') }
                        });
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template-email-subject">
                      <Mail className="inline h-4 w-4 mr-1" />
                      Email Subject
                    </Label>
                    <Input
                      id="template-email-subject"
                      placeholder="Task Assignment: {{taskTitle}}"
                      value={config.templates.email.subject}
                      onChange={(value) => {
                        setConfig({
                          ...config,
                          templates: {
                            ...config.templates,
                            email: { ...config.templates.email, subject: String(value || '') }
                          }
                        });
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template-email-body">Email Body</Label>
                    <Textarea
                      id="template-email-body"
                      placeholder="Hello {{userName}},

You have been assigned to task: {{taskTitle}}

Deadline: {{deadline}}
Priority: {{priority}}

Best regards,
The Team"
                      rows={8}
                      value={config.templates.email.body}
                      onChange={(e) => {
                        setConfig({
                          ...config,
                          templates: {
                            ...config.templates,
                            email: { ...config.templates.email, body: e.target.value }
                          }
                        });
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template-whatsapp">
                      <MessageCircle className="inline h-4 w-4 mr-1" />
                      WhatsApp Message
                    </Label>
                    <Textarea
                      id="template-whatsapp"
                      placeholder="*New Task Assignment* 📋

Task: {{taskTitle}}
Deadline: {{deadline}}
Priority: {{priority}}

View details: {{link}}"
                      rows={5}
                      value={config.templates.whatsapp}
                      onChange={(e) => {
                        setConfig({
                          ...config,
                          templates: { ...config.templates, whatsapp: e.target.value }
                        });
                      }}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
            <Eye className="mr-2 h-4 w-4" />
            {showPreview ? 'Hide' : 'Show'} Preview
          </Button>
          <div className="space-x-2">
            <Button variant="outline">Cancel</Button>
            <Button onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              Save Configuration
            </Button>
          </div>
        </div>

        {showPreview && (
          <Card>
            <CardHeader>
              <CardTitle>Configuration Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs overflow-auto bg-muted p-4 rounded-lg">
                {JSON.stringify(config, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}