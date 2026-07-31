import { useEffect, useState } from 'react';
import { mockApi } from '../services/api';
import { formatCurrency } from '../lib/utils';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  DollarSign, 
  Wallet, 
  Calendar as CalendarIcon, 
  FileText, 
  Printer, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle, 
  Trash2, 
  Receipt,
  FileCheck
} from 'lucide-react';

interface PaymentSectionProps {
  proyecto: {
    id: number;
    cliente_nombre?: string;
    cliente_celular?: string;
  };
}

export function PaymentSection({ proyecto }: PaymentSectionProps) {
  const [plazos, setPlazos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [plazoSeleccionado, setPlazoSeleccionado] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estados para notificaciones y flujos de confirmación estéticos
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmCancelData, setConfirmCancelData] = useState<{ abono: any, onConfirm: () => void } | null>(null);
  const [confirmPayData, setConfirmPayData] = useState<{ formData: any, saldoRestante: number, onConfirm: () => void } | null>(null);

  const { register, handleSubmit, reset } = useForm();

  const cargarPlazos = async () => {
    try {
      setLoading(true);
      const data = await mockApi.getPagosByProyecto(proyecto.id);
      setPlazos(data || []);
    } catch (error) {
      console.error("Error al obtener plazos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarPlazos();
  }, [proyecto.id]);

  const onPayClick = (e: React.MouseEvent, plazo: any, index: number) => {
    e.stopPropagation(); 
    setPlazoSeleccionado(plazo);
    setErrorMessage(null); 
    
    const restante = Number(plazo.monto_total) - Number(plazo.monto_pagado || 0);
    
    // 🌟 CORRECCIÓN: Normalizar y detectar el tipo de pago real del registro original
    const tipoOriginal = plazo.tipo_pago?.toUpperCase() || 'MENSUAL';
    let conceptoSugerido = '';

    if (tipoOriginal === 'ENGANCHE') {
      conceptoSugerido = 'PAGO DE ENGANCHE / DEPÓSITO INICIAL';
    } else {
      conceptoSugerido = `PAGO ${tipoOriginal} - PERIODO #${index + 1} ${plazo.fecha_vencimiento}`;
    }

    reset({
      amount: restante,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'transferencia',
      concept: conceptoSugerido, // <-- Se envía limpio y correcto en el formulario
      observaciones: ''
    });

    setIsModalOpen(true);
  };

  // Validación del primer paso del formulario antes de abrir confirmación visual
  const onPaymentSubmit = (data: any) => {
    if (!plazoSeleccionado) return;
    setErrorMessage(null);

    const restante = Number(plazoSeleccionado.monto_total) - Number(plazoSeleccionado.monto_pagado || 0);
    const montoA_Pagar = Number(data.amount);

    if (montoA_Pagar <= 0) {
      setErrorMessage("El monto a abonar debe ser mayor a 0.");
      return;
    }

    if (montoA_Pagar > restante) {
      setErrorMessage(
        `El monto ingresado (${formatCurrency(montoA_Pagar)}) supera el saldo restante de este periodo (${formatCurrency(restante)}).`
      );
      return;
    }

    // Si pasa los filtros, abrimos la confirmación visual bonita
    setConfirmPayData({
      formData: data,
      saldoRestante: restante,
      onConfirm: () => executePayment(data, plazoSeleccionado)
    });
  };

  // Ejecución real de la transacción e impresión de PDF
  const executePayment = async (data: any, plazo: any) => {
    try {
      const montoA_Pagar = Number(data.amount);

      const nuevoRecibo = await mockApi.registrarReciboAbono({
        mensualidad_id: plazo.id,
        monto_abonado: montoA_Pagar,
        fecha_pago: data.paymentDate,
        metodo_pago: data.paymentMethod,
        concepto: data.concept,
        observaciones: data.observaciones || undefined
      });

      // Disparar descarga al vuelo del recibo PDF oficial
      generarReciboPDF(montoA_Pagar, data.concept, data.paymentMethod, data.paymentDate, nuevoRecibo.id);

      setSuccessMessage(`¡Abono de ${formatCurrency(montoA_Pagar)} registrado y comprobante PDF generado con éxito!`);
      setIsModalOpen(false);
      setPlazoSeleccionado(null);
      await cargarPlazos();
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Error al procesar el abono.");
    }
  };

  // Motor Generador del PDF Oficial AvTech
  const generarReciboPDF = (monto: number, conceptoPago: string, metodo: string, fecha: string, reciboId?: string | number) => {
    const doc = new jsPDF();

    // Encabezado Corporativo
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text('AvTech', 15, 25);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('COMPROBANTE OFICIAL DE PAGO', 135, 20);
    if (reciboId) {
      doc.setFont('helvetica', 'bold');
      doc.text(`FOLIO RECIBO: #RA-${reciboId}`, 135, 27);
    }

    // Datos del Cliente desde el Padrón
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('DATOS DEL CLIENTE (PADRÓN):', 15, 55);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Nombre Completo: ${proyecto.cliente_nombre || 'N/A'}`, 15, 63);
    doc.text(`Celular de Contacto: ${proyecto.cliente_celular || 'N/A'}`, 15, 69);
    doc.text(`Referencia Contrato: #${proyecto.id}`, 15, 75);

    // Detalles de Metadata del Recibo
    doc.setFont('helvetica', 'bold');
    doc.text('DETALLES DEL MOVIMIENTO:', 125, 55);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha de Aplicación: ${fecha}`, 125, 63);
    doc.text(`Método Utilizado: ${metodo.toUpperCase()}`, 125, 69);

    // Tabla de Desglose
    autoTable(doc, {
      startY: 85,
      head: [['Descripción / Concepto del Periodo', 'Importe Abonado']],
      body: [
        [conceptoPago, formatCurrency(monto)]
      ],
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 10, cellPadding: 5 },
    });

    let finalY = (doc as any).lastAutoTable.finalY + 15;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(`TOTAL RECIBIDO: ${formatCurrency(monto)}`, 130, finalY);

    // Apartado de Firma del Cliente
    finalY += 35; 
    doc.setDrawColor(148, 163, 184); 
    doc.setLineDash([2, 2], 0); 
    doc.line(65, finalY, 145, finalY); 
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text('Firma de Conformidad del Cliente', 78, finalY + 6);
    doc.setFontSize(9);
    doc.text(proyecto.cliente_nombre || '', 75, finalY + 12, { align: 'left' });

    doc.setLineDash([], 0);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(148, 163, 184);
    doc.text('Este documento es un comprobante digital de abono emitido instantáneamente por el sistema AvTech.', 15, 285);

    doc.save(`Recibo_AvTech_RA_${reciboId || 'N'}.pdf`);
  };

  const totalAportado = plazos.reduce((acc, item) => acc + Number(item.monto_pagado || 0), 0);

  return (
    <div className="space-y-6">
      {/* Alerta de éxito animada */}
      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <p className="text-sm font-medium">{successMessage}</p>
            </div>
            <button className="text-xs font-bold text-emerald-700 hover:underline" onClick={() => setSuccessMessage(null)}>
              Entendido
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Receipt className="h-5 w-5 text-blue-600" />
              Estructura de Plazos y Control de Abonos
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Total Acumulado Pagado: <span className="font-bold text-emerald-600 text-sm">{formatCurrency(totalAportado)}</span>
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-200/60 px-2.5 py-1 rounded-full align-self-start sm:align-self-auto">
            {plazos.length} Periodos Evaluados
          </span>
        </div>

        <div className="divide-y divide-slate-100 max-h-[440px] overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
              <Clock className="h-4 w-4 animate-spin text-blue-500" /> Cargando desglose de plazos...
            </div>
          ) : plazos.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-sm">
              No se han encontrado plazos de pago vinculados a este proyecto.
            </div>
          ) : (
            plazos.map((plazo, index) => (
              <InstallmentRow 
                key={plazo.id}
                plazo={plazo}
                index={index}
                onPayClick={(e) => onPayClick(e, plazo, index)}
                generarReciboPDF={generarReciboPDF}
                onRefreshNeeded={cargarPlazos}
                setConfirmCancelData={setConfirmCancelData}
                setSuccessMessage={setSuccessMessage}
              />
            ))
          )}
        </div>
      </div>

      {/* MODAL PRINCIPAL: FORMULARIO REGISTRO DE ABONO */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => {
          setPlazoSeleccionado(null);
          setIsModalOpen(false);
        }} 
        title="Registrar Abono / Pago Parcial"
      >
        {isModalOpen && plazoSeleccionado && (
          <form onSubmit={handleSubmit(onPaymentSubmit)} className="space-y-5">
            <Input 
              label="Monto a Recibir ($)" 
              type="number" 
              step="0.01" 
              required 
              {...register('amount', { required: true, min: 0.01 })} 
              icon={<DollarSign className="h-4 w-4 text-slate-400" />}
            />
            
            <Input 
              label="Fecha del Pago" 
              type="date" 
              required 
              {...register('paymentDate', { required: true })} 
              icon={<CalendarIcon className="h-4 w-4 text-slate-400" />}
            />
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                <Wallet className="h-3.5 w-3.5" /> Método de Pago
              </label>
              <select 
                {...register('paymentMethod')} 
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="transferencia">Transferencia Bancaria</option>
                <option value="deposito">Depósito</option>
                <option value="efectivo">Efectivo</option>
              </select>
            </div>
            
            <Input 
              label="Concepto del Recibo" 
              required
              {...register('concept', { required: true })} 
              icon={<FileText className="h-4 w-4 text-slate-400" />}
            />
            
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Observaciones (Opcional)</label>
              <textarea 
                {...register('observaciones')} 
                rows={2} 
                placeholder="Ej. Pago parcial liquidado en sucursal"
                className="flex w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" 
              />
            </div>

            {errorMessage && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 animate-in fade-in zoom-in-95 duration-200">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold">Validación de Fondos</p>
                  <p className="text-xs text-red-700/90 leading-relaxed">{errorMessage}</p>
                </div>
              </div>
            )}

            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setPlazoSeleccionado(null);
                  setIsModalOpen(false);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700">Confirmar Monto</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL BONITO DE SEGUNDA CONFIRMACIÓN DE COBRO */}
      <Modal isOpen={!!confirmPayData} onClose={() => setConfirmPayData(null)} title="Confirmar Registro de Ingreso">
        {confirmPayData && (
          <div className="space-y-6">
            <div className="flex items-start gap-4 bg-emerald-50 p-4 border border-emerald-200 rounded-xl">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-emerald-900">¿Deseas asentar este pago en el sistema?</p>
                <div className="text-xs text-emerald-800 leading-relaxed space-y-1.5 mt-2">
                  <p>Vas a registrar un ingreso de <span className="font-bold text-sm text-emerald-700">{formatCurrency(confirmPayData.formData.amount)}</span> mediante <strong className="capitalize">{confirmPayData.formData.paymentMethod}</strong>.</p>
                  <p>• <strong>Titular:</strong> {proyecto.cliente_nombre}</p>
                  <p>• <strong>Nuevo saldo restante de la cuota:</strong> {formatCurrency(confirmPayData.saldoRestante - confirmPayData.formData.amount)}</p>
                  <p className="text-[11px] text-slate-500 italic pt-1 border-t border-emerald-200/50">Esta acción aplicará los saldos y generará el recibo oficial AvTech al instante.</p>
                </div>
              </div>
            </div>
            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setConfirmPayData(null)}>Modificar Datos</Button>
              <Button 
                type="button"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md"
                onClick={() => {
                  confirmPayData.onConfirm();
                  setConfirmPayData(null);
                }}
              >
                Sí, registrar abono
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL DE ELIMINACIÓN / CANCELACIÓN CRÍTICA DE RECIBOS */}
      <Modal isOpen={!!confirmCancelData} onClose={() => setConfirmCancelData(null)} title="Confirmar Acción Crítica">
        {confirmCancelData && (
          <div className="space-y-6">
            <div className="flex items-start gap-4 bg-amber-50 p-4 border border-amber-200 rounded-xl">
              <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-amber-900">¿Estás completamente seguro de eliminar este abono?</p>
                <p className="text-xs text-amber-800 leading-relaxed mt-1">
                  Vas a revertir el recibo de cobro por valor de <span className="font-bold text-sm text-red-600">{formatCurrency(confirmCancelData.abono.monto_abonado)}</span>. 
                  Esta acción cambiará su estatus a <strong>CANCELADO</strong> en la base de datos y los triggers recalcularán automáticamente el saldo global del periodo mensual.
                </p>
              </div>
            </div>
            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setConfirmCancelData(null)}>No, mantener abono</Button>
              <Button 
                type="button"
                className="bg-red-600 hover:bg-red-700 text-white shadow-md"
                leftIcon={<Trash2 className="h-4 w-4" />}
                onClick={() => {
                  confirmCancelData.onConfirm();
                  setConfirmCancelData(null);
                }}
              >
                Sí, eliminar abono
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ==========================================
// RENDERIZADOR: Fila de Plazo e Historial
// ==========================================
function InstallmentRow({ 
  plazo, 
  index, 
  onPayClick, 
  generarReciboPDF,
  onRefreshNeeded,
  setConfirmCancelData,
  setSuccessMessage
}: { 
  plazo: any, 
  index: number, 
  onPayClick: any, 
  generarReciboPDF: any,
  onRefreshNeeded: () => Promise<void>,
  setConfirmCancelData: React.Dispatch<React.SetStateAction<any>>,
  setSuccessMessage: React.Dispatch<React.SetStateAction<string | null>>
}) {
  const [isOpen, setIsOpen] = useState(false);

  const restante = Number(plazo.monto_total) - Number(plazo.monto_pagado || 0);
  const estatusNormalizado = plazo.estatus?.toUpperCase();
  const esLiquidado = estatusNormalizado === 'LIQUIDADO';
  const esAbonado = estatusNormalizado === 'ABONADO';
  
  const recibos = plazo.recibos_abonos || [];
  const tieneRecibos = recibos.length > 0;

  const handleCancelClick = (e: React.MouseEvent, recibo: any) => {
    e.stopPropagation();

    setConfirmCancelData({
      abono: recibo,
      onConfirm: async () => {
        try {
          // Actualizamos el estatus del recibo individual a CANCELADO en tu tabla relacional
          await mockApi.updateAbonoEstatus(recibo.id, 'CANCELADO');
          
          // Refrescamos los saldos desde el Servidor / Triggers
          await onRefreshNeeded();
          setSuccessMessage("El abono ha sido cancelado exitosamente y los saldos globales fueron recalculados.");
        } catch (err: any) {
          console.error("Error al cancelar abono:", err);
          alert(err.message || "Error al intentar comunicar la cancelación con la base de datos.");
        }
      }
    });
  };

  return (
    <div className="flex flex-col bg-white border-b border-slate-100 last:border-0">
      {/* Cabecera del Plazo */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="p-4 flex items-center justify-between gap-2 hover:bg-slate-50/60 transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-4 flex-1">
          <div className="text-slate-400">
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>

          <div className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
            esLiquidado && "bg-emerald-100 text-emerald-600",
            esAbonado && "bg-amber-100 text-amber-600",
            (!esLiquidado && !esAbonado) && "bg-slate-100 text-slate-500"
          )}>
            {esLiquidado ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 uppercase tracking-wide">
              {/* 🌟 Muestra el tipo original guardado (SEMANAL, QUINCENAL, MENSUAL, ENGANCHE) */}
              {plazo.tipo_pago?.toUpperCase() === 'ENGANCHE' 
                ? 'Enganche / Depósito Inicial' 
                : `${plazo.tipo_pago?.toUpperCase() || 'MENSUAL'} #${index + 1}`
              }
            </p>
            <p className="text-xs text-slate-400">Vence: {plazo.fecha_vencimiento}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-bold text-slate-900">{formatCurrency(plazo.monto_total)}</p>
            {restante > 0 ? (
              <p className="text-[11px] font-semibold text-amber-600">Restan: {formatCurrency(restante)}</p>
            ) : (
              <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Liquidado</p>
            )}
          </div>

          {!esLiquidado ? (
            <Button size="sm" onClick={onPayClick}>Pagar</Button>
          ) : (
            <div className="flex items-center gap-1 text-emerald-600 font-semibold text-xs bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg">
              <FileCheck className="h-3.5 w-3.5" />
              <span>Liquidado</span>
            </div>
          )}
        </div>
      </div>

      {/* Historial Desplegable con Animación Completa */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden bg-slate-50/50 px-11 pb-4"
          >
            <div className="pt-2 border-t border-slate-150 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recibos Emitidos en el Periodo ({recibos.length})</p>
              </div>

              {recibos.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-1 pl-1">No hay transacciones registradas para esta cuota.</p>
              ) : (
                <div className="space-y-1.5">
                  {recibos.map((recibo: any) => (
                    <div 
                      key={recibo.id}
                      className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                          <Receipt className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-700">Folio: #RA-{recibo.id}</p>
                          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-400">
                            <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> {recibo.fecha_pago}</span>
                            <span className="flex items-center gap-1 capitalize"><Wallet className="h-3 w-3" /> {recibo.metodo_pago}</span>
                          </div>
                          {recibo.observaciones && <p className="text-slate-500 italic text-[11px] mt-0.5">"{recibo.observaciones}"</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-600 mr-2">{formatCurrency(recibo.monto_abonado)}</span>
                        <button
                          type="button"
                          title="Reimprimir Recibo PDF"
                          onClick={() => generarReciboPDF(
                            Number(recibo.monto_abonado),
                            recibo.concepto,
                            recibo.metodo_pago,
                            recibo.fecha_pago,
                            recibo.id
                          )}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-lg transition-all"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Cancelar e Invalidar Abono"
                          onClick={(e) => handleCancelClick(e, recibo)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-lg transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}