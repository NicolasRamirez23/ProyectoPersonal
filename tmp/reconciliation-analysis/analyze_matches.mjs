import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const receiptsText = await fs.readFile('C:/Users/Administrator/Desktop/RECIBOS AGOSTO.csv', 'utf8');
const receiptsBook = await Workbook.fromCSV(receiptsText, { sheetName: 'Recibos' });
const bankBook = await SpreadsheetFile.importXlsx(await FileBlob.load('C:/Users/Administrator/Desktop/INBURSA AGOSTO.csv'));
const receiptsValues = receiptsBook.worksheets.getItem('Recibos').getRange('A1:J477').values;
const bankValues = bankBook.worksheets.getItem('Movimientos').getRange('A1:M597').values;

const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const isoFromExcel = (serial) => new Date((Number(serial) - 25569) * 86400000).toISOString().slice(0, 10);
const dayDiff = (a, b) => Math.abs((Date.parse(a) - Date.parse(b)) / 86400000);
const tokens = (value) => {
  const ignored = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'PAGO', 'PALO', 'VERDE', 'TRANSFERENCIA', 'DEPOSITO', 'SPEI', 'MX']);
  return [...new Set(normalize(value).split(' ').filter((token) => token.length > 1 && !ignored.has(token)))];
};
const property = (value) => {
  const text = normalize(value);
  const m = text.match(/(?:MANZANA|MANZ|MZNA|MZA|MNA|M)\s*0*(\d{1,2})(?!\d)/);
  const l = text.match(/(?:LOTE|LTE|LT|L)\s*0*(\d{1,2})(?!\d)/);
  return { m: m?.[1] || '', l: l?.[1] || '' };
};
const overlap = (a, b) => {
  const left = tokens(a); const right = new Set(tokens(b));
  return left.length ? left.filter((token) => right.has(token)).length / left.length : 0;
};

const receipts = receiptsValues.slice(1).filter((row) => row[0]).map((row) => ({
  recibo: String(row[0]), credito: String(row[1]), cliente: String(row[2]), manzana: String(Number(row[4])), lote: String(Number(row[5])),
  fecha: String(row[7] || row[6]), amount: Number(row[8] || 0) + Number(row[9] || 0),
}));
const bank = bankValues.slice(1).filter((row) => row[0] && Number(row[10] || 0) > 0).map((row, index) => ({
  index: index + 2, fecha: isoFromExcel(row[0]), referencia: String(row[1]), tipo: String(row[2]), persona: String(row[3] || ''),
  detalle: String(row[6] || ''), concepto: String(row[8] || ''), amount: Number(row[10]), pagina: Number(row[12]),
}));

const ranked = receipts.map((receipt) => {
  const candidates = bank.map((movement) => {
    const days = dayDiff(receipt.fecha, movement.fecha);
    const amountExact = Math.abs(receipt.amount - movement.amount) < 0.01;
    const haystack = `${movement.persona} ${movement.detalle} ${movement.concepto}`;
    const nameScore = overlap(receipt.cliente, haystack);
    const bankProperty = property(haystack);
    const propertyMatches = receipt.manzana === bankProperty.m && receipt.lote === bankProperty.l;
    let score = amountExact ? 45 : 0;
    score += days === 0 ? 20 : days === 1 ? 15 : days === 2 ? 10 : days <= 3 ? 5 : 0;
    score += propertyMatches ? 30 : 0;
    score += nameScore >= 0.6 ? 30 : nameScore >= 0.4 ? 20 : nameScore > 0 ? 8 : 0;
    return { movement, score, amountExact, days, nameScore, propertyMatches };
  }).filter((candidate) => candidate.days <= 3 && (candidate.amountExact || candidate.propertyMatches || candidate.nameScore >= 0.4))
    .sort((a, b) => b.score - a.score || a.days - b.days);
  return { receipt, best: candidates[0], second: candidates[1] };
});

const high = ranked.filter((x) => x.best && x.best.score >= 85 && (!x.second || x.best.score - x.second.score >= 10));
const medium = ranked.filter((x) => x.best && x.best.score >= 65 && !high.includes(x));
const low = ranked.filter((x) => x.best && !high.includes(x) && !medium.includes(x));
const none = ranked.filter((x) => !x.best);
const reusedHigh = new Map();
for (const match of high) reusedHigh.set(match.best.movement.index, (reusedHigh.get(match.best.movement.index) || 0) + 1);
const collisions = [...reusedHigh.entries()].filter(([, count]) => count > 1);

console.log(JSON.stringify({
  recibos: receipts.length,
  totalRecibos: receipts.reduce((sum, row) => sum + row.amount, 0),
  abonosBanco: bank.length,
  totalAbonosBanco: bank.reduce((sum, row) => sum + row.amount, 0),
  high: high.length, medium: medium.length, low: low.length, none: none.length,
  highBankCollisions: collisions.length,
  sampleHigh: high.slice(0, 8).map((x) => ({ recibo: x.receipt.recibo, cliente: x.receipt.cliente, monto: x.receipt.amount, banco: x.best.movement.persona, detalle: x.best.movement.detalle, score: x.best.score })),
  sampleAmbiguous: [...medium, ...low].slice(0, 12).map((x) => ({ recibo: x.receipt.recibo, cliente: x.receipt.cliente, fecha: x.receipt.fecha, monto: x.receipt.amount, mejor: x.best && { banco: x.best.movement.persona, fecha: x.best.movement.fecha, monto: x.best.movement.amount, detalle: x.best.movement.detalle, score: x.best.score }, segundo: x.second?.score })),
  sampleNone: none.slice(0, 12).map((x) => x.receipt),
}, null, 2));
