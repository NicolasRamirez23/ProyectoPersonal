import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx';
import jsPDF from 'jspdf';
import type { NotarySuccession, SuccessionSearch } from '../types/notaryProcess';
import { formatRelatedPeople, numberToSpanishWords } from './notaryDocuments';

const dateText = (value: string) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '________________';
const personName = (person: NotarySuccession['people'][number]) => [person.client.nombres, person.client.apellidoPaterno, person.client.apellidoMaterno].filter(Boolean).join(' ');
const save = (blob: Blob, name: string) => { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); };
const paragraph = (text: string, options: { bold?: boolean; center?: boolean; firstLine?: boolean; before?: number; after?: number } = {}) => new Paragraph({
  alignment: options.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
  indent: options.firstLine === false || options.center ? undefined : { firstLine: 720 },
  spacing: { before: options.before, after: options.after ?? 0, line: 360 },
  children: [new TextRun({ text, bold: options.bold, font: 'Microsoft Sans Serif', size: 24 })],
});

export async function createRadicationDraft(item: NotarySuccession) {
  const heirs = item.people.filter((person) => person.role === 'heredero'); const executor = item.people.find((person) => person.role === 'albacea');
  const heirNames = formatRelatedPeople(heirs.map(personName)) || '________________'; const executorName = executor ? personName(executor) : '________________';
  const heirsPlural = heirs.length !== 1;
  const generalText = item.people.filter((person) => ['heredero', 'albacea', 'solicitante'].includes(person.role)).map((person) => `${personName(person)}, originario(a) de ${person.client.birthPlace || '________'}, donde nació el ${dateText(person.client.birthDate || '')}, de nacionalidad ${person.client.nationality || '________'}, estado civil ${person.client.maritalStatus || '________'}, ocupación ${person.client.occupation || '________'}, con domicilio en ${person.client.domicilio || '________'}, RFC ${person.client.rfc || '________'} y CURP ${person.client.curp}.`).join(' ');
  const instrumentWords = numberToSpanishWords(item.will.instrument); const volumeWords = numberToSpanishWords(item.will.volume);
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Microsoft Sans Serif', size: 24 }, paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { line: 360, after: 0 } } } } },
    sections: [{ properties: { page: { size: { width: 12240, height: 20160 }, margin: { top: 567, right: 1397, bottom: 677, left: 2041 } } }, children: [
      paragraph(`VOLUMEN NÚMERO ${item.will.volume}${volumeWords ? ` (${volumeWords})` : ''}`, { firstLine: false, before: 2687 }),
      paragraph(`ESCRITURA ${item.will.instrument}${instrumentWords ? ` (${instrumentWords})` : ''}`, { firstLine: false }),
      paragraph(`En la ciudad de La Paz, Capital del Estado de Baja California Sur, Estados Unidos Mexicanos, a ${dateText(new Date().toISOString().slice(0, 10))}. Yo, el Licenciado ALEJANDRO DAVIS MONZÓN, Notario Público Número DOS, en esta Entidad Federativa, en ejercicio en esta Jurisdicción, por el presente instrumento hago constar: LA ACEPTACIÓN DE HERENCIA, DEL CARGO DE ALBACEA Y LA RADICACIÓN DE LA SUCESIÓN TESTAMENTARIA a bienes de ${item.deceased.name}, que formaliza ${executorName}, con la comparecencia de ${heirNames}, al tenor de los antecedentes y cláusulas que siguen:`),
      paragraph('A N T E C E D E N T E S:', { center: true }),
      paragraph(`I.- TESTAMENTO: En escritura número ${item.will.instrument}${instrumentWords ? ` (${instrumentWords})` : ''}, del volumen ${item.will.volume}${volumeWords ? ` (${volumeWords})` : ''}, de fecha ${dateText(item.will.date)}, del protocolo a cargo de ${item.will.notary}, Notario Público número ${item.will.notaryNumber}, con ejercicio en ${item.will.place}, se consignó el testamento que bajo la forma de público abierto otorgó ${item.deceased.name} y que en su parte dispositiva dice: “PRIMERA.- ${item.will.mainDisposition || '________________'}”.`),
      paragraph(`II.- FALLECIMIENTO: ${item.deceased.name} falleció en ${item.deceased.deathPlace}, el ${dateText(item.deceased.deathDate)}, según consta del certificado del acta de su defunción que se me exhibe: ${item.deceased.deathCertificate || '________________'}.`),
      paragraph(searchAntecedent(item, 'registro_publico', 'III.- INFORME DEL REGISTRO PÚBLICO.-')),
      paragraph(searchAntecedent(item, 'archivo_notarias', 'IV.- INFORME DEL ARCHIVO GENERAL DE NOTARÍAS.-')),
      paragraph('V.- Expuesto lo anterior son de otorgarse las siguientes:'),
      paragraph('C L Á U S U L A S:', { center: true }),
      paragraph(`PRIMERA.- Aceptación de la Herencia: ${heirNames}, instituido${heirsPlural ? 's' : ''} como único${heirsPlural ? 's' : ''} y universal${heirsPlural ? 'es' : ''} heredero${heirsPlural ? 's' : ''} por ${item.deceased.name}, declara${heirsPlural ? 'n' : ''} y formaliza${heirsPlural ? 'n' : ''} por el presente instrumento:`),
      paragraph(`1.- Que no impugna${heirsPlural ? 'n' : ''} en forma alguna y sí, en cambio, acepta${heirsPlural ? 'n' : ''} en todas y cada una de sus partes el testamento público abierto otorgado a su favor;`),
      paragraph(`2.- Que acepta${heirsPlural ? 'n' : ''} la herencia en los términos consignados en el testamento;`),
      paragraph('3.- Que en este asunto no hay controversias.'),
      paragraph('4.- Que en virtud de que se cumplen los requisitos señalados en el artículo 853 (ochocientos cincuenta y tres) del Código de Procedimientos Civiles en vigor, procede esta tramitación notarial de la sucesión y se deja radicada ante el suscrito notario.'),
      paragraph(`SEGUNDA.- ${executorName} manifiesta que acepta expresamente el cargo de albacea que le fue otorgado en el testamento.`),
      paragraph(`TERCERA.- ${executorName} manifiesta que, en su oportunidad, protocolizará los inventarios y solicitará los avalúos del bien o los bienes que resultaren a la sucesión, pidiendo del suscrito notario haga las publicaciones a que se refiere el párrafo segundo del artículo ochocientos cincuenta y cuatro del Código de Procedimientos Civiles en vigor.`),
      paragraph(`GENERALES: Las personas comparecientes manifiestan bajo protesta de conducirse con verdad: ${generalText || '________________'}`),
      paragraph('YO, EL NOTARIO CERTIFICO: Que conozco personalmente a las personas comparecientes, quienes a mi juicio tienen capacidad legal para celebrar este acto; que leído que les fue el presente instrumento y explicándoseles en cuanto a su valor y fuerza legal, se mostraron conformes con el mismo, lo ratificaron en todas sus partes y firmaron ante mi presencia para constancia el día de su fecha en que se autoriza desde luego. DOY FE.'),
      paragraph(`AL CALCE: Firmado - ${executorName}; ${heirs.map((person) => `Firmado - ${personName(person)}`).join('; ')}; Ante mí: Firma y Sello del Suscrito Notario.`),
      paragraph('EL SUSCRITO NOTARIO, HACE CONSTAR Y CERTIFICA QUE:'),
      paragraph(searchCertification(item, 'registro_publico', item.deceased.name)),
      paragraph(searchCertification(item, 'archivo_notarias', item.deceased.name)),
      paragraph('Con fechas __________ y __________, Tomo __________, en los Boletines Oficiales correspondientes del Gobierno del Estado, se hacen las publicaciones a que se refiere el párrafo segundo del artículo ochocientos cincuenta y cuatro del Código de Procedimientos Civiles en vigor.'),
      paragraph(`ES PRIMER TESTIMONIO QUE SE EXPIDE DE SU ORIGINAL, VA EN ______ FOJAS ÚTILES, ESCRITAS A TINTA FIJA, DEBIDAMENTE COTEJADAS, CORREGIDAS, SELLADAS Y RUBRICADAS. PARA USO DE ${executorName} Y ${heirNames.toUpperCase()}, EN COMPROBACIÓN DE LA ACEPTACIÓN DEL TESTAMENTO, DE LA HERENCIA, DEL CARGO DE ALBACEA Y RADICACIÓN DE LA SUCESIÓN EFECTUADA. EN LA CIUDAD DE LA PAZ, CAPITAL DEL ESTADO DE BAJA CALIFORNIA SUR. A LOS ______ DÍAS DEL MES DE ______ DEL AÑO DOS MIL ______. DOY FE.`),
    ] }],
  });
  return Packer.toBlob(doc);
}

export async function downloadRadicationDraft(item: NotarySuccession) {
  save(await createRadicationDraft(item), `proyecto-radicacion-${item.case.folio}.docx`);
}

const searchAntecedent = (item: NotarySuccession, authority: SuccessionSearch['authority'], title: string) => { const search = item.searches.find((value) => value.authority === authority); return `${title} Con fecha ${dateText(search?.requestDate || '')} se solicitó el informe correspondiente. Mediante oficio ${search?.responseFolio || '________'}, de fecha ${dateText(search?.responseDate || '')}, la autoridad informó: ${search?.result || '________________'}.`; };
const searchCertification = (item: NotarySuccession, authority: SuccessionSearch['authority'], deceasedName: string) => { const search = item.searches.find((value) => value.authority === authority); const office = authority === 'registro_publico' ? 'Registro Público de la Propiedad y del Comercio' : 'Dirección del Archivo General de Notarías'; return `Mediante Oficio ${search?.responseFolio || '________'}, de fecha ${dateText(search?.responseDate || '')}, se recibe respuesta de la búsqueda solicitada ante ${office}, en el sentido de que ${search?.result || `no se encontró registro posterior de memoria testamentaria a nombre de ${deceasedName}`}.`; };

export function downloadSuccessionSearchRequest(item: NotarySuccession, authority: SuccessionSearch['authority']) {
  const isRegistry = authority === 'registro_publico'; const title = isRegistry ? 'DIRECCIÓN DEL REGISTRO PÚBLICO DE LA PROPIEDAD Y DEL COMERCIO' : 'DIRECCIÓN DEL ARCHIVO GENERAL DE NOTARÍAS';
  const pdf = new jsPDF(); pdf.setFont('times', 'bold'); pdf.setFontSize(13); pdf.text('NOTARÍA PÚBLICA NÚMERO DOS', 105, 22, { align: 'center' }); pdf.setFontSize(10); pdf.text(title, 20, 48); pdf.text('P R E S E N T E', 20, 56); pdf.setFont('times', 'normal'); pdf.setFontSize(11);
  const body = `Por medio del presente solicito atentamente se informe a esta Notaría si existe disposición o memoria testamentaria otorgada por ${item.deceased.name}, CURP ${item.deceased.curp || 'NO PROPORCIONADA'}, quien falleció el ${dateText(item.deceased.deathDate)} en ${item.deceased.deathPlace}. ${item.route === 'testamentaria' ? `La búsqueda deberá considerar disposiciones posteriores al testamento de fecha ${dateText(item.will.date)}, instrumento ${item.will.instrument}, volumen ${item.will.volume}.` : 'La búsqueda se solicita para determinar si existe disposición testamentaria registrada.'}`;
  const lines = pdf.splitTextToSize(body, 170); pdf.text(lines, 20, 75, { align: 'justify', maxWidth: 170, lineHeightFactor: 1.55 }); const y = 75 + lines.length * 7 + 22; pdf.text('ATENTAMENTE', 105, y, { align: 'center' }); pdf.setFont('times', 'bold'); pdf.text('LIC. ALEJANDRO DAVIS MONZÓN', 105, y + 22, { align: 'center' }); pdf.setFont('times', 'normal'); pdf.text('NOTARIO PÚBLICO NÚMERO DOS', 105, y + 30, { align: 'center' }); pdf.save(`oficio-${authority}-${item.case.folio}.pdf`);
}
