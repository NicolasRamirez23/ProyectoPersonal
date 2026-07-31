import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import html2pdf from 'html2pdf.js';
import { supabase } from '../services/supabaseClient.ts'; // Asegúrate de importar tu cliente de supabase

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount);
}

export function generateFolio() {
  return `BDG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

export function printReceipt(receiptPayload: any) {
  // Guardamos temporalmente los datos en el objeto window para que el componente fantasma los lea
  (window as any).__currentReceiptData = receiptPayload;
  
  // Pequeño delay de 100ms para asegurar que React pinte el HTML oculto antes de invocar el PDF
  setTimeout(() => {
    window.print();
  }, 100);
}

export async function saveReceiptToStorage(projectId: string | number, folio: string | number, receiptElementId: string) {
  const element = document.getElementById(receiptElementId);
  if (!element) return null;

  // 1️⃣ Forzamos temporalmente que el elemento oculto de impresión sea visible para la captura
  element.classList.remove('hidden', 'print:block');
  element.classList.add('block');

  // Opciones de configuración del PDF (Tamaño Carta, márgenes limpios)
  const options = {
    margin:       10,
    filename:     `recibo_${folio}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, logging: false, useCORS: true },
    jsPDF:        { unit: 'mm', format: 'letter', orientation: 'portrait' }
  };

  try {
    // 2️⃣ Generamos el PDF en memoria como un archivo binario (Blob) sin abrir ventanas
    const pdfBlob = await html2pdf().set(options).from(element).output('blob');

    // Restauramos el estado oculto del componente en la interfaz de usuario
    element.classList.remove('block');
    element.classList.add('hidden', 'print:block');

    // 3️⃣ Definimos la ruta estructurada: Carpeta del departamento / Nombre del archivo
    // Supabase crea las carpetas dinámicamente si no existen al hacer la subida
    const filePath = `${projectId}/recibo_${folio}.pdf`;

    // 4️⃣ Subimos el archivo al Bucket de Supabase
    const { data, error } = await supabase.storage
      .from('recibos_clientes')
      .upload(filePath, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true // Si el recibo ya existe, lo sobrescribe para evitar duplicados molestos
      });

    if (error) throw error;

    // 5️⃣ Obtenemos la URL pública del archivo recién guardado para guardarla en base de datos si se requiere
    const { data: { publicUrl } } = supabase.storage
      .from('recibos_clientes')
      .getPublicUrl(filePath);

    return publicUrl;

  } catch (err) {
    console.error("Error al guardar el PDF en el Storage:", err);
    // En caso de fallo, restauramos los estilos del HTML para no romper la pantalla
    element.classList.remove('block');
    element.classList.add('hidden', 'print:block');
    throw err;
  }
}

