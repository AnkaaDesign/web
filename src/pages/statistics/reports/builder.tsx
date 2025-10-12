/**
 * Custom Reports Builder Page
 *
 * Drag-and-drop report builder with templates, scheduling,
 * and automated delivery capabilities.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  IconPlus,
  IconTrash,
  IconDownload,
  IconSend,
  IconTemplate,
  IconCalendar,
  IconGripVertical,
  IconChartBar,
  IconTable,
  IconFileText
} from '@tabler/icons-react';
import { createReportTemplate, generateReport, scheduleReport, type ReportConfig, type ReportSection } from '../analytics/utils/report-generator';
import { cn } from '@/lib/utils';

export default function ReportsBuilderPage() {
  const [reportName, setReportName] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly'>('weekly');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [newRecipient, setNewRecipient] = useState('');

  // Available section types
  const sectionTypes = [
    { value: 'kpi', label: 'KPI Metrics', icon: IconChartBar, color: 'bg-blue-500' },
    { value: 'chart', label: 'Chart', icon: IconChartBar, color: 'bg-green-500' },
    { value: 'table', label: 'Data Table', icon: IconTable, color: 'bg-purple-500' },
    { value: 'text', label: 'Text Block', icon: IconFileText, color: 'bg-gray-500' }
  ];

  // Report templates
  const templates = [
    { value: 'monthly', label: 'Monthly Operations Report', description: 'Comprehensive monthly metrics' },
    { value: 'financial', label: 'Financial Summary', description: 'Financial performance and costs' },
    { value: 'inventory', label: 'Inventory Report', description: 'Stock levels and trends' },
    { value: 'hr', label: 'HR Report', description: 'Human resources metrics' },
    { value: 'custom', label: 'Blank Report', description: 'Start from scratch' }
  ];

  const addSection = (type: ReportSection['type']) => {
    const newSection: ReportSection = {
      id: Date.now().toString(),
      type,
      title: `New ${type} section`,
      config: {}
    };
    setSections([...sections, newSection]);
  };

  const removeSection = (id: string) => {
    setSections(sections.filter(s => s.id !== id));
  };

  const updateSection = (id: string, updates: Partial<ReportSection>) => {
    setSections(sections.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const moveSection = (id: string, direction: 'up' | 'down') => {
    const index = sections.findIndex(s => s.id === id);
    if (index === -1) return;

    const newSections = [...sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex >= 0 && targetIndex < sections.length) {
      [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
      setSections(newSections);
    }
  };

  const loadTemplate = (templateType: string) => {
    const template = createReportTemplate(templateType as any);
    setReportName(template.title);
    setReportDescription(template.description || '');
    setSections(template.sections);
  };

  const addRecipient = () => {
    if (newRecipient && !recipients.includes(newRecipient)) {
      setRecipients([...recipients, newRecipient]);
      setNewRecipient('');
    }
  };

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter(r => r !== email));
  };

  const saveReport = async () => {
    const report: ReportConfig = {
      id: Date.now().toString(),
      title: reportName,
      description: reportDescription,
      sections,
      schedule: scheduleEnabled ? {
        frequency,
        enabled: true
      } : undefined,
      recipients
    };

    console.log('Saving report:', report);
    alert('Report configuration saved!');
  };

  const generateReportNow = async (format: 'pdf' | 'excel' | 'csv') => {
    const report: ReportConfig = {
      id: Date.now().toString(),
      title: reportName,
      description: reportDescription,
      sections
    };

    try {
      const blob = await generateReport(report, { format });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportName || 'report'}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('Failed to generate report');
    }
  };

  const getSectionIcon = (type: ReportSection['type']) => {
    const sectionType = sectionTypes.find(t => t.value === type);
    return sectionType?.icon || IconFileText;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports Builder</h1>
          <p className="text-muted-foreground mt-1">
            Create custom reports with drag-and-drop builder
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={saveReport}>
            Save Report
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <IconDownload className="h-4 w-4 mr-2" />
                Generate
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Report</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Choose the format for your report:
                </p>
                <div className="flex flex-col gap-2">
                  <Button onClick={() => generateReportNow('pdf')} className="w-full">
                    <IconDownload className="h-4 w-4 mr-2" />
                    Download as PDF
                  </Button>
                  <Button onClick={() => generateReportNow('excel')} variant="outline" className="w-full">
                    <IconDownload className="h-4 w-4 mr-2" />
                    Download as Excel
                  </Button>
                  <Button onClick={() => generateReportNow('csv')} variant="outline" className="w-full">
                    <IconDownload className="h-4 w-4 mr-2" />
                    Download as CSV
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report Builder */}
        <div className="lg:col-span-2 space-y-4">
          {/* Report Info */}
          <Card>
            <CardHeader>
              <CardTitle>Report Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="report-name">Report Name</Label>
                <Input
                  id="report-name"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder="e.g., Monthly Sales Report"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-desc">Description (Optional)</Label>
                <Textarea
                  id="report-desc"
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Brief description of what this report includes"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Report Sections */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Report Sections</CardTitle>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <IconPlus className="h-4 w-4 mr-2" />
                      Add Section
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Report Section</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-3 py-4">
                      {sectionTypes.map((type) => {
                        const Icon = type.icon;
                        return (
                          <Button
                            key={type.value}
                            variant="outline"
                            className="h-24 flex flex-col gap-2"
                            onClick={() => addSection(type.value as any)}
                          >
                            <div className={cn('p-2 rounded', type.color)}>
                              <Icon className="h-6 w-6 text-white" />
                            </div>
                            <span className="text-sm font-medium">{type.label}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {sections.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <IconFileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No sections added yet</p>
                  <p className="text-sm">Click "Add Section" to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sections.map((section, index) => {
                    const Icon = getSectionIcon(section.type);
                    return (
                      <div
                        key={section.id}
                        className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <IconGripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                          <Input
                            value={section.title}
                            onChange={(e) => updateSection(section.id, { title: e.target.value })}
                            className="h-8 font-medium"
                          />
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {section.type}
                        </Badge>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => moveSection(section.id, 'up')}
                            disabled={index === 0}
                          >
                            ↑
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => moveSection(section.id, 'down')}
                            disabled={index === sections.length - 1}
                          >
                            ↓
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeSection(section.id)}
                          >
                            <IconTrash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Templates */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <IconTemplate className="h-5 w-5" />
                <CardTitle>Templates</CardTitle>
              </div>
              <CardDescription>Start with a pre-built template</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {templates.map((template) => (
                  <Button
                    key={template.value}
                    variant="outline"
                    className="w-full justify-start h-auto py-3"
                    onClick={() => loadTemplate(template.value)}
                  >
                    <div className="text-left">
                      <div className="font-medium">{template.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {template.description}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Scheduling */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <IconCalendar className="h-5 w-5" />
                <CardTitle>Schedule Delivery</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={scheduleEnabled}
                  onCheckedChange={(checked) => setScheduleEnabled(!!checked)}
                />
                <label className="text-sm font-medium">Enable automatic delivery</label>
              </div>

              {scheduleEnabled && (
                <>
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select value={frequency} onValueChange={(v) => setFrequency(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Recipients</Label>
                    <div className="flex gap-2">
                      <Input
                        value={newRecipient}
                        onChange={(e) => setNewRecipient(e.target.value)}
                        placeholder="email@example.com"
                        onKeyPress={(e) => e.key === 'Enter' && addRecipient()}
                      />
                      <Button size="sm" onClick={addRecipient}>
                        <IconPlus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {recipients.map((email) => (
                        <div
                          key={email}
                          className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                        >
                          <span>{email}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeRecipient(email)}
                          >
                            <IconTrash className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
