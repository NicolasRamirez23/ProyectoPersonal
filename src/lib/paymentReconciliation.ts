import ExcelJS from 'exceljs';
import JSZip from 'jszip';

export type ReconciliationStatus = 'exacto' | 'alta' | 'posible' | 'agrupado' | 'sin_movimiento';

export interface ReceiptPayment {
  id: string;
  recibo: string;
  tipoOrigen: string;
  folioOrigen: string;
  credito: string;
  cliente: string;
  predio: string;
  manzana: string;
  lote: string;
  fecha: string;
  transferencia: number;
  deposito: number;
  monto: number;
  referenciaPago: string;
}

export interface BankPayment {
  id: string;
  fecha: string;
  referencia: string;
  persona: string;
  banco: string;
  detalle: string;
  claveRastreo: string;
  conceptoCompleto: string;
  abono: number;
}

export interface ReconciliationRow {
  id: string;
  status: ReconciliationStatus;
  confidence: number;
  reasons: string[];
  receipts: ReceiptPayment[];
  bank?: BankPayment;
}

export interface ReconciliationResult {
  rows: ReconciliationRow[];
  unmatchedBank: BankPayment[];
  receiptCount: number;
  bankCount: number;
  receiptTotal: number;
  bankTotal: number;
}

const clean = (value: unknown) => {
  const text = String(value ?? '').trim();
  return /^(NULL|N\/A)$/i.test(text) ? '' : text;
};
const normalize = (value: unknown) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const compact = (value: unknown) => normalize(value).replaceAll(' ', '');
const amount = (value: unknown) => Number(clean(value).replace(/[$,\s]/g, '')) || 0;

function csvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell); cell = '';
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export async function parseReceiptsCsv(file: File): Promise<ReceiptPayment[]> {
  const rows = csvRows(await file.text());
  if (!rows.length) throw new Error('El archivo de recibos está vacío.');
  const headers = rows[0].map((value) => normalize(value).toLowerCase().replaceAll(' ', '_'));
  const index = (name: string) => headers.indexOf(name);
  const required = ['recibo', 'cliente', 'fecha_pago', 'transferencia', 'deposito', 'referencia_pago'];
  const missing = required.filter((name) => index(name) < 0);
  if (missing.length) throw new Error(`Faltan columnas en recibos: ${missing.join(', ')}.`);
  return rows.slice(1).filter((row) => clean(row[index('recibo')])).map((row, rowIndex) => {
    const transferencia = amount(row[index('transferencia')]);
    const deposito = amount(row[index('deposito')]);
    return {
      id: `R-${rowIndex + 2}`,
      recibo: clean(row[index('recibo')]), tipoOrigen: clean(row[index('tipo_origen')]) || 'CREDITO',
      folioOrigen: clean(row[index('folio_origen')]) || clean(row[index('credito')]),
      credito: clean(row[index('credito')]), cliente: clean(row[index('cliente')]),
      predio: clean(row[index('predio')]), manzana: clean(row[index('manzana')]), lote: clean(row[index('lote')]),
      fecha: clean(row[index('fecha_pago_comprobante')]) || clean(row[index('fecha_pago')]),
      transferencia, deposito, monto: transferencia + deposito,
      referenciaPago: clean(row[index('referencia_pago')]),
    };
  });
}

const excelDate = (value: ExcelJS.CellValue) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = clean(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : text;
};

export async function parseBankExcel(file: File): Promise<BankPayment[]> {
  const workbook = new ExcelJS.Workbook();
  const bytes = await file.arrayBuffer();
  const signature = new Uint8Array(bytes.slice(0, 4));
  const isZipWorkbook = signature[0] === 0x50 && signature[1] === 0x4b;
  if (!isZipWorkbook) {
    throw new Error('El segundo archivo no es el Excel bancario. Selecciona el archivo de movimientos generado desde el estado de cuenta Inbursa.');
  }
  try { await workbook.xlsx.load(bytes); }
  catch {
    try { return await parseLegacyBankWorkbook(bytes); }
    catch { throw new Error('No se pudo leer el archivo bancario. Vuelve a generarlo desde “Estado de cuenta a Excel” y selecciónalo aquí.'); }
  }
  const sheet = workbook.getWorksheet('Movimientos') || workbook.worksheets[0];
  if (!sheet) throw new Error('El archivo bancario no contiene hojas.');
  const headers = (sheet.getRow(1).values as ExcelJS.CellValue[]).slice(1).map(normalize);
  const col = (...names: string[]) => headers.findIndex((header) => names.includes(header)) + 1;
  const columns = {
    fecha: col('FECHA'), referencia: col('REFERENCIA'), persona: col('PERSONA BENEFICIARIO', 'PERSONA / BENEFICIARIO'),
    banco: col('BANCO'), detalle: col('DETALLE'), rastreo: col('CLAVE DE RASTREO'), concepto: col('CONCEPTO COMPLETO'), abono: col('ABONOS'),
  };
  if (!columns.fecha || !columns.referencia || !columns.abono) throw new Error('El Excel bancario no tiene las columnas Fecha, Referencia y Abonos.');
  const payments: BankPayment[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const abono = amount(row.getCell(columns.abono).value);
    if (abono <= 0) return;
    payments.push({
      id: `B-${rowNumber}`, fecha: excelDate(row.getCell(columns.fecha).value), referencia: clean(row.getCell(columns.referencia).value),
      persona: clean(row.getCell(columns.persona).value), banco: clean(row.getCell(columns.banco).value),
      detalle: clean(row.getCell(columns.detalle).value), claveRastreo: clean(row.getCell(columns.rastreo).value),
      conceptoCompleto: clean(row.getCell(columns.concepto).value), abono,
    });
  });
  if (!payments.length) throw new Error('No se encontraron abonos en el Excel bancario.');
  return payments;
}

const xmlDecode = (value: string) => value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const excelSerialDate = (serial: string) => new Date((Number(serial) - 25569) * 86400000).toISOString().slice(0, 10);

async function parseLegacyBankWorkbook(bytes: ArrayBuffer): Promise<BankPayment[]> {
  const zip = await JSZip.loadAsync(bytes);
  const sharedXml = await zip.file('xl/sharedStrings.xml')?.async('string');
  const shared = sharedXml ? [...sharedXml.matchAll(/<(?:x:)?si\b[^>]*>([\s\S]*?)<\/(?:x:)?si>/g)].map((match) => xmlDecode([...match[1].matchAll(/<(?:x:)?t\b[^>]*>([\s\S]*?)<\/(?:x:)?t>/g)].map((part) => part[1]).join(''))) : [];
  const sheetFiles = Object.keys(zip.files).filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path));
  let sheetXml = '';
  for (const path of sheetFiles) {
    const candidate = await zip.file(path)!.async('string');
    if (/\bAbonos\b/i.test(candidate) && /Clave de rastreo/i.test(candidate) && /Persona \/ beneficiario/i.test(candidate)) { sheetXml = candidate; break; }
  }
  if (!sheetXml) throw new Error('No se encontró la hoja Movimientos en el Excel bancario.');
  const matrix: Record<number, Record<string, string>> = {};
  for (const rowMatch of sheetXml.matchAll(/<(?:x:)?row\b([^>]*)>([\s\S]*?)<\/(?:x:)?row>/g)) {
    const rowNumber = Number(rowMatch[1].match(/\br="(\d+)"/)?.[1]); if (!rowNumber) continue; matrix[rowNumber] = {};
    for (const cellMatch of rowMatch[2].matchAll(/<(?:x:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:x:)?c>)/g)) {
      const attrs = cellMatch[1]; const column = attrs.match(/\br="([A-Z]+)\d+"/)?.[1]; if (!column) continue;
      const raw = cellMatch[2]?.match(/<(?:x:)?v>([\s\S]*?)<\/(?:x:)?v>/)?.[1] || '';
      matrix[rowNumber][column] = /\bt="s"/.test(attrs) ? shared[Number(raw)] || '' : xmlDecode(raw);
    }
  }
  const payments: BankPayment[] = [];
  Object.entries(matrix).forEach(([rowKey, row]) => {
    const rowNumber = Number(rowKey); if (rowNumber === 1) return;
    const abono = amount(row.K); if (abono <= 0) return;
    payments.push({ id: `B-${rowNumber}`, fecha: excelSerialDate(row.A), referencia: clean(row.B), persona: clean(row.D), banco: clean(row.E), detalle: clean(row.G), claveRastreo: clean(row.H), conceptoCompleto: clean(row.I), abono });
  });
  if (!payments.length) throw new Error('No se encontraron abonos en el Excel bancario.');
  return payments;
}

const daysBetween = (left: string, right: string) => Math.abs((Date.parse(`${left}T00:00:00`) - Date.parse(`${right}T00:00:00`)) / 86400000);
const ignoredNames = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'PALO', 'VERDE']);
const nameTokens = (value: string) => normalize(value).split(' ').filter((token) => token.length > 1 && !ignoredNames.has(token));
const nameSimilarity = (left: string, right: string) => {
  const tokens = nameTokens(left); const other = new Set(nameTokens(right));
  return tokens.length ? tokens.filter((token) => other.has(token)).length / tokens.length : 0;
};
const propertyMatches = (receipt: ReceiptPayment, bank: BankPayment) => {
  if (!receipt.manzana || !receipt.lote) return false;
  const text = compact(`${bank.detalle} ${bank.conceptoCompleto}`);
  const m = receipt.manzana.replace(/^0+/, ''); const l = receipt.lote.replace(/^0+/, '');
  const mz = new RegExp(`(?:MANZANA|MANZ|MZNA|MZA|M)0*${m}(?!\\d)`).test(text);
  const lt = new RegExp(`(?:LOTE|LTE|LT|L)0*${l}(?!\\d)`).test(text);
  return mz && lt;
};

function score(receipt: ReceiptPayment, bank: BankPayment) {
  const reasons: string[] = [];
  let points = 0;
  const amountDifference = Number(Math.abs(receipt.monto - bank.abono).toFixed(2));
  const exactAmount = amountDifference < 0.01;
  const acceptableAmount = amountDifference <= 1;
  if (exactAmount) { points += 45; reasons.push('importe'); }
  else if (acceptableAmount) { points += 42; reasons.push(`importe ±${amountDifference.toFixed(2)}`); }
  const days = daysBetween(receipt.fecha, bank.fecha);
  if (days === 0) { points += 20; reasons.push('fecha'); }
  else if (days === 1) { points += 15; reasons.push('fecha ±1 día'); }
  else if (days <= 3) { points += 8; reasons.push(`fecha ±${days} días`); }
  const bankText = compact(`${bank.referencia} ${bank.detalle} ${bank.claveRastreo} ${bank.conceptoCompleto}`);
  const reference = compact(receipt.referenciaPago);
  const referenceMatch = reference.length >= 4 && (bankText.includes(reference) || (reference.length >= 6 && bankText.includes(reference.replace(/^0+/, ''))));
  if (referenceMatch) { points += 60; reasons.push('referencia de pago'); }
  if (propertyMatches(receipt, bank)) { points += 30; reasons.push('manzana/lote'); }
  const names = nameSimilarity(receipt.cliente, `${bank.persona} ${bank.detalle}`);
  if (names >= .6) { points += 30; reasons.push('cliente'); }
  else if (names >= .4) { points += 18; reasons.push('cliente parcial'); }
  return { points, reasons, exactAmount, acceptableAmount, amountDifference, referenceMatch };
}

export function reconcilePayments(receipts: ReceiptPayment[], bankPayments: BankPayment[]): ReconciliationResult {
  const candidates = receipts.flatMap((receipt) => bankPayments.map((bank) => ({ receipt, bank, ...score(receipt, bank) })))
    .filter((item) => item.points >= 42 && item.acceptableAmount)
    .sort((a, b) => b.points - a.points);
  const usedReceipts = new Set<string>(); const usedBank = new Set<string>(); const rows: ReconciliationRow[] = [];
  const assignCandidate = (candidate: typeof candidates[number]) => {
    if (usedReceipts.has(candidate.receipt.id) || usedBank.has(candidate.bank.id)) return;
    usedReceipts.add(candidate.receipt.id); usedBank.add(candidate.bank.id);
    const status: ReconciliationStatus = candidate.referenceMatch && candidate.exactAmount ? 'exacto' : candidate.points >= 92 ? 'alta' : 'posible';
    rows.push({ id: `M-${candidate.receipt.id}-${candidate.bank.id}`, status, confidence: Math.min(100, candidate.points), reasons: candidate.reasons, receipts: [candidate.receipt], bank: candidate.bank });
  };

  // Primero reserva únicamente las coincidencias individuales fuertes. Las débiles
  // esperan hasta después de buscar depósitos que cubren varios recibos.
  candidates.filter((candidate) => candidate.points >= 92 || (candidate.referenceMatch && candidate.exactAmount)).forEach(assignCandidate);

  // Detecta el caso común de un solo depósito que liquida dos recibos.
  bankPayments.filter((bank) => !usedBank.has(bank.id)).forEach((bank) => {
    const available = receipts.filter((receipt) => !usedReceipts.has(receipt.id) && daysBetween(receipt.fecha, bank.fecha) <= 3);
    let found: [ReceiptPayment, ReceiptPayment] | undefined;
    let groupedReasons: string[] = [];
    for (let left = 0; left < available.length && !found; left += 1) for (let right = left + 1; right < available.length; right += 1) {
      const pair: [ReceiptPayment, ReceiptPayment] = [available[left], available[right]];
      const receiptsTotal = pair[0].monto + pair[1].monto;
      const difference = Number((bank.abono - receiptsTotal).toFixed(2));
      const directSum = Math.abs(difference) <= 1;
      const monthlyPayments = difference > 0 ? Math.round(difference / 1500) : 0;
      const includesMonthlyPayments = monthlyPayments >= 1 && monthlyPayments <= 12 && Math.abs(difference - monthlyPayments * 1500) <= 1;
      if (!directSum && !includesMonthlyPayments) continue;
      const sameReceiptClient = nameSimilarity(pair[0].cliente, pair[1].cliente) >= .6;
      const supported = pair.every((receipt) => propertyMatches(receipt, bank) || nameSimilarity(receipt.cliente, `${bank.persona} ${bank.detalle}`) >= .6 || score(receipt, bank).referenceMatch);
      if (supported && (directSum || sameReceiptClient)) {
        found = pair;
        groupedReasons = directSum
          ? ['suma de 2 recibos', 'fecha y cliente/propiedad']
          : ['suma de 2 recibos', `${monthlyPayments} mensualidad${monthlyPayments === 1 ? '' : 'es'} adicional${monthlyPayments === 1 ? '' : 'es'} de $1,500`, `diferencia incluida $${difference.toFixed(2)}`, 'mismo cliente y fecha'];
        break;
      }
    }
    if (found) {
      found.forEach((receipt) => usedReceipts.add(receipt.id)); usedBank.add(bank.id);
      rows.push({ id: `G-${bank.id}`, status: 'agrupado', confidence: 90, reasons: groupedReasons, receipts: found, bank });
    }
  });

  // Finalmente asigna coincidencias individuales de menor confianza que no hayan
  // sido absorbidas por un pago agrupado.
  candidates.forEach(assignCandidate);

  receipts.filter((receipt) => !usedReceipts.has(receipt.id)).forEach((receipt) => rows.push({ id: `U-${receipt.id}`, status: 'sin_movimiento', confidence: 0, reasons: [], receipts: [receipt] }));
  return {
    rows,
    unmatchedBank: bankPayments.filter((bank) => !usedBank.has(bank.id)),
    receiptCount: receipts.length, bankCount: bankPayments.length,
    receiptTotal: receipts.reduce((sum, receipt) => sum + receipt.monto, 0),
    bankTotal: bankPayments.reduce((sum, bank) => sum + bank.abono, 0),
  };
}

const statusLabel: Record<ReconciliationStatus, string> = { exacto: 'Coincidencia exacta', alta: 'Coincidencia alta', posible: 'Posible coincidencia', agrupado: 'Pago agrupado', sin_movimiento: 'Recibo sin movimiento' };

export async function downloadReconciliationExcel(result: ReconciliationResult) {
  const workbook = new ExcelJS.Workbook(); workbook.creator = 'AvTech';
  const sheet = workbook.addWorksheet('Conciliación', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.addRow(['Estado', 'Confianza', 'Recibo(s)', 'Tipo origen', 'Folio origen', 'Crédito', 'Cliente', 'Predio', 'Manzana', 'Lote', 'Fecha recibo', 'Referencia pago', 'Monto recibo(s)', 'Fecha banco', 'Referencia banco', 'Persona banco', 'Detalle', 'Clave rastreo', 'Abono banco', 'Criterios']);
  result.rows.forEach((item) => sheet.addRow([
    statusLabel[item.status], item.confidence / 100, item.receipts.map((r) => r.recibo).join(', '), item.receipts.map((r) => r.tipoOrigen).join(', '),
    item.receipts.map((r) => r.folioOrigen).join(', '), item.receipts.map((r) => r.credito).join(', '), item.receipts.map((r) => r.cliente).join(' / '),
    item.receipts.map((r) => r.predio).join(', '), item.receipts.map((r) => r.manzana).join(', '), item.receipts.map((r) => r.lote).join(', '),
    item.receipts.map((r) => r.fecha).join(', '), item.receipts.map((r) => r.referenciaPago).join(', '), item.receipts.reduce((sum, r) => sum + r.monto, 0),
    item.bank?.fecha || '', item.bank?.referencia || '', item.bank?.persona || '', item.bank?.detalle || '', item.bank?.claveRastreo || '', item.bank?.abono || '', item.reasons.join(', '),
  ]));
  result.unmatchedBank.forEach((bank) => sheet.addRow(['Movimiento sin recibo', 0, '', '', '', '', '', '', '', '', '', '', '', bank.fecha, bank.referencia, bank.persona, bank.detalle, bank.claveRastreo, bank.abono, '']));
  sheet.getRow(1).eachCell((cell) => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } }; });
  sheet.autoFilter = { from: 'A1', to: 'T1' };
  sheet.columns = [24, 12, 14, 14, 14, 14, 34, 11, 11, 11, 15, 20, 18, 15, 18, 30, 45, 35, 18, 35].map((width) => ({ width }));
  sheet.getColumn(2).numFmt = '0%'; sheet.getColumn(13).numFmt = '$#,##0.00'; sheet.getColumn(19).numFmt = '$#,##0.00';
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `conciliacion-${new Date().toISOString().slice(0, 10)}.xlsx`; link.click(); URL.revokeObjectURL(url);
}
