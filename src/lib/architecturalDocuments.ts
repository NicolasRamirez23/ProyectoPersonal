import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ArchitecturalCharge, ArchitecturalProject } from '../types/architecture';

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

function header(doc: jsPDF, documentType: string, folio: string) {
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 44, 'F');
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 44, 210, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('AVTECH', 16, 19);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(191, 219, 254);
  doc.text('ARQUITECTURA  /  DISEÑO  /  PROYECTOS', 16, 28);
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(139, 8, 55, 10, 2, 2, 'F');
  doc.setTextColor(219, 234, 254);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(documentType, 166.5, 14.5, { align: 'center' });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Folio  ${folio}`, 194, 27, { align: 'right' });
  doc.setTextColor(148, 163, 184);
  doc.text(`Emisión  ${new Date().toLocaleDateString('es-MX')}`, 194, 34, { align: 'right' });
  doc.setTextColor(15, 23, 42);
}

function footer(doc: jsPDF, legalText: string) {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.line(16, 278, 194, 278);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(legalText, 16, 284);
    doc.text(`Pagina ${page} de ${pageCount}`, 194, 284, { align: 'right' });
  }
}

function fileName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function buildArchitecturalReceipt(project: ArchitecturalProject, charge: ArchitecturalCharge) {
  const doc = new jsPDF();
  const folio = `REC-${charge.id.slice(0, 8).toUpperCase()}`;
  header(doc, 'RECIBO DE PAGO', folio);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('RECIBIMOS DE', 16, 52);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(project.clientName, 16, 60);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Proyecto: ${project.projectName}`, 16, 67);
  if (project.location) doc.text(`Ubicacion: ${project.location}`, 16, 73);

  doc.setFillColor(236, 253, 245);
  doc.roundedRect(132, 49, 62, 28, 3, 3, 'F');
  doc.setTextColor(5, 150, 105);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL RECIBIDO', 163, 59, { align: 'center' });
  doc.setFontSize(17);
  const receivedAmount = charge.amount * (project.invoiceRequested ? 1.16 : 1);
  doc.text(money.format(receivedAmount), 163, 70, { align: 'center' });

  autoTable(doc, {
    startY: 88,
    head: [['Concepto', 'Descripcion', 'Fecha de pago', 'Importe']],
    body: [[
      charge.concept,
      charge.description || 'Servicio arquitectonico',
      charge.paymentDate ? new Date(`${charge.paymentDate}T12:00:00`).toLocaleDateString('es-MX') : new Date().toLocaleDateString('es-MX'),
      money.format(receivedAmount),
    ]],
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235], fontSize: 9 },
    bodyStyles: { fontSize: 9, cellPadding: 4 },
    columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 115;
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Este recibo confirma el pago del concepto indicado.', 16, finalY + 14);
  doc.line(128, finalY + 42, 190, finalY + 42);
  doc.setFontSize(8);
  doc.text('Firma de administracion', 159, finalY + 48, { align: 'center' });
  footer(doc, 'Comprobante interno de pago. Conserve este documento para futuras aclaraciones.');
  return doc;
}

export function generateArchitecturalReceipt(project: ArchitecturalProject, charge: ArchitecturalCharge) {
  buildArchitecturalReceipt(project, charge).save(`REC-${charge.id.slice(0, 8).toUpperCase()}_${fileName(project.projectName)}.pdf`);
}

export function buildArchitecturalInvoice(project: ArchitecturalProject, charges: ArchitecturalCharge[]) {
  if (!charges.length) throw new Error('No hay conceptos para facturar.');
  const doc = new jsPDF();
  const folio = `FAC-${project.id.slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-5)}`;
  header(doc, 'FACTURA COMERCIAL', folio);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(37, 99, 235);
  doc.text('INFORMACIÓN DE FACTURACIÓN', 16, 55);

  autoTable(doc, {
    startY: 59,
    head: [[
      { content: 'RECEPTOR', colSpan: 2 },
      { content: 'PROYECTO', colSpan: 2 },
    ]],
    body: [
      ['Razón social', project.businessName || project.clientName, 'Proyecto', project.projectName],
      ['RFC', project.taxId || 'No proporcionado', 'Tipo', project.projectType],
      ['C.P. fiscal', project.taxPostalCode || 'No proporcionado', 'Obra', project.constructionType],
      ['Régimen fiscal', project.taxRegime || 'No proporcionado', 'Ubicación', project.location || 'No proporcionada'],
      ['Domicilio', project.taxAddress || 'No proporcionado', '', ''],
      ['Correo', project.billingEmail || 'No proporcionado', '', ''],
      ['Uso CFDI', project.cfdiUse || 'No especificado', '', ''],
    ],
    theme: 'plain',
    margin: { left: 16, right: 16 },
    headStyles: {
      fillColor: [239, 246, 255],
      textColor: [30, 64, 175],
      fontSize: 7.5,
      fontStyle: 'bold',
      cellPadding: { top: 3.5, right: 4, bottom: 3.5, left: 4 },
    },
    bodyStyles: {
      textColor: [30, 41, 59],
      fontSize: 8,
      cellPadding: { top: 2.7, right: 4, bottom: 2.7, left: 4 },
      valign: 'top',
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { cellWidth: 25, fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [100, 116, 139] },
      1: { cellWidth: 77 },
      2: { cellWidth: 23, fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [100, 116, 139] },
      3: { cellWidth: 53 },
    },
    didDrawCell: (data) => {
      if (data.section === 'body') {
        doc.setDrawColor(226, 232, 240);
        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      }
    },
  });

  const infoFinalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 105;

  const subtotal = charges.reduce((sum, charge) => sum + Number(charge.amount), 0);
  const tax = subtotal * 0.16;
  const total = subtotal + tax;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(37, 99, 235);
  doc.text('DETALLE DE SERVICIOS', 16, infoFinalY + 10);

  autoTable(doc, {
    startY: infoFinalY + 14,
    head: [['CANT.', 'CONCEPTO', 'DESCRIPCIÓN', 'IMPORTE']],
    body: charges.map((charge) => ['1', charge.concept, charge.description || '-', money.format(charge.amount)]),
    theme: 'plain',
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      cellPadding: 3.5,
    },
    bodyStyles: {
      fontSize: 8.2,
      textColor: [30, 41, 59],
      cellPadding: { top: 4, right: 3.5, bottom: 4, left: 3.5 },
      lineColor: [226, 232, 240],
      lineWidth: { bottom: 0.15 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15, textColor: [100, 116, 139] },
      1: { cellWidth: 48, fontStyle: 'bold' },
      3: { halign: 'right', cellWidth: 36, fontStyle: 'bold' },
    },
    margin: { left: 16, right: 16, top: 54, bottom: 28 },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) header(doc, 'FACTURA COMERCIAL', folio);
    },
  });

  let finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 130;
  if (finalY > 222) {
    doc.addPage();
    header(doc, 'FACTURA COMERCIAL', folio);
    finalY = 56;
  }
  const totalsX = 126;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(totalsX - 5, finalY + 7, 73, 43, 3, 3, 'F');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal', totalsX, finalY + 17);
  doc.text(money.format(subtotal), 189, finalY + 17, { align: 'right' });
  doc.text('IVA (16%)', totalsX, finalY + 25);
  doc.text(money.format(tax), 189, finalY + 25, { align: 'right' });
  doc.setDrawColor(203, 213, 225);
  doc.line(totalsX, finalY + 30, 189, finalY + 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(30, 64, 175);
  doc.text('TOTAL', totalsX, finalY + 42);
  doc.text(money.format(total), 189, finalY + 42, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(16, finalY + 7, 96, 27, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('INFORMACIÓN IMPORTANTE', 21, finalY + 16);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const note = doc.splitTextToSize(
    'Los importes corresponden al valor de los servicios antes de IVA. Este documento resume los conceptos solicitados para el proyecto.',
    86,
  );
  doc.text(note, 21, finalY + 22);

  footer(doc, 'Documento comercial informativo. No es CFDI, no está timbrado y no sustituye una factura fiscal del SAT.');
  return doc;
}

export function generateArchitecturalInvoice(project: ArchitecturalProject, charges: ArchitecturalCharge[]) {
  const doc = buildArchitecturalInvoice(project, charges);
  const folio = `FAC-${project.id.slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-5)}`;
  doc.save(`${folio}_${fileName(project.projectName)}.pdf`);
}
