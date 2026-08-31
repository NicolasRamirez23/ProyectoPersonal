import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Camera, Save } from 'lucide-react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAlerts } from '../components/AlertProvider';
import { useAuth } from '../auth/AuthContext';
import { generateStudentRecordPdf } from '../lib/studentRecordPdf';
import { studentRecordsApi } from '../services/studentRecords';
import type { ContactDetails, PersonDetails, StudentRecordData } from '../types/studentRecord';

const SCHOOL_NAME = 'JARDÍN DE NIÑOS JOSEFINA RAMOS DEL RÍO F-24';
const TEACHER_NAME = 'ABRIL SOLORZANO';
const GRADE_GROUPS = ['PRIMERO - A', 'PRIMERO - B', 'SEGUNDO - A', 'SEGUNDO - B', 'TERCERO - A', 'TERCERO - B'];
const EDUCATION_LEVELS = ['SIN ESTUDIOS', 'PRIMARIA', 'SECUNDARIA', 'BACHILLERATO', 'CARRERA TÉCNICA', 'LICENCIATURA', 'POSGRADO'];
const CIVIL_STATUSES = ['SOLTERO(A)', 'CASADO(A)', 'UNIÓN LIBRE', 'DIVORCIADO(A)', 'VIUDO(A)'];
const RELATIONSHIPS = ['MADRE', 'PADRE', 'HERMANO(A)', 'ABUELO(A)', 'TÍO(A)', 'PRIMO(A)', 'TUTOR(A)', 'AMIGO(A)', 'VECINO(A)', 'OTRO'];
const DATE_PATTERN = '(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])-[0-9]{4}';
const CURP_PATTERN = '[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9][0-9]';
const PHONE_PATTERN = '[0-9]{3}-[0-9]{3}-[0-9]{4}';

const formatPhoneInput = (value: string) => value.replace(/\D/g, '').slice(0, 10).replace(/^(\d{3})(\d)/, '$1-$2').replace(/^(\d{3})-(\d{3})(\d)/, '$1-$2-$3');
const formatDateInput = (value: string) => value.replace(/\D/g, '').slice(0, 8).replace(/^(\d{2})(\d)/, '$1-$2').replace(/^(\d{2})-(\d{2})(\d)/, '$1-$2-$3');

function uppercaseRecord(value: any, key = ''): any {
  if (typeof value === 'string') return ['foto', 'genero', 'id', 'createdAt'].includes(key) ? value : value.toLocaleUpperCase('es-MX');
  if (Array.isArray(value)) return value.map((item) => uppercaseRecord(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, uppercaseRecord(childValue, childKey)]));
  return value;
}

const emptyPerson = (): PersonDetails => ({ nombre: '', fechaNacimiento: '', curp: '', escolaridad: '', ocupacion: '', lugarTrabajo: '', telefonoTrabajo: '', celular: '', estadoCivil: '' });
const emptyContact = (): ContactDetails => ({ nombre: '', parentesco: '', telefono: '' });
const initialRecord = (): StudentRecordData => ({
  escuela: SCHOOL_NAME, nombre: '', genero: 'alumna', foto: '', fotoAjuste: { x: 50, y: 35, zoom: 1 }, gradoGrupo: '', maestra: TEACHER_NAME, fechaNacimiento: '', lugarNacimiento: '', curp: '', edad: '', peso: '', estatura: '', alergias: '', calleNumero: '', codigoPostal: '', colonia: '', telefono: '',
  madre: emptyPerson(), padre: emptyPerson(), emergencias: [emptyContact(), emptyContact()], autorizados: [emptyContact(), emptyContact()],
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="mb-5 text-lg font-bold text-slate-900">{title}</h2>{children}</section>;
}

function SelectField({ label, value, options, onChange, required = true }: { label: string; value: string; options: string[]; onChange: (value: string) => void; required?: boolean }) {
  return <label className="flex w-full flex-col gap-1.5 text-sm font-medium text-slate-700">{label}{required && <span className="sr-only">requerido</span>}<select required={required} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" value={value} onChange={(event) => onChange(event.target.value)}><option value="">Selecciona una opción</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

const personLabels: Array<[keyof PersonDetails, string, string?]> = [
  ['nombre', 'Nombre completo'], ['fechaNacimiento', 'Fecha de nacimiento'], ['curp', 'CURP'], ['escolaridad', 'Escolaridad'], ['ocupacion', 'Ocupación'], ['lugarTrabajo', 'Lugar de trabajo'], ['telefonoTrabajo', 'Teléfono del trabajo', 'tel'], ['celular', 'Celular', 'tel'], ['estadoCivil', 'Estado civil'],
];

export function StudentRecordFormPage({ publicMode = false }: { publicMode?: boolean }) {
  const [form, setForm] = useState<StudentRecordData>(initialRecord);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [website, setWebsite] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);
  const { notify } = useAlerts();
  const { profile } = useAuth();
  const setField = (field: keyof StudentRecordData, value: any) => setForm((current) => ({ ...current, [field]: uppercaseRecord(value, field) }));
  const setPerson = (key: 'madre' | 'padre', field: keyof PersonDetails, value: string) => setForm((current) => ({ ...current, [key]: { ...current[key], [field]: value.toLocaleUpperCase('es-MX') } }));
  const setContact = (key: 'emergencias' | 'autorizados', index: number, field: keyof ContactDetails, value: string) => setForm((current) => {
    const items = [...current[key]] as [ContactDetails, ContactDetails];
    items[index] = { ...items[index], [field]: value.toLocaleUpperCase('es-MX') };
    return { ...current, [key]: items };
  });

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    studentRecordsApi.getById(id)
      .then((record) => { if (active) setForm(uppercaseRecord({ ...record, fotoAjuste: record.fotoAjuste || { x: 50, y: 35, zoom: 1 }, escuela: SCHOOL_NAME, maestra: TEACHER_NAME })); })
      .catch((error) => { if (active) notify('error', 'No se pudo cargar la ficha', error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const handlePhoto = (file?: File) => {
    if (!file) return;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 900 / Math.max(image.width, image.height));
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
      setField('foto', canvas.toDataURL('image/jpeg', 0.82));
      URL.revokeObjectURL(image.src);
    };
    image.src = URL.createObjectURL(file);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.foto) return notify('warning', 'Fotografía requerida', 'Selecciona la fotografía del estudiante.');
    setSaving(true);
    try {
      const normalizedForm = uppercaseRecord({ ...form, escuela: SCHOOL_NAME, maestra: TEACHER_NAME }) as StudentRecordData;
      const saved = publicMode ? await studentRecordsApi.createPublic(normalizedForm, website) : editing && id ? await studentRecordsApi.update(id, normalizedForm) : await studentRecordsApi.create(normalizedForm);
      await generateStudentRecordPdf(saved);
      notify('success', editing ? 'Ficha actualizada' : 'Ficha generada', editing ? 'Los cambios se guardaron y la ficha actualizada comenzó a descargarse.' : 'El registro se guardó y la ficha PDF comenzó a descargarse.');
      if (publicMode || profile?.rol !== 'admin') setSubmitted(true); else navigate('/fichas');
    } catch (error: any) {
      notify('error', 'No se pudo crear la ficha', error.message || 'Inténtalo nuevamente.');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="py-20 text-center text-slate-500">Cargando ficha...</div>;
  if (submitted) return <main className="flex min-h-[70vh] items-center justify-center bg-slate-50 p-6"><div className="max-w-lg rounded-3xl border border-emerald-200 bg-white p-10 text-center shadow-xl"><h1 className="text-2xl font-bold text-emerald-700">Ficha recibida correctamente</h1><p className="mt-3 text-slate-600">La información quedó registrada y el PDF fue descargado. No es posible consultar o modificar el registro desde esta cuenta.</p></div></main>;

  return <form onSubmit={submit} className={`mx-auto max-w-5xl space-y-6 ${publicMode ? 'px-4 py-10' : ''}`}>
    <div><h1 className="text-3xl font-bold tracking-tight">{editing ? 'Editar ficha de estudiante' : 'Nueva ficha de estudiante'}</h1><p className="mt-1 text-slate-500">{editing ? 'Modifica la información; al guardar se descargará la ficha actualizada.' : 'Captura la información del formato; al guardar se descargará el PDF.'}</p></div>
    <Section title="Datos del estudiante">
      <div className="grid gap-5 md:grid-cols-[220px_1fr]">
        <div className="space-y-3">
          <label className="group relative flex aspect-[112/109] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-100 text-center hover:border-blue-500">
            {form.foto ? <img src={form.foto} alt="Foto del estudiante" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: `${form.fotoAjuste.x}% ${form.fotoAjuste.y}%`, transform: `scale(${form.fotoAjuste.zoom})`, transformOrigin: `${form.fotoAjuste.x}% ${form.fotoAjuste.y}%` }} /> : <><Camera className="mb-2 h-8 w-8 text-slate-400" /><span className="text-sm font-semibold">Agregar fotografía</span><span className="text-xs text-slate-400">Retrato de frente, JPG o PNG</span></>}
            {form.foto && <span className="absolute bottom-2 rounded-full bg-slate-950/70 px-3 py-1 text-[11px] font-semibold text-white">Cambiar fotografía</span>}
            <input className="hidden" type="file" accept="image/jpeg,image/png" onChange={(e) => handlePhoto(e.target.files?.[0])} />
          </label>
          {form.foto && <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-600">Centra el rostro dentro del marco</p>
            <label className="block text-[11px] text-slate-500">Horizontal<input className="block w-full accent-blue-600" type="range" min="0" max="100" value={form.fotoAjuste.x} onChange={(e) => setField('fotoAjuste', { ...form.fotoAjuste, x: Number(e.target.value) })} /></label>
            <label className="block text-[11px] text-slate-500">Vertical<input className="block w-full accent-blue-600" type="range" min="0" max="100" value={form.fotoAjuste.y} onChange={(e) => setField('fotoAjuste', { ...form.fotoAjuste, y: Number(e.target.value) })} /></label>
            <label className="block text-[11px] text-slate-500">Acercamiento<input className="block w-full accent-blue-600" type="range" min="100" max="300" value={Math.round(form.fotoAjuste.zoom * 100)} onChange={(e) => setField('fotoAjuste', { ...form.fotoAjuste, zoom: Number(e.target.value) / 100 })} /></label>
          </div>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input required label="Nombre completo" value={form.nombre} onChange={(e) => setField('nombre', e.target.value)} containerClassName="sm:col-span-2" />
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">Género<select className="h-10 rounded-md border border-slate-200 bg-white px-3" value={form.genero} onChange={(e) => setField('genero', e.target.value)}><option value="alumna">Alumna</option><option value="alumno">Alumno</option></select></label>
          <SelectField label="Grado y grupo" value={form.gradoGrupo} options={GRADE_GROUPS} onChange={(value) => setField('gradoGrupo', value)} />
          <Input label="Maestra" value={TEACHER_NAME} readOnly className="bg-slate-100 font-semibold text-slate-600" />
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {([['fechaNacimiento','Fecha de nacimiento'],['lugarNacimiento','Lugar de nacimiento'],['curp','CURP'],['edad','Edad'],['peso','Peso (kilogramos)'],['estatura','Estatura (metros)'],['alergias','Alergias o enfermedades'],['calleNumero','Calle y número'],['codigoPostal','Código postal'],['colonia','Colonia'],['telefono','Contacto telefónico']] as Array<[keyof StudentRecordData,string]>).map(([field,label]) => <Input key={field} required label={label} type={field === 'peso' || field === 'estatura' ? 'number' : 'text'} inputMode={field === 'telefono' || field === 'fechaNacimiento' ? 'numeric' : undefined} step={field === 'peso' ? '0.1' : field === 'estatura' ? '0.01' : undefined} min={field === 'peso' || field === 'estatura' ? '0' : undefined} maxLength={field === 'curp' ? 18 : field === 'telefono' ? 12 : field === 'fechaNacimiento' ? 10 : undefined} pattern={field === 'curp' ? CURP_PATTERN : field === 'telefono' ? PHONE_PATTERN : field === 'fechaNacimiento' ? DATE_PATTERN : undefined} title={field === 'curp' ? 'La CURP debe contener exactamente 18 caracteres válidos.' : field === 'telefono' ? 'Ingresa un teléfono de 10 dígitos.' : field === 'fechaNacimiento' ? 'Usa el formato DD-MM-YYYY.' : undefined} placeholder={field === 'peso' ? 'EJ. 17.2' : field === 'estatura' ? 'EJ. 1.20' : field === 'telefono' ? '612-123-4567' : field === 'fechaNacimiento' ? 'DD-MM-YYYY' : undefined} value={String(form[field])} onChange={(e) => setField(field, field === 'telefono' ? formatPhoneInput(e.target.value) : field === 'fechaNacimiento' ? formatDateInput(e.target.value) : e.target.value)} />)}
      </div>
    </Section>
    {(['madre','padre'] as const).map((key) => <Section key={key} title={`Información de la ${key}`}><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{personLabels.map(([field,label,type]) => field === 'escolaridad' ? <SelectField key={field} label={label} value={form[key][field]} options={EDUCATION_LEVELS} onChange={(value) => setPerson(key, field, value)} /> : field === 'estadoCivil' ? <SelectField key={field} label={label} value={form[key][field]} options={CIVIL_STATUSES} onChange={(value) => setPerson(key, field, value)} /> : <Input key={field} required label={label} type="text" inputMode={type === 'tel' || field === 'fechaNacimiento' ? 'numeric' : undefined} maxLength={field === 'curp' ? 18 : type === 'tel' ? 12 : field === 'fechaNacimiento' ? 10 : undefined} pattern={field === 'curp' ? CURP_PATTERN : type === 'tel' ? PHONE_PATTERN : field === 'fechaNacimiento' ? DATE_PATTERN : undefined} title={field === 'curp' ? 'La CURP debe contener exactamente 18 caracteres válidos.' : type === 'tel' ? 'Ingresa un teléfono de 10 dígitos.' : field === 'fechaNacimiento' ? 'Usa el formato DD-MM-YYYY.' : undefined} placeholder={type === 'tel' ? '612-123-4567' : field === 'fechaNacimiento' ? 'DD-MM-YYYY' : undefined} value={form[key][field]} onChange={(e) => setPerson(key,field,type === 'tel' ? formatPhoneInput(e.target.value) : field === 'fechaNacimiento' ? formatDateInput(e.target.value) : e.target.value)} />)}</div></Section>)}
    <Section title="Contactos y personas autorizadas"><div className="grid gap-8 lg:grid-cols-2"><div><h3 className="mb-3 font-semibold text-slate-700">En caso de no localizar a los padres</h3>{form.emergencias.map((item,index) => <div key={index} className="mb-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-3"><Input required label={`Contacto ${index+1}`} value={item.nombre} onChange={(e)=>setContact('emergencias',index,'nombre',e.target.value)}/><SelectField label="Parentesco" value={item.parentesco} options={RELATIONSHIPS} onChange={(value)=>setContact('emergencias',index,'parentesco',value)}/><Input required label="Teléfono" type="text" inputMode="numeric" maxLength={12} pattern={PHONE_PATTERN} title="Ingresa un teléfono de 10 dígitos." placeholder="612-123-4567" value={item.telefono} onChange={(e)=>setContact('emergencias',index,'telefono',formatPhoneInput(e.target.value))}/></div>)}</div><div><h3 className="mb-3 font-semibold text-slate-700">Autorizados para recoger al estudiante</h3>{form.autorizados.map((item,index) => <div key={index} className="mb-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"><Input required label={`Persona ${index+1}`} value={item.nombre} onChange={(e)=>setContact('autorizados',index,'nombre',e.target.value)}/><SelectField label="Parentesco" value={item.parentesco} options={RELATIONSHIPS} onChange={(value)=>setContact('autorizados',index,'parentesco',value)}/></div>)}</div></div></Section>
    {publicMode && <input aria-hidden="true" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px]" name="website" value={website} onChange={(event) => setWebsite(event.target.value)} />}
    <div className="sticky bottom-4 flex justify-end gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">{!publicMode && <Button type="button" variant="outline" onClick={()=>navigate('/fichas')}>Cancelar</Button>}<Button type="submit" isLoading={saving} leftIcon={<Save className="h-4 w-4" />}>{editing ? 'Guardar cambios' : publicMode ? 'Enviar ficha' : 'Guardar y generar PDF'}</Button></div>
  </form>;
}
