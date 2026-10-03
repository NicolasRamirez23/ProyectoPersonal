import { AlignmentType, Document, Footer, Header, Packer, Paragraph, TextRun } from 'docx';
import { jsPDF } from 'jspdf';
import type { NotarySearchOfficeData } from '../types/notary';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const formatDate = (value: string) => {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  return `${day} de ${MONTHS[month - 1]} de ${year}`;
};
const safeFile = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
export const downloadBlob = (blob: Blob, name: string) => { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url); };

const grammar = (data: NotarySearchOfficeData) => ({
  greet: data.authorityGender === 'F' ? 'saludarla' : 'saludarlo',
  mentioned: data.deceasedGender === 'F' ? 'mencionada señora' : 'mencionado señor',
  testator: data.deceasedGender === 'F' ? 'la testadora' : 'el testador',
  nationality: data.deceasedGender === 'F' ? data.nationality.replace(/o$/i, 'a') : data.nationality,
  child: data.deceasedGender === 'F' ? 'hija' : 'hijo',
  origin: data.deceasedGender === 'F' ? 'originaria' : 'originario',
});

export function buildNotarySearchOfficeText(data: NotarySearchOfficeData) {
  const words = grammar(data);
  const address = [
    `calle ${data.street} número ${data.exteriorNumber}`,
    data.interiorNumber ? `interior ${data.interiorNumber}` : '',
    data.neighborhood ? `colonia ${data.neighborhood}` : '',
    data.postalCode ? `código postal ${data.postalCode}` : '',
    `${data.city}, ${data.state}`,
  ].filter(Boolean).join(', ');
  const parentsStatus = data.fatherDeceased && data.motherDeceased
    ? 'ambos ya finados'
    : `${data.fatherDeceased ? 'su padre ya finado' : 'su padre vive'} y ${data.motherDeceased ? 'su madre ya finada' : 'su madre vive'}`;
  return `Me es grato ${words.greet} e informarle que en instrumento número ${data.radicationInstrument}, del volumen número ${data.radicationVolume}, del protocolo a mi cargo, con fecha ${formatDate(data.radicationDate)}, se radicó el Juicio Sucesorio Testamentario a bienes de ${data.deceasedName}, con fundamento en el Testamento Público Abierto otorgado en instrumento número ${data.willInstrument}, del volumen ${data.willVolume}, ante la fe del Lic. ${data.willNotaryName}, Notario Público número ${data.willNotaryNumber}, con ejercicio en ${data.willPlace}, de fecha ${formatDate(data.willDate)}. Por lo que, con fundamento en ${data.legalBasis}, ruego a usted nos informe si ${words.mentioned} elaboró alguna disposición testamentaria posterior a la que sirvió de base para la radicación de su sucesión, en el entendido de que ${words.testator} era ${words.nationality} por nacimiento, ${words.child} de padres de la misma nacionalidad, ${words.origin} de ${data.birthCity}, ${data.birthState}, donde nació el ${formatDate(data.birthDate)}, de estado civil ${data.maritalStatus}${data.occupation ? `, de ocupación ${data.occupation}` : ''}, con domicilio en ${address}, con Clave Única del Registro de Población ${data.curp}, Registro Federal de Contribuyentes ${data.rfc}, y se identificó con credencial para votar expedida por el Instituto Nacional Electoral con folio ${data.ineFolio}. Sus padres fueron ${data.fatherName} y ${data.motherName}, ${parentsStatus}.`;
}

export async function createNotarySearchOfficeDocx(data: NotarySearchOfficeData) {
  const body = buildNotarySearchOfficeText(data);
  const documentFile = new Document({
    styles: { default: { document: { run: { font: 'Times New Roman', size: 24 }, paragraph: { spacing: { line: 360, after: 0 } } } } },
    sections: [{
      properties: { page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
      headers: { default: new Header({ children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'NOTARÍA PÚBLICA No. 2', bold: true, size: 22 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '16 de Septiembre No. 1685 y Chiapas · Tel. 612 122 07 34 y 612 122 35 20', size: 18 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'La Paz, Baja California Sur', size: 18 })] }),
      ] }) },
      footers: { default: new Footer({ children: [] }) },
      children: [
        new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 300, after: 360 }, children: [new TextRun(`${data.place}, a ${formatDate(data.issueDate)}`)] }),
        new Paragraph({ children: [new TextRun({ text: data.authorityName.toUpperCase(), bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: data.authorityTitle.toUpperCase(), bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: data.authorityDepartment.toUpperCase(), bold: true })] }),
        new Paragraph({ spacing: { after: 300 }, children: [new TextRun({ text: 'P R E S E N T E:', bold: true })] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 360 }, children: [new TextRun({ text: `Asunto: Se solicita informe sobre testamento de ${data.deceasedName}.`, bold: true })] }),
        new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 720 }, spacing: { after: 300 }, children: [new TextRun(body)] }),
        new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 720 }, spacing: { after: 600 }, children: [new TextRun('Todo lo anterior para los efectos de la tramitación de su sucesión.')] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 900 }, children: [new TextRun('A T E N T A M E N T E,')] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.signerName.toUpperCase(), bold: true })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.signerTitle.toUpperCase(), bold: true })] }),
      ],
    }],
  });
  return Packer.toBlob(documentFile);
}

export function createNotarySearchOfficePdf(data: NotarySearchOfficeData) {
  const pdf = new jsPDF({ unit: 'mm', format: 'letter' });
  pdf.setFont('times', 'bold'); pdf.setFontSize(12); pdf.text('NOTARÍA PÚBLICA No. 2', 108, 15, { align: 'center' });
  pdf.setFont('times', 'normal'); pdf.setFontSize(9); pdf.text('16 de Septiembre No. 1685 y Chiapas · Tel. 612 122 07 34 y 612 122 35 20', 108, 20, { align: 'center' }); pdf.text('La Paz, Baja California Sur', 108, 24, { align: 'center' });
  pdf.setFontSize(11); pdf.text(`${data.place}, a ${formatDate(data.issueDate)}`, 195, 37, { align: 'right' });
  pdf.setFont('times', 'bold'); pdf.text([data.authorityName.toUpperCase(), data.authorityTitle.toUpperCase(), data.authorityDepartment.toUpperCase(), 'P R E S E N T E:'], 20, 52);
  pdf.text(`Asunto: Se solicita informe sobre testamento de ${data.deceasedName}.`, 195, 79, { align: 'right', maxWidth: 95 });
  pdf.setFont('times', 'normal'); const lines = pdf.splitTextToSize(buildNotarySearchOfficeText(data), 175); pdf.text(lines, 20, 96, { align: 'justify', maxWidth: 175, lineHeightFactor: 1.55 });
  const closingY = Math.min(225, 96 + lines.length * 6.1 + 10); pdf.text('Todo lo anterior para los efectos de la tramitación de su sucesión.', 20, closingY, { maxWidth: 175, align: 'justify' });
  pdf.text('A T E N T A M E N T E,', 108, closingY + 18, { align: 'center' });
  pdf.setFont('times', 'bold'); pdf.text(data.signerName.toUpperCase(), 108, closingY + 38, { align: 'center' }); pdf.text(data.signerTitle.toUpperCase(), 108, closingY + 44, { align: 'center' });
  return pdf.output('blob');
}

export async function downloadNotarySearchOfficeDocx(data: NotarySearchOfficeData) { downloadBlob(await createNotarySearchOfficeDocx(data), `oficio-busqueda-${safeFile(data.deceasedName)}.docx`); }
export function downloadNotarySearchOfficePdf(data: NotarySearchOfficeData) { downloadBlob(createNotarySearchOfficePdf(data), `oficio-busqueda-${safeFile(data.deceasedName)}.pdf`); }
