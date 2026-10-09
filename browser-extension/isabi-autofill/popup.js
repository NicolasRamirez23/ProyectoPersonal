const status = document.getElementById('status');
document.getElementById('fill').addEventListener('click', async () => {
  try {
    const payload = JSON.parse(document.getElementById('payload').value);
    if (payload?.type !== 'avtech-isabi' || !payload.data) throw new Error('El contenido no corresponde a un expediente ISABI de AvTech.');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: fillIsabi, args: [payload.data] });
    status.textContent = `Listo: ${result.filled} campos completados; ${result.missing.length} no localizados. Revisa el formulario antes de registrar.`;
  } catch (error) { status.textContent = error.message || 'No se pudo completar el formulario.'; }
});

function fillIsabi(data) {
  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const mappings = {
    claveCatastral:['CLAVE CATASTRAL'],folio:['FOLIO'],tipoPredio:['TIPO'],naturalezaActo:['NATURALEZA DEL ACTO','CONCEPTO DE LA ADQUISICION'],descripcionAdquisicion:['DESCRIPCION'],actoTraslativo:['ACTO TRASLATIVO'],volumen:['VOLUMEN'],escrituraNumero:['ESCRITURA'],fechaEscritura:['FECHA DE ESCRITURA'],estadoEscritura:['ESTADO'],municipioEscritura:['MUNICIPIO'],lugarOtorgamiento:['LUGAR DEL OTORGAMIENTO'],fechaOtorgamiento:['FECHA DEL OTORGAMIENTO'],fechaFirma:['FECHA DE FIRMA'],datosEnajenante:['DATOS DE IDENTIFICACION DEL ENAJENANTE'],rfc:['RFC'],usoCfdi:['USO CFDI'],regimenFiscal:['REGIMEN FISCAL'],nombres:['NOMBRE'],apellidoPaterno:['APELLIDO PATERNO'],apellidoMaterno:['APELLIDO MATERNO'],codigoPostalFiscal:['CODIGO POSTAL'],correoElectronico:['CORREO ELECTRONICO'],datosAdquiriente:['DATOS DE IDENTIFICACION DEL ADQUIRIENTE'],notificacionColonia:['COLONIA'],notificacionCalle:['CALLE'],notificacionExterior:['NO EXTERIOR'],notificacionInterior:['NO INTERIOR'],clasificacionInmueble:['CLASIFICACION DEL INMUEBLE'],ubicacionLinderos:['UBICACION MEDIDAS Y LINDEROS'],superficieTerreno:['SUPERFICIE TERRENO'],superficieConstruccion:['SUPERFICIE CONSTRUCCION'],antecedentesPropiedad:['PROCEDENCIA O ANTECEDENTES'],folioReal:['FOLIO REAL'],valorFiscal:['VALOR FISCAL','VALOR CATASTRAL'],valorOperacion:['VALOR DE OPERACION'],valorAvaluo:['VALOR DE AVALUO'],fechaAvaluo:['FECHA DE AVALUO'],observaciones:['OBSERVACIONES']
  };
  const controls = [...document.querySelectorAll('input,select,textarea')].filter((element) => !['hidden','file','submit','button'].includes(element.type));
  const labelText = (element) => { const id = element.id && document.querySelector(`label[for="${CSS.escape(element.id)}"]`); const parent = element.closest('label,div,td,tr'); return `${id?.innerText || ''} ${parent?.innerText || ''} ${element.name || ''} ${element.id || ''} ${element.placeholder || ''}`; };
  const filled = []; const missing = [];
  const setValue = (element, value) => { if (element.tagName === 'SELECT') { const target = [...element.options].find((option) => normalize(option.text).includes(normalize(value)) || normalize(value).includes(normalize(option.text))); if (!target) return false; element.value = target.value; } else element.value = value; element.dispatchEvent(new Event('input',{bubbles:true})); element.dispatchEvent(new Event('change',{bubbles:true})); return true; };
  for (const [key, labels] of Object.entries(mappings)) { const value = data[key]; if (value === undefined || value === null || value === '') continue; const target = controls.find((element) => labels.some((label) => normalize(labelText(element)).includes(normalize(label))) && !element.dataset.avtechFilled); if (target && setValue(target, value)) { target.dataset.avtechFilled='1'; target.style.outline='2px solid #22c55e'; filled.push(key); } else missing.push(key); }
  return { filled: filled.length, missing };
}
