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
  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const mappings = {
    claveCatastral:['CLAVE CATASTRAL'],folio:['FOLIO'],tipoPredio:['TIPO'],naturalezaActo:['NATURALEZA DEL ACTO','CONCEPTO DE LA ADQUISICION'],descripcionAdquisicion:['DESCRIPCION'],actoTraslativo:['ACTO TRASLATIVO'],volumen:['VOLUMEN'],escrituraNumero:['ESCRITURA'],fechaEscritura:['FECHA DE ESCRITURA'],estadoEscritura:['ESTADO'],municipioEscritura:['MUNICIPIO'],lugarOtorgamiento:['LUGAR DEL OTORGAMIENTO'],fechaOtorgamiento:['FECHA DEL OTORGAMIENTO'],fechaFirma:['FECHA DE FIRMA'],datosEnajenante:['DATOS DE IDENTIFICACION DEL ENAJENANTE'],rfc:['RFC'],usoCfdi:['USO CFDI'],regimenFiscal:['REGIMEN FISCAL'],nombres:['NOMBRE'],apellidoPaterno:['APELLIDO PATERNO'],apellidoMaterno:['APELLIDO MATERNO'],codigoPostalFiscal:['CODIGO POSTAL'],correoElectronico:['CORREO ELECTRONICO'],datosAdquiriente:['DATOS DE IDENTIFICACION DEL ADQUIRIENTE'],notificacionColonia:['COLONIA'],notificacionCalle:['CALLE'],notificacionExterior:['NO EXTERIOR'],notificacionInterior:['NO INTERIOR'],clasificacionInmueble:['CLASIFICACION DEL INMUEBLE'],ubicacionLinderos:['UBICACION MEDIDAS Y LINDEROS'],superficieTerreno:['SUPERFICIE TERRENO'],superficieConstruccion:['SUPERFICIE CONSTRUCCION'],antecedentesPropiedad:['PROCEDENCIA O ANTECEDENTES'],folioReal:['FOLIO REAL'],valorFiscal:['VALOR FISCAL','VALOR CATASTRAL'],valorOperacion:['VALOR DE OPERACION'],valorAvaluo:['VALOR DE AVALUO'],fechaAvaluo:['FECHA DE AVALUO'],observaciones:['OBSERVACIONES']
  };
  const controls = [...document.querySelectorAll('input,select,textarea')].filter((element) => !['hidden','file','submit','button'].includes(element.type) && !element.disabled);
  const labels = [...document.querySelectorAll('label,.control-label')];
  const controlFromLabel = (label) => {
    if (label.htmlFor) {
      const linked = document.getElementById(label.htmlFor);
      if (linked && controls.includes(linked)) return linked;
    }
    const nested = label.querySelector('input,select,textarea');
    if (nested && controls.includes(nested)) return nested;
    let container = label.parentElement;
    for (let depth = 0; container && depth < 4; depth += 1, container = container.parentElement) {
      const candidates = [...container.querySelectorAll(':scope input,:scope select,:scope textarea')].filter((element) => controls.includes(element));
      if (candidates.length === 1) return candidates[0];
      const siblings = [...container.children];
      const labelIndex = siblings.indexOf(label);
      if (labelIndex >= 0) {
        for (const sibling of siblings.slice(labelIndex + 1)) {
          const candidate = sibling.matches?.('input,select,textarea') ? sibling : sibling.querySelector?.('input,select,textarea');
          if (candidate && controls.includes(candidate)) return candidate;
        }
      }
    }
    return null;
  };
  const findControl = (fieldLabels) => {
    const normalizedLabels = fieldLabels.map(normalize);
    for (const label of labels) {
      const text = normalize(label.textContent || '');
      if (normalizedLabels.some((wanted) => text === wanted || text.includes(wanted))) {
        const control = controlFromLabel(label);
        if (control && !control.dataset.avtechFilled) return control;
      }
    }
    return controls.find((element) => {
      const own = normalize(`${element.name || ''} ${element.id || ''} ${element.placeholder || ''} ${element.getAttribute('aria-label') || ''}`);
      return !element.dataset.avtechFilled && normalizedLabels.some((wanted) => own.includes(wanted));
    });
  };
  const filled = []; const missing = [];
  const setValue = (element, value) => {
    if (element.tagName === 'SELECT') {
      const wanted = normalize(value);
      const options = [...element.options].filter((option) => option.value && !/SELECCIONAR/i.test(option.text));
      const target = options.find((option) => normalize(option.text) === wanted)
        || options.find((option) => normalize(option.text).includes(wanted) || wanted.includes(normalize(option.text)));
      if (!target) return false;
      element.value = target.value;
      target.selected = true;
      if (window.jQuery) window.jQuery(element).val(target.value).trigger('input').trigger('change').trigger('select2:select');
    } else {
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value');
      if (descriptor?.set) descriptor.set.call(element, value); else element.value = value;
    }
    element.dispatchEvent(new Event('input',{bubbles:true}));
    element.dispatchEvent(new Event('change',{bubbles:true}));
    element.dispatchEvent(new Event('blur',{bubbles:true}));
    return true;
  };
  for (const [key, fieldLabels] of Object.entries(mappings)) {
    const value = data[key];
    if (value === undefined || value === null || value === '') continue;
    const target = findControl(fieldLabels);
    if (target && setValue(target, value)) {
      target.dataset.avtechFilled='1';
      target.style.outline='2px solid #22c55e';
      const visibleSelect = target.tagName === 'SELECT' && target.nextElementSibling?.classList?.contains('select2') ? target.nextElementSibling : null;
      if (visibleSelect) visibleSelect.style.outline='2px solid #22c55e';
      filled.push(key);
    } else missing.push(key);
  }
  return { filled: filled.length, missing };
}
