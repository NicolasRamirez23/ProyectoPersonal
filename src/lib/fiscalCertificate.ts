import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface ExtractedFiscalData {
  businessName: string;
  taxId: string;
  taxPostalCode: string;
  taxRegime: string;
  taxRegimes: string[];
  taxAddress: string;
}

export type FiscalCertificateProgress = (message: string) => void;

interface TextItemLike {
  str: string;
  transform: number[];
}

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function searchKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[|]/g, 'I')
    .toLocaleLowerCase('es-MX');
}

function groupLines(items: TextItemLike[]) {
  const rows: { y: number; items: { x: number; text: string }[] }[] = [];
  for (const item of items) {
    const text = normalize(item.str);
    if (!text) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    let row = rows.find((candidate) => Math.abs(candidate.y - y) < 2);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push({ x, text });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => normalize(row.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(' ')));
}

function valueAfterLabels(lines: string[], labels: string[], followingLabels: string[] = []) {
  for (const line of lines) {
    const comparable = searchKey(line);
    for (const label of labels) {
      const comparableLabel = searchKey(label);
      const labelIndex = comparable.indexOf(comparableLabel);
      if (labelIndex < 0) continue;
      let endIndex = line.length;
      for (const nextLabel of followingLabels) {
        const nextIndex = comparable.indexOf(searchKey(nextLabel), labelIndex + comparableLabel.length);
        if (nextIndex >= 0) endIndex = Math.min(endIndex, nextIndex);
      }
      const value = normalize(line.slice(labelIndex + label.length, endIndex).replace(/^[\s:;.-]+/, ''));
      if (value) return value;
    }
  }
  return '';
}

function cleanRegime(value: string) {
  return normalize(value
    .replace(/\s+\d{2}[/-]\d{2}[/-]\d{4}.*$/, ''));
}

function cleanAddressValue(value: string) {
  return normalize(value
    .replace(/\bNombre\s+del?\s+Municipio\s+o\s+Demarcaci[oó]n\s+Territorial\s*:?.*$/i, '')
    .replace(/\bMunicipio\s+o\s+Demarcaci[oó]n\s+Territorial\s*:?.*$/i, ''));
}

function nameFromHeader(lines: string[]) {
  const labelIndex = lines.findIndex((line) =>
    /nombre,\s*denominacion\s+o\s+razon\s+social/i.test(searchKey(line)));
  if (labelIndex < 1) return '';
  const candidates = lines.slice(Math.max(0, labelIndex - 3), labelIndex)
    .filter((line) =>
      /^[A-ZÁÉÍÓÚÜÑ&.\s]{4,}$/.test(line)
      && !/SAT|HACIENDA|REGISTRO FEDERAL|CONTRIBUYENTES/i.test(line));
  return normalize(candidates.join(' '));
}

function parseFiscalLines(rawLines: string[]): ExtractedFiscalData {
  const lines = rawLines.map(normalize).filter(Boolean);
  const allText = lines.join(' ');
  const rfcLine = lines.find((line) => /^RFC\s*[:;]?/i.test(line));
  const rfcMatch = (rfcLine || allText).match(/\b[A-ZÑ&]{3,4}\s?\d{6}\s?[A-Z0-9]{3}\b/i);

  const firstName = valueAfterLabels(lines, ['Nombre (s)', 'Nombres'], ['Primer Apellido', 'Apellido Paterno']);
  const firstSurname = valueAfterLabels(lines, ['Primer Apellido', 'Apellido Paterno'], ['Segundo Apellido', 'Apellido Materno']);
  const secondSurname = valueAfterLabels(lines, ['Segundo Apellido', 'Apellido Materno'], ['Fecha inicio de operaciones']);
  const companyName = valueAfterLabels(lines, [
    'Denominación o Razón Social',
    'Denominacion/Razon Social',
    'Razón Social',
    'Nombre, denominación o razón social',
  ], ['Nombre Comercial', 'Fecha inicio de operaciones']);
  const businessName = normalize(
    companyName
    || [firstName, firstSurname, secondSurname].filter(Boolean).join(' ')
    || nameFromHeader(lines));

  const postalCode = valueAfterLabels(lines, ['Código Postal', 'Codigo Postal', 'C.P.'], ['Tipo de Vialidad'])
    .match(/\d{5}/)?.[0] || '';
  const streetType = valueAfterLabels(lines, ['Tipo de Vialidad'], ['Nombre de Vialidad']);
  const street = valueAfterLabels(lines, ['Nombre de Vialidad'], ['Número Exterior', 'Numero Exterior']);
  const exterior = valueAfterLabels(lines, ['Número Exterior', 'Numero Exterior'], ['Número Interior', 'Numero Interior', 'Nombre de la Colonia']);
  const interior = valueAfterLabels(lines, ['Número Interior', 'Numero Interior'], ['Nombre de la Colonia']);
  const neighborhood = valueAfterLabels(lines, ['Nombre de la Colonia'], ['Nombre de la Localidad']);
  const locality = valueAfterLabels(lines, ['Nombre de la Localidad'], [
    'Nombre del Municipio o Demarcación Territorial',
    'Nombre de Municipio o Demarcación Territorial',
    'Municipio o Demarcación Territorial',
  ]);
  const municipality = valueAfterLabels(lines, [
    'Nombre del Municipio o Demarcación Territorial',
    'Nombre de Municipio o Demarcación Territorial',
    'Municipio o Demarcación Territorial',
    'Municipio',
  ], ['Nombre de la Entidad Federativa', 'Entidad Federativa']);
  const state = valueAfterLabels(lines, ['Nombre de la Entidad Federativa', 'Entidad Federativa'], ['Entre Calle']);

  const regimeLines = lines.filter((line) => {
    const comparable = searchKey(line);
    return /^regimen\s+(?:de\s+|simplificado\b|general\b|sin\b)/i.test(comparable)
      && !/^regimen\s+fecha\b/i.test(comparable);
  });
  const regimesValue = valueAfterLabels(lines, ['Regímenes', 'Regimenes'], ['Fecha Inicio', 'Fecha de inicio']);
  const taxRegimes = [...new Set(
    [...regimeLines, regimesValue]
      .map(cleanRegime)
      .filter((value) => value && searchKey(value) !== 'regimen'),
  )];
  const taxRegime = taxRegimes[0] || '';
  const taxAddress = normalize([
    streetType,
    street,
    exterior && `No. ${exterior}`,
    interior && `Int. ${interior}`,
    neighborhood && `Col. ${neighborhood}`,
    cleanAddressValue(locality),
    municipality !== locality ? cleanAddressValue(municipality) : '',
    state,
    postalCode && `C.P. ${postalCode}`,
  ].filter(Boolean).join(', '));

  return {
    businessName,
    taxId: rfcMatch?.[0]?.replace(/\s/g, '').toUpperCase() || '',
    taxPostalCode: postalCode,
    taxRegime,
    taxRegimes,
    taxAddress,
  };
}

function missingFields(result: ExtractedFiscalData) {
  return [
    !result.businessName && 'nombre o razón social',
    !result.taxId && 'RFC',
    !result.taxPostalCode && 'código postal',
    !result.taxRegime && 'régimen fiscal',
  ].filter(Boolean) as string[];
}

async function loadPdf(file: File) {
  return getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

async function extractPdfText(document: PDFDocumentProxy) {
  const lines: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    lines.push(...groupLines(content.items as unknown as TextItemLike[]));
  }
  return lines;
}

async function pageToCanvas(document: PDFDocumentProxy, pageNumber: number) {
  const page = await document.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = window.document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('El navegador no pudo preparar la imagen para OCR.');
  await page.render({ canvasContext: context, viewport, canvas }).promise;
  return canvas;
}

async function extractWithOcr(
  source: File | PDFDocumentProxy,
  onProgress?: FiscalCertificateProgress,
) {
  const { createWorker } = await import('tesseract.js');
  onProgress?.('Preparando reconocimiento OCR...');
  const worker = await createWorker('spa');
  try {
    const texts: string[] = [];
    if (source instanceof File) {
      onProgress?.('Reconociendo texto de la imagen...');
      const result = await worker.recognize(source);
      texts.push(result.data.text);
    } else {
      const pages = Math.min(source.numPages, 3);
      for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
        onProgress?.(`Aplicando OCR a la página ${pageNumber} de ${pages}...`);
        const canvas = await pageToCanvas(source, pageNumber);
        const result = await worker.recognize(canvas);
        texts.push(result.data.text);
      }
    }
    return texts.flatMap((text) => text.split(/\r?\n/));
  } finally {
    await worker.terminate();
  }
}

export async function extractFiscalCertificate(
  file: File,
  onProgress?: FiscalCertificateProgress,
): Promise<ExtractedFiscalData> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const isPdf = file.type === 'application/pdf' || extension === 'pdf';
  const isImage = ['png', 'jpg', 'jpeg'].includes(extension || '') || ['image/png', 'image/jpeg'].includes(file.type);
  if (!isPdf && !isImage) {
    throw new Error('La constancia debe ser PDF, PNG, JPG o JPEG.');
  }

  let result: ExtractedFiscalData;
  if (isPdf) {
    onProgress?.('Leyendo texto de la constancia...');
    const document = await loadPdf(file);
    result = parseFiscalLines(await extractPdfText(document));
    if (missingFields(result).length) {
      result = parseFiscalLines(await extractWithOcr(document, onProgress));
    }
  } else {
    result = parseFiscalLines(await extractWithOcr(file, onProgress));
  }

  const missing = missingFields(result);
  if (missing.length) {
    throw new Error(`No se pudo reconocer: ${missing.join(', ')}. Puedes completar o corregir los datos manualmente.`);
  }
  return result;
}
