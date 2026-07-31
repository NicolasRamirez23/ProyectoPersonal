import { formatCurrency } from '../lib/utils';
import { format, parseISO } from 'date-fns';

interface ReceiptPDFProps {
  receiptData: {
    folio: string | number;
    cliente: string;
    departamentoNum: string | number;
    domicilio: string;
    concepto: string;
    montoAbonado: number;
    metodoPago: string;
    fechaPago: string;
    observaciones?: string;
    saldoRestantePeriodo: number;
  } | null;
}

export function ReceiptPDF({ receiptData }: ReceiptPDFProps) {
  if (!receiptData) return null;

  return (
    <div id="receipt-print-area" className="hidden print:block rc-container">
      
      {/* Encabezado */}
      <div className="rc-header">
        <div>
          <h1 className="rc-title">AVTECH</h1>
          <p className="rc-subtitle">Control de Recibos de Arrendamiento</p>
        </div>
        <div className="rc-header-right">
          <div className="rc-badge">
            <p className="rc-badge-label">Folio Recibo</p>
            <p className="rc-badge-value">#RB-{receiptData.folio}</p>
          </div>
          <p className="rc-date">
            Fecha Emisión: {format(new Date(), 'dd/MM/yyyy HH:mm')}
          </p>
        </div>
      </div>

      {/* Datos del Cliente y Departamento */}
      <div className="rc-grid-2 rc-info-box">
        <div className="rc-col">
          <p className="rc-section-title">Información del Cliente</p>
          <p className="rc-client-name">{receiptData.cliente.toUpperCase()}</p>
          <p className="rc-subtext">Estado de Cuenta Activo</p>
        </div>
      </div>

      {/* Detalle del Pago */}
      <div className="rc-table-wrapper">
        <table className="rc-table">
          <thead>
            <tr className="rc-table-head-tr">
              <th className="rc-th">Concepto / Descripción del Movimiento</th>
              <th className="rc-th">Método</th>
              <th className="rc-th">Fecha Pago</th>
              <th className="rc-th text-right">Total Pagado</th>
            </tr>
          </thead>
          <tbody>
            <tr className="rc-table-body-tr">
              <td className="rc-td font-medium">
                {receiptData.concept || 'Pago de mensualidad'}
              </td>
              <td className="rc-td" style={{ textTransform: 'capitalize' }}>{receiptData.metodoPago}</td>
              <td className="rc-td">{format(parseISO(receiptData.fechaPago), 'dd/MM/yyyy')}</td>
              <td className="rc-td text-right rc-total-amount">
                {formatCurrency(receiptData.montoAbonado)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Bloque de Notas y Firmas */}
      <div className="rc-grid-5" style={{ marginTop: '48px', alignItems: 'end' }}>
        <div className="rc-span-3">
          {receiptData.observaciones && (
            <>
              <p className="rc-section-title">Observaciones del Recibo</p>
              <p className="rc-observations">
                "{receiptData.observaciones}"
              </p>
            </>
          )}
          <div style={{ paddingTop: '8px' }}>
            <p className="rc-subtext-dark">
              * Saldo restante por cubrir en este periodo: <span style={{ fontWeight: 'bold' }}>{formatCurrency(receiptData.saldoRestantePeriodo)}</span>
            </p>
          </div>
        </div>

        <div className="rc-span-2 text-center" style={{ marginBottom: '10px' }}>
          <div className="rc-signature-line"></div>
          <div>
            <p className="rc-signature-title">Firma de Caja</p>
            <p className="rc-signature-sub">Administración de AvTech</p>
          </div>
        </div>
      </div>

      {/* 🚀 CSS PLANO ABSOLUTO - SIN RASTRO DE TAILWIND NI OKLCH */}
      <style>{`
        .rc-container {
          box-sizing: border-box;
          font-family: Arial, Helvetica, sans-serif !important;
          background-color: #ffffff !important;
          color: #0f172a !important;
          padding: 45px !important;
          width: 100%;
        }
        .rc-header {
          display: flex !important;
          justify-content: space-between !important;
          align-items: flex-start !important;
          border-bottom: 2px solid #e2e8f0 !important;
          padding-bottom: 24px !important;
          margin-bottom: 32px !important;
        }
        .rc-title {
          font-size: 24px !important;
          font-weight: 900 !important;
          letter-spacing: -0.5px !important;
          color: #1e1b4b !important;
          margin: 0 !important;
        }
        .rc-subtitle {
          font-size: 12px !important;
          color: #64748b !important;
          font-weight: 500 !important;
          margin: 4px 0 0 0 !important;
        }
        .rc-header-right {
          text-align: right !important;
        }
        .rc-badge {
          background-color: #f1f5f9 !important;
          border: 1px solid #e2e8f0 !important;
          padding: 8px 16px !important;
          border-radius: 12px !important;
          display: inline-block !important;
        }
        .rc-badge-label {
          font-size: 10px !important;
          text-transform: uppercase !important;
          font-weight: bold !important;
          letter-spacing: 1px !important;
          color: #64748b !important;
          margin: 0 !important;
        }
        .rc-badge-value {
          font-size: 18px !important;
          font-family: monospace !important;
          font-weight: bold !important;
          color: #1e293b !important;
          margin: 0 !important;
        }
        .rc-date {
          font-size: 12px !important;
          color: #94a3b8 !important;
          margin: 8px 0 0 0 !important;
        }
        .rc-grid-2 {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 24px !important;
        }
        .rc-grid-5 {
          display: grid !important;
          grid-template-columns: 1fr 1fr 1fr 1fr 1fr !important;
          gap: 32px !important;
        }
        .rc-span-3 { grid-column: span 3 !important; }
        .rc-span-2 { grid-column: span 2 !important; }
        
        .rc-info-box {
          background-color: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          padding: 20px !important;
          border-radius: 16px !important;
          margin-bottom: 32px !important;
        }
        .rc-col {
          display: flex !important;
          flex-direction: column !important;
        }
        .rc-border-left {
          border-left: 1px solid #e2e8f0 !important;
          padding-left: 24px !important;
        }
        .rc-section-title {
          font-size: 12px !important;
          font-weight: bold !important;
          color: #94a3b8 !important;
          text-transform: uppercase !important;
          letter-spacing: 1px !important;
          margin: 0 0 6px 0 !important;
        }
        .rc-client-name {
          font-size: 16px !important;
          font-weight: bold !important;
          color: #1e293b !important;
          margin: 0 !important;
        }
        .rc-subtext {
          font-size: 12px !important;
          color: #64748b !important;
          margin: 4px 0 0 0 !important;
        }
        .rc-subtext-dark {
          font-size: 12px !important;
          color: #475569 !important;
          margin: 0 !important;
        }
        .rc-meta-item {
          font-size: 14px !important;
        }
        .rc-meta-label {
          font-weight: 600 !important;
          color: #64748b !important;
          font-size: 12px !important;
          text-transform: uppercase !important;
          display: block !important;
        }
        .rc-meta-val-bold {
          font-weight: bold !important;
          color: #1e293b !important;
          font-size: 14px !important;
        }
        .rc-meta-val-text {
          font-size: 12px !important;
          color: #475569 !important;
          font-weight: 500 !important;
        }
        .rc-table-wrapper {
          border: 1px solid #e2e8f0 !important;
          border-radius: 16px !important;
          overflow: hidden !important;
          margin-bottom: 32px !important;
        }
        .rc-table {
          width: 100% !important;
          border-collapse: collapse !important;
          text-align: left !important;
          font-size: 14px !important;
        }
        .rc-table-head-tr {
          background-color: #f1f5f9 !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }
        .rc-th {
          padding: 16px !important;
          color: #475569 !important;
          font-weight: bold !important;
        }
        .rc-table-body-tr {
          color: #334155 !important;
        }
        .rc-td {
          padding: 16px !important;
          border-bottom: 1px solid #f1f5f9 !important;
        }
        .rc-total-amount {
          font-weight: bold !important;
          color: #059669 !important;
          font-size: 16px !important;
        }
        .rc-observations {
          font-size: 12px !important;
          color: #475569 !important;
          background-color: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          padding: 12px !important;
          border-radius: 12px !important;
          font-style: italic !important;
          margin: 4px 0 0 0 !important;
        }
        .rc-signature-line {
          border-bottom: 1px solid #cbd5e1 !important;
          margin: 0 auto 16px auto !important;
          width: 192px !important;
        }
        .rc-signature-title {
          font-size: 12px !important;
          font-weight: bold !important;
          color: #1e293b !important;
          text-transform: uppercase !important;
          letter-spacing: 1px !important;
          margin: 0 !important;
        }
        .rc-signature-sub {
          font-size: 10px !important;
          color: #94a3b8 !important;
          margin: 4px 0 0 0 !important;
        }
        .text-right { text-align: right !important; }
        .text-center { text-align: center !important; }

        @media print {
          body * { visibility: hidden !important; }
          #receipt-print-area, #receipt-print-area * { visibility: visible !important; }
          #receipt-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}