import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const sourceJson = "C:/Users/Administrator/Desktop/Proyectos AvTech 2.0/AvTech/tmp/pdfs/consultar-cuenta/transactions.json";
const outputDir = "C:/Users/Administrator/Desktop/Proyectos AvTech 2.0/AvTech/outputs/consultar-cuenta";
const data = JSON.parse(await fs.readFile(sourceJson, "utf8"));
const movements = data.movimientos;
const lastRow = movements.length + 1;

const workbook = Workbook.create();
const summary = workbook.worksheets.add("Resumen");
const detail = workbook.worksheets.add("Movimientos");

summary.showGridLines = false;
detail.showGridLines = false;

const headers = [
  "Fecha", "Referencia", "Tipo de movimiento", "Persona / beneficiario", "Banco",
  "Cuenta / CLABE", "Detalle", "Clave de rastreo", "Concepto completo",
  "Cargos", "Abonos", "Saldo", "Página PDF",
];
const rows = movements.map((m) => [
  new Date(`${m.fecha}T00:00:00Z`),
  m.referencia,
  m.tipo,
  m.persona,
  m.banco,
  m.cuenta ? `CTA ${m.cuenta}` : "",
  m.detalle,
  m.clave_rastreo ? `RASTREO ${m.clave_rastreo}` : "",
  m.concepto,
  m.cargos,
  m.abonos,
  m.saldo,
  m.pagina,
]);

detail.getRange(`A1:M${lastRow}`).values = [headers, ...rows];
detail.getRange("A1:M1").format = {
  fill: "#17365D",
  font: { bold: true, color: "#FFFFFF" },
  verticalAlignment: "center",
};
detail.getRange(`A2:A${lastRow}`).format.numberFormat = "yyyy-mm-dd";
detail.getRange(`B2:B${lastRow}`).format.numberFormat = "@";
detail.getRange(`F2:F${lastRow}`).format.numberFormat = "@";
detail.getRange(`H2:H${lastRow}`).format.numberFormat = "@";
detail.getRange(`J2:L${lastRow}`).format.numberFormat = "$#,##0.00;[Red]-$#,##0.00";
detail.getRange(`M2:M${lastRow}`).format.numberFormat = "0";
detail.getRange(`A2:M${lastRow}`).format.verticalAlignment = "top";
detail.getRange(`G2:I${lastRow}`).format.wrapText = true;
detail.getRange(`A1:M${lastRow}`).format.borders = {
  insideHorizontal: { style: "thin", color: "#D9E2F3" },
  bottom: { style: "thin", color: "#A6A6A6" },
};
detail.getRange("A:A").format.columnWidth = 12;
detail.getRange("B:B").format.columnWidth = 15;
detail.getRange("C:C").format.columnWidth = 23;
detail.getRange("D:D").format.columnWidth = 30;
detail.getRange("E:E").format.columnWidth = 19;
detail.getRange("F:F").format.columnWidth = 23;
detail.getRange("G:G").format.columnWidth = 36;
detail.getRange("H:H").format.columnWidth = 34;
detail.getRange("I:I").format.columnWidth = 55;
detail.getRange("J:L").format.columnWidth = 15;
detail.getRange("M:M").format.columnWidth = 11;
detail.getRange("1:1").format.rowHeight = 28;
detail.getRange(`2:${lastRow}`).format.rowHeight = 30;
detail.freezePanes.freezeRows(1);
detail.freezePanes.freezeColumns(2);
const table = detail.tables.add(`A1:M${lastRow}`, true, "MovimientosTable");
table.style = "TableStyleMedium2";
table.showBandedRows = true;
table.showFilterButton = true;

summary.mergeCells("A1:F1");
summary.getRange("A1").values = [["Estado de cuenta - Agosto 2026"]];
summary.getRange("A1:F1").format = {
  fill: "#17365D",
  font: { bold: true, color: "#FFFFFF", size: 18 },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};
summary.getRange("A1:F1").format.rowHeight = 34;
summary.getRange("A3:B10").values = [
  ["Cuenta", "CUENTA 50073105932"],
  ["CLABE", "CLABE 036162500731059321"],
  ["Moneda", "MXP - Peso mexicano"],
  ["Periodo", "01 Ago. 2026 al 31 Ago. 2026"],
  ["Fecha de corte", "31 Ago. 2026"],
  ["Movimientos extraídos", movements.length],
  ["Archivo fuente", "consultar-cuenta.pdf"],
  ["Páginas con movimientos", "2 a 55"],
];
summary.getRange("A3:A10").format = { fill: "#D9EAF7", font: { bold: true, color: "#17365D" } };
summary.getRange("A3:B10").format.borders = { preset: "outside", style: "thin", color: "#9FBAD0" };
summary.getRange("B3:B4").format.numberFormat = "@";

summary.getRange("D3:F3").values = [["Concepto", "Estado de cuenta", "Excel"]];
summary.getRange("D4:D9").values = [
  ["Saldo anterior"], ["Abonos"], ["Cargos"], ["Saldo actual"], ["Saldo promedio"], ["Rendimientos"],
];
summary.getRange("E4:E9").values = [
  [data.saldo_anterior], [data.abonos_resumen], [data.cargos_resumen], [data.saldo_actual], [data.saldo_promedio], [data.rendimientos],
];
summary.getRange("F4").values = [[data.saldo_anterior]];
summary.getRange("F5").formulas = [[`=SUM('Movimientos'!$K$2:$K$${lastRow})`]];
summary.getRange("F6").formulas = [[`=SUM('Movimientos'!$J$2:$J$${lastRow})`]];
summary.getRange("F7").formulas = [[`=F4+F5-F6`]];
summary.getRange("F8:F9").values = [[data.saldo_promedio], [data.rendimientos]];
summary.getRange("D3:F3").format = { fill: "#17365D", font: { bold: true, color: "#FFFFFF" } };
summary.getRange("D4:D9").format = { fill: "#EAF2F8", font: { bold: true, color: "#17365D" } };
summary.getRange("E4:F9").format.numberFormat = "$#,##0.00;[Red]-$#,##0.00";
summary.getRange("D3:F9").format.borders = { preset: "all", style: "thin", color: "#B4C7E7" };

summary.getRange("D11:F11").values = [["Control", "Valor", "Resultado"]];
summary.getRange("D12:D14").values = [["Diferencia abonos"], ["Diferencia cargos"], ["Diferencia saldo final"]];
summary.getRange("E12").formulas = [["=F5-E5"]];
summary.getRange("E13").formulas = [["=F6-E6"]];
summary.getRange("E14").formulas = [["=F7-E7"]];
summary.getRange("F12").formulas = [["=IF(ABS(E12)<0.01,\"OK\",\"REVISAR\")"]];
summary.getRange("F13").formulas = [["=IF(ABS(E13)<0.01,\"OK\",\"REVISAR\")"]];
summary.getRange("F14").formulas = [["=IF(ABS(E14)<0.01,\"OK\",\"REVISAR\")"]];
summary.getRange("D11:F11").format = { fill: "#548235", font: { bold: true, color: "#FFFFFF" } };
summary.getRange("D12:D14").format = { fill: "#E2F0D9", font: { bold: true, color: "#375623" } };
summary.getRange("E12:E14").format.numberFormat = "$#,##0.00;[Red]-$#,##0.00";
summary.getRange("D11:F14").format.borders = { preset: "all", style: "thin", color: "#A9D18E" };
summary.getRange("F12:F14").conditionalFormats.add("containsText", {
  text: "OK", format: { fill: "#C6EFCE", font: { color: "#006100", bold: true } },
});
summary.getRange("A17:F18").merge();
summary.getRange("A17").values = [["Nota: los campos Persona, Banco, Cuenta/CLABE, Detalle y Clave de rastreo se separaron automáticamente cuando la estructura del movimiento lo permitió. El concepto completo conserva el texto extraído para auditoría."]];
summary.getRange("A17:F18").format = { fill: "#FFF2CC", font: { color: "#7F6000" }, wrapText: true, verticalAlignment: "center" };
summary.getRange("A:A").format.columnWidth = 22;
summary.getRange("B:B").format.columnWidth = 32;
summary.getRange("C:C").format.columnWidth = 3;
summary.getRange("D:D").format.columnWidth = 24;
summary.getRange("E:F").format.columnWidth = 18;
summary.freezePanes.freezeRows(1);

const summaryCheck = await workbook.inspect({
  kind: "table", range: "Resumen!A1:F18", include: "values,formulas", tableMaxRows: 20, tableMaxCols: 8,
});
console.log(summaryCheck.ndjson);
const detailCheck = await workbook.inspect({
  kind: "table", range: "Movimientos!A1:M8", include: "values,formulas", tableMaxRows: 8, tableMaxCols: 13,
});
console.log(detailCheck.ndjson);
const errors = await workbook.inspect({
  kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 100 }, summary: "final formula error scan",
});
console.log(errors.ndjson);

await fs.mkdir(outputDir, { recursive: true });
for (const [sheetName, range, fileName] of [
  ["Resumen", "A1:F18", "preview-resumen.png"],
  ["Movimientos", "A1:M24", "preview-movimientos.png"],
]) {
  const preview = await workbook.render({ sheetName, range, scale: 1.4, format: "png" });
  await fs.writeFile(`${outputDir}/${fileName}`, new Uint8Array(await preview.arrayBuffer()));
}

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(`${outputDir}/estado-cuenta-agosto-2026.xlsx`);
console.log(`OUTPUT=${outputDir}/estado-cuenta-agosto-2026.xlsx`);
