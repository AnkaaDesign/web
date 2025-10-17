import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { Task } from '@types';
import type { Budget } from '../types/budget';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable?: {
      finalY: number;
    };
  }
}

export interface BudgetPDFData {
  task: Pick<Task, 'id' | 'name' | 'serialNumber' | 'customer'> & {
    budget?: Budget[];
  };
}

export function generateBudgetPDF(data: BudgetPDFData): void {
  const { task } = data;

  if (!task.budget || task.budget.length === 0) {
    console.warn('No budget data available to generate PDF');
    return;
  }

  // Create new PDF document (A4 size)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;

  // Ankaa Logo - Using placeholder text for now
  // You can replace this with a base64 encoded logo
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138); // Blue color
  doc.text('ANKAA', margin, 25);

  // Subtitle
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139); // Gray color
  doc.text('Sistema de Gestão', margin, 32);

  // Add a line below header
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, 38, pageWidth - margin, 38);

  // Document title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // Dark gray
  doc.text('Orçamento Detalhado', margin, 50);

  // Task Information
  let yPosition = 60;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  // Task Name
  doc.setFont('helvetica', 'bold');
  doc.text('Tarefa:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(task.name, margin + 25, yPosition);
  yPosition += 7;

  // Customer
  if (task.customer) {
    doc.setFont('helvetica', 'bold');
    doc.text('Cliente:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(task.customer.fantasyName || task.customer.name || 'N/A', margin + 25, yPosition);
    yPosition += 7;
  }

  // Serial Number
  if (task.serialNumber) {
    doc.setFont('helvetica', 'bold');
    doc.text('Nº Série:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(task.serialNumber, margin + 25, yPosition);
    yPosition += 7;
  }

  yPosition += 5;

  // Prepare table data
  const tableData = task.budget.map((item) => [
    item.referencia,
    `R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  ]);

  // Calculate total
  const total = task.budget.reduce((sum, item) => sum + item.valor, 0);

  // Add budget table
  doc.autoTable({
    startY: yPosition,
    head: [['Referência', 'Valor']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 58, 138], // Blue
      textColor: [255, 255, 255], // White
      fontStyle: 'bold',
      fontSize: 11,
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 10,
      textColor: [51, 65, 85],
    },
    columnStyles: {
      0: { cellWidth: 'auto' }, // Referência
      1: { cellWidth: 40, halign: 'right' }, // Valor
    },
    margin: { left: margin, right: margin },
    styles: {
      cellPadding: 5,
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // Total row
  const finalY = doc.lastAutoTable?.finalY || yPosition + 50;

  doc.setFillColor(241, 245, 249); // Light gray background
  doc.rect(margin, finalY + 2, pageWidth - 2 * margin, 12, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL:', margin + 5, finalY + 10);
  doc.text(
    `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    pageWidth - margin - 5,
    finalY + 10,
    { align: 'right' }
  );

  // Footer with generation date
  const generationDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Gerado em: ${generationDate}`,
    pageWidth / 2,
    pageHeight - 15,
    { align: 'center' }
  );

  // Page number
  doc.text(
    `Página 1 de 1`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );

  // Download the PDF
  const fileName = `orcamento-${task.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${Date.now()}.pdf`;
  doc.save(fileName);
}
