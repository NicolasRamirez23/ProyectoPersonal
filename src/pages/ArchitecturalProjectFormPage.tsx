import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, DollarSign, Download, Eye, File, FileCheck2, FileText, Landmark, Loader2, Paperclip, Plus, ReceiptText, Save, Trash2, Upload, X } from 'lucide-react';
import { architecturalProjectsService } from '../services/architecturalProjects';
import { ArchitecturalAttachment, ArchitecturalCharge, ArchitecturalProjectStatus } from '../types/architecture';
import { formatCurrency } from '../lib/utils';
import { catalogsService } from '../services/catalogs';
import { generateArchitecturalInvoice, generateArchitecturalReceipt } from '../lib/architecturalDocuments';
import { extractFiscalCertificate } from '../lib/fiscalCertificate';

const newCharge = (): ArchitecturalCharge => ({
  id: crypto.randomUUID(), concept: '', description: '', amount: 0, status: 'pendiente', attachments: [],
});

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export function ArchitecturalProjectFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [projectName, setProjectName] = useState('');
  const [constructionType, setConstructionType] = useState('Casa habitación');
  const [projectType, setProjectType] = useState('Proyecto nuevo');
  const [location, setLocation] = useState('');
  const [invoiceRequested, setInvoiceRequested] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [taxAddress, setTaxAddress] = useState('');
  const [taxPostalCode, setTaxPostalCode] = useState('');
  const [taxRegime, setTaxRegime] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [cfdiUse, setCfdiUse] = useState('');
  const [extractingCertificate, setExtractingCertificate] = useState(false);
  const [certificateProgress, setCertificateProgress] = useState('');
  const [certificateMessage, setCertificateMessage] = useState('');
  const [detectedTaxRegimes, setDetectedTaxRegimes] = useState<string[]>([]);
  const [status, setStatus] = useState<ArchitecturalProjectStatus>('cotizacion');
  const [notes, setNotes] = useState('');
  const [charges, setCharges] = useState<ArchitecturalCharge[]>([newCharge()]);
  const [fileError, setFileError] = useState('');
  const [previewAttachment, setPreviewAttachment] = useState<ArchitecturalAttachment | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [constructionOptions, setConstructionOptions] = useState(['Casa habitación', 'Departamento', 'Edificio', 'Local comercial', 'Oficina', 'Remodelación', 'Ampliación', 'Otro']);
  const [projectOptions, setProjectOptions] = useState(['Proyecto nuevo', 'Remodelación', 'Ampliación', 'Regularización', 'Diseño de interiores', 'Levantamiento', 'Otro']);
  const [chargeConceptOptions, setChargeConceptOptions] = useState<string[]>([]);
  const [cfdiUseOptions, setCfdiUseOptions] = useState<string[]>([]);
  const [taxRegimeOptions, setTaxRegimeOptions] = useState<string[]>([]);

  useEffect(() => {
    void Promise.all([
      catalogsService.getActiveValues('tipos_construccion'),
      catalogsService.getActiveValues('tipos_proyecto'),
      catalogsService.getActiveValues('conceptos_cobro'),
      catalogsService.getActiveValues('usos_cfdi'),
      catalogsService.getActiveValues('regimenes_fiscales'),
    ]).then(([constructionValues, projectValues, conceptValues, cfdiValues, regimeValues]) => {
      setConstructionOptions(constructionValues.map((item) => item.value));
      setProjectOptions(projectValues.map((item) => item.value));
      setChargeConceptOptions(conceptValues.map((item) => item.value));
      setCfdiUseOptions(cfdiValues.map((item) => item.value));
      setTaxRegimeOptions(regimeValues.map((item) => item.value));
    }).catch(() => {
      setSaveError('No se pudieron cargar los catálogos. Se muestran las opciones predeterminadas.');
    });
  }, []);

  useEffect(() => {
    if (!taxRegime || !taxRegimeOptions.length) return;
    const currentNormalized = normalizeFiscalLabel(taxRegime);
    const canonical = taxRegimeOptions.find((option) => normalizeFiscalLabel(option) === currentNormalized);
    if (canonical && canonical !== taxRegime) setTaxRegime(canonical);
  }, [taxRegime, taxRegimeOptions]);

  useEffect(() => {
    if (!id) return;
    void architecturalProjectsService.getById(id)
      .then((current) => {
        if (!current) throw new Error('Proyecto no encontrado.');
        setClientName(current.clientName);
        setClientPhone(current.clientPhone);
        setProjectName(current.projectName);
        setConstructionType(current.constructionType);
        setProjectType(current.projectType);
        setLocation(current.location);
        setInvoiceRequested(current.invoiceRequested);
        setBusinessName(current.businessName);
        setTaxId(current.taxId);
        setTaxAddress(current.taxAddress);
        setTaxPostalCode(current.taxPostalCode);
        setTaxRegime(current.taxRegime);
        setBillingEmail(current.billingEmail);
        setCfdiUse(current.cfdiUse);
        setStatus(current.status);
        setNotes(current.notes);
        setCharges(current.charges.length ? current.charges : [newCharge()]);
      })
      .catch((error) => setSaveError(error.message || 'No se pudo cargar el proyecto.'))
      .finally(() => setLoading(false));
  }, [id]);

  const subtotal = useMemo(() => charges.reduce((sum, charge) => sum + Number(charge.amount || 0), 0), [charges]);
  const tax = invoiceRequested ? subtotal * 0.16 : 0;
  const total = subtotal + tax;
  const paid = useMemo(() => charges
    .filter((charge) => charge.status === 'pagado')
    .reduce((sum, charge) => sum + Number(charge.amount || 0) * (invoiceRequested ? 1.16 : 1), 0), [charges, invoiceRequested]);

  const fiscalFieldsComplete = Boolean(
    businessName.trim()
    && /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i.test(taxId.trim())
    && taxAddress.trim()
    && /^\d{5}$/.test(taxPostalCode.trim())
    && taxRegime.trim()
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail.trim())
    && cfdiUse.trim(),
  );

  const documentProject: ArchitecturalProject = {
    id: id || 'BORRADOR',
    clientName,
    clientPhone,
    projectName,
    constructionType,
    projectType,
    location,
    invoiceRequested,
    businessName,
    taxId,
    taxAddress,
    taxPostalCode,
    taxRegime,
    billingEmail,
    cfdiUse,
    status,
    notes,
    charges,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const updateCharge = (chargeId: string, patch: Partial<ArchitecturalCharge>) =>
    setCharges((items) => items.map((item) => item.id === chargeId ? { ...item, ...patch } : item));

  const addAttachments = async (chargeId: string, files: FileList | null) => {
    if (!files?.length) return;
    setFileError('');
    const selected = Array.from(files);
    const oversized = selected.find((file) => file.size > MAX_FILE_SIZE);
    if (oversized) {
      setFileError(`"${oversized.name}" supera el límite de 20 MB por archivo.`);
      return;
    }
    const attachments = await Promise.all(selected.map((file) => new Promise<ArchitecturalAttachment>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl: String(reader.result),
        createdAt: new Date().toISOString(),
      });
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    })));
    const charge = charges.find((item) => item.id === chargeId);
    updateCharge(chargeId, { attachments: [...(charge?.attachments || []), ...attachments] });
  };

  const removeAttachment = (chargeId: string, attachmentId: string) => {
    const charge = charges.find((item) => item.id === chargeId);
    updateCharge(chargeId, {
      attachments: (charge?.attachments || []).filter((attachment) => attachment.id !== attachmentId),
    });
  };

  const readFiscalCertificate = async (file: File | undefined) => {
    if (!file) return;
    setExtractingCertificate(true);
    setCertificateProgress('Leyendo constancia...');
    setCertificateMessage('');
    setDetectedTaxRegimes([]);
    setSaveError('');
    try {
      const fiscalData = await extractFiscalCertificate(file, setCertificateProgress);
      setInvoiceRequested(true);
      setBusinessName(fiscalData.businessName);
      setTaxId(fiscalData.taxId);
      setTaxPostalCode(fiscalData.taxPostalCode);
      const detectedRegimes = fiscalData.taxRegimes.map((regime) => {
        const matchingRegime = taxRegimeOptions.find((option) =>
          normalizeFiscalLabel(option) === normalizeFiscalLabel(regime));
        return matchingRegime || regime;
      }).filter((regime, index, items) => items.indexOf(regime) === index);
      setDetectedTaxRegimes(detectedRegimes);
      setTaxRegime(detectedRegimes.length === 1 ? detectedRegimes[0] : '');
      setTaxAddress(fiscalData.taxAddress);
      setCertificateMessage(detectedRegimes.length > 1
        ? `Se encontraron ${detectedRegimes.length} regímenes en "${file.name}". Selecciona cuál se utilizará.`
        : `Datos extraídos de "${file.name}". Revisa la información antes de guardar.`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudo leer la constancia fiscal.');
    } finally {
      setExtractingCertificate(false);
      setCertificateProgress('');
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (invoiceRequested && !fiscalFieldsComplete) {
      setSaveError('Completa todos los datos fiscales obligatorios antes de guardar o generar una factura.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await architecturalProjectsService.save({
        clientName, clientPhone, projectName, constructionType, projectType, location,
        invoiceRequested, businessName, taxId, taxAddress, taxPostalCode, taxRegime,
        billingEmail, cfdiUse, status, notes,
        charges: charges.filter((charge) => charge.concept.trim()),
      }, id);
      navigate('/arquitectura');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudo guardar el proyecto.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-20 text-center text-sm font-medium text-slate-500">Cargando proyecto arquitectónico...</div>;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/arquitectura')} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{id ? 'Editar proyecto arquitectónico' : 'Nuevo proyecto arquitectónico'}</h1>
            <p className="mt-1 text-sm text-slate-500">Registra la obra y desglosa cada servicio que se cobrará.</p>
          </div>
        </div>
        <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
          <Save className="h-4 w-4" /> {saving ? 'Guardando...' : 'Guardar proyecto'}
        </button>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-600"><Building2 className="h-5 w-5" /></div>
          <h2 className="text-lg font-bold text-slate-800">Información del cliente y la obra</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Nombre del cliente" required value={clientName} onChange={setClientName} placeholder="Ej. María López" />
          <Field label="Teléfono" value={clientPhone} onChange={setClientPhone} placeholder="Ej. 612 123 4567" />
          <Field label="Nombre de la casa, departamento u obra" required value={projectName} onChange={setProjectName} placeholder="Ej. Casa Mirador" />
          <SelectField label="Tipo de construcción" value={constructionType} onChange={setConstructionType} options={withCurrentValue(constructionOptions, constructionType)} />
          <SelectField label="Tipo de proyecto" value={projectType} onChange={setProjectType} options={withCurrentValue(projectOptions, projectType)} />
          <Field label="Ubicación" value={location} onChange={setLocation} placeholder="Dirección o ciudad" />
          <SelectField label="Estado" value={status} onChange={(value) => setStatus(value as ArchitecturalProjectStatus)} options={['cotizacion', 'activo', 'pausado', 'terminado']} />
        </div>
        <label className="mt-5 block text-sm font-medium text-slate-700">
          Notas
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Alcance, medidas, acuerdos o datos importantes..." className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
        </label>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-violet-50 p-2 text-violet-600"><Landmark className="h-5 w-5" /></div>
            <div><h2 className="text-lg font-bold text-slate-800">¿Este proyecto requiere factura?</h2><p className="text-xs text-slate-500">El IVA se agregará únicamente cuando se solicite factura.</p></div>
          </div>
          <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1">
            <button type="button" onClick={() => setInvoiceRequested(false)} className={`rounded-lg px-5 py-2 text-sm font-bold transition ${!invoiceRequested ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>No</button>
            <button type="button" onClick={() => setInvoiceRequested(true)} className={`rounded-lg px-5 py-2 text-sm font-bold transition ${invoiceRequested ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500'}`}>Sí</button>
          </div>
        </div>
        {invoiceRequested ? (
          <>
            <div className="mb-5 rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-sm font-bold text-violet-900"><Upload className="h-4 w-4" /> Autollenar desde constancia fiscal</p>
                  <p className="mt-1 text-xs text-violet-700/70">Acepta PDF digital o escaneado, PNG y JPG. El archivo se procesa en este navegador y no se almacena en Supabase.</p>
                </div>
                <label className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700 ${extractingCertificate ? 'pointer-events-none opacity-60' : ''}`}>
                  {extractingCertificate ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  {extractingCertificate ? certificateProgress || 'Leyendo constancia...' : 'Subir constancia'}
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="hidden" onChange={(event) => { void readFiscalCertificate(event.target.files?.[0]); event.target.value = ''; }} />
                </label>
              </div>
              {certificateMessage && <p className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800"><FileCheck2 className="mt-0.5 h-4 w-4 shrink-0" /> {certificateMessage}</p>}
              {detectedTaxRegimes.length > 1 && (
                <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
                  <p className="text-sm font-bold text-amber-900">¿Qué régimen fiscal se utilizará para esta factura?</p>
                  <p className="mt-1 text-xs text-amber-700">La constancia contiene más de un régimen. Debes elegir uno para continuar.</p>
                  <select
                    value={taxRegime}
                    onChange={(event) => setTaxRegime(event.target.value)}
                    className="mt-3 h-11 w-full rounded-xl border border-amber-300 bg-white px-4 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                  >
                    <option value="">Selecciona un régimen fiscal</option>
                    {detectedTaxRegimes.map((regime) => <option key={regime} value={regime}>{regime}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Razón social o nombre fiscal" required value={businessName} onChange={setBusinessName} placeholder={clientName || 'Nombre del receptor'} />
              <Field label="RFC" required value={taxId} onChange={(value) => setTaxId(value.toUpperCase())} placeholder="Ej. XAXX010101000" />
              <Field label="Código postal fiscal" required value={taxPostalCode} onChange={(value) => setTaxPostalCode(value.replace(/\D/g, '').slice(0, 5))} placeholder="Ej. 23000" />
              <SelectField label="Régimen fiscal *" value={taxRegime} onChange={setTaxRegime} options={['', ...withCurrentValue(taxRegimeOptions, taxRegime)]} />
              <Field label="Domicilio fiscal" required value={taxAddress} onChange={setTaxAddress} placeholder="Calle, número y colonia" />
              <Field label="Correo de facturación" required type="email" value={billingEmail} onChange={setBillingEmail} placeholder="facturacion@cliente.com" />
              <SelectField label="Uso de CFDI *" value={cfdiUse} onChange={setCfdiUse} options={['', ...withCurrentValue(cfdiUseOptions, cfdiUse)]} />
            </div>
            <div className="mt-5 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-relaxed text-amber-800">Todos los campos son obligatorios. La factura generada es comercial y no está timbrada ante el SAT.</p>
              <button type="button" disabled={!fiscalFieldsComplete || !charges.some((charge) => charge.concept.trim())} onClick={() => generateArchitecturalInvoice(documentProject, charges.filter((charge) => charge.concept.trim()))} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-40">
                <FileText className="h-4 w-4" /> Factura del proyecto
              </button>
            </div>
          </>
        ) : (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">No se solicitará información fiscal ni se agregará IVA a los importes.</p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600"><DollarSign className="h-5 w-5" /></div>
            <div><h2 className="text-lg font-bold text-slate-800">Conceptos de cobro</h2><p className="text-xs text-slate-500">Planos, eléctricos, renders o cualquier otro servicio.</p></div>
          </div>
          <button type="button" onClick={() => setCharges((items) => [...items, newCharge()])} className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100">
            <Plus className="h-4 w-4" /> Agregar concepto
          </button>
        </div>
        <div className="space-y-4">
          {charges.map((charge, index) => (
            <div key={charge.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="grid gap-3 md:grid-cols-[1.2fr_1.5fr_.7fr_.7fr_auto] md:items-end">
                <SelectField label={`Concepto ${index + 1} *`} value={charge.concept} onChange={(value) => updateCharge(charge.id, { concept: value })} options={['', ...withCurrentValue(chargeConceptOptions, charge.concept)]} />
                <Field label="Descripción" value={charge.description} onChange={(value) => updateCharge(charge.id, { description: value })} placeholder="Qué incluye" />
                <Field label={invoiceRequested ? 'Importe antes de IVA' : 'Importe'} type="number" min="0" step="0.01" value={String(charge.amount || '')} onChange={(value) => updateCharge(charge.id, { amount: Number(value) })} placeholder="0.00" />
                <SelectField label="Estado" value={charge.status} onChange={(value) => updateCharge(charge.id, { status: value as ArchitecturalCharge['status'], paymentDate: value === 'pagado' ? charge.paymentDate || new Date().toISOString().slice(0, 10) : undefined })} options={['pendiente', 'pagado']} />
                <button type="button" title="Eliminar concepto" onClick={() => setCharges((items) => items.filter((item) => item.id !== charge.id))} className="rounded-xl border border-red-100 bg-white p-3 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
              </div>

              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-bold text-slate-700"><Paperclip className="h-4 w-4 text-blue-600" /> Archivos adjuntos</p>
                    <p className="mt-0.5 text-xs text-slate-400">PDF, planos, imágenes o documentos. Máximo 20 MB por archivo.</p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-50">
                    <Plus className="h-4 w-4" /> Adjuntar archivos
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(event) => {
                        void addAttachments(charge.id, event.target.files);
                        event.target.value = '';
                      }}
                    />
                  </label>
                </div>

                {(charge.attachments || []).length > 0 && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {charge.attachments.map((attachment) => (
                      <div key={attachment.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                        <div className="shrink-0 rounded-lg bg-blue-50 p-2 text-blue-600"><File className="h-4 w-4" /></div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-slate-700" title={attachment.name}>{attachment.name}</p>
                          <p className="text-[10px] text-slate-400">{formatFileSize(attachment.size)}</p>
                        </div>
                        {isPreviewable(attachment) && (
                          <button type="button" onClick={() => setPreviewAttachment(attachment)} title="Visualizar archivo" className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600">
                            <Eye className="h-4 w-4" />
                          </button>
                        )}
                        <a href={attachment.dataUrl || '#'} download={attachment.name} title="Descargar archivo" className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Download className="h-4 w-4" /></a>
                        <button type="button" onClick={() => removeAttachment(charge.id, attachment.id)} title="Quitar archivo" className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
                {charge.status === 'pagado' && (
                  <button type="button" onClick={() => generateArchitecturalReceipt(documentProject, charge)} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100">
                    <ReceiptText className="h-4 w-4" /> Generar recibo
                  </button>
                )}
                {invoiceRequested && (
                  <button type="button" onClick={() => generateArchitecturalInvoice(documentProject, [charge])} disabled={!charge.concept.trim() || !fiscalFieldsComplete} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-40">
                    <FileText className="h-4 w-4" /> Generar factura
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {fileError && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{fileError}</p>}
        {saveError && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{saveError}</p>}
        <div className={`mt-6 grid gap-3 border-t border-slate-100 pt-5 ${invoiceRequested ? 'sm:grid-cols-5' : 'sm:grid-cols-3'}`}>
          {invoiceRequested && <Summary label="Subtotal (ganancia)" value={subtotal} />}
          {invoiceRequested && <Summary label="IVA 16%" value={tax} color="text-violet-600" />}
          <Summary label="Total a cobrar" value={total} />
          <Summary label="Total cobrado" value={paid} color="text-emerald-600" />
          <Summary label="Saldo pendiente" value={total - paid} color="text-amber-600" />
        </div>
      </section>

      {previewAttachment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" onClick={() => setPreviewAttachment(null)}>
          <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-lg bg-blue-50 p-2 text-blue-600"><File className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-800">{previewAttachment.name}</p>
                  <p className="text-xs text-slate-400">{formatFileSize(previewAttachment.size)}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a href={previewAttachment.dataUrl || '#'} download={previewAttachment.name} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
                  <Download className="h-4 w-4" /><span className="hidden sm:inline">Descargar</span>
                </a>
                <button type="button" onClick={() => setPreviewAttachment(null)} className="rounded-xl bg-slate-100 p-2.5 text-slate-600 hover:bg-slate-200" aria-label="Cerrar vista previa">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-100 p-3">
              {isImageAttachment(previewAttachment) ? (
                <img src={previewAttachment.dataUrl || ''} alt={previewAttachment.name} className="max-h-full max-w-full rounded-lg object-contain shadow-sm" />
              ) : (
                <iframe src={previewAttachment.dataUrl || ''} title={`Vista previa de ${previewAttachment.name}`} className="h-full w-full rounded-lg border-0 bg-white" />
              )}
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

interface FieldProps {
  label: string; value: string; onChange: (value: string) => void; required?: boolean;
  type?: string; placeholder?: string; min?: string; step?: string;
}
function Field({ label, value, onChange, required, type = 'text', ...props }: FieldProps) {
  return <label className="block text-sm font-medium text-slate-700">{label}{required && <span className="text-red-500"> *</span>}<input {...props} type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" /></label>;
}
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm capitalize outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}
function Summary({ label, value, color = 'text-slate-900' }: { label: string; value: number; color?: string }) {
  return <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-400">{label}</p><p className={`mt-1 text-xl font-bold ${color}`}>{formatCurrency(value)}</p></div>;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentExtension(attachment: ArchitecturalAttachment) {
  return attachment.name.split('.').pop()?.toLowerCase() || '';
}

function isImageAttachment(attachment: ArchitecturalAttachment) {
  return ['png', 'jpg', 'jpeg'].includes(attachmentExtension(attachment))
    || ['image/png', 'image/jpeg'].includes(attachment.type);
}

function isPreviewable(attachment: ArchitecturalAttachment) {
  return isImageAttachment(attachment)
    || attachmentExtension(attachment) === 'pdf'
    || attachment.type === 'application/pdf';
}

function withCurrentValue(options: string[], current: string) {
  const equivalent = options.some((option) => normalizeFiscalLabel(option) === normalizeFiscalLabel(current));
  return current && !equivalent ? [current, ...options] : options;
}

function normalizeFiscalLabel(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-MX')
    .replace(/^\s*\d{3}\s*-\s*/, '')
    .replace(/^\s*regimen(?:\s+de)?\s+/, '')
    .replace(/^\s*de(?:\s+(las|los))?\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}
