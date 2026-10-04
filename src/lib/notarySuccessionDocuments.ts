import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import jsPDF from 'jspdf';
import type { NotarySuccession, SuccessionSearch } from '../types/notaryProcess';

const dateText = (value: string) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '________________';
const personName = (person: NotarySuccession['people'][number]) => [person.client.nombres, person.client.apellidoPaterno, person.client.apellidoMaterno].filter(Boolean).join(' ');
const save = (blob: Blob, name: string) => { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); };
const paragraph = (text: string, bold = false) => new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 180, line: 330 }, children: [new TextRun({ text, bold, font: 'Times New Roman', size: 24 })] });

export async function downloadRadicationDraft(item: NotarySuccession) {
  const heirs = item.people.filter((person) => person.role === 'heredero'); const executor = item.people.find((person) => person.role === 'albacea');
  const heirNames = heirs.map(personName).join(', ') || '________________'; const executorName = executor ? personName(executor) : '________________';
  const generalText = item.people.filter((person) => ['heredero', 'albacea', 'solicitante'].includes(person.role)).map((person) => `${personName(person)}, originario(a) de ${person.client.birthPlace || '________'}, donde nació el ${dateText(person.client.birthDate || '')}, de nacionalidad ${person.client.nationality || '________'}, estado civil ${person.client.maritalStatus || '________'}, ocupación ${person.client.occupation || '________'}, con domicilio en ${person.client.domicilio || '________'}, RFC ${person.client.rfc || '________'} y CURP ${person.client.curp}.`).join(' ');
  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children: [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'PROYECTO DE RADICACIÓN DE SUCESIÓN TESTAMENTARIA', bold: true, font: 'Times New Roman', size: 28 })], spacing: { after: 300 } }),
    paragraph(`En la ciudad de La Paz, Baja California Sur, a ${dateText(new Date().toISOString().slice(0, 10))}. Yo, Licenciado ALEJANDRO DAVIS MONZÓN, Notario Público Número DOS, hago constar la aceptación de herencia, del cargo de albacea y la radicación de la sucesión testamentaria a bienes de ${item.deceased.name}, que formalizan ${heirNames}.`),
    new Paragraph({ text: 'ANTECEDENTES', heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
    paragraph(`I. TESTAMENTO. En instrumento número ${item.will.instrument}, volumen ${item.will.volume}, de fecha ${dateText(item.will.date)}, del protocolo a cargo de ${item.will.notary}, Notario Público número ${item.will.notaryNumber}, con ejercicio en ${item.will.place}, se consignó el testamento público abierto otorgado por ${item.deceased.name}. Disposición principal: ${item.will.mainDisposition || '________________'}.`),
    paragraph(`II. FALLECIMIENTO. ${item.deceased.name} falleció en ${item.deceased.deathPlace}, el ${dateText(item.deceased.deathDate)}, según consta en ${item.deceased.deathCertificate || 'el acta de defunción exhibida'}.`),
    paragraph(searchAntecedent(item, 'registro_publico', 'III. INFORME DEL REGISTRO PÚBLICO.')),
    paragraph(searchAntecedent(item, 'archivo_notarias', 'IV. INFORME DEL ARCHIVO GENERAL DE NOTARÍAS.')),
    new Paragraph({ text: 'CLÁUSULAS', heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
    paragraph(`PRIMERA. ${heirNames}, en su carácter de heredero(s), manifiesta(n) que no impugna(n) el testamento, acepta(n) la herencia en los términos consignados y declara(n) que no existe controversia.`),
    paragraph(`SEGUNDA. ${executorName} manifiesta que acepta expresamente el cargo de albacea conferido.`),
    paragraph('TERCERA. La persona albacea manifiesta que oportunamente formulará inventarios, solicitará los avalúos correspondientes y atenderá las publicaciones previstas por la legislación aplicable.'),
    new Paragraph({ text: 'GENERALES', heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }), paragraph(generalText || '________________'),
    paragraph('YO, EL NOTARIO, CERTIFICO: que las personas comparecientes cuentan, a mi juicio, con capacidad legal para este acto; que el instrumento fue leído y explicado en cuanto a su valor y fuerza legal; y que, conformes con su contenido, lo ratifican y firman. DOY FE.'),
    new Paragraph({ spacing: { before: 500 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'DOCUMENTO DE TRABAJO SUJETO A REVISIÓN Y AUTORIZACIÓN DEL NOTARIO', bold: true, font: 'Times New Roman', size: 20 })] }),
  ] }] });
  save(await Packer.toBlob(doc), `proyecto-radicacion-${item.case.folio}.docx`);
}

const searchAntecedent = (item: NotarySuccession, authority: SuccessionSearch['authority'], title: string) => { const search = item.searches.find((value) => value.authority === authority); return `${title} Con fecha ${dateText(search?.requestDate || '')} se solicitó el informe correspondiente. Mediante oficio ${search?.responseFolio || '________'}, de fecha ${dateText(search?.responseDate || '')}, la autoridad informó: ${search?.result || '________________'}.`; };

export function downloadSuccessionSearchRequest(item: NotarySuccession, authority: SuccessionSearch['authority']) {
  const isRegistry = authority === 'registro_publico'; const title = isRegistry ? 'DIRECCIÓN DEL REGISTRO PÚBLICO DE LA PROPIEDAD Y DEL COMERCIO' : 'DIRECCIÓN DEL ARCHIVO GENERAL DE NOTARÍAS';
  const pdf = new jsPDF(); pdf.setFont('times', 'bold'); pdf.setFontSize(13); pdf.text('NOTARÍA PÚBLICA NÚMERO DOS', 105, 22, { align: 'center' }); pdf.setFontSize(10); pdf.text(title, 20, 48); pdf.text('P R E S E N T E', 20, 56); pdf.setFont('times', 'normal'); pdf.setFontSize(11);
  const body = `Por medio del presente solicito atentamente se informe a esta Notaría si existe disposición o memoria testamentaria otorgada por ${item.deceased.name}, CURP ${item.deceased.curp || 'NO PROPORCIONADA'}, quien falleció el ${dateText(item.deceased.deathDate)} en ${item.deceased.deathPlace}. ${item.route === 'testamentaria' ? `La búsqueda deberá considerar disposiciones posteriores al testamento de fecha ${dateText(item.will.date)}, instrumento ${item.will.instrument}, volumen ${item.will.volume}.` : 'La búsqueda se solicita para determinar si existe disposición testamentaria registrada.'}`;
  const lines = pdf.splitTextToSize(body, 170); pdf.text(lines, 20, 75, { align: 'justify', maxWidth: 170, lineHeightFactor: 1.55 }); const y = 75 + lines.length * 7 + 22; pdf.text('ATENTAMENTE', 105, y, { align: 'center' }); pdf.setFont('times', 'bold'); pdf.text('LIC. ALEJANDRO DAVIS MONZÓN', 105, y + 22, { align: 'center' }); pdf.setFont('times', 'normal'); pdf.text('NOTARIO PÚBLICO NÚMERO DOS', 105, y + 30, { align: 'center' }); pdf.save(`oficio-${authority}-${item.case.folio}.pdf`);
}
