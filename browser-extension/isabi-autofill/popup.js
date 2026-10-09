const status = document.getElementById('status');
document.getElementById('fill').addEventListener('click', async () => {
  try {
    const payload = JSON.parse(document.getElementById('payload').value);
    if (payload?.type !== 'avtech-isabi' || !payload.data) throw new Error('El contenido no corresponde a un expediente ISABI de AvTech.');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: fillIsabi, args: [payload.data] });
    status.textContent = `Listo: ${result.filled} campos completados; ${result.missing.length} no localizados. Revisa el formulario antes de registrar.`;
  } catch (error) { status.textContent = error.message || 'No se pudo completar el formulario.'; }
});

function fillIsabi(data) {
  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/gi, ' ').trim().toUpperCase();
  const mappings = {
    claveCatastral:['CLAVE CATASTRAL'], folio:['FOLIO'], tipoPredio:['TIPO'], naturalezaActo:['NATURALEZA DEL ACTO','CONCEPTO DE LA ADQUISICION'], descripcionAdquisicion:['DESCRIPCION'], cartaNoPropiedad:['CARTA DE NO PROPIEDAD'], entreConyugesParientes:['ENTRE CONYUGES','PARIENTES EN LINEA RECTA'], aplicaArticulo39:['APLICA ARTICULO 39'], cesionDerechosHereditarios:['CESION DE DERECHOS HEREDITARIOS'], tramitePorcentaje:['TRAMITE A PORCENTAJE'], actoTraslativo:['ACTO TRASLATIVO'], volumen:['VOLUMEN'], escrituraNumero:['ESCRITURA NUMERO','ESCRITURA'], fechaEscritura:['FECHA DE ESCRITURA'], estadoEscritura:['ESTADO'], municipioEscritura:['MUNICIPIO'], lugarOtorgamiento:['LUGAR DEL OTORGAMIENTO'], fechaOtorgamiento:['FECHA DEL OTORGAMIENTO'], fechaFirma:['FECHA DE FIRMA'], datosEnajenante:['DATOS DE IDENTIFICACION DEL ENAJENANTE'], personaTipo:['TIPO DE PERSONA','PERSONA FISICA','PERSONA MORAL'], rfc:['RFC'], usoCfdi:['USO CFDI'], regimenFiscal:['REGIMEN FISCAL'], nombres:['NOMBRE S','NOMBRE'], apellidoPaterno:['APELLIDO PATERNO'], apellidoMaterno:['APELLIDO MATERNO'], codigoPostalFiscal:['CODIGO POSTAL'], correoElectronico:['CORREO ELECTRONICO'], datosAdquiriente:['DATOS DE IDENTIFICACION DEL ADQUIRIENTE'], notificacionColonia:['COLONIA'], notificacionCalle:['CALLE'], notificacionExterior:['NUMERO EXTERIOR','NO EXTERIOR'], notificacionInterior:['NUMERO INTERIOR','NO INTERIOR'], clasificacionInmueble:['CLASIFICACION DEL INMUEBLE'], ubicacionLinderos:['UBICACION MEDIDAS Y LINDEROS'], superficieTerreno:['SUPERFICIE TERRENO'], superficieConstruccion:['SUPERFICIE CONSTRUCCION'], antecedentesPropiedad:['PROCEDENCIA O ANTECEDENTES'], folioReal:['FOLIO REAL'], valorFiscal:['VALOR FISCAL O CATASTRAL','VALOR FISCAL','VALOR CATASTRAL'], valorOperacion:['VALOR DE OPERACION'], valorAvaluo:['VALOR DE AVALUO'], fechaAvaluo:['FECHA DE AVALUO'], observaciones:['OBSERVACIONES']
  };
  const dateKeys = new Set(['fechaEscritura','fechaOtorgamiento','fechaFirma','fechaAvaluo']);
  const isVisible = (element) => {
    if (!element || element.disabled || element.parentElement?.closest('[hidden],.modal:not(.in):not(.show),[aria-hidden="true"]')) return false;
    const style = getComputedStyle(element);
    if (style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length) return true;
    if (element.tagName === 'SELECT') {
      const select2 = element.nextElementSibling?.classList?.contains('select2') ? element.nextElementSibling : element.parentElement?.querySelector('.select2-container');
      return Boolean(select2 && getComputedStyle(select2).display !== 'none' && select2.getClientRects().length);
    }
    return false;
  };
  const controls = [...document.querySelectorAll('input,select,textarea')].filter((element) => !['hidden','file','submit','button'].includes(element.type) && isVisible(element));
  const labels = [...document.querySelectorAll('label,.control-label')].filter(isVisible);
  const controlsNear = (label) => {
    if (label.htmlFor) { const linked = document.getElementById(label.htmlFor); if (controls.includes(linked)) return linked; }
    const nested = label.querySelector('input,select,textarea'); if (controls.includes(nested)) return nested;
    let container = label.parentElement;
    for (let depth = 0; container && depth < 5; depth += 1, container = container.parentElement) {
      const candidates = [...container.querySelectorAll('input,select,textarea')].filter((element) => controls.includes(element) && !element.dataset.avtechFilled);
      if (candidates.length === 1) return candidates[0];
    }
    const box = label.getBoundingClientRect();
    return controls.filter((element) => !element.dataset.avtechFilled).map((element) => { const rect = element.getBoundingClientRect(); return { element, score: Math.abs(rect.top - box.top) * 5 + (rect.left >= box.left ? Math.max(0, rect.left - box.right) : 1000) }; }).sort((a,b) => a.score - b.score)[0]?.element || null;
  };
  const findControl = (fieldLabels) => {
    const wanted = fieldLabels.map(normalize);
    for (const label of labels) {
      const text = normalize(label.textContent);
      if (wanted.some((candidate) => text === candidate || text.includes(candidate))) { const control = controlsNear(label); if (control) return control; }
    }
    return controls.find((element) => { const own = normalize(`${element.name || ''} ${element.id || ''} ${element.placeholder || ''} ${element.getAttribute('aria-label') || ''}`); return !element.dataset.avtechFilled && wanted.some((candidate) => own.includes(candidate)); });
  };
  const scoreOption = (text, wanted) => {
    const option = normalize(text); if (!option || /SELECCIONAR/.test(option)) return -1;
    if (option === wanted) return 100; if (option.includes(wanted) || wanted.includes(option)) return 80;
    const ignored = new Set(['DE','DEL','LA','EL','Y','EN','POR','CON','LOS','LAS']);
    const tokens = wanted.split(' ').filter((token) => token.length > 2 && !ignored.has(token));
    return tokens.length ? tokens.filter((token) => option.includes(token)).length / tokens.length * 60 : -1;
  };
  const formatDate = (value, element) => { const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/); return match && element.type !== 'date' ? `${match[3]}/${match[2]}/${match[1]}` : value; };
  const dispatch = (element) => ['input','change','blur'].forEach((name) => element.dispatchEvent(new Event(name, { bubbles: true })));
  const setValue = (element, value, key) => {
    if (element.type === 'checkbox') { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set; setter ? setter.call(element, Boolean(value)) : (element.checked = Boolean(value)); dispatch(element); return true; }
    if (element.type === 'radio') {
      const wanted = normalize(value); const group = controls.filter((candidate) => candidate.type === 'radio' && candidate.name === element.name);
      const target = group.find((candidate) => normalize(`${candidate.value} ${candidate.parentElement?.textContent || ''}`).includes(wanted)); if (!target) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set; setter ? setter.call(target, true) : (target.checked = true); dispatch(target); return true;
    }
    if (element.tagName === 'SELECT') {
      const wanted = normalize(value); const ranked = [...element.options].map((option) => ({ option, score: scoreOption(option.text, wanted) })).sort((a,b) => b.score - a.score);
      if (!ranked[0] || ranked[0].score < 25) return false;
      const target = ranked[0].option; const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set; setter ? setter.call(element, target.value) : (element.value = target.value);
      if (window.jQuery) window.jQuery(element).val(target.value).trigger('change'); dispatch(element); return true;
    }
    const finalValue = dateKeys.has(key) ? formatDate(value, element) : value; const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set; setter ? setter.call(element, finalValue) : (element.value = finalValue); dispatch(element); return true;
  };
  const filled = []; const missing = [];
  for (const [key, fieldLabels] of Object.entries(mappings)) {
    const value = data[key]; if (value === undefined || value === null || value === '') continue;
    const target = findControl(fieldLabels);
    if (target && setValue(target, value, key)) { target.dataset.avtechFilled = '1'; target.style.outline = '2px solid #22c55e'; const select2 = target.tagName === 'SELECT' ? target.parentElement?.querySelector('.select2-container') : null; if (select2) select2.style.outline = '2px solid #22c55e'; filled.push(key); } else missing.push(key);
  }
  return { filled: filled.length, missing };
}
