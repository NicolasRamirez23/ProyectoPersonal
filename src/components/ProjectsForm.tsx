import { useForm } from 'react-hook-form';
import { Input } from './Input';
import { Button } from './Button';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { DollarSign, Calendar, Save, Briefcase, UserPlus, Users } from 'lucide-react';
import { mockApi } from '../services/api';

interface ProjectFormProps {
  initialData?: any;
  onSubmit: (data: any) => Promise<void>;
  isLoading?: boolean;
}

export function ProjectForm({ initialData, onSubmit, isLoading }: ProjectFormProps) {
  const [clientes, setClientes] = useState<{ id: number; nombre: string; celular?: string }[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [esClienteNuevo, setEsClienteNuevo] = useState(false); 
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors }, unregister } = useForm({
    defaultValues: initialData || {
      cliente: '', // Apunta a la columna 'cliente' de tu BD (ID numérico)
      nombre: '', // Temporal para crear en padron
      celular: '', // Temporal para crear en padron
      pago_inicial: undefined,
      tipo_pago: 'mensual',
      pago: undefined,
      fecha_firma_contrato: '',
      fecha_inicio: ''
    }
  });

  // Cargar clientes desde la tabla padron
  useEffect(() => {
    async function cargarClientes() {
      try {
        setLoadingClientes(true);
        const data = await mockApi.getClientes();
        setClientes(data || []);
      } catch (error) {
        console.error("Error al cargar clientes:", error);
      } finally {
        setLoadingClientes(false);
      }
    }
    cargarClientes();
  }, []);

  // Limpiar validaciones de campos ocultos
  useEffect(() => {
    if (esClienteNuevo) {
      unregister('cliente');
    } else {
      unregister('nombre');
      unregister('celular');
    }
  }, [esClienteNuevo, unregister]);

  const onFormSubmit = async (data: any) => {
    setSaving(true);
    try {
      let finalClienteId = data.cliente;

      // Si el cliente es nuevo, se inserta primero en la tabla 'padron'
      if (esClienteNuevo) {
        finalClienteId = await mockApi.createClienteNuevo(data.nombre, data.celular);
      }

      // Estructuramos el payload EXACTAMENTE con los nombres de tus columnas de la tabla 'proyectos'
      const payload = {
        cliente: Number(finalClienteId),
        pago: Number(data.pago),
        pago_inicial: Number(data.pago_inicial),
        tipo_pago: data.tipo_pago,
        fecha_firma_contrato: data.fecha_firma_contrato,
        fecha_inicio: data.fecha_inicio
      };

      await onSubmit(payload);
      navigate('/listado');
    } catch (error) {
      console.error("Error en el envío del flujo:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.form 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit(onFormSubmit)} 
      className="space-y-8 max-w-4xl mx-auto"
    >
      {/* SECCIÓN 1: IDENTIFICACIÓN Y CONTACTO */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Briefcase className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold text-slate-800">Información del Cliente</h2>
          </div>

          {/* Switch para alternar Cliente Existente o Nuevo */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setEsClienteNuevo(false)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${!esClienteNuevo ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Users className="h-3.5 w-3.5" /> Existente
            </button>
            <button
              type="button"
              onClick={() => setEsClienteNuevo(true)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${esClienteNuevo ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <UserPlus className="h-3.5 w-3.5" /> Nuevo
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          {!esClienteNuevo ? (
            /* CASO A: SELECCIONAR CLIENTE EXISTENTE (Columna 'cliente') */
            <div className="flex flex-col space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                Seleccionar Cliente del Padrón <span className="text-red-500">*</span>
              </label>
              <select
                {...register('cliente', { required: !esClienteNuevo ? 'Selecciona un cliente de la lista' : false })}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                disabled={loadingClientes}
              >
                <option value="">{loadingClientes ? 'Cargando clientes...' : '--- Elige un Cliente ---'}</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
              {errors.cliente && (
                <span className="text-xs text-red-500">{errors.cliente.message as string}</span>
              )}
            </div>
          ) : (
            /* CASO B: NUEVO CLIENTE (Columnas 'nombre' y 'celular') */
            <>
              <Input
                label="Nombre Completo del Cliente"
                required
                placeholder="Ej. Juan Pérez López"
                {...register('nombre', { required: esClienteNuevo ? 'El nombre es obligatorio' : false })}
                error={errors.nombre?.message}
              />
              <Input
                label="Celular de Contacto"
                required
                type="tel"
                placeholder="Ej. 6121234567"
                {...register('celular', { required: esClienteNuevo ? 'El número celular es obligatorio' : false })}
                error={errors.celular?.message}
              />
            </>
          )}
        </div>
      </div>

      {/* SECCIÓN 2: ESQUEMA DE PAGOS (Columnas 'pago_inicial', 'tipo_pago', 'pago') */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <DollarSign className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800">Estructura Financiera</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <Input
            label="Pago Inicial (Enganche / Depósito)"
            required
            type="number"
            placeholder="0.00"
            {...register('pago_inicial', { required: 'Este campo es obligatorio' })}
            error={errors.pago_inicial?.message}
          />

          <div className="flex flex-col space-y-2">
            <label className="text-sm font-medium text-slate-700">Tipo de Pago <span className="text-red-500">*</span></label>
            <select
              {...register('tipo_pago', { required: 'Frecuencia obligatoria' })}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="semanal">Semanalmente</option>
              <option value="quincenal">Quincenalmente</option>
              <option value="mensual">Mensualmente</option>
            </select>
          </div>

          <Input
            label="Monto del Pago Frecuente"
            required
            type="number"
            placeholder="0.00"
            {...register('pago', { required: 'Este campo es obligatorio' })}
            error={errors.pago?.message}
          />
        </div>
      </div>

      {/* SECCIÓN 3: FECHAS (Columnas 'fecha_firma_contrato', 'fecha_inicio') */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Calendar className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800">Fechas de Contrato</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <Input
            label="Fecha Firma Contrato"
            required
            type="date"
            {...register('fecha_firma_contrato', { required: 'Obligatorio' })}
            error={errors.fecha_firma_contrato?.message}
          />
          <Input
            label="Fecha de Inicio (Primer Pago)"
            required
            type="date"
            {...register('fecha_inicio', { required: 'Obligatorio' })}
            error={errors.fecha_inicio?.message}
          />
        </div>
      </div>

      {/* BOTONES DE ACCIÓN */}
      <div className="flex justify-end gap-4 p-4 sticky bottom-6 z-20">
        <Button type="button" variant="outline" onClick={() => navigate('/listado')}>Cancelar</Button>
        <Button 
          type="submit" 
          isLoading={saving || isLoading} 
          leftIcon={<Save className="h-5 w-5" />}
          className="min-w-[160px]"
        >
          Guardar Registro
        </Button>
      </div>
    </motion.form>
  );
}