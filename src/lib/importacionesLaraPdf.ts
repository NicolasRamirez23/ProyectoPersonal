import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { LaraReceipt } from '../types/importacionesLara';

const money = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);

async function loadCroppedLogo() {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('No se pudo cargar el logotipo de Importaciones Lara.'));
    element.src = '/importaciones-lara/logo.png';
  });
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 640;
  const sourceSize = Math.min(image.naturalWidth, 640);
  const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2);
  const sourceY = Math.max(0, Math.min(image.naturalHeight - sourceSize, 450));
  canvas.getContext('2d')?.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 640, 640);
  return fetch(canvas.toDataURL('image/png')).then((response) => response.arrayBuffer());
}

export async function generateImportacionesLaraPdf(receipt: LaraReceipt) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(await loadCroppedLogo());
  const black = rgb(0.025, 0.035, 0.055);
  const gold = rgb(0.91, 0.57, 0.2);
  const blue = rgb(0.02, 0.44, 0.7);
  const gray = rgb(0.38, 0.42, 0.48);

  const navy = rgb(0.04, 0.09, 0.17);
  page.drawRectangle({ x: 32, y: 622, width: 548, height: 138, color: rgb(1, 1, 1), borderColor: rgb(0.88, 0.9, 0.93), borderWidth: 1 });
  page.drawRectangle({ x: 32, y: 754, width: 548, height: 6, color: gold });
  page.drawImage(logo, { x: 48, y: 637, width: 108, height: 108 });
  page.drawText('IMPORTACIONES LARA', { x: 180, y: 716, size: 23, font: bold, color: navy });
  page.drawText('IMPORTACIONES Y ELECTRONICA', { x: 180, y: 691, size: 11, font: bold, color: gold });
  page.drawText('Electronica - Gadgets - Smartphones - Ropa', { x: 180, y: 671, size: 9.3, font: regular, color: gray });
  page.drawText('Raul Garcia Lara', { x: 180, y: 649, size: 9.5, font: bold, color: navy });
  page.drawText('Heroes de Independencia entre Colima y Pirul, Col. Arboledas', { x: 180, y: 634, size: 8.1, font: regular, color: gray });
  page.drawText('La Paz, B.C.S.  |  Tel. 612 219 3808', { x: 387, y: 649, size: 8.5, font: regular, color: gray });

  page.drawText('RECIBO COMERCIAL', { x: 40, y: 582, size: 20, font: bold, color: navy });
  page.drawText('NO SUSTITUYE CFDI', { x: 40, y: 564, size: 8.5, font: bold, color: blue });
  page.drawText(`FOLIO  ${receipt.folio}`, { x: 424, y: 580, size: 11, font: bold, color: navy });
  page.drawText(`FECHA  ${new Date(receipt.createdAt || Date.now()).toLocaleDateString('es-MX')}`, { x: 424, y: 560, size: 8.5, font: regular, color: gray });
  page.drawLine({ start: { x: 32, y: 544 }, end: { x: 580, y: 544 }, thickness: 1, color: rgb(0.86, 0.88, 0.91) });
  page.drawText(`METODO DE PAGO`, { x: 40, y: 517, size: 7.5, font: bold, color: gray });
  page.drawText(receipt.metodoPago, { x: 40, y: 499, size: 11, font: bold, color: navy });
  const statusColor = receipt.estadoPago === 'TERMINADO' ? rgb(0.02, 0.55, 0.3) : rgb(0.9, 0.5, 0.05);
  page.drawRectangle({ x: 438, y: 497, width: 134, height: 25, color: statusColor });
  page.drawText(receipt.estadoPago, { x: receipt.estadoPago === 'TERMINADO' ? 477 : 468, y: 506, size: 9, font: bold, color: rgb(1, 1, 1) });

  const headers = [['CONCEPTO / DESCRIPCION', 40], ['CANT.', 365], ['P. UNITARIO', 420], ['IMPORTE', 500]] as const;
  page.drawRectangle({ x: 32, y: 462, width: 548, height: 28, color: black });
  headers.forEach(([label, x]) => page.drawText(label, { x, y: 472, size: 8, font: bold, color: rgb(1, 1, 1) }));
  let y = 436;
  receipt.conceptos.forEach((item, index) => {
    if (index % 2 === 0) page.drawRectangle({ x: 32, y: y - 8, width: 548, height: 30, color: rgb(0.96, 0.97, 0.98) });
    let description = item.descripcion;
    while (description.length > 1 && regular.widthOfTextAtSize(description, 8.5) > 305) description = `${description.slice(0, -2)}...`;
    page.drawText(description, { x: 40, y, size: 8.5, font: regular, color: black });
    page.drawText(String(item.cantidad), { x: 375, y, size: 8.5, font: regular, color: black });
    page.drawText(money(item.precioUnitario), { x: 420, y, size: 8.5, font: regular, color: black });
    page.drawText(money(item.importe), { x: 500, y, size: 8.5, font: bold, color: black });
    y -= 30;
  });
  page.drawLine({ start: { x: 350, y: y - 4 }, end: { x: 572, y: y - 4 }, thickness: 1, color: rgb(0.75, 0.78, 0.82) });
  page.drawText('TOTAL', { x: 420, y: y - 27, size: 12, font: bold, color: black });
  page.drawText(money(receipt.total), { x: 496, y: y - 27, size: 12, font: bold, color: blue });
  page.drawText('Gracias por su compra.', { x: 230, y: 64, size: 11, font: bold, color: gray });
  page.drawText('Este recibo es un comprobante comercial y no sustituye un CFDI.', { x: 167, y: 44, size: 8, font: regular, color: gray });

  const blob = new Blob([await pdf.save()], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `recibo-lara-${receipt.folio.replace(/[^a-zA-Z0-9-]/g, '-')}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
