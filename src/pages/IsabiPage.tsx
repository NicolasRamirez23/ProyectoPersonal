import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCopy, FileSearch, Loader2, Plus, Save, UploadCloud } from 'lucide-react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAlerts } from '../components/AlertProvider';
import { notaryInboxApi } from '../services/notaryInbox';
import { isabiApi } from '../services/isabi';
import type { IsabiData, IsabiDocumentDraft, IsabiRecord } from '../types/isabi';

type Field = { key: string; label: string; type?: 'text' | 'date' | 'number' | 'textarea' | 'select'; options?: string[]; wide?: boolean };
type Section = { title: string; subtitle: string; fields: Field[] };
const sections: Section[] = [
  { title: '1. Identificación del trámite', subtitle: 'Datos catastrales y naturaleza de la adquisición.', fields: [
    { key: 'claveCatastral', label: 'Clave catastral' }, { key: 'folio', label: 'Folio del portal' }, { key: 'tipoPredio', label: 'Tipo', type: 'select', options: ['URBANO','SUBURBANO','RÚSTICO','ESPECIAL'] },
    { key: 'naturalezaActo', label: 'Naturaleza del acto o adquisición', wide: true }, { key: 'descripcionAdquisicion', label: 'Descripción', type: 'textarea', wide: true }, { key: 'actoTraslativo', label: 'Acto traslativo', wide: true },
  ]},
  { title: '2. Escritura y otorgamiento', subtitle: 'Información del instrumento que formaliza la operación.', fields: [
    { key: 'volumen', label: 'Volumen' }, { key: 'escrituraNumero', label: 'Escritura número' }, { key: 'fechaEscritura', label: 'Fecha de escritura', type: 'date' },
    { key: 'estadoEscritura', label: 'Estado' }, { key: 'municipioEscritura', label: 'Municipio' }, { key: 'lugarOtorgamiento', label: 'Lugar del otorgamiento' },
    { key: 'fechaOtorgamiento', label: 'Fecha del otorgamiento', type: 'date' }, { key: 'fechaFirma', label: 'Fecha de firma', type: 'date' }, { key: 'datosEnajenante', label: 'Datos de identificación del enajenante', type: 'textarea', wide: true },
  ]},
  { title: '3. Adquiriente y datos fiscales', subtitle: 'Información personal, fiscal y de facturación.', fields: [
    { key: 'rfc', label: 'RFC' }, { key: 'personaTipo', label: 'Tipo de persona', type: 'select', options: ['FÍSICA','MORAL'] }, { key: 'usoCfdi', label: 'Uso CFDI' },
    { key: 'regimenFiscal', label: 'Régimen fiscal', wide: true }, { key: 'nombres', label: 'Nombre(s)' }, { key: 'apellidoPaterno', label: 'Apellido paterno' }, { key: 'apellidoMaterno', label: 'Apellido materno' },
    { key: 'codigoPostalFiscal', label: 'Código postal fiscal' }, { key: 'correoElectronico', label: 'Correo electrónico' }, { key: 'datosAdquiriente', label: 'Datos de identificación del adquiriente', type: 'textarea', wide: true },
  ]},
  { title: '4. Domicilio de notificación', subtitle: 'Domicilio que se capturará en el portal.', fields: [
    { key: 'notificacionEstado', label: 'Estado' }, { key: 'notificacionColonia', label: 'Colonia' }, { key: 'notificacionCp', label: 'Código postal' },
    { key: 'notificacionCalle', label: 'Calle', wide: true }, { key: 'notificacionExterior', label: 'Número exterior' }, { key: 'notificacionInterior', label: 'Número interior' },
  ]},
  { title: '5. Inmueble transmitido', subtitle: 'Descripción, antecedentes, superficies y valores.', fields: [
    { key: 'clasificacionInmueble', label: 'Clasificación del inmueble', wide: true }, { key: 'ubicacionLinderos', label: 'Ubicación, medidas y linderos', type: 'textarea', wide: true },
    { key: 'superficieTerreno', label: 'Superficie del terreno', type: 'number' }, { key: 'superficieConstruccion', label: 'Superficie de construcción', type: 'number' }, { key: 'antecedentesPropiedad', label: 'Procedencia o antecedentes de propiedad', type: 'textarea', wide: true },
    { key: 'folioReal', label: 'Folio real' }, { key: 'valorFiscal', label: 'Valor fiscal o catastral', type: 'number' }, { key: 'valorOperacion', label: 'Valor de operación', type: 'number' },
    { key: 'valorAvaluo', label: 'Valor de avalúo', type: 'number' }, { key: 'fechaAvaluo', label: 'Fecha del avalúo', type: 'date' }, { key: 'observaciones', label: 'Observaciones', type: 'textarea', wide: true },
  ]},
];
const documentBlocks = [
  { key: 'acto', title: 'Escritura y antecedentes', hint: 'Sube la escritura completa y, si existe, el antecedente de propiedad.', minimum: 1, types: ['Escritura','Antecedente de propiedad'] },
  { key: 'enajenante', title: 'Enajenante', hint: 'Identificación, CURP, constancia fiscal y comprobante de domicilio.', minimum: 2, types: ['INE','CURP','CSF','Comprobante de domicilio'] },
  { key: 'adquiriente', title: 'Adquiriente(s)', hint: 'Identificación y constancia fiscal de cada adquiriente. Puedes agregar varios archivos.', minimum: 2, types: ['INE','CURP','CSF','Comprobante de domicilio'] },
  { key: 'inmueble', title: 'Inmueble y valores', hint: 'Avalúo, predial, certificado de libertad de gravamen y plano o medidas.', minimum: 2, types: ['Avalúo','Predial','Certificado de libertad de gravamen','Plano o medidas'] },
  { key: 'otros', title: 'Anexos adicionales', hint: 'Carta de no propiedad, poderes, permisos u otros anexos aplicables.', minimum: 0, types: ['Poder','Carta de no propiedad','Otro'] },
];
const initialData: IsabiData = { tipoPredio: 'URBANO', naturalezaActo: 'I-A. COMPRAVENTA', personaTipo: 'FÍSICA', lugarOtorgamiento: 'LA PAZ, B.C.S.' };
const inferDocumentType = (block: typeof documentBlocks[number], name: string) => {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (normalized.includes('AVALUO')) return 'Avalúo';
  if (normalized.includes('PREDIAL')) return 'Predial';
  if (normalized.includes('GRAVAMEN') || normalized.includes('LIBERTAD')) return 'Certificado de libertad de gravamen';
  if (normalized.includes('PLANO') || normalized.includes('MEDIDA') || normalized.includes('LINDERO')) return 'Plano o medidas';
  if (normalized.includes('ANTECEDENTE')) return 'Antecedente de propiedad';
  if (normalized.includes('FISCAL') || normalized.includes('CSF') || normalized.includes('RFC')) return 'CSF';
  if (normalized.includes('DOMICILIO') || normalized.includes('RECIBO')) return 'Comprobante de domicilio';
  if (normalized.includes('CURP')) return 'CURP';
  if (normalized.includes('INE') || normalized.includes('IDENTIFICACION')) return 'INE';
  return block.types[0] || 'Otro';
};

const normalizeExtracted = (raw: Record<string, unknown>): Record<string, string> => {
  const string = (key: string) => typeof raw[key] === 'string' ? String(raw[key]).trim() : '';
  const fullName = [string('nombres'), string('apellidoPaterno'), string('apellidoMaterno')].filter(Boolean).join(' ');
  return {
    nombres: string('nombres') || string('nombre'), apellidoPaterno: string('apellidoPaterno'), apellidoMaterno: string('apellidoMaterno'), rfc: string('rfc'), regimenFiscal: string('regimenFiscal'), codigoPostalFiscal: string('codigoPostal'),
    datosAdquiriente: fullName, escrituraNumero: string('numeroInstrumento'), volumen: string('volumen'), fechaEscritura: string('fechaInstrumento'), lugarOtorgamiento: string('lugarOtorgamiento'),
    claveCatastral: string('claveCatastral'), folioReal: string('folioReal'), ubicacionLinderos: string('ubicacionLinderos') || string('medidasLinderos'), superficieTerreno: string('superficieTerreno'), superficieConstruccion: string('superficieConstruccion'),
    valorFiscal: string('valorFiscal'), valorOperacion: string('valorOperacion'), valorAvaluo: string('valorAvaluo'), fechaAvaluo: string('fechaAvaluo'), antecedentesPropiedad: string('antecedentesPropiedad'), clasificacionInmueble: string('clasificacionInmueble'),
    notificacionCalle: string('calle'), notificacionExterior: string('numeroExterior'), notificacionInterior: string('numeroInterior'), notificacionColonia: string('colonia'), notificacionEstado: string('estado'), notificacionCp: string('codigoPostal'), correoElectronico: string('correoElectronico'),
  };
};

export function IsabiPage() {
  const [data, setData] = useState<IsabiData>(initialData);
  const [documents, setDocuments] = useState<IsabiDocumentDraft[]>([]);
  const [records, setRecords] = useState<IsabiRecord[]>([]);
  const [processing, setProcessing] = useState('');
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState('');
  const { notify } = useAlerts();
  useEffect(() => { isabiApi.list().then(setRecords).catch(() => undefined); }, []);
  const setValue = (key: string, value: string | boolean) => setData((current) => ({ ...current, [key]: typeof value === 'string' ? value.toUpperCase() : value }));
  const counts = useMemo(() => Object.fromEntries(documentBlocks.map((block) => [block.key, documents.filter((document) => document.block === block.key).length])), [documents]);

  const analyzeFiles = async (block: typeof documentBlocks[number], files: FileList | null) => {
    if (!files?.length) return; setProcessing(block.key);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 15 * 1024 * 1024) throw new Error(`${file.name} supera 15 MB.`);
        const expectedType = inferDocumentType(block, file.name);
        const result = await notaryInboxApi.analyzeDraftWithAi(file, expectedType, setProgress);
        const normalized = normalizeExtracted(result.data as Record<string, unknown>);
        setData((current) => { const next = { ...current }; for (const [key, value] of Object.entries(normalized)) if (value && !String(next[key] || '').trim()) next[key] = value.toUpperCase(); return next; });
        setDocuments((current) => [...current, { block: block.key, expectedType: result.type || expectedType || 'Otro', file, extractedData: result.data as Record<string, unknown>, confidence: result.confidence, warnings: result.warnings || [] }]);
      }
      notify('success', 'Documentos analizados', 'Los datos encontrados se colocaron en campos vacíos. Revisa la información antes de guardar.');
    } catch (error) { notify('error', 'No se pudo analizar', error instanceof Error ? error.message : 'Intenta nuevamente.'); }
    finally { setProcessing(''); setProgress(''); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const missing = documentBlocks.filter((block) => block.minimum > (counts[block.key] || 0));
    if (missing.length) return notify('warning', 'Faltan documentos', `Completa los bloques: ${missing.map((block) => block.title).join(', ')}.`);
    setSaving(true);
    try { const saved = await isabiApi.save({ status: 'BORRADOR', data }, documents); notify('success', 'Expediente ISABI guardado', `Se creó ${saved.folioInterno}.`); setData(initialData); setDocuments([]); setRecords(await isabiApi.list()); }
    catch (error) { notify('error', 'No se pudo guardar', error instanceof Error ? error.message : 'Intenta nuevamente.'); }
    finally { setSaving(false); }
  };
  const copyForPortal = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify({ version: 1, type: 'avtech-isabi', data })); notify('success', 'Datos copiados', 'Abre la extensión AvTech ISABI en el portal y pega el contenido.'); }
    catch { notify('error', 'No se pudo copiar', 'El navegador bloqueó el portapapeles. Revisa los permisos del sitio.'); }
  };

  return <form onSubmit={submit} className="space-y-6">
    <div><p className="text-sm font-bold uppercase tracking-wider text-blue-600">Notaría · Registro Público</p><h1 className="mt-1 text-3xl font-black">Expediente ISABI</h1><p className="mt-2 max-w-3xl text-sm text-slate-500">Carga los documentos de la operación, revisa los datos extraídos y conserva un expediente listo para trasladarlo al portal del impuesto.</p></div>
    <section className="rounded-2xl border bg-white p-6 shadow-sm"><div className="mb-5 flex items-center gap-3"><UploadCloud className="h-6 w-6 text-blue-600"/><div><h2 className="text-xl font-bold">Documentos fuente</h2><p className="text-sm text-slate-500">El sistema admite PDF, JPG, PNG y WEBP. No sustituye la revisión jurídica.</p></div></div><div className="grid gap-4 lg:grid-cols-2">{documentBlocks.map((block) => <label key={block.key} className="cursor-pointer rounded-xl border border-dashed border-slate-300 p-4 transition hover:border-blue-400 hover:bg-blue-50/30"><div className="flex justify-between gap-3"><div><p className="font-bold">{block.title}</p><p className="mt-1 text-xs leading-relaxed text-slate-500">{block.hint}</p><p className="mt-2 text-xs font-semibold text-blue-600">{block.minimum ? `Mínimo sugerido: ${block.minimum}` : 'Opcional'} · Cargados: {counts[block.key] || 0}</p></div>{processing === block.key ? <Loader2 className="h-5 w-5 animate-spin text-blue-600"/> : (counts[block.key] || 0) >= block.minimum && block.minimum > 0 ? <CheckCircle2 className="h-5 w-5 text-emerald-600"/> : <Plus className="h-5 w-5 text-slate-400"/>}</div><input className="hidden" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={!!processing} onChange={(event) => { void analyzeFiles(block, event.target.files); event.target.value = ''; }}/></label>)}</div>{progress && <p className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">{progress}</p>} {documents.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{documents.map((document, index) => <span key={`${document.file.name}-${index}`} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">{document.file.name} · {document.confidence}%</span>)}</div>}</section>
    {sections.map((section) => <section key={section.title} className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">{section.title}</h2><p className="mt-1 text-sm text-slate-500">{section.subtitle}</p><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{section.fields.map((field) => <div key={field.key} className={field.wide ? 'md:col-span-2 xl:col-span-3' : ''}>{field.type === 'textarea' ? <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">{field.label}<textarea rows={3} className="rounded-md border px-3 py-2 text-sm uppercase outline-none focus:ring-2 focus:ring-blue-500" value={String(data[field.key] || '')} onChange={(event) => setValue(field.key, event.target.value)}/></label> : field.type === 'select' ? <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">{field.label}<select className="h-10 rounded-md border bg-white px-3 text-sm" value={String(data[field.key] || '')} onChange={(event) => setValue(field.key, event.target.value)}><option value="">SELECCIONAR</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select></label> : <Input label={field.label} type={field.type || 'text'} step={field.type === 'number' ? '0.01' : undefined} value={String(data[field.key] || '')} onChange={(event) => setValue(field.key, event.target.value)}/>}</div>)}</div></section>)}
    <div className="sticky bottom-4 flex flex-wrap justify-end gap-3 rounded-2xl border bg-white/95 p-4 shadow-xl backdrop-blur"><Button type="button" variant="outline" onClick={() => void copyForPortal()} leftIcon={<ClipboardCopy className="h-4 w-4"/>}>Copiar para portal</Button><Button type="submit" isLoading={saving} leftIcon={<Save className="h-4 w-4"/>}>Guardar expediente ISABI</Button></div>
    {records.length > 0 && <section className="rounded-2xl border bg-white p-6 shadow-sm"><div className="flex items-center gap-2"><FileSearch className="h-5 w-5 text-slate-500"/><h2 className="font-bold">Expedientes recientes</h2></div><div className="mt-4 divide-y">{records.slice(0, 5).map((record) => <div key={record.id} className="flex justify-between py-3 text-sm"><span className="font-bold">{record.folioInterno}</span><span className="text-slate-500">{String(record.data.claveCatastral || 'SIN CLAVE CATASTRAL')}</span></div>)}</div></section>}
  </form>;
}
