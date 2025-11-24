import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Task, Truck } from '@types';
import type { Budget } from '../types/budget';
import logoImage from '../assets/logo.png';

// Convert image to base64 for embedding in PDF
const getBase64FromImage = async (imgSrc: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL('image/png');
        resolve(dataURL);
      } else {
        reject(new Error('Could not get canvas context'));
      }
    };
    img.onerror = reject;
    img.src = imgSrc;
  });
};

export interface BudgetPDFData {
  task: Pick<Task, 'id' | 'name' | 'serialNumber' | 'customer'> & {
    budget?: Budget;
    truck?: Partial<Truck>;
  };
}

export async function generateBudgetPDF(data: BudgetPDFData): Promise<void> {
  const { task } = data;

  if (!task.budget || !task.budget.items || task.budget.items.length === 0) {
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

  // Add company logo (maintain aspect ratio)
  try {
    const logoBase64 = await getBase64FromImage(logoImage);
    const logoWidth = 35;
    const logoHeight = 15; // Maintain proper aspect ratio
    doc.addImage(logoBase64, 'PNG', margin, 12, logoWidth, logoHeight);
  } catch (error) {
    console.warn('Could not load company logo:', error);
    // Fallback to text logo
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('ANKAA', margin, 22);
  }

  // Add customer logo if available (on the right side, maintain aspect ratio)
  if (task.customer?.logo?.url) {
    try {
      const customerLogoUrl = task.customer.logo.url;
      const customerLogoBase64 = await getBase64FromImage(customerLogoUrl);
      const customerLogoWidth = 35;
      const customerLogoHeight = 15;
      doc.addImage(customerLogoBase64, 'PNG', pageWidth - margin - customerLogoWidth, 12, customerLogoWidth, customerLogoHeight);
    } catch (error) {
      console.warn('Could not load customer logo:', error);
    }
  }

  // Add a line below header
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, 32, pageWidth - margin, 32);

  // Document title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Orçamento Detalhado', margin, 42);

  // Task Information
  let yPosition = 52;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

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

  // Chassis Number
  if (task.truck?.chassisNumber) {
    doc.setFont('helvetica', 'bold');
    doc.text('Chassi:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(task.truck.chassisNumber, margin + 25, yPosition);
    yPosition += 7;
  }

  // Plate
  if (task.truck?.plate) {
    doc.setFont('helvetica', 'bold');
    doc.text('Placa:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(task.truck.plate, margin + 25, yPosition);
    yPosition += 7;
  }

  // Layout dimensions (Tamanho) if truck has layouts
  if (task.truck) {
    const layouts = [task.truck.leftSideLayout, task.truck.rightSideLayout, task.truck.backSideLayout].filter(Boolean);
    if (layouts.length > 0 && layouts[0]) {
      const layout = layouts[0];
      if (layout.height && layout.layoutSections && layout.layoutSections.length > 0) {
        // Calculate total width from sections
        const totalWidth = layout.layoutSections.reduce((sum, section) => sum + (section.width || 0), 0);
        doc.setFont('helvetica', 'bold');
        doc.text('Tamanho:', margin, yPosition);
        doc.setFont('helvetica', 'normal');
        doc.text(`${totalWidth.toFixed(2).replace('.', ',')} x ${layout.height.toFixed(2).replace('.', ',')} m`, margin + 25, yPosition);
        yPosition += 7;
      }
    }
  }

  // Add expiration date if available
  if (task.budget.expiresIn) {
    doc.setFont('helvetica', 'bold');
    doc.text('Validade:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    const expiryDate = new Date(task.budget.expiresIn);
    doc.text(expiryDate.toLocaleDateString('pt-BR'), margin + 25, yPosition);
    yPosition += 7;
  }

  yPosition += 5;

  // Prepare table data
  const tableData = task.budget.items.map((item) => {
    const value = typeof item.amount === 'number' ? item.amount : Number(item.amount) || 0;
    return [
      item.description,
      `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    ];
  });

  // Use the total from the budget entity
  const total = typeof task.budget.total === 'number' ? task.budget.total : Number(task.budget.total) || 0;

  // Add budget table with clean design
  autoTable(doc, {
    startY: yPosition,
    head: [['Descrição', 'Valor']],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'left',
      lineWidth: 0.5,
      lineColor: [220, 220, 220],
    },
    bodyStyles: {
      fontSize: 10,
      textColor: [40, 40, 40],
      lineWidth: 0.1,
      lineColor: [230, 230, 230],
    },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' }, // Descrição
      1: { cellWidth: 45, halign: 'right', fontStyle: 'bold' }, // Valor
    },
    margin: { left: margin, right: margin },
    styles: {
      cellPadding: 4,
      lineColor: [230, 230, 230],
      lineWidth: 0.1,
    },
    alternateRowStyles: {
      fillColor: [252, 252, 252],
    },
  });

  // Total row with clean design
  const finalY = (doc as any).lastAutoTable?.finalY || yPosition + 50;

  // Draw border for total row
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.rect(margin, finalY + 3, pageWidth - 2 * margin, 10);

  // Total background
  doc.setFillColor(250, 250, 250);
  doc.rect(margin, finalY + 3, pageWidth - 2 * margin, 10, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('TOTAL:', margin + 4, finalY + 10);
  doc.text(
    `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    pageWidth - margin - 4,
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
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
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
