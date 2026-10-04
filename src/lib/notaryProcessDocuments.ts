import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { NotaryCase } from '../types/notaryProcess';
import { notaryProcessesApi } from '../services/notaryProcesses';

const money = (value: number) => value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const date = (value?: string) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Sin fecha';
const header = (pdf: jsPDF, title: string, folio: string) => { pdf.setTextColor(18, 47, 87); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16); pdf.text('NOTARÍA PÚBLICA No. 2', 20, 20); pdf.setFontSize(12); pdf.text(title, 20, 29); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(80); pdf.setFontSize(9); pdf.text(`Folio: ${folio}`, 190, 20, { align: 'right' }); pdf.text(`Fecha: ${new Date().toLocaleDateString('es-MX')}`, 190, 27, { align: 'right' }); pdf.setDrawColor(30, 90, 170); pdf.line(20, 34, 190, 34); };
const save = (pdf: jsPDF, fileName: string) => pdf.save(fileName);

export function downloadNotaryQuote(item: NotaryCase) {
  const pdf = new jsPDF(); header(pdf, 'COTIZACIÓN DE SERVICIOS NOTARIALES', item.folio);
  const totalStages = item.stages.reduce((sum, stage) => sum + stage.cost, 0); const subtotal = item.generalCost > 0 ? item.generalCost : totalStages; const total = Math.max(0, subtotal - item.discount);
  pdf.setTextColor(30); pdf.setFontSize(10); pdf.text(`Cliente: ${notaryProcessesApi.clientName(item.client)}`, 20, 44); pdf.text(`CURP: ${item.client.curp}`, 20, 51); pdf.text(`Operación: ${item.operationType}`, 20, 58); pdf.text(`Expediente: ${item.title}`, 20, 65);
  autoTable(pdf, { startY: 73, head: [['#', 'Concepto / proceso', 'Fecha límite', 'Importe']], body: item.stages.map((stage) => [stage.order, stage.concept, date(stage.deadline), money(stage.cost)]), foot: [['', '', 'Subtotal', money(subtotal)], ['', '', 'Descuento', money(item.discount)], ['', '', 'TOTAL', money(total)]], theme: 'grid', headStyles: { fillColor: [18, 47, 87] }, footStyles: { fillColor: [240, 244, 249], textColor: [18, 47, 87], fontStyle: 'bold' }, styles: { fontSize: 9 } });
  const finalY = (pdf as any).lastAutoTable.finalY + 12; pdf.setFontSize(8); pdf.setTextColor(90); pdf.text('Cotización informativa sujeta a revisión documental y a gastos, derechos e impuestos que correspondan. Vigencia: 15 días naturales.', 20, finalY, { maxWidth: 170 });
  save(pdf, `cotizacion-${item.folio}.pdf`);
}
export function downloadPaymentOrder(item: NotaryCase, order: { folio: string; concepto: string; monto: number; fecha_limite?: string }) {
  const pdf = new jsPDF(); header(pdf, 'ORDEN DE PAGO', order.folio); pdf.setTextColor(30); pdf.setFontSize(11);
  pdf.text(`Expediente: ${item.folio}`, 20, 48); pdf.text(`Cliente: ${notaryProcessesApi.clientName(item.client)}`, 20, 57); pdf.text(`Concepto: ${order.concepto}`, 20, 66, { maxWidth: 165 }); pdf.text(`Fecha límite: ${date(order.fecha_limite)}`, 20, 82);
  pdf.setFillColor(239, 246, 255); pdf.roundedRect(20, 94, 170, 32, 3, 3, 'F'); pdf.setTextColor(18, 47, 87); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.text('IMPORTE A PAGAR', 30, 107); pdf.setFontSize(20); pdf.text(money(order.monto), 180, 113, { align: 'right' });
  pdf.setFont('helvetica', 'normal'); pdf.setTextColor(90); pdf.setFontSize(8); pdf.text('Presente esta orden al realizar el pago. El comprobante deberá indicar el folio de la orden y del expediente.', 20, 142, { maxWidth: 170 }); save(pdf, `orden-pago-${order.folio}.pdf`);
}
