import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import JSZip from 'jszip';
import type { NotaryExtractedData } from '../types/notaryProcess';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
export interface LocalDocumentAnalysis { text: string; type: string; role: string; confidence: number; data: NotaryExtractedData; }
const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

async function renderPdfPage(page: any) {
  const viewport = page.getViewport({ scale: 1.8 });
  const canvas = window.document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo preparar la página para OCR.');
  await page.render({ canvasContext: context, viewport, canvas }).promise;
  return canvas;
}

async function pdfText(file: File, progress?: (message: string) => void) {
  const pdf = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 15); pageNumber += 1) {
    progress?.(`Leyendo texto de la página ${pageNumber}…`);
    const content = await (await pdf.getPage(pageNumber)).getTextContent();
    pages.push(content.items.map((item: any) => item.str || '').join(' '));
  }
  const directText = clean(pages.join('\n'));
  if (directText.length >= 80) return directText;
  const { createWorker } = await import('tesseract.js');
  progress?.('El PDF parece escaneado; preparando OCR local…');
  const worker = await createWorker('spa');
  try {
    const recognized: string[] = [];
    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 5); pageNumber += 1) {
      progress?.(`Aplicando OCR local a la página ${pageNumber}…`);
      const result = await worker.recognize(await renderPdfPage(await pdf.getPage(pageNumber)));
      recognized.push(result.data.text);
    }
    return clean(recognized.join('\n'));
  } finally { await worker.terminate(); }
}

async function docxText(file: File) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = await zip.file('word/document.xml')?.async('text');
  if (!xml) return '';
  const parsed = new DOMParser().parseFromString(xml, 'application/xml');
  return clean([...parsed.getElementsByTagNameNS('*', 't')].map((node) => node.textContent || '').join(' '));
}

async function ocrImage(file: File, progress?: (message: string) => void) {
  const { createWorker } = await import('tesseract.js');
  progress?.('Preparando OCR local…');
  const worker = await createWorker('spa');
  try {
    progress?.('Leyendo el documento dentro de este navegador…');
    const original = (await worker.recognize(file)).data.text;
    progress?.('Mejorando contraste para una segunda lectura…');
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(2.2, 2600 / Math.max(bitmap.width, bitmap.height));
    const canvas = window.document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) return original.trim();
    context.filter = 'grayscale(1) contrast(1.75)';
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const enhanced = (await worker.recognize(canvas)).data.text;
    const score = (value: string) => ['NOMBRE','DOMICILIO','CLAVE DE ELECTOR','CURP','FECHA DE NACIMIENTO','VIGENCIA'].filter((label) => normalized(value).includes(label)).length * 10 + (normalized(value).match(/\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/) ? 25 : 0);
    const best = score(enhanced) > score(original) ? enhanced : original;
    return best.split(/\r?\n/).map(clean).filter(Boolean).join('\n');
  } finally { await worker.terminate(); }
}

function classify(text: string, fileName: string) {
  const value = normalized(`${fileName} ${text}`);
  const rules: Array<[string, string[]]> = [
    ['INE', ['INSTITUTO NACIONAL ELECTORAL', 'CREDENCIAL PARA VOTAR', 'CLAVE DE ELECTOR']],
    ['CSF', ['CONSTANCIA DE SITUACION FISCAL', 'REGISTRO FEDERAL DE CONTRIBUYENTES', 'REGIMEN FISCAL']],
    ['CURP', ['CLAVE UNICA DE REGISTRO DE POBLACION', 'CURP']],
    ['Acta de defunción', ['ACTA DE DEFUNCION', 'DATOS DE LA DEFUNCION']],
    ['Acta de matrimonio', ['ACTA DE MATRIMONIO', 'CONTRAYENTES']],
    ['Acta de nacimiento', ['ACTA DE NACIMIENTO', 'DATOS DE LA PERSONA REGISTRADA']],
    ['Testamento', ['TESTAMENTO', 'HEREDERO', 'LEGATARIO', 'ALBACEA']],
    ['Poder', ['PODER GENERAL', 'PODER NOTARIAL', 'APODERADO', 'PODERDANTE']],
    ['Escritura', ['ESCRITURA PUBLICA', 'INSTRUMENTO NOTARIAL', 'COMPRAVENTA']],
    ['Comprobante de domicilio', ['COMISION FEDERAL DE ELECTRICIDAD', 'ESTADO DE CUENTA', 'TOTAL A PAGAR']],
  ];
  const match = rules.map(([type, keys]) => ({ type, score: keys.filter((key) => value.includes(key)).length, total: keys.length })).sort((a, b) => b.score - a.score)[0];
  return match?.score ? { type: match.type, confidence: Math.min(98, 55 + (match.score / match.total) * 40) } : { type: 'Otro', confidence: 25 };
}

function between(text: string, label: string, nextLabels: string[]) {
  const next = nextLabels.length ? `(?=${nextLabels.join('|')}|$)` : '$';
  return clean(text.match(new RegExp(`${label}\\s*:?\\s*(.*?)\\s*${next}`, 'i'))?.[1] || '');
}

function csfData(text: string) {
  const nombres = between(text, 'Nombre\\s*\\(s\\)', ['Primer Apellido']);
  const paterno = between(text, 'Primer Apellido', ['Segundo Apellido']);
  const materno = between(text, 'Segundo Apellido', ['Fecha inicio de operaciones']);
  const postalCode = between(text, 'C[oó]digo Postal', ['Tipo de Vialidad']).match(/\d{5}/)?.[0] || '';
  const streetType = between(text, 'Tipo de Vialidad', ['Nombre de Vialidad']);
  const street = between(text, 'Nombre de Vialidad', ['N[uú]mero Exterior']);
  const exterior = between(text, 'N[uú]mero Exterior', ['N[uú]mero Interior', 'Nombre de la Colonia']);
  const interior = between(text, 'N[uú]mero Interior', ['Nombre de la Colonia']);
  const colony = between(text, 'Nombre de la Colonia', ['Nombre de la Localidad']);
  const locality = between(text, 'Nombre de la Localidad', ['Nombre del Municipio', 'Nombre de Municipio', 'Municipio o Demarcaci[oó]n Territorial']);
  const municipality = between(text, '(?:Nombre del Municipio|Nombre de Municipio|Municipio o Demarcaci[oó]n Territorial)', ['Nombre de la Entidad Federativa', 'Entidad Federativa']);
  const state = between(text, '(?:Nombre de la Entidad Federativa|Entidad Federativa)', ['Entre Calle', 'Y Calle', 'Actividades Econ[oó]micas']);
  const domicilio = clean([
    streetType, street, exterior && `No. ${exterior}`, interior && interior !== exterior ? `Int. ${interior}` : '',
    colony && `Col. ${colony}`, locality, municipality && municipality !== locality ? municipality : '', state, postalCode && `C.P. ${postalCode}`,
  ].filter(Boolean).join(', '));
  return { nombre: clean([nombres, paterno, materno].filter(Boolean).join(' ')), nombres, apellidoPaterno: paterno, apellidoMaterno: materno, domicilio, codigoPostal: postalCode };
}

function ineData(text: string) {
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const start = lines.findIndex((line) => /^NOMBRE\b/i.test(line));
  const end = lines.findIndex((line, index) => index > start && /^DOMICILIO\b/i.test(line));
  const firstNameLine = start >= 0 ? clean(lines[start].replace(/^NOMBRE\s*[:\-]?\s*/i, '')) : '';
  const nameLines = start >= 0
    ? [firstNameLine, ...lines.slice(start + 1, end > start ? end : start + 4)]
      .filter((line) => line && !/^(SEXO\b|H$|M$|DOMICILIO\b)/i.test(line))
      .map((line) => clean(line.replace(/\bSEXO\s*[HM]?\b.*$/i, '')))
      .filter(Boolean)
    : [];
  const apellidoPaterno = nameLines[0] || '';
  const apellidoMaterno = nameLines[1] || '';
  const nombres = nameLines.slice(2).join(' ');
  const addressStart = end;
  const addressEnd = lines.findIndex((line, index) => index > addressStart && /CLAVE DE ELECTOR/i.test(line));
  const firstAddressLine = addressStart >= 0 ? clean(lines[addressStart].replace(/^DOMICILIO\s*[:\-]?\s*/i, '')) : '';
  const domicilio = addressStart >= 0
    ? [firstAddressLine, ...lines.slice(addressStart + 1, addressEnd > addressStart ? addressEnd : addressStart + 4)].filter(Boolean).join(', ')
    : '';
  const upper = normalized(text);
  const seccion = upper.match(/SECCI[OÓ]N\s*[:\-]?\s*(\d{3,5})/)?.[1] || '';
  const anioRegistro = upper.match(/A[NÑ]O DE REGISTRO\s*[:\-]?\s*([0-9 ]{4,9})/)?.[1]?.trim() || '';
  const vigencia = upper.match(/VIGENCIA\s*[:\-]?\s*([0-9]{4}\s*[-–]\s*[0-9]{4})/)?.[1]?.replace(/\s/g, '') || '';
  return { nombres, apellidoPaterno, apellidoMaterno, nombre: clean([nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(' ')), domicilio, seccion, anioRegistro, vigencia };
}

function extract(text: string): NotaryExtractedData {
  const upper = normalized(text);
  const curp = upper.match(/\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/)?.[0] || '';
  const rfc = upper.match(/\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/)?.[0] || '';
  const claveElector = upper.match(/\b[A-Z]{6}\d{8}[HM]\d{3}\b/)?.[0] || '';
  const century = curp && Number(curp.slice(4, 6)) <= new Date().getFullYear() % 100 ? '20' : '19';
  const birth = curp ? `${century}${curp.slice(4, 6)}-${curp.slice(6, 8)}-${curp.slice(8, 10)}` : '';
  const isCsf = upper.includes('CONSTANCIA DE SITUACION FISCAL') || upper.includes('DATOS DEL DOMICILIO REGISTRADO');
  const isIne = upper.includes('INSTITUTO NACIONAL ELECTORAL') || upper.includes('CREDENCIAL PARA VOTAR');
  const csf = isCsf ? csfData(text) : { nombre: '', domicilio: '' };
  const ine = isIne ? ineData(text) : { nombre: '', domicilio: '' };
  const nameMatch = text.match(/(?:NOMBRE(?:\s*\(S\))?|NOMBRE COMPLETO)\s*[:\-]?\s*([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s]{5,80})/i);
  const addressMatch = text.match(/(?:DOMICILIO|DOMICILIO FISCAL)\s*[:\-]?\s*([^\n]{8,160})/i);
  return { ...ine, ...csf, nombre: csf.nombre || ine.nombre || clean(nameMatch?.[1] || ''), curp, rfc, domicilio: csf.domicilio || ine.domicilio || clean(addressMatch?.[1] || ''), fechaNacimiento: birth, claveElector };
}

function detectRole(text: string) {
  const value = normalized(text);
  if (/\bVENDEDOR(A|ES)?\b|PARTE VENDEDORA/.test(value)) return 'Vendedor';
  if (/\bCOMPRADOR(A|ES)?\b|PARTE COMPRADORA/.test(value)) return 'Comprador';
  if (/\bAPODERADO(A)?\b/.test(value)) return 'Apoderado';
  if (/\bPODERDANTE\b|\bMANDANTE\b/.test(value)) return 'Poderdante';
  if (/\bALBACEA\b/.test(value)) return 'Albacea';
  if (/\bHEREDERO(A|S)?\b/.test(value)) return 'Heredero';
  if (/AUTOR DE LA SUCESION|DE CUJUS/.test(value)) return 'Autor de la sucesión';
  return '';
}

export async function sha256(file: File) {
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function analyzeNotaryDocument(file: File, progress?: (message: string) => void, expectedType = ''): Promise<LocalDocumentAnalysis> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  let text = '';
  if (file.type === 'application/pdf' || extension === 'pdf') { progress?.('Leyendo texto del PDF localmente…'); text = await pdfText(file, progress); }
  else if (file.type.startsWith('image/')) text = await ocrImage(file, progress);
  else if (extension === 'docx') { progress?.('Leyendo el documento Word localmente…'); text = await docxText(file); }
  const classification = expectedType ? { type: expectedType, confidence: 70 } : classify(text, file.name);
  return { text, type: classification.type, role: detectRole(text), confidence: classification.confidence, data: extract(text) };
}
