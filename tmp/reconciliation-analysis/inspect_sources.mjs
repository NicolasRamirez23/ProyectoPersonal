import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const receiptsText = await fs.readFile('C:/Users/Administrator/Desktop/RECIBOS AGOSTO.csv', 'utf8');
const receipts = await Workbook.fromCSV(receiptsText, { sheetName: 'Recibos' });
const bankBlob = await FileBlob.load('C:/Users/Administrator/Desktop/INBURSA AGOSTO.csv');
const bank = await SpreadsheetFile.importXlsx(bankBlob);

console.log((await receipts.inspect({ kind: 'workbook,sheet,table', maxChars: 10000, tableMaxRows: 12, tableMaxCols: 15 })).ndjson);
console.log((await bank.inspect({ kind: 'workbook,sheet,table', maxChars: 18000, tableMaxRows: 12, tableMaxCols: 15 })).ndjson);
