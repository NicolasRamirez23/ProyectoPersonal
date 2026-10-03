import ExcelJS from 'exceljs';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface BankMovement {
  fecha: string;
  referencia: string;
  tipo: string;
  persona: string;
  banco: string;
  cuenta: string;
  detalle: string;
  claveRastreo: string;
  conceptoCompleto: string;
  cargos: number | null;
  abonos: number | null;
  saldo: number;
  pagina: number;
}

export interface BankStatementResult {
  banco: string;
  cuenta: string;
  clabe: string;
  moneda: string;
  periodo: string;
  saldoAnterior: number;
  abonosResumen: number;
  cargosResumen: number;
  saldoActual: number;
  saldoPromedio: number;
  rendimientos: number;
  movimientos: BankMovement[];
  totalCargos: number;
  totalAbonos: number;
  conciliado: boolean;
}

interface PositionedText { text: string; x: number; y: number }
interface PdfTextItemLike { str: string; transform: number[] }

const parseMoney = (value: string) => {
  const matches = value.match(/(?:\d{1,3}(?:,\d{3})*|\d+)\.\d{2}/g);
  return matches?.length ? Number(matches.at(-1)!.replaceAll(',', '')) : null;
};

const moneyFromText = (text: string, label: string) => {
  const match = text.match(new RegExp(`${label}\\s+([\\d,]+\\.\\d{2})`, 'i'));
  return match ? Number(match[1].replaceAll(',', '')) : 0;
};

const groupLines = (items: PositionedText[], tolerance = 2.5) => {
  const lines: PositionedText[][] = [];
  [...items].sort((a, b) => a.y - b.y || a.x - b.x).forEach((item) => {
    const line = lines.at(-1);
    if (!line || Math.abs(item.y - line[0].y) > tolerance) lines.push([item]);
    else line.push(item);
  });
  return lines;
};

const inColumn = (line: PositionedText[], min: number, max: number) => line
  .filter((item) => item.x >= min && item.x < max)
  .sort((a, b) => a.x - b.x)
  .map((item) => item.text.trim())
  .filter(Boolean)
  .join(' ')
  .trim();

const fullLine = (line: PositionedText[]) => line
  .sort((a, b) => a.x - b.x)
  .map((item) => item.text.trim())
  .filter(Boolean)
  .join(' ')
  .trim();

function movementDetails(lines: string[]) {
  const result = { tipo: lines[0] || '', persona: '', banco: '', cuenta: '', detalle: '', claveRastreo: '' };
  const traceIndex = lines.findIndex((line) => /CLAVE DE RASTREO/i.test(line));
  if (traceIndex >= 0) result.claveRastreo = lines[traceIndex].replace(/^.*?CLAVE DE RASTREO\s*/i, '');
  if (/DEPOSITO SPEI|TRANSFERENCIA SPEI/i.test(result.tipo)) {
    result.persona = lines[1] || '';
    const bankMatch = (lines[2] || '').match(/^(.*?)\s+(\d{10,18})$/);
    result.banco = bankMatch?.[1] || lines[2] || '';
    result.cuenta = bankMatch?.[2] || '';
    result.detalle = lines.slice(3, traceIndex >= 0 ? traceIndex : lines.length).join(' | ');
  } else {
    result.detalle = lines.slice(1).join(' | ');
  }
  return result;
}

const monthNumber: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
};

export async function parseBankStatement(file: File, onProgress?: (percent: number) => void): Promise<BankStatementResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data: bytes }).promise;
  const pages: { items: PositionedText[]; text: string }[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items
      .filter((item) => 'str' in item && 'transform' in item)
      .map((item) => item as unknown as PdfTextItemLike)
      .map((item) => ({ text: item.str, x: item.transform[4], y: viewport.height - item.transform[5] }));
    pages.push({ items, text: items.map((item) => item.text).join(' ') });
    onProgress?.(Math.round((pageNumber / pdf.numPages) * 75));
  }

  const firstPage = pages[0]?.text || '';
  if (!/BANCO INBURSA/i.test(firstPage) || !/DETALLE DE MOVIMIENTOS/i.test(firstPage)) {
    throw new Error('Por ahora este modelo reconoce estados de cuenta de Banco Inbursa con la sección “Detalle de movimientos”.');
  }

  const periodMatch = firstPage.match(/PERIODO\s+Del\s+(\d{1,2})\s+([A-Za-zÁÉÍÓÚáéíóú]+)\.?\s+(\d{4})\s+al\s+(\d{1,2})\s+([A-Za-zÁÉÍÓÚáéíóú]+)\.?\s+(\d{4})/i);
  const year = Number(periodMatch?.[3] || new Date().getFullYear());
  const monthKey = (periodMatch?.[2] || 'ago').slice(0, 3).toLowerCase();
  const month = monthNumber[monthKey] || 8;
  const statementMonthLabel = `${monthKey.toUpperCase()}.`;
  const movementStartPattern = new RegExp(`^${statementMonthLabel.replace('.', '\\.')}\\s*(\\d{1,2})\\s*(\\d{10})(?=\\D|$)`, 'i');
  const accountMatch = firstPage.match(/CUENTA\s+(\d{6,18})/i);
  const clabeMatch = firstPage.match(/CLABE\s+(\d{18})/i);
  const currencyMatch = firstPage.match(/MONEDA\s+([A-Z]{3}\s+[^\n]+?)\s+PERIODO/i);

  const movements: BankMovement[] = [];
  pages.forEach((page, pageIndex) => {
    if (!/FECHA\s*REFERENCIA|FECHA REFERENCIA/i.test(page.text)) return;
    const lines = groupLines(page.items.filter((item) => item.y >= 130 && item.y <= 790));
    const starts: number[] = [];
    lines.forEach((line, index) => {
      if (movementStartPattern.test(fullLine(line))) starts.push(index);
    });

    starts.forEach((startIndex, movementIndex) => {
      const nextIndex = starts[movementIndex + 1] ?? lines.length;
      const startY = lines[startIndex][0].y;
      const block = lines.slice(startIndex, nextIndex).filter((line) => line[0].y <= startY + 65);
      const first = block[0];
      const startMatch = fullLine(first).match(movementStartPattern);
      if (!startMatch) return;
      const [, day, reference] = startMatch;

      let conceptLines = block.map((line) => inColumn(line, 105, 350)).filter(Boolean);
      if (conceptLines.length && !/DEPOSITO SPEI|TRANSFERENCIA SPEI/i.test(conceptLines[0])) conceptLines = conceptLines.slice(0, 2);
      const details = movementDetails(conceptLines);
      const cargo = parseMoney(inColumn(first, 350, 430));
      const credit = parseMoney(inColumn(first, 430, 505));
      const balance = parseMoney(inColumn(first, 505, 610));
      if (balance === null) return;
      movements.push({
        fecha: `${year}-${String(month).padStart(2, '0')}-${String(Number(day)).padStart(2, '0')}`,
        referencia: reference,
        ...details,
        conceptoCompleto: conceptLines.join(' | '),
        cargos: cargo,
        abonos: credit,
        saldo: balance,
        pagina: pageIndex + 1,
      });
    });
  });

  onProgress?.(85);
  if (!movements.length) {
    throw new Error(`No se encontraron movimientos de ${periodMatch?.[2] || 'este periodo'}. No se generará un Excel vacío.`);
  }
  const totalCargos = Number(movements.reduce((sum, row) => sum + (row.cargos || 0), 0).toFixed(2));
  const totalAbonos = Number(movements.reduce((sum, row) => sum + (row.abonos || 0), 0).toFixed(2));
  const cargosResumen = moneyFromText(firstPage, 'CARGOS');
  const abonosResumen = moneyFromText(firstPage, 'ABONOS');
  const saldoActual = moneyFromText(firstPage, 'SALDO ACTUAL');
  const saldoAnterior = moneyFromText(firstPage, 'SALDO ANTERIOR');
  const lastBalance = movements.at(-1)?.saldo || 0;
  const conciliado = Math.abs(totalCargos - cargosResumen) < 0.01
    && Math.abs(totalAbonos - abonosResumen) < 0.01
    && Math.abs(lastBalance - saldoActual) < 0.01;

  onProgress?.(100);
  return {
    banco: 'Banco Inbursa', cuenta: accountMatch?.[1] || '', clabe: clabeMatch?.[1] || '',
    moneda: currencyMatch?.[1]?.trim() || 'MXP - Peso mexicano',
    periodo: periodMatch ? `${periodMatch[1]} ${periodMatch[2]} ${periodMatch[3]} al ${periodMatch[4]} ${periodMatch[5]} ${periodMatch[6]}` : '',
    saldoAnterior, abonosResumen, cargosResumen, saldoActual,
    saldoPromedio: moneyFromText(firstPage, 'SALDO PROMEDIO'),
    rendimientos: moneyFromText(firstPage, 'RENDIMIENTOS'),
    movimientos: movements, totalCargos, totalAbonos, conciliado,
  };
}

const currencyFormat = '$#,##0.00;[Red]-$#,##0.00';

export async function downloadBankStatementExcel(result: BankStatementResult, sourceName: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AvTech';
  const summary = workbook.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
  const movements = workbook.addWorksheet('Movimientos', { views: [{ state: 'frozen', xSplit: 2, ySplit: 1, showGridLines: false }] });

  summary.mergeCells('A1:F1');
  summary.getCell('A1').value = 'Estado de cuenta bancario';
  summary.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 18 };
  summary.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
  summary.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  summary.getRow(1).height = 28;
  const info = [['Banco', result.banco], ['Cuenta', `CUENTA ${result.cuenta}`], ['CLABE', `CLABE ${result.clabe}`], ['Moneda', result.moneda], ['Periodo', result.periodo], ['Movimientos extraídos', result.movimientos.length], ['Archivo fuente', sourceName]];
  info.forEach((row, index) => row.forEach((value, column) => { summary.getCell(index + 3, column + 1).value = value; }));
  for (let row = 3; row <= 9; row += 1) {
    summary.getCell(row, 1).font = { bold: true, color: { argb: 'FF17365D' } };
    summary.getCell(row, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAF7' } };
  }
  const checks = [
    ['Concepto', 'Estado de cuenta', 'Excel'],
    ['Saldo anterior', result.saldoAnterior, result.saldoAnterior],
    ['Abonos', result.abonosResumen, result.totalAbonos],
    ['Cargos', result.cargosResumen, result.totalCargos],
    ['Saldo actual', result.saldoActual, result.movimientos.at(-1)?.saldo || 0],
    ['Saldo promedio', result.saldoPromedio, result.saldoPromedio],
    ['Rendimientos', result.rendimientos, result.rendimientos],
  ];
  checks.forEach((row, index) => {
    row.forEach((value, column) => { summary.getCell(index + 3, column + 4).value = value; });
  });
  for (let col = 4; col <= 6; col += 1) {
    summary.getCell(3, col).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summary.getCell(3, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
  }
  for (let row = 4; row <= 9; row += 1) {
    summary.getCell(row, 4).font = { bold: true, color: { argb: 'FF17365D' } };
    summary.getCell(row, 4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF2F8' } };
    summary.getCell(row, 5).numFmt = currencyFormat;
    summary.getCell(row, 6).numFmt = currencyFormat;
  }
  summary.columns = [{ width: 23 }, { width: 34 }, { width: 3 }, { width: 24 }, { width: 19 }, { width: 19 }];

  const headers = ['Fecha', 'Referencia', 'Tipo de movimiento', 'Persona / beneficiario', 'Banco', 'Cuenta / CLABE', 'Detalle', 'Clave de rastreo', 'Concepto completo', 'Cargos', 'Abonos', 'Saldo', 'Página PDF'];
  movements.addRow(headers);
  result.movimientos.forEach((row) => movements.addRow([
    new Date(`${row.fecha}T00:00:00`), row.referencia, row.tipo, row.persona, row.banco,
    row.cuenta ? `CTA ${row.cuenta}` : '', row.detalle, row.claveRastreo ? `RASTREO ${row.claveRastreo}` : '',
    row.conceptoCompleto, row.cargos, row.abonos, row.saldo, row.pagina,
  ]));
  movements.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
    cell.alignment = { vertical: 'middle' };
  });
  movements.getRow(1).height = 25;
  movements.autoFilter = { from: 'A1', to: 'M1' };
  movements.columns = [12, 15, 23, 30, 19, 25, 38, 38, 55, 15, 15, 15, 11].map((width) => ({ width }));
  movements.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.height = 29;
    row.alignment = { vertical: 'top' };
    if (rowNumber % 2 === 0) row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EEF7' } }; });
    [7, 9].forEach((column) => { row.getCell(column).alignment = { vertical: 'top', wrapText: true }; });
    row.getCell(1).numFmt = 'yyyy-mm-dd';
    [10, 11, 12].forEach((column) => { row.getCell(column).numFmt = currencyFormat; });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sourceName.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9-_]/g, '-')}-movimientos.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
