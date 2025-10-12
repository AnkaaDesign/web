/**
 * Report Generation Utilities
 *
 * Functions for generating, exporting, and scheduling reports
 * in various formats (PDF, Excel, CSV).
 */

export interface ReportConfig {
  id: string;
  title: string;
  description?: string;
  sections: ReportSection[];
  filters?: Record<string, any>;
  schedule?: ReportSchedule;
  recipients?: string[];
}

export interface ReportSection {
  id: string;
  type: 'chart' | 'table' | 'kpi' | 'text' | 'image';
  title: string;
  data?: any;
  config?: any;
}

export interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  time?: string; // HH:mm format
  timezone?: string;
  enabled: boolean;
}

export interface ExportOptions {
  format: 'pdf' | 'excel' | 'csv' | 'json';
  filename?: string;
  includeCharts?: boolean;
  includeRawData?: boolean;
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'A4' | 'Letter' | 'Legal';
}

/**
 * Generate PDF Report
 * Creates a PDF document from report data
 */
export async function generatePDF(
  reportData: ReportConfig,
  options: ExportOptions = { format: 'pdf' }
): Promise<Blob> {
  // In a real implementation, use libraries like jsPDF or pdfmake
  // This is a placeholder that creates a simple text-based PDF structure

  const content = generateReportContent(reportData);

  // Create blob (in production, use actual PDF generation)
  const pdfContent = createPDFStructure(content, options);
  return new Blob([pdfContent], { type: 'application/pdf' });
}

/**
 * Generate Excel Report
 * Creates an Excel spreadsheet from report data
 */
export async function generateExcel(
  reportData: ReportConfig,
  options: ExportOptions = { format: 'excel' }
): Promise<Blob> {
  // In a real implementation, use libraries like exceljs or xlsx
  // This is a placeholder

  const content = generateReportContent(reportData);
  const excelContent = createExcelStructure(content);

  return new Blob([excelContent], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

/**
 * Generate CSV Report
 * Creates a CSV file from tabular report data
 */
export function generateCSV(
  reportData: ReportConfig,
  options: ExportOptions = { format: 'csv' }
): Blob {
  const csvContent = convertToCSV(reportData);
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
}

/**
 * Generate JSON Report
 * Exports report data as JSON
 */
export function generateJSON(
  reportData: ReportConfig,
  options: ExportOptions = { format: 'json' }
): Blob {
  const jsonContent = JSON.stringify(reportData, null, 2);
  return new Blob([jsonContent], { type: 'application/json' });
}

/**
 * Schedule Report
 * Sets up automatic report generation and delivery
 */
export async function scheduleReport(
  config: ReportConfig
): Promise<{ success: boolean; scheduleId?: string; error?: string }> {
  try {
    if (!config.schedule || !config.schedule.enabled) {
      return { success: false, error: 'Schedule not configured or disabled' };
    }

    // In production, this would integrate with a backend scheduler
    // For now, we'll save to localStorage and simulate scheduling

    const scheduleId = `schedule_${config.id}_${Date.now()}`;
    const scheduleData = {
      id: scheduleId,
      config,
      createdAt: new Date().toISOString(),
      nextRun: calculateNextRun(config.schedule)
    };

    // Save to localStorage (in production, save to backend)
    const existingSchedules = loadSchedules();
    existingSchedules.push(scheduleData);
    saveSchedules(existingSchedules);

    return { success: true, scheduleId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to schedule report'
    };
  }
}

/**
 * Cancel Scheduled Report
 */
export function cancelScheduledReport(scheduleId: string): boolean {
  try {
    const schedules = loadSchedules();
    const filtered = schedules.filter(s => s.id !== scheduleId);
    saveSchedules(filtered);
    return true;
  } catch (error) {
    console.error('Failed to cancel schedule:', error);
    return false;
  }
}

/**
 * Get All Scheduled Reports
 */
export function getScheduledReports(): any[] {
  return loadSchedules();
}

/**
 * Execute Scheduled Report
 * Generates and sends a scheduled report
 */
export async function executeScheduledReport(
  scheduleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const schedules = loadSchedules();
    const schedule = schedules.find(s => s.id === scheduleId);

    if (!schedule) {
      return { success: false, error: 'Schedule not found' };
    }

    // Generate report
    const blob = await generateReport(schedule.config, { format: 'pdf' });

    // Send report (in production, integrate with email service)
    if (schedule.config.recipients && schedule.config.recipients.length > 0) {
      await sendReportEmail(schedule.config.recipients, blob, schedule.config);
    }

    // Update next run time
    schedule.nextRun = calculateNextRun(schedule.config.schedule);
    saveSchedules(schedules);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute report'
    };
  }
}

/**
 * Generate Report
 * Main function that generates report in specified format
 */
export async function generateReport(
  reportData: ReportConfig,
  options: ExportOptions
): Promise<Blob> {
  switch (options.format) {
    case 'pdf':
      return generatePDF(reportData, options);
    case 'excel':
      return generateExcel(reportData, options);
    case 'csv':
      return generateCSV(reportData, options);
    case 'json':
      return generateJSON(reportData, options);
    default:
      throw new Error(`Unsupported format: ${options.format}`);
  }
}

/**
 * Download Report
 * Triggers browser download of generated report
 */
export function downloadReport(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Share Report
 * Generates a shareable link for the report
 */
export async function shareReport(
  reportData: ReportConfig
): Promise<{ url: string; expiresAt: Date }> {
  // In production, upload to backend and get shareable URL
  const shareId = `share_${Date.now()}`;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

  // Save to localStorage (in production, save to backend)
  const shareData = {
    id: shareId,
    reportData,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString()
  };

  localStorage.setItem(`report_share_${shareId}`, JSON.stringify(shareData));

  const url = `${window.location.origin}/reports/shared/${shareId}`;
  return { url, expiresAt };
}

/**
 * Load Shared Report
 */
export function loadSharedReport(shareId: string): ReportConfig | null {
  try {
    const stored = localStorage.getItem(`report_share_${shareId}`);
    if (!stored) return null;

    const shareData = JSON.parse(stored);
    const expiresAt = new Date(shareData.expiresAt);

    if (expiresAt < new Date()) {
      // Expired
      localStorage.removeItem(`report_share_${shareId}`);
      return null;
    }

    return shareData.reportData;
  } catch (error) {
    console.error('Failed to load shared report:', error);
    return null;
  }
}

// Helper Functions

function generateReportContent(reportData: ReportConfig): string {
  let content = `# ${reportData.title}\n\n`;

  if (reportData.description) {
    content += `${reportData.description}\n\n`;
  }

  content += `Generated: ${new Date().toLocaleString()}\n\n`;

  for (const section of reportData.sections) {
    content += `## ${section.title}\n\n`;

    switch (section.type) {
      case 'kpi':
        content += formatKPISection(section);
        break;
      case 'table':
        content += formatTableSection(section);
        break;
      case 'chart':
        content += formatChartSection(section);
        break;
      case 'text':
        content += `${section.data || ''}\n\n`;
        break;
    }
  }

  return content;
}

function formatKPISection(section: ReportSection): string {
  if (!section.data) return '';

  let content = '';
  for (const [key, value] of Object.entries(section.data)) {
    content += `- ${key}: ${value}\n`;
  }
  return content + '\n';
}

function formatTableSection(section: ReportSection): string {
  if (!section.data || !Array.isArray(section.data)) return '';

  const data = section.data;
  if (data.length === 0) return 'No data\n\n';

  // Get headers from first row
  const headers = Object.keys(data[0]);
  let content = headers.join(' | ') + '\n';
  content += headers.map(() => '---').join(' | ') + '\n';

  // Add rows
  for (const row of data) {
    content += headers.map(h => row[h] || '').join(' | ') + '\n';
  }

  return content + '\n';
}

function formatChartSection(section: ReportSection): string {
  return `[Chart: ${section.title}]\n(Chart data not available in text format)\n\n`;
}

function createPDFStructure(content: string, options: ExportOptions): string {
  // Placeholder for PDF generation
  // In production, use jsPDF or pdfmake
  return `%PDF-1.4\n${content}`;
}

function createExcelStructure(content: string): string {
  // Placeholder for Excel generation
  // In production, use exceljs or xlsx
  return content;
}

function convertToCSV(reportData: ReportConfig): string {
  let csv = '';

  // Add metadata
  csv += `"Report","${reportData.title}"\n`;
  csv += `"Generated","${new Date().toISOString()}"\n\n`;

  // Add sections
  for (const section of reportData.sections) {
    if (section.type === 'table' && Array.isArray(section.data)) {
      csv += `"${section.title}"\n`;

      if (section.data.length > 0) {
        const headers = Object.keys(section.data[0]);
        csv += headers.map(h => `"${h}"`).join(',') + '\n';

        for (const row of section.data) {
          csv += headers.map(h => `"${row[h] || ''}"`).join(',') + '\n';
        }
      }

      csv += '\n';
    }
  }

  return csv;
}

function calculateNextRun(schedule: ReportSchedule): string {
  const now = new Date();
  let nextRun = new Date(now);

  switch (schedule.frequency) {
    case 'daily':
      nextRun.setDate(nextRun.getDate() + 1);
      break;
    case 'weekly':
      const daysUntilNext = (7 + (schedule.dayOfWeek || 0) - now.getDay()) % 7;
      nextRun.setDate(nextRun.getDate() + (daysUntilNext || 7));
      break;
    case 'monthly':
      nextRun.setMonth(nextRun.getMonth() + 1);
      if (schedule.dayOfMonth) {
        nextRun.setDate(schedule.dayOfMonth);
      }
      break;
    case 'quarterly':
      nextRun.setMonth(nextRun.getMonth() + 3);
      break;
  }

  if (schedule.time) {
    const [hours, minutes] = schedule.time.split(':').map(Number);
    nextRun.setHours(hours, minutes, 0, 0);
  }

  return nextRun.toISOString();
}

function loadSchedules(): any[] {
  try {
    const stored = localStorage.getItem('report_schedules');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load schedules:', error);
    return [];
  }
}

function saveSchedules(schedules: any[]): void {
  try {
    localStorage.setItem('report_schedules', JSON.stringify(schedules));
  } catch (error) {
    console.error('Failed to save schedules:', error);
  }
}

async function sendReportEmail(
  recipients: string[],
  blob: Blob,
  config: ReportConfig
): Promise<void> {
  // In production, integrate with email service (SendGrid, AWS SES, etc.)
  console.log(`Would send report "${config.title}" to:`, recipients);

  // Simulate email sending
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('Report email sent successfully');
      resolve();
    }, 1000);
  });
}

/**
 * Validate Report Configuration
 */
export function validateReportConfig(config: ReportConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.title || config.title.trim() === '') {
    errors.push('Report title is required');
  }

  if (!config.sections || config.sections.length === 0) {
    errors.push('Report must have at least one section');
  }

  if (config.schedule) {
    if (config.schedule.enabled) {
      if (!config.schedule.frequency) {
        errors.push('Schedule frequency is required');
      }

      if (config.schedule.frequency === 'weekly' && config.schedule.dayOfWeek === undefined) {
        errors.push('Day of week is required for weekly schedule');
      }

      if (config.schedule.frequency === 'monthly' && !config.schedule.dayOfMonth) {
        errors.push('Day of month is required for monthly schedule');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create Report Template
 */
export function createReportTemplate(
  type: 'monthly' | 'financial' | 'inventory' | 'hr' | 'custom'
): ReportConfig {
  const templates: Record<string, Partial<ReportConfig>> = {
    monthly: {
      title: 'Monthly Operations Report',
      description: 'Comprehensive monthly operational metrics and KPIs',
      sections: [
        { id: 'overview', type: 'kpi', title: 'Key Metrics Overview' },
        { id: 'production', type: 'chart', title: 'Production Trends' },
        { id: 'inventory', type: 'table', title: 'Inventory Status' },
        { id: 'financial', type: 'chart', title: 'Financial Performance' }
      ]
    },
    financial: {
      title: 'Financial Summary Report',
      description: 'Financial performance and cost analysis',
      sections: [
        { id: 'revenue', type: 'kpi', title: 'Revenue Metrics' },
        { id: 'costs', type: 'chart', title: 'Cost Breakdown' },
        { id: 'profit', type: 'chart', title: 'Profit Analysis' }
      ]
    },
    inventory: {
      title: 'Inventory Report',
      description: 'Current inventory status and trends',
      sections: [
        { id: 'stock', type: 'kpi', title: 'Stock Levels' },
        { id: 'movement', type: 'chart', title: 'Inventory Movement' },
        { id: 'alerts', type: 'table', title: 'Low Stock Alerts' }
      ]
    },
    hr: {
      title: 'HR Report',
      description: 'Human resources metrics and analytics',
      sections: [
        { id: 'headcount', type: 'kpi', title: 'Headcount Statistics' },
        { id: 'attendance', type: 'chart', title: 'Attendance Trends' },
        { id: 'performance', type: 'table', title: 'Performance Summary' }
      ]
    },
    custom: {
      title: 'Custom Report',
      description: 'Build your own custom report',
      sections: []
    }
  };

  const template = templates[type] || templates.custom;

  return {
    id: `report_${type}_${Date.now()}`,
    title: template.title || 'New Report',
    description: template.description,
    sections: template.sections || [],
    filters: {},
    recipients: []
  };
}
