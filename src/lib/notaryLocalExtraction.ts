import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { NotaryExtractedData } from '../types/notaryProcess';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
export interface LocalDocumentAnalysis { text: string; type: string; role: string; confidence: number; data: NotaryExtractedData; }
const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

async function pdfText(file: File) {
  const pdf = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 15); pageNumber += 1) {
    const content = await (await pdf.getPage(pageNumber)).getTextContent();
    pages.push(content.items.map((item: any) => item.str || '').join(' '));
  }
  return clean(pages.join('\n'));
}

async function ocrImage(file: File, progress?: (message: string) => void) {
  const { createWorker } = await import('tesseract.js');
  progress?.('Preparando OCR local…');
  const worker = await createWorker('spa');
  try {
    progress?.('Leyendo el documento dentro de este navegador…');
    return clean((await worker.recognize(file)).data.text);
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

function extract(text: string): NotaryExtractedData {
  const upper = normalized(text);
  const curp = upper.match(/\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/)?.[0] || '';
  const rfc = upper.match(/\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/)?.[0] || '';
  const claveElector = upper.match(/\b[A-Z]{6}\d{8}[HM]\d{3}\b/)?.[0] || '';
  const century = curp && Number(curp.slice(4, 6)) <= new Date().getFullYear() % 100 ? '20' : '19';
  const birth = curp ? `${century}${curp.slice(4, 6)}-${curp.slice(6, 8)}-${curp.slice(8, 10)}` : '';
  const nameMatch = text.match(/(?:NOMBRE(?:\s*\(S\))?|NOMBRE COMPLETO)\s*[:\-]?\s*([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s]{5,80})/i);
  const addressMatch = text.match(/(?:DOMICILIO|DOMICILIO FISCAL)\s*[:\-]?\s*([^\n]{8,160})/i);
  return { nombre: clean(nameMatch?.[1] || ''), curp, rfc, domicilio: clean(addressMatch?.[1] || ''), fechaNacimiento: birth, claveElector };
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

export async function analyzeNotaryDocument(file: File, progress?: (message: string) => void): Promise<LocalDocumentAnalysis> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  let text = '';
  if (file.type === 'application/pdf' || extension === 'pdf') { progress?.('Leyendo texto del PDF localmente…'); text = await pdfText(file); }
  else if (file.type.startsWith('image/')) text = await ocrImage(file, progress);
  const classification = classify(text, file.name);
  return { text, type: classification.type, role: detectRole(text), confidence: classification.confidence, data: extract(text) };
}
