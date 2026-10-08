import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import JSZip from "jszip";
import type { NotaryExtractedData } from "../types/notaryProcess";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
export interface LocalDocumentAnalysis {
  text: string;
  type: string;
  role: string;
  confidence: number;
  data: NotaryExtractedData;
}
const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const normalized = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

async function renderPdfPage(page: any) {
  const viewport = page.getViewport({ scale: 3 });
  const canvas = window.document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo preparar la página para OCR.");
  await page.render({ canvasContext: context, viewport, canvas }).promise;
  return canvas;
}

async function pdfText(file: File, progress?: (message: string) => void) {
  const pdf = await getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  }).promise;
  const pages: string[] = [];
  for (
    let pageNumber = 1;
    pageNumber <= Math.min(pdf.numPages, 15);
    pageNumber += 1
  ) {
    progress?.(`Leyendo texto de la página ${pageNumber}…`);
    const content = await (await pdf.getPage(pageNumber)).getTextContent();
    pages.push(content.items.map((item: any) => item.str || "").join(" "));
  }
  const directText = clean(pages.join("\n"));
  if (directText.length >= 80) return directText;
  const { createWorker } = await import("tesseract.js");
  progress?.("El PDF parece escaneado; preparando OCR local…");
  const worker = await createWorker("spa");
  try {
    const recognized: string[] = [];
    for (
      let pageNumber = 1;
      pageNumber <= Math.min(pdf.numPages, 5);
      pageNumber += 1
    ) {
      progress?.(`Aplicando OCR local a la página ${pageNumber}…`);
      const canvas = await renderPdfPage(await pdf.getPage(pageNumber));
      const original = (await worker.recognize(canvas)).data.text;
      const enhanced = window.document.createElement("canvas");
      enhanced.width = canvas.width;
      enhanced.height = canvas.height;
      const context = enhanced.getContext("2d");
      if (context) {
        context.filter = "grayscale(1) contrast(1.8)";
        context.drawImage(canvas, 0, 0);
      }
      const contrasted = context
        ? (await worker.recognize(enhanced)).data.text
        : "";
      const score = (value: string) =>
        [
          "NOMBRE",
          "DOMICILIO",
          "CLAVE DE ELECTOR",
          "CURP",
          "FECHA DE NACIMIENTO",
          "VIGENCIA",
          "IDMEX",
        ].filter((label) => normalized(value).includes(label)).length *
          10 +
        (normalized(value).match(/\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/)
          ? 30
          : 0);
      let best = score(contrasted) > score(original) ? contrasted : original;
      if (score(best) < 80) {
        progress?.(`Buscando credenciales dentro de la página ${pageNumber}…`);
        const focused = window.document.createElement("canvas");
        focused.width = canvas.width;
        focused.height = Math.round(canvas.height * 0.52);
        const focusedContext = focused.getContext("2d");
        if (focusedContext) {
          focusedContext.filter = "grayscale(1) contrast(1.9)";
          focusedContext.drawImage(
            canvas,
            0,
            Math.round(canvas.height * 0.45),
            canvas.width,
            focused.height,
            0,
            0,
            focused.width,
            focused.height,
          );
          const focusedText = (await worker.recognize(focused)).data.text;
          if (score(focusedText) > 0) best = `${best}\n${focusedText}`;
        }
      }
      recognized.push(best);
    }
    return recognized
      .join("\n")
      .split(/\r?\n/)
      .map(clean)
      .filter(Boolean)
      .join("\n");
  } finally {
    await worker.terminate();
  }
}

async function docxText(file: File) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = await zip.file("word/document.xml")?.async("text");
  if (!xml) return "";
  const parsed = new DOMParser().parseFromString(xml, "application/xml");
  return clean(
    [...parsed.getElementsByTagNameNS("*", "t")]
      .map((node) => node.textContent || "")
      .join(" "),
  );
}

async function ocrImage(file: File, progress?: (message: string) => void) {
  const { createWorker } = await import("tesseract.js");
  progress?.("Preparando OCR local…");
  const worker = await createWorker("spa");
  try {
    progress?.("Leyendo el documento dentro de este navegador…");
    const original = (await worker.recognize(file)).data.text;
    progress?.("Mejorando contraste para una segunda lectura…");
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(2.2, 2600 / Math.max(bitmap.width, bitmap.height));
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return original.trim();
    context.filter = "grayscale(1) contrast(1.75)";
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const enhanced = (await worker.recognize(canvas)).data.text;
    const score = (value: string) =>
      [
        "NOMBRE",
        "DOMICILIO",
        "CLAVE DE ELECTOR",
        "CURP",
        "FECHA DE NACIMIENTO",
        "VIGENCIA",
      ].filter((label) => normalized(value).includes(label)).length *
        10 +
      (normalized(value).match(/\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/)
        ? 25
        : 0);
    const best = score(enhanced) > score(original) ? enhanced : original;
    return best.split(/\r?\n/).map(clean).filter(Boolean).join("\n");
  } finally {
    await worker.terminate();
  }
}

function classify(text: string, fileName: string) {
  const value = normalized(`${fileName} ${text}`);
  const rules: Array<[string, string[]]> = [
    [
      "INE",
      [
        "INSTITUTO NACIONAL ELECTORAL",
        "CREDENCIAL PARA VOTAR",
        "CLAVE DE ELECTOR",
      ],
    ],
    [
      "CSF",
      [
        "CONSTANCIA DE SITUACION FISCAL",
        "REGISTRO FEDERAL DE CONTRIBUYENTES",
        "REGIMEN FISCAL",
      ],
    ],
    ["CURP", ["CLAVE UNICA DE REGISTRO DE POBLACION", "CURP"]],
    [
      "Acta de defunción",
      [
        "ACTA DE DEFUNCION",
        "DATOS DE LA DEFUNCION",
        "DATOS DE LA PERSONA FALLECIDA",
        "DEFUNCION",
      ],
    ],
    ["Acta de matrimonio", ["ACTA DE MATRIMONIO", "CONTRAYENTES"]],
    [
      "Acta de nacimiento",
      ["ACTA DE NACIMIENTO", "DATOS DE LA PERSONA REGISTRADA"],
    ],
    ["Testamento", ["TESTAMENTO", "HEREDERO", "LEGATARIO", "ALBACEA"]],
    ["Poder", ["PODER GENERAL", "PODER NOTARIAL", "APODERADO", "PODERDANTE"]],
    ["Escritura", ["ESCRITURA PUBLICA", "INSTRUMENTO NOTARIAL", "COMPRAVENTA"]],
    [
      "Comprobante de domicilio",
      ["COMISION FEDERAL DE ELECTRICIDAD", "ESTADO DE CUENTA", "TOTAL A PAGAR"],
    ],
  ];
  const match = rules
    .map(([type, keys]) => ({
      type,
      score: keys.filter((key) => value.includes(key)).length,
      total: keys.length,
    }))
    .sort((a, b) => b.score - a.score)[0];
  return match?.score
    ? {
        type: match.type,
        confidence: Math.min(98, 55 + (match.score / match.total) * 40),
      }
    : { type: "Otro", confidence: 25 };
}

function between(text: string, label: string, nextLabels: string[]) {
  const next = nextLabels.length ? `(?=${nextLabels.join("|")}|$)` : "$";
  return clean(
    text.match(new RegExp(`${label}\\s*:?\\s*(.*?)\\s*${next}`, "i"))?.[1] ||
      "",
  );
}

function firstBetween(text: string, labels: string[], nextLabels: string[]) {
  for (const label of labels) {
    const value = between(text, label, nextLabels);
    if (value) return value;
  }
  return "";
}

function isoDate(value: string) {
  const numeric = value.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/);
  if (numeric)
    return `${numeric[3]}-${numeric[2].padStart(2, "0")}-${numeric[1].padStart(2, "0")}`;
  const months: Record<string, string> = {
    ENERO: "01",
    FEBRERO: "02",
    MARZO: "03",
    ABRIL: "04",
    MAYO: "05",
    JUNIO: "06",
    JULIO: "07",
    AGOSTO: "08",
    SEPTIEMBRE: "09",
    SETIEMBRE: "09",
    OCTUBRE: "10",
    NOVIEMBRE: "11",
    DICIEMBRE: "12",
  };
  const written = normalized(value).match(
    /\b(\d{1,2})\s+DE\s+([A-Z]+)\s+DE\s+(\d{4})\b/,
  );
  return written && months[written[2]]
    ? `${written[3]}-${months[written[2]]}-${written[1].padStart(2, "0")}`
    : clean(value);
}

function deathCertificateData(text: string) {
  const personSection = firstBetween(
    text,
    [
      "DATOS DE LA PERSONA FALLECIDA",
      "DATOS DEL FINADO",
      "DATOS DEL FALLECIDO",
    ],
    ["DATOS DE LA DEFUNCI[OÓ]N", "DATOS DEL FALLECIMIENTO", "DEFUNCI[OÓ]N"],
  );
  const deathSection = firstBetween(
    text,
    ["DATOS DE LA DEFUNCI[OÓ]N", "DATOS DEL FALLECIMIENTO"],
    [
      "DATOS DE LOS PADRES",
      "DATOS DEL DECLARANTE",
      "DATOS DE REGISTRO",
      "CERTIFICADO",
    ],
  );
  const registrationSection = firstBetween(
    text,
    ["DATOS DE REGISTRO", "DATOS DEL ACTA"],
    ["ANOTACIONES", "CADENA DIGITAL", "FIRMA ELECTR[OÓ]NICA"],
  );
  const source = personSection || text;
  const nextName = [
    "Primer Apellido",
    "Apellido Paterno",
    "Segundo Apellido",
    "Apellido Materno",
    "CURP",
    "Sexo",
  ];
  const nombres = firstBetween(
    source,
    ["Nombre\\s*\\(s\\)", "Nombres?"],
    nextName,
  );
  const apellidoPaterno = firstBetween(
    source,
    ["Primer Apellido", "Apellido Paterno"],
    ["Segundo Apellido", "Apellido Materno", "CURP", "Sexo"],
  );
  const apellidoMaterno = firstBetween(
    source,
    ["Segundo Apellido", "Apellido Materno"],
    ["CURP", "Sexo", "Fecha de Nacimiento"],
  );
  const nombre = clean(
    [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(" "),
  );
  const pick = (scope: string, labels: string[], next: string[]) =>
    firstBetween(scope || text, labels, next);
  const fechaNacimientoRaw = pick(
    source,
    ["Fecha de Nacimiento"],
    ["Lugar de Nacimiento", "Nacionalidad", "Sexo", "Estado Civil"],
  );
  const fechaDefuncionRaw = pick(
    deathSection,
    ["Fecha de Defunci[oó]n", "Fecha del Fallecimiento"],
    ["Hora de Defunci[oó]n", "Hora del Fallecimiento", "Lugar de Defunci[oó]n"],
  );
  return {
    nombre,
    nombres,
    apellidoPaterno,
    apellidoMaterno,
    curp:
      normalized(source).match(
        /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/,
      )?.[0] || "",
    sexo: pick(
      source,
      ["Sexo"],
      ["Fecha de Nacimiento", "Nacionalidad", "Estado Civil"],
    ),
    nacionalidad: pick(
      source,
      ["Nacionalidad"],
      ["Estado Civil", "Fecha de Nacimiento", "Domicilio"],
    ),
    fechaNacimiento: isoDate(fechaNacimientoRaw),
    estadoCivil: pick(
      source,
      ["Estado Civil"],
      ["Nacionalidad", "Domicilio", "Nombre del C[oó]nyuge"],
    ),
    conyuge: pick(
      text,
      ["Nombre del C[oó]nyuge", "C[oó]nyuge"],
      [
        "Datos de los Padres",
        "Nombre del Padre",
        "Nombre de la Madre",
        "Declarante",
      ],
    ),
    fechaDefuncion: isoDate(fechaDefuncionRaw),
    horaDefuncion: pick(
      deathSection,
      ["Hora de Defunci[oó]n", "Hora del Fallecimiento"],
      ["Lugar de Defunci[oó]n", "Lugar del Fallecimiento", "Causa"],
    ),
    lugarDefuncion: pick(
      deathSection,
      ["Lugar de Defunci[oó]n", "Lugar del Fallecimiento"],
      ["Causa de la Defunci[oó]n", "Domicilio", "Certificado"],
    ),
    causaDefuncion: pick(
      deathSection,
      ["Causa de la Defunci[oó]n", "Causa del Fallecimiento"],
      ["Certificado", "M[eé]dico", "Datos de los Padres"],
    ),
    nombrePadre: pick(
      text,
      ["Nombre del Padre", "Padre"],
      ["Nombre de la Madre", "Madre", "Datos del Declarante"],
    ),
    nombreMadre: pick(
      text,
      ["Nombre de la Madre", "Madre"],
      ["Datos del Declarante", "Declarante", "Datos de Registro"],
    ),
    declarante: pick(
      text,
      ["Nombre del Declarante", "Declarante"],
      ["Parentesco", "Datos de Registro", "Oficial[ií]a"],
    ),
    oficialia: pick(
      registrationSection,
      ["Oficial[ií]a"],
      ["Libro", "N[uú]mero de Acta", "Acta"],
    ),
    libro: pick(
      registrationSection,
      ["Libro"],
      ["N[uú]mero de Acta", "Acta", "Fecha de Registro"],
    ),
    numeroActa: pick(
      registrationSection,
      ["N[uú]mero de Acta", "Acta N[uú]mero"],
      ["Fecha de Registro", "Municipio", "Entidad"],
    ),
    fechaRegistro: isoDate(
      pick(
        registrationSection,
        ["Fecha de Registro"],
        ["Municipio", "Entidad", "Oficial[ií]a"],
      ),
    ),
    municipioRegistro: pick(
      registrationSection,
      ["Municipio de Registro", "Municipio"],
      ["Entidad de Registro", "Entidad Federativa", "Estado"],
    ),
    entidadRegistro: pick(
      registrationSection,
      ["Entidad de Registro", "Entidad Federativa", "Estado"],
      ["Municipio", "Oficial[ií]a", "Libro"],
    ),
  };
}

function testamentData(text: string) {
  const upper = normalized(text);
  const instrument =
    upper.match(
      /(?:INSTRUMENTO|ESCRITURA)\s+(?:PUBLICA\s+)?(?:NUMERO|NO\.?|N[ÚU]M\.?)[\s:#-]*([\d,.]+)/,
    )?.[1] || "";
  const volume =
    upper.match(
      /(?:VOLUMEN|LIBRO)\s+(?:NUMERO|NO\.?|N[ÚU]M\.?)?[\s:#-]*([\d,.]+)/,
    )?.[1] || "";
  const dateMatch = text.match(
    /(?:FECHA|OTORGAD[OA]\s+EL|A\s+LOS?)\s*[:\-]?\s*((?:\d{1,2}[\/-]\d{1,2}[\/-]\d{4})|(?:\d{1,2}\s+DE\s+[A-ZÁÉÍÓÚÜÑ]+\s+DE\s+\d{4}))/i,
  );
  const notary = firstBetween(
    text,
    ["(?:ANTE LA FE DEL|NOTARIO(?: P[ÚU]BLICO)?)"],
    [
      "NOTAR[IÍ]A",
      "N[ÚU]MERO",
      "NUMERO",
      "CON EJERCICIO",
      "CON RESIDENCIA",
      "EN",
    ],
  );
  const number =
    upper.match(
      /NOTAR[IÍ]A\s+(?:P[ÚU]BLICA\s+)?(?:N[ÚU]MERO|NO\.?)\s*([A-Z0-9]+)/,
    )?.[1] || "";
  const place = firstBetween(
    text,
    ["(?:CON EJERCICIO|CON RESIDENCIA|OTORGADO)\s+EN"],
    ["DE FECHA", "A LOS", "EL D[IÍ]A", "ANTE"],
  );
  const heirsSection = firstBetween(
    text,
    ["INSTITUYE?\s+(?:COMO\s+)?HEREDER", "HEREDEROS?"],
    ["LEGADOS?", "ALBACEA", "CL[ÁA]USULA", "TESTIGOS?", "REVOC"],
  );
  const herederos = heirsSection
    .split(/,|;|\s+Y\s+/i)
    .map(clean)
    .filter((value) => value.length >= 5 && value.length <= 100)
    .slice(0, 12);
  const albacea = firstBetween(
    text,
    ["(?:NOMBRA|DESIGNA|INSTITUYE)\s+(?:COMO\s+)?ALBACEA", "ALBACEA\s*:?"],
    ["SUSTITUT", "CL[ÁA]USULA", "HEREDER", "LEGAD", "TESTIG"],
  );
  const testatorMatch = text.match(
    /(?:TESTAMENTO\s+(?:P[ÚU]BLICO\s+ABIERTO\s+)?(?:QUE\s+)?OTORGA|TESTADOR(?:A)?\s*:?|OTORGADO\s+POR)\s+([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s]{5,100}?)(?=,|\s+ANTE|\s+QUIEN|\s+MANIF)/i,
  );
  return {
    nombre: clean(testatorMatch?.[1] || ""),
    numeroInstrumento: clean(instrument),
    volumen: clean(volume),
    fechaInstrumento: dateMatch ? isoDate(dateMatch[1]) : "",
    notario: clean(notary),
    numeroNotaria: clean(number),
    lugarOtorgamiento: clean(place),
    herederos,
    albacea: clean(albacea),
  };
}

function csfData(text: string) {
  const nombres = between(text, "Nombre\\s*\\(s\\)", ["Primer Apellido"]);
  const paterno = between(text, "Primer Apellido", ["Segundo Apellido"]);
  const materno = between(text, "Segundo Apellido", [
    "Fecha inicio de operaciones",
  ]);
  const postalCode =
    between(text, "C[oó]digo Postal", ["Tipo de Vialidad"]).match(
      /\d{5}/,
    )?.[0] || "";
  const streetType = between(text, "Tipo de Vialidad", ["Nombre de Vialidad"]);
  const street = between(text, "Nombre de Vialidad", ["N[uú]mero Exterior"]);
  const exterior = between(text, "N[uú]mero Exterior", [
    "N[uú]mero Interior",
    "Nombre de la Colonia",
  ]);
  const interior = between(text, "N[uú]mero Interior", [
    "Nombre de la Colonia",
  ]);
  const colony = between(text, "Nombre de la Colonia", [
    "Nombre de la Localidad",
  ]);
  const locality = between(text, "Nombre de la Localidad", [
    "Nombre del Municipio",
    "Nombre de Municipio",
    "Municipio o Demarcaci[oó]n Territorial",
  ]);
  const municipality = between(
    text,
    "(?:Nombre del Municipio o Demarcaci[oó]n Territorial|Municipio o Demarcaci[oó]n Territorial|Nombre del Municipio|Nombre de Municipio)",
    ["Nombre de la Entidad Federativa", "Entidad Federativa"],
  );
  const state = between(
    text,
    "(?:Nombre de la Entidad Federativa|Entidad Federativa)",
    ["Entre Calle", "Y Calle", "Actividades Econ[oó]micas"],
  );
  const domicilio = clean(
    [
      streetType,
      street,
      exterior && `No. ${exterior}`,
      interior && interior !== exterior ? `Int. ${interior}` : "",
      colony && `Col. ${colony}`,
      locality,
      municipality && municipality !== locality ? municipality : "",
      state,
      postalCode && `C.P. ${postalCode}`,
    ]
      .filter(Boolean)
      .join(", "),
  );
  const activitySection = between(text, "Actividades Econ[oó]micas", [
    "Reg[ií]menes",
  ]);
  const actividadesEconomicas = [
    ...activitySection.matchAll(
      /(?:^|\s)\d+\s+(.+?)\s+\d{1,3}(?:\.\d+)?\s+(\d{2}\/\d{2}\/\d{4})/g,
    ),
  ].map((match) => clean(`${match[1]} · desde ${match[2]}`));
  const regimeSection = between(text, "Reg[ií]menes", [
    "Obligaciones",
    "Sus datos personales",
    "Caracter[ií]sticas Fiscales",
  ]);
  const regimenes = [
    ...regimeSection.matchAll(
      /((?:R[eé]gimen|Sueldos|Personas|Incorporaci[oó]n|Actividades)[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s,().&-]{4,}?)\s+(\d{2}\/\d{2}\/\d{4})/g,
    ),
  ].map((match) => ({
    label: clean(`${match[1]} · desde ${match[2]}`),
    date: match[2],
  }));
  const toTime = (date: string) => {
    const [day, month, year] = date.split("/").map(Number);
    return new Date(year, month - 1, day).getTime();
  };
  regimenes.sort((a, b) => toTime(b.date) - toTime(a.date));
  const regimenesFiscales = regimenes.map(({ label }) => label);
  const idCif =
    normalized(text).match(/\bID\s*CIF\s*[:=]?\s*(\d{6,20})\b/)?.[1] || "";
  return {
    nombre: clean([nombres, paterno, materno].filter(Boolean).join(" ")),
    nombres,
    apellidoPaterno: paterno,
    apellidoMaterno: materno,
    domicilio,
    codigoPostal: postalCode,
    actividadesEconomicas,
    regimenesFiscales,
    regimenFiscal: regimenesFiscales[0] || "",
    idCif,
  };
}

function ineData(text: string) {
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const start = lines.findIndex((line) => /^N[O0]MBRE\b/i.test(line));
  const end = lines.findIndex(
    (line, index) => index > start && /^D[O0]MICILI[O0]\b/i.test(line),
  );
  const firstNameLine =
    start >= 0 ? clean(lines[start].replace(/^NOMBRE\s*[:\-]?\s*/i, "")) : "";
  let nameLines =
    start >= 0
      ? [
          firstNameLine,
          ...lines.slice(start + 1, end > start ? end : start + 4),
        ]
          .filter((line) => line && !/^(SEXO\b|H$|M$|DOMICILIO\b)/i.test(line))
          .map((line) => clean(line.replace(/\bSEXO\s*[HM]?\b.*$/i, "")))
          .filter(Boolean)
      : [];
  if (nameLines.length < 3) {
    const nameBlock =
      text.match(
        /N[O0]MBRE\s*[:\-]?\s*([\s\S]{5,100}?)(?=D[O0]MICILI[O0])/i,
      )?.[1] || "";
    const fallback = nameBlock
      .split(/\r?\n/)
      .map(clean)
      .filter((line) => line && !/SEXO/i);
    if (fallback.length >= 3) nameLines = fallback.slice(0, 4);
  }
  const upper = normalized(text);
  const mrzName = upper.match(
    /(?:^|\n)\s*([A-Z]+)<([A-Z]+)<<([A-Z<]+)(?:\n|$)/,
  );
  const apellidoPaterno = nameLines[0] || mrzName?.[1] || "";
  const apellidoMaterno = nameLines[1] || mrzName?.[2] || "";
  const nombres =
    nameLines.slice(2).join(" ") || mrzName?.[3]?.replace(/<+/g, " ") || "";
  const addressStart =
    end >= 0
      ? end
      : lines.findIndex((line) => /^D[O0]MICILI[O0]\b/i.test(line));
  const addressEnd = lines.findIndex(
    (line, index) => index > addressStart && /CLAVE DE ELECTOR/i.test(line),
  );
  const firstAddressLine =
    addressStart >= 0
      ? clean(lines[addressStart].replace(/^DOMICILIO\s*[:\-]?\s*/i, ""))
      : "";
  let domicilio =
    addressStart >= 0
      ? [
          firstAddressLine,
          ...lines.slice(
            addressStart + 1,
            addressEnd > addressStart ? addressEnd : addressStart + 4,
          ),
        ]
          .filter(Boolean)
          .join(", ")
      : "";
  if (!domicilio)
    domicilio = clean(
      text.match(
        /D[O0]MICILI[O0]\s*[:\-]?\s*([\s\S]{8,180}?)(?=CLAVE\s+DE\s+ELECTOR)/i,
      )?.[1] || "",
    ).replace(/\s*,\s*/g, ", ");
  const compactMrz = upper.replace(/[ \t]/g, "").replace(/O/g, "0");
  const flatMrz = upper.replace(/\s/g, "").replace(/O/g, "0");
  const mrzNumbers = flatMrz.match(/IDMEX(\d{9})\d?<+(\d{13})/);
  const ocr = mrzNumbers?.[2] || "";
  const cic = mrzNumbers?.[1] || "";
  const seccion =
    upper.match(/SECCI[O0]N\s*[:\-]?\s*(\d{3,5})/)?.[1] || ocr.slice(0, 4);
  const anioMatch = upper.match(
    /A[NÑ]O\s+DE\s+REGISTR[O0]\s*[:\-]?\s*(\d{4})(?:\s+(\d{2}))?/,
  );
  const anioRegistro = anioMatch
    ? [anioMatch[1], anioMatch[2]].filter(Boolean).join(" ")
    : "";
  const vigenciaMatch = upper.match(
    /VIGENCIA\s*[:\-]?\s*(\d{4})\s*[-–]?\s*(\d{4})/,
  );
  const vigencia = vigenciaMatch
    ? `${vigenciaMatch[1]}-${vigenciaMatch[2]}`
    : "";
  const mrzIdentity = compactMrz.match(/(?:^|\n)(\d{6})\d([HM])/);
  const mrzBirth = mrzIdentity
    ? `${Number(mrzIdentity[1].slice(0, 2)) <= new Date().getFullYear() % 100 ? "20" : "19"}${mrzIdentity[1].slice(0, 2)}-${mrzIdentity[1].slice(2, 4)}-${mrzIdentity[1].slice(4, 6)}`
    : "";
  const idmex =
    mrzNumbers?.[0] || flatMrz.match(/IDMEX[A-Z0-9<]{12,40}/)?.[0] || "";
  const numeroDocumento = flatMrz.match(/IDMEX([A-Z0-9]{6,20})</)?.[1] || "";
  return {
    nombres,
    apellidoPaterno,
    apellidoMaterno,
    nombre: clean(
      [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(" "),
    ),
    domicilio,
    seccion,
    anioRegistro,
    vigencia,
    sexo: mrzIdentity?.[2] || "",
    fechaNacimiento: mrzBirth,
    numeroDocumento,
    idmex,
    cic,
    ocr,
  };
}

function extract(text: string, indicatedType = ""): NotaryExtractedData {
  const upper = normalized(text);
  const curp =
    upper.match(/\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/)?.[0] || "";
  const rfc = upper.match(/\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/)?.[0] || "";
  const claveElector = upper.match(/\b[A-Z]{6}\d{8}[HM]\d{3}\b/)?.[0] || "";
  const century =
    curp && Number(curp.slice(4, 6)) <= new Date().getFullYear() % 100
      ? "20"
      : "19";
  const birth = curp
    ? `${century}${curp.slice(4, 6)}-${curp.slice(6, 8)}-${curp.slice(8, 10)}`
    : "";
  const isCsf =
    upper.includes("CONSTANCIA DE SITUACION FISCAL") ||
    upper.includes("DATOS DEL DOMICILIO REGISTRADO");
  const isIne =
    upper.includes("INSTITUTO NACIONAL ELECTORAL") ||
    upper.includes("CREDENCIAL PARA VOTAR");
  const isDeathCertificate =
    indicatedType === "Acta de defunción" ||
    upper.includes("ACTA DE DEFUNCION") ||
    upper.includes("DATOS DE LA PERSONA FALLECIDA");
  const isTestament =
    indicatedType === "Testamento" ||
    upper.includes("TESTAMENTO PUBLICO") ||
    upper.includes("TESTADOR");
  const csf = isCsf ? csfData(text) : { nombre: "", domicilio: "" };
  const ine = isIne ? ineData(text) : { nombre: "", domicilio: "" };
  const deathCertificate = isDeathCertificate ? deathCertificateData(text) : {};
  const testament = isTestament ? testamentData(text) : {};
  const nameMatch = text.match(
    /(?:NOMBRE(?:\s*\(S\))?|NOMBRE COMPLETO)\s*[:\-]?\s*([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s]{5,80})/i,
  );
  const addressMatch = text.match(
    /(?:DOMICILIO|DOMICILIO FISCAL)\s*[:\-]?\s*([^\n]{8,160})/i,
  );
  return {
    ...ine,
    ...csf,
    ...testament,
    ...deathCertificate,
    nombre:
      deathCertificate.nombre ||
      testament.nombre ||
      csf.nombre ||
      ine.nombre ||
      clean(nameMatch?.[1] || ""),
    curp: deathCertificate.curp || curp,
    rfc,
    domicilio: csf.domicilio || ine.domicilio || clean(addressMatch?.[1] || ""),
    fechaNacimiento:
      deathCertificate.fechaNacimiento || birth || ine.fechaNacimiento || "",
    sexo: deathCertificate.sexo || ine.sexo || (curp ? curp.charAt(10) : ""),
    claveElector,
  };
}

function detectRole(text: string) {
  const value = normalized(text);
  if (/\bVENDEDOR(A|ES)?\b|PARTE VENDEDORA/.test(value)) return "Vendedor";
  if (/\bCOMPRADOR(A|ES)?\b|PARTE COMPRADORA/.test(value)) return "Comprador";
  if (/\bAPODERADO(A)?\b/.test(value)) return "Apoderado";
  if (/\bPODERDANTE\b|\bMANDANTE\b/.test(value)) return "Poderdante";
  if (/\bALBACEA\b/.test(value)) return "Albacea";
  if (/\bHEREDERO(A|S)?\b/.test(value)) return "Heredero";
  if (/AUTOR DE LA SUCESION|DE CUJUS/.test(value))
    return "Autor de la sucesión";
  return "";
}

export async function sha256(file: File) {
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function analyzeNotaryDocument(
  file: File,
  progress?: (message: string) => void,
  expectedType = "",
): Promise<LocalDocumentAnalysis> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  let text = "";
  if (file.type === "application/pdf" || extension === "pdf") {
    progress?.("Leyendo texto del PDF localmente…");
    text = await pdfText(file, progress);
  } else if (file.type.startsWith("image/"))
    text = await ocrImage(file, progress);
  else if (extension === "docx") {
    progress?.("Leyendo el documento Word localmente…");
    text = await docxText(file);
  }
  const classification = expectedType
    ? { type: expectedType, confidence: 70 }
    : classify(text, file.name);
  return {
    text,
    type: classification.type,
    role: detectRole(text),
    confidence: classification.confidence,
    data: extract(text, classification.type),
  };
}
