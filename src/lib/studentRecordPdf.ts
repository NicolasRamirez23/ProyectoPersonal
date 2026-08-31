import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { StudentRecordData, PersonDetails, ContactDetails } from '../types/studentRecord';

const topY = (top: number, height = 0) => 792 - top - height;

async function cropPhoto(source: string, adjustment: { x: number; y: number; zoom: number }) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('No se pudo procesar la fotografía.'));
    element.src = source;
  });
  const canvas = document.createElement('canvas');
  canvas.width = 448;
  canvas.height = 436;
  const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight) * adjustment.zoom;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const x = -(width - canvas.width) * (adjustment.x / 100);
  const y = -(height - canvas.height) * (adjustment.y / 100);
  canvas.getContext('2d')?.drawImage(image, x, y, width, height);
  return fetch(canvas.toDataURL('image/jpeg', 0.9)).then((response) => response.arrayBuffer());
}

export async function generateStudentRecordPdf(record: StudentRecordData) {
  const templatePath = record.genero === 'alumno' ? '/templates/ficha-alumno.png' : '/templates/ficha-alumna.png';
  const template = await fetch(templatePath).then((response) => {
    if (!response.ok) throw new Error('No se pudo cargar la plantilla de la ficha.');
    return response.arrayBuffer();
  });
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const background = await pdf.embedPng(template);
  page.drawImage(background, { x: 0, y: 0, width: 612, height: 792 });
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const yellow = rgb(1, 0.98, 0.72);
  const pink = rgb(0.99, 0.91, 0.94);
  const green = rgb(0.91, 0.97, 0.94);

  const text = (value: string | undefined, x: number, top: number, width: number, size = 7.5) => {
    const raw = (value || '').toUpperCase();
    let current = size;
    while (current > 4.5 && bold.widthOfTextAtSize(raw, current) > width) current -= 0.25;
    const measured = bold.widthOfTextAtSize(raw, current);
    page.drawText(raw, { x: x + Math.max(2, (width - measured) / 2), y: 792 - top - current, size: current, font: bold, color: rgb(0.03, 0.03, 0.03) });
  };
  const fill = (value: string | undefined, x: number, top: number, width: number, height: number, _color: ReturnType<typeof rgb>, size = 7.5) => {
    text(value, x, top + (height - size) / 2 - 1, width, size);
  };
  const dateParts = (value: string) => {
    const parts = (value || '').split('-');
    return parts[0]?.length === 4 ? { day: parts[2], month: parts[1], year: parts[0] } : { day: parts[0], month: parts[1], year: parts[2] };
  };
  const formatDate = (value: string) => { const date = dateParts(value); return value ? `${date.day}/${date.month}/${date.year}` : ''; };
  const studentBirthDate = dateParts(record.fechaNacimiento);

  // The clean template contains the frame; the cropped photograph only replaces its illustration.
  if (record.foto) {
    const adjustment = record.fotoAjuste || { x: 50, y: 35, zoom: 1 };
    const image = await pdf.embedJpg(await cropPhoto(record.foto, adjustment));
    page.drawImage(image, { x: 62, y: topY(50, 109), width: 112, height: 109 });
  }

  fill(record.nombre, 306, 148, 253, 27, yellow, 10);
  fill(record.gradoGrupo, 277, 180, 111, 20, yellow, 8.5);
  fill(record.maestra, 433, 180, 131, 22, yellow, 8.5);
  text(studentBirthDate.day, 188, 214, 18, 6.5);
  text(studentBirthDate.month, 230, 214, 18, 6.5);
  text(studentBirthDate.year, 268, 214, 32, 6.5);
  fill(record.lugarNacimiento, 433, 211, 131, 20, yellow, 8.5);
  fill(record.curp, 102, 239, 251, 24, yellow, 8.5);
  fill(record.edad, 403, 239, 123, 24, yellow, 9);
  fill(record.peso ? `${record.peso} KG` : '', 95, 272, 76, 23, yellow, 9);
  fill(record.estatura ? `${record.estatura} M` : '', 220, 272, 104, 23, yellow, 9);
  fill(record.alergias, 402, 272, 146, 23, yellow, 8.5);
  fill(record.calleNumero, 112, 298, 302, 20, yellow, 7.5);
  fill(record.codigoPostal, 481, 298, 69, 20, yellow, 8.5);
  fill(record.colonia, 105, 322, 200, 20, yellow, 8.5);
  fill(record.telefono, 375, 322, 174, 20, yellow, 8.5);

  const person = (p: PersonDetails, top: number, color: ReturnType<typeof rgb>) => {
    fill(p.nombre, 111, top, 449, 24, color, 9.5);
    fill(formatDate(p.fechaNacimiento), 145, top + 27, 155, 22, color, 8.2);
    fill(p.curp, 355, top + 27, 217, 22, color, 8.2);
    fill(p.escolaridad, 112, top + 54, 173, 22, color, 8.2);
    fill(p.ocupacion, 348, top + 54, 199, 22, color, 8.2);
    fill(p.lugarTrabajo, 113, top + 81, 153, 22, color, 8);
    fill(p.telefonoTrabajo, 337, top + 81, 187, 22, color, 8.2);
    fill(p.celular, 116, top + 108, 149, 22, color, 8.2);
    fill(p.estadoCivil, 337, top + 108, 188, 22, color, 8.2);
  };
  person(record.madre, 376, pink);
  person(record.padre, 533, green);

  const compact = (item: ContactDetails, x: number, top: number, width: number, includePhone: boolean) => {
    fill(item.nombre, x, top + 2, width, 14, rgb(1, 1, 1), 7.2);
    fill(item.parentesco, x, top + 17.5, width, 14, rgb(1, 1, 1), 7.2);
    if (includePhone) fill(item.telefono, x, top + 32, width, 14, rgb(1, 1, 1), 7.2);
  };
  compact(record.emergencias[0], 103, 673, 171, true);
  compact(record.emergencias[1], 103, 724, 171, true);
  compact(record.autorizados[0], 356, 673, 176, false);
  compact(record.autorizados[1], 356, 707, 176, false);

  const safeName = record.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  const blob = new Blob([await pdf.save()], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ficha-${safeName || 'estudiante'}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
