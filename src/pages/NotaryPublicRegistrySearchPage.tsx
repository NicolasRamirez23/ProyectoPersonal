import { useEffect, useState, type ChangeEvent, type MouseEvent, type ReactNode } from 'react';
import { ArrowLeft, Download, FileCheck2, FileText, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Input } from '../components/Input';
import { useAlerts } from '../components/AlertProvider';
import { buildPublicRegistrySearchText, downloadBlob } from '../lib/notaryDocuments';
import { notaryDocumentsApi } from '../services/notaryDocuments';
import { notaryInboxApi } from '../services/notaryInbox';
import type { NotaryPublicRegistrySearchData, NotaryStoredDocument } from '../types/notary';

const today = new Date().toISOString().slice(0, 10);
const initialData: NotaryPublicRegistrySearchData = {
  place: 'La Paz, B.C.S.', issueDate: today,
  authorityName: 'LIC. ALEJANDRA OCHOA HIRALES', authorityTitle: 'DIRECTORA DEL REGISTRO PÚBLICO DE LA PROPIEDAD', authorityDepartment: 'Y DEL COMERCIO DE LA PAZ, B.C.S.',
  deceasedName: '', deceasedGender: 'F', heirNames: [],
  willInstrument: '', willInstrumentWords: '', willVolume: '', willVolumeWords: '', willDate: '', willNotaryName: '', willNotaryNumber: '', willPlace: 'La Paz, Baja California Sur',
  nationality: 'mexicana', birthCity: '', birthState: '', birthDate: '', maritalStatus: '', occupation: '', fullAddress: '', curp: '',
  fatherName: '', fatherDeceased: true, motherName: '', motherDeceased: true,
  signerName: 'LIC. ALEJANDRO DAVIS MONZÓN', signerTitle: 'NOTARIO PÚBLICO No. DOS',
};

export function NotaryPublicRegistrySearchPage() {
  const { notify } = useAlerts();
  const [data, setData] = useState(initialData); const [cases, setCases] = useState<any[]>([]); const [caseId, setCaseId] = useState('');
  const [processing, setProcessing] = useState(false); const [progress, setProgress] = useState(''); const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState<NotaryStoredDocument | null>(null); const [savedSnapshot, setSavedSnapshot] = useState('');
  const set = <K extends keyof NotaryPublicRegistrySearchData>(key: K, value: NotaryPublicRegistrySearchData[K]) => setData((current) => ({ ...current, [key]: value }));
  useEffect(() => { notaryInboxApi.cases().then((rows) => { setCases(rows); if (rows[0]) setCaseId(rows[0].id); }).catch((error) => notify('error', 'No se pudieron cargar los expedientes', error.message)); }, []);

  const applyDocumentData = (document: Awaited<ReturnType<typeof notaryInboxApi.list>>[number]) => {
    const found = document.extractedData;
    const birthplace = typeof found.lugarNacimiento === 'string' ? found.lugarNacimiento : '';
    setData((current) => ({ ...current,
      caseId: document.caseId || current.caseId, sourceDocumentId: document.id, sourceFileName: document.fileName,
      deceasedName: typeof found.nombre === 'string' ? found.nombre.toUpperCase() : current.deceasedName,
      deceasedGender: found.sexo === 'H' ? 'M' : found.sexo === 'M' ? 'F' : current.deceasedGender,
      heirNames: Array.isArray(found.herederos) ? found.herederos.map((value) => value.toUpperCase()) : current.heirNames,
      willInstrument: typeof found.numeroInstrumento === 'string' ? found.numeroInstrumento : current.willInstrument,
      willVolume: typeof found.volumen === 'string' ? found.volumen : current.willVolume,
      willDate: typeof found.fechaInstrumento === 'string' ? found.fechaInstrumento : current.willDate,
      willNotaryName: typeof found.notario === 'string' ? found.notario.toUpperCase() : current.willNotaryName,
      willNotaryNumber: typeof found.numeroNotaria === 'string' ? found.numeroNotaria : current.willNotaryNumber,
      willPlace: typeof found.lugarOtorgamiento === 'string' ? found.lugarOtorgamiento : current.willPlace,
      nationality: typeof found.nacionalidad === 'string' ? found.nacionalidad.toLowerCase() : current.nationality,
      birthCity: birthplace || current.birthCity, birthDate: typeof found.fechaNacimiento === 'string' ? found.fechaNacimiento : current.birthDate,
      maritalStatus: typeof found.estadoCivil === 'string' ? found.estadoCivil.toLowerCase() : current.maritalStatus,
      occupation: typeof found.ocupacion === 'string' ? found.ocupacion : current.occupation,
      fullAddress: typeof found.domicilio === 'string' ? found.domicilio : current.fullAddress,
      curp: typeof found.curp === 'string' ? found.curp : current.curp,
      fatherName: typeof found.nombrePadre === 'string' ? found.nombrePadre.toUpperCase() : current.fatherName,
      motherName: typeof found.nombreMadre === 'string' ? found.nombreMadre.toUpperCase() : current.motherName,
    }));
  };

  const retryAiAnalysis = async () => {
    if (!data.sourceDocumentId) return;
    setProcessing(true); setProgress('Reintentando análisis con IA…');
    try {
      await notaryInboxApi.analyzeWithAi(data.sourceDocumentId);
      const analyzed = (await notaryInboxApi.list()).find((item) => item.id === data.sourceDocumentId);
      if (analyzed) applyDocumentData(analyzed);
      notify('success', 'Testamento analizado', 'Actualizamos el formulario con los datos propuestos por la IA.');
    } catch (error) { notify('warning', 'El testamento sigue seguro', error instanceof Error ? error.message : 'El análisis de IA sigue pendiente.'); }
    finally { setProcessing(false); setProgress(''); }
  };

  const uploadTestament = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; const selectedCase = cases.find((item) => item.id === caseId);
    if (!file || !selectedCase) return;
    setProcessing(true);
    try {
      const document = await notaryInboxApi.upload({ id: selectedCase.id, clientId: selectedCase.cliente_id }, file, 'Testamento', setProgress);
      applyDocumentData(document);
      try {
        setProgress('Analizando el testamento con IA empresarial…'); await notaryInboxApi.analyzeWithAi(document.id);
        const analyzed = (await notaryInboxApi.list()).find((item) => item.id === document.id) || document;
        applyDocumentData(analyzed);
        notify('success', 'Testamento analizado', 'Los datos encontrados se colocaron como propuesta. Revísalos antes de generar el oficio.');
      } catch (error) {
        notify('warning', 'Testamento guardado · análisis pendiente', error instanceof Error ? error.message : 'Puedes reintentar el análisis sin volver a subir el archivo.');
      }
    } catch (error) { notify('error', 'No se pudo analizar el testamento', error instanceof Error ? error.message : 'Intenta nuevamente.'); }
    finally { setProcessing(false); setProgress(''); }
  };

  const submit = async (event: MouseEvent<HTMLButtonElement>, type: 'word' | 'pdf') => {
    event.preventDefault(); if (!event.currentTarget.form?.reportValidity()) return; setProcessing(true);
    try { const snapshot = JSON.stringify(data); const record = saved && savedSnapshot === snapshot ? saved : await notaryDocumentsApi.createPublicRegistrySearch(data); if (record !== saved) { setSaved(record); setSavedSnapshot(snapshot); } const blob = await notaryDocumentsApi.download(record, type); downloadBlob(blob, `${record.folio}-registro-publico.${type === 'word' ? 'docx' : 'pdf'}`); notify('success', `Oficio guardado · ${record.folio}`, 'Quedó archivado y relacionado con sus datos de origen.'); }
    catch (error) { notify('error', 'No se pudo generar el oficio', error instanceof Error ? error.message : 'Revisa los datos.'); } finally { setProcessing(false); }
  };

  return <form className="space-y-6">
    <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><Link to="/notaria" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-600"><ArrowLeft className="h-4 w-4"/>Volver a formatos</Link><h1 className="text-3xl font-bold">Búsqueda en Registro Público</h1><p className="mt-2 text-sm text-slate-500">Formato basado en el oficio proporcionado. Carga el testamento para proponer los datos y coteja antes de generar.</p>{saved ? <p className="mt-2 text-sm font-bold text-emerald-700">Guardado con folio {saved.folio}</p> : null}</div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setPreview((value) => !value)} className="inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-bold"><FileText className="h-4 w-4"/>{preview ? 'Ocultar vista' : 'Vista previa'}</button><button type="button" disabled={processing} onClick={(event) => void submit(event, 'pdf')} className="inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-bold"><Download className="h-4 w-4"/>PDF</button><button type="button" disabled={processing} onClick={(event) => void submit(event, 'word')} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white"><Download className="h-4 w-4"/>Word</button></div></header>
    <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5"><div className="grid gap-4 md:grid-cols-[1fr_auto]"><label className="text-sm font-bold text-blue-950">Expediente<select required value={caseId} onChange={(e) => setCaseId(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 font-normal"><option value="">Selecciona un expediente</option>{cases.map((item) => <option key={item.id} value={item.id}>{item.folio} · {item.titulo}</option>)}</select></label><label className={`flex h-11 cursor-pointer items-center justify-center gap-2 self-end rounded-xl bg-blue-600 px-5 text-sm font-bold text-white ${!caseId || processing ? 'pointer-events-none opacity-50' : ''}`}><Upload className="h-4 w-4"/>{processing ? 'Procesando…' : 'Subir testamento'}<input hidden type="file" accept=".pdf,.docx,image/jpeg,image/png,image/webp" onChange={(event) => void uploadTestament(event)}/></label></div>{progress ? <p className="mt-3 text-sm font-medium text-blue-700">{progress}</p> : null}{data.sourceFileName ? <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-sm text-emerald-700"><FileCheck2 className="h-4 w-4"/>{data.sourceFileName} guardado en el expediente</p><button type="button" disabled={processing} onClick={() => void retryAiAnalysis()} className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-50">Reintentar análisis IA</button></div> : null}</section>
    <Section title="Autoridad y fecha"><Grid><Input required label="Lugar" value={data.place} onChange={(e) => set('place', e.target.value)}/><Input required type="date" label="Fecha del oficio" value={data.issueDate} onChange={(e) => set('issueDate', e.target.value)}/><Input required label="Nombre de la autoridad" value={data.authorityName} onChange={(e) => set('authorityName', e.target.value.toUpperCase())}/><Input required label="Cargo" value={data.authorityTitle} onChange={(e) => set('authorityTitle', e.target.value.toUpperCase())}/><Input required label="Dependencia" value={data.authorityDepartment} onChange={(e) => set('authorityDepartment', e.target.value.toUpperCase())}/></Grid></Section>
    <Section title="Testamento y herederos"><Grid><Input required label="Nombre de la persona testadora" value={data.deceasedName} onChange={(e) => set('deceasedName', e.target.value.toUpperCase())}/><Select label="Sexo" value={data.deceasedGender} onChange={(value) => set('deceasedGender', value as 'M'|'F')}/><Input required label="Instrumento" value={data.willInstrument} onChange={(e) => set('willInstrument', e.target.value)}/><Input label="Instrumento con letra" value={data.willInstrumentWords} onChange={(e) => set('willInstrumentWords', e.target.value.toLowerCase())}/><Input required label="Volumen" value={data.willVolume} onChange={(e) => set('willVolume', e.target.value)}/><Input label="Volumen con letra" value={data.willVolumeWords} onChange={(e) => set('willVolumeWords', e.target.value.toLowerCase())}/><Input required type="date" label="Fecha del testamento" value={data.willDate} onChange={(e) => set('willDate', e.target.value)}/><Input required label="Notario autorizante" value={data.willNotaryName} onChange={(e) => set('willNotaryName', e.target.value.toUpperCase())}/><Input required label="Número de notaría" value={data.willNotaryNumber} onChange={(e) => set('willNotaryNumber', e.target.value)}/><Input required label="Lugar de otorgamiento" value={data.willPlace} onChange={(e) => set('willPlace', e.target.value)}/><label className="md:col-span-2 text-sm font-medium">Herederos, uno por renglón<textarea required rows={4} value={data.heirNames.join('\n')} onChange={(e) => set('heirNames', e.target.value.split('\n').map((value) => value.trim().toUpperCase()).filter(Boolean))} className="mt-1.5 w-full rounded-xl border p-3"/></label></Grid></Section>
    <Section title="Datos de la persona testadora"><Grid><Input required label="Nacionalidad" value={data.nationality} onChange={(e) => set('nationality', e.target.value.toLowerCase())}/><Input required label="Ciudad de nacimiento" value={data.birthCity} onChange={(e) => set('birthCity', e.target.value)}/><Input required label="Estado de nacimiento" value={data.birthState} onChange={(e) => set('birthState', e.target.value)}/><Input required type="date" label="Fecha de nacimiento" value={data.birthDate} onChange={(e) => set('birthDate', e.target.value)}/><Input required label="Estado civil" value={data.maritalStatus} onChange={(e) => set('maritalStatus', e.target.value.toLowerCase())}/><Input label="Ocupación" value={data.occupation} onChange={(e) => set('occupation', e.target.value)}/><Input required label="CURP" maxLength={18} value={data.curp} onChange={(e) => set('curp', e.target.value.toUpperCase())}/><Input required label="Último domicilio completo" containerClassName="md:col-span-2" value={data.fullAddress} onChange={(e) => set('fullAddress', e.target.value)}/><Input required label="Nombre del padre" value={data.fatherName} onChange={(e) => set('fatherName', e.target.value.toUpperCase())}/><Input required label="Nombre de la madre" value={data.motherName} onChange={(e) => set('motherName', e.target.value.toUpperCase())}/><Check label="Padre fallecido" checked={data.fatherDeceased} onChange={(value) => set('fatherDeceased', value)}/><Check label="Madre fallecida" checked={data.motherDeceased} onChange={(value) => set('motherDeceased', value)}/></Grid></Section>
    <Section title="Firma"><Grid><Input required label="Nombre del firmante" value={data.signerName} onChange={(e) => set('signerName', e.target.value.toUpperCase())}/><Input required label="Cargo" value={data.signerTitle} onChange={(e) => set('signerTitle', e.target.value.toUpperCase())}/></Grid></Section>
    {preview ? <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="font-bold">Vista previa del contenido</h2><p className="mt-4 whitespace-pre-wrap text-justify font-serif leading-8">{buildPublicRegistrySearchText(data)}</p></section> : null}
  </form>;
}

function Section({ title, children }: { title: string; children: ReactNode }) { return <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="mb-5 text-lg font-bold">{title}</h2>{children}</section>; }
function Grid({ children }: { children: ReactNode }) { return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>; }
function Select({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="text-sm font-medium">{label}<select className="mt-1.5 h-10 w-full rounded-md border bg-white px-3" value={value} onChange={(e) => onChange(e.target.value)}><option value="F">Femenino</option><option value="M">Masculino</option></select></label>; }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center gap-2 self-end rounded-xl border bg-slate-50 px-4 py-3 text-sm font-medium"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-blue-600"/>{label}</label>; }
