/* =============================================================================
   CONSTRUCTORA DEL VALLE S.A. — CLIENTE INTERACTIVO MODULAR Y ESPACIOSO
   Navegacion por paginas y sub-vistas sin saturacion visual
   ============================================================================= */

let estadoGlobal = null;
let etapaCircuitoActiva = 0;

const ETAPAS_CIRCUITO_A1 = [
  {
    numero: 'ETAPA 01',
    titulo: 'Requisicion Interna',
    ejecuta: 'Ingenieria Residente de Obra / Jefatura de Mantenimiento / Bodega Central',
    documento: 'Solicitud o Requisicion de Compra (REQ-XXXX)',
    control: 'Consulta obligatoria de existencias disponibles en Bodega Central (evitar comprar material ya almacenado), seleccion de codigo estandarizado (SKU) del catalogo maestro y verificacion de partida presupuestaria activa.',
    riesgoMitigado: 'Impide solicitar materiales con nombres libres o comprar articulos que ya tienen saldo disponible en otra bodega.'
  },
  {
    numero: 'ETAPA 02',
    titulo: 'Aprobacion por Umbral',
    ejecuta: 'Jefatura de Area / Jefatura de Compras / Gerencia Financiera / Gerencia General + Comite',
    documento: 'Requisicion Autorizada + Cuadro Comparativo de Cotizaciones',
    control: 'Segregacion de funciones (quien solicita no aprueba en firme), validacion del numero minimo de cotizaciones y calculo automatico del acumulado movil de 30 dias por area/proveedor.',
    riesgoMitigado: 'Neutraliza el riesgo de fraccionamiento (split purchasing), donde una compra grande se divide en varias pequenas.'
  },
  {
    numero: 'ETAPA 03',
    titulo: 'Emision de Orden (OC)',
    ejecuta: 'Departamento de Compras y Abastecimiento',
    documento: 'Orden de Compra Formal (OC-XXXX) enviada al proveedor',
    control: 'Validacion dura contra precios de Contratos Marco vigentes (Cemento ₡6 300 y Varilla ₡2 050 con Proveedor A) y escaneo preventivo de duplicidad en ventana de 3 dias.',
    riesgoMitigado: 'Evita ordenes duplicadas como OC-1041/OC-1042 y bloquea compras fuera de contrato con sobreprecio.'
  },
  {
    numero: 'ETAPA 04',
    titulo: 'Recepcion Fisica Ciega',
    ejecuta: 'Bodeguero de Obra o Encargado de Bodega Central',
    documento: 'Boleta de Recepcion de Mercancia (REC-XXXX) + Guia firmada',
    control: 'Recepcion ciega (blind receiving: la copia para bodega oculta las cantidades pedidas para obligar al conteo fisico real), verificacion de lote/calidad y asiento inmediato en Kardex.',
    riesgoMitigado: 'Elimina recepciones ficticias o faltantes de material al descargar en obra.'
  },
  {
    numero: 'ETAPA 05',
    titulo: 'Three-Way Match',
    ejecuta: 'Departamento de Contabilidad (Cuentas por Pagar)',
    documento: 'Acta de Cotejo de Tres Vias + Factura Electronica XML (FE-XXXX)',
    control: 'Three-Way Match: cruce automatizado entre (1) Orden de Compra (precio autorizado), (2) Boleta de Recepcion (cantidad ingresada al Kardex) y (3) Factura Electronica.',
    riesgoMitigado: 'Garantiza que solo se pague lo pedido, efectivamente recibido y facturado al precio contratado.'
  },
  {
    numero: 'ETAPA 06',
    titulo: 'Tesoreria y Pago',
    ejecuta: 'Tesoreria + Mancomunidad de Firmas Bancarias (Gerencia)',
    documento: 'Comprobante de Transferencia SINPE (PAG-XXXX)',
    control: 'Programacion al vencimiento del plazo de credito negociado (30/45/60 dias), doble firma bancaria mancomunada y sellado de documentos como LIQUIDADOS.',
    riesgoMitigado: 'Imposibilita pagar dos veces la misma factura o perder financiamiento de capital de trabajo.'
  }
];

const LINEAS_ERP_A2 = [
  { linea: 1, desc: 'Cemento gris 50 kg', area: 'Obras', prov: 'Proveedor A', cant: 200, precio: 6450, cat: 'Materiales de Obra Gris > Cementos y Aglomerantes', sku: 'MAT-CEM-001', menorPrecio: 6300 },
  { linea: 2, desc: 'Saco cemento uso general', area: 'Mantenimiento', prov: 'Proveedor B', cant: 40, precio: 7100, cat: 'Materiales de Obra Gris > Cementos y Aglomerantes', sku: 'MAT-CEM-001', menorPrecio: 6300 },
  { linea: 3, desc: 'CEM-GRIS-50', area: 'Bodega Central', prov: 'Proveedor A', cant: 300, precio: 6300, cat: 'Materiales de Obra Gris > Cementos y Aglomerantes', sku: 'MAT-CEM-001', menorPrecio: 6300 },
  { linea: 4, desc: 'Varilla #3 grado 40', area: 'Obras', prov: 'Proveedor C', cant: 500, precio: 2150, cat: 'Materiales de Obra Gris > Acero de Refuerzo', sku: 'MAT-ACE-003', menorPrecio: 2150 },
  { linea: 5, desc: 'Hierro 3/8 x 6 m', area: 'Mantenimiento', prov: 'Proveedor D', cant: 60, precio: 2600, cat: 'Materiales de Obra Gris > Acero de Refuerzo', sku: 'MAT-ACE-003', menorPrecio: 2150 },
  { linea: 6, desc: 'Guantes de nitrilo talla L', area: 'Bodega Central', prov: 'Proveedor E', cant: 100, precio: 850, cat: 'Seguridad Ocupacional y EPP > Proteccion Manual', sku: 'EPP-GUA-001', menorPrecio: 850 },
  { linea: 7, desc: 'Guantes trabajo L', area: 'Obras', prov: 'Proveedor F', cant: 80, precio: 1200, cat: 'Seguridad Ocupacional y EPP > Proteccion Manual', sku: 'EPP-GUA-001', menorPrecio: 850 },
  { linea: 8, desc: 'Tubo PVC 1/2 SDR 13.5', area: 'Mantenimiento', prov: 'Proveedor B', cant: 25, precio: 2900, cat: 'Instalaciones Hidrosanitarias > Tuberia PVC', sku: 'HID-PVC-012', menorPrecio: 2900 }
];

function formatoColones(valor) {
  return '₡' + Math.round(Number(valor || 0)).toLocaleString('es-CR');
}

function formatoNumero(valor) {
  return Number(valor || 0).toLocaleString('es-CR');
}

function animarContador(elemento, valorFinal, prefijo = '', sufijo = '', duracion = 700) {
  if (!elemento) return;
  const inicio = performance.now();
  const valorInicial = Number(elemento.dataset.valorActual || 0);
  elemento.dataset.valorActual = valorFinal;

  function tick(ahora) {
    const progreso = Math.min(1, (ahora - inicio) / duracion);
    const ease = 1 - Math.pow(1 - progreso, 4);
    const actual = Math.round(valorInicial + (valorFinal - valorInicial) * ease);
    elemento.textContent = `${prefijo}${actual.toLocaleString('es-CR')}${sufijo}`;
    if (progreso < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function mostrarNotificacion(mensaje) {
  const banner = document.getElementById('toast-notification');
  if (!banner) return;
  banner.textContent = mensaje;
  banner.classList.add('visible');
  clearTimeout(banner._timer);
  banner._timer = setTimeout(() => banner.classList.remove('visible'), 4600);
}

function activarPagina(pageId) {
  const btn = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (!btn) return;

  document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.view-page').forEach((p) => p.classList.remove('active'));

  btn.classList.add('active');
  const page = document.getElementById(pageId);
  if (page) page.classList.add('active');

  document.getElementById('stage-bc').textContent = btn.dataset.bc || '';
  document.getElementById('stage-title').textContent = btn.dataset.title || '';

  requestAnimationFrame(() => {
    document.querySelectorAll('.meter-fill').forEach((el) => {
      el.style.width = el.dataset.targetWidth || '0%';
    });
  });
}

async function cargarDashboard() {
  const res = await fetch('/api/dashboard');
  const data = await res.json();
  estadoGlobal = data;

  animarContador(document.getElementById('kpi-valor-inventario'), data.kpis.valor_inventario_colones, '₡');
  animarContador(
    document.getElementById('kpi-bajo-pr'),
    data.kpis.materiales_bajo_pr,
    '',
    data.kpis.materiales_bajo_pr === 1 ? ' MATERIAL' : ' MATERIALES'
  );
  animarContador(document.getElementById('kpi-fuga-mensual'), data.kpis.fuga_mensual_identificada_colones, '₡');
  animarContador(document.getElementById('kpi-fuga-anual'), data.kpis.proyeccion_fuga_anual_colones, '₡');
  const elAhorro = document.getElementById('kpi-ahorro-a2');
  if (elAhorro) elAhorro.textContent = formatoColones(data.kpis.ahorro_homologacion_a2_colones);

  renderizarResumenMateriales(data.materiales);
  renderizarAlertasActivas(data.alertas_reorden, data.alertas_activas);
  renderizarTablaMateriales(data.materiales);
  renderizarCurvaAgotamiento(data.materiales);
  renderizarSelectoresFormulario(data.materiales, data.ubicaciones);
  renderizarUltimosMovimientos(data.ultimos_movimientos);
  renderizarAuditoriaGasto(data.auditoria_gasto);
  renderizarCircuitoA1();
  renderizarBandejaAprobaciones(data.auditoria_gasto.lineas_analizadas);
  renderizarTablaA2();
  renderizarMatrizProveedores(data.proveedores_evaluacion);
  renderizarPromocionesOpcion3(data.promociones_opcion3);
  inicializarThreeWayMatch(data.auditoria_gasto.lineas_analizadas);
}

function renderizarPromocionesOpcion3(promoData) {
  const tbody = document.getElementById('tbody-promociones-casos');
  if (!tbody || !promoData) return;

  tbody.innerHTML = (promoData.cinco_casos_prueba || []).map((c, idx) => {
    const descHtml = (c.promociones_descartadas || []).map((d) =>
      `<div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--ink-secondary); margin-bottom: 3px;">• <strong>${d.codigo_promo}:</strong> ${d.motivo_descarte}</div>`
    ).join('') || '<span style="color: var(--ink-muted); font-size: 0.75rem;">Ninguna descartada</span>';

    return `
      <tr class="stagger-row" style="--idx: ${idx};">
        <td><strong>${c.referencia_caso}</strong></td>
        <td>${c.material} (<span class="sku-tag">${c.categoria}</span>)</td>
        <td class="num-cell">${formatoColones(c.monto_bruto_colones)}</td>
        <td>
          ${c.promocion_aplicada
            ? `<span class="status-pill pill-ok">${c.promocion_aplicada.codigo_promo}</span>`
            : `<span class="status-pill pill-warning">NINGUNA APLICABLE</span>`}
        </td>
        <td class="num-cell" style="font-weight: 700; color: ${c.ahorro_aplicado_colones > 0 ? 'var(--oxide)' : 'var(--ink-muted)'};">
          ${formatoColones(c.ahorro_aplicado_colones)}
        </td>
        <td class="num-cell" style="font-weight: 700;">${formatoColones(c.monto_neto_colones)}</td>
        <td>${descHtml}</td>
      </tr>
    `;
  }).join('');
}

async function ejecutarCotejoThreeWay(payload) {
  const res = await fetch('/api/three-way-match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  const panel = document.getElementById('resultado-three-way-panel');
  if (!panel || !res.ok) return;

  const exito = data.resultado_match === 'COTEJO_EXITOSO_PAGO_AUTORIZADO';
  panel.innerHTML = `
    <div style="border: 2px solid ${exito ? 'var(--oxide)' : 'var(--vermilion)'}; padding: 1.35rem; background: ${exito ? 'var(--oxide-soft)' : 'var(--vermilion-soft)'}; margin-bottom: 1.25rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <span class="status-pill ${exito ? 'pill-ok' : 'pill-critical'}">${data.resultado_match}</span>
        <span style="font-family: var(--font-mono); font-weight: 700;">${data.orden_compra} // ${data.numero_factura}</span>
      </div>
      <div style="font-weight: 700; font-size: 1rem;">${data.material} — ${data.proveedor}</div>
      <div style="font-family: var(--font-mono); font-size: 0.82rem; margin-top: 0.45rem;">
        Monto Facturado: <strong>${formatoColones(data.monto_facturado_colones)}</strong> &nbsp;|&nbsp;
        Monto Autorizado a Pagar: <strong>${formatoColones(data.monto_autorizado_colones)}</strong>
      </div>
    </div>

    <div class="split-3col" style="margin-bottom: 1.25rem; gap: 0.85rem;">
      <div style="border: 1px solid var(--line-subtle); padding: 0.85rem; background: var(--bg-canvas);">
        <div class="field-label">1. ORDEN DE COMPRA</div>
        <div style="font-family: var(--font-mono); font-size: 0.85rem; margin-top: 0.25rem;">
          Cant: <strong>${data.comparativa.oc_cantidad}</strong><br/>
          Precio: <strong>${formatoColones(data.comparativa.oc_precio)}</strong>
        </div>
      </div>
      <div style="border: 1px solid var(--line-subtle); padding: 0.85rem; background: var(--bg-canvas);">
        <div class="field-label">2. RECEPCION CIEGA</div>
        <div style="font-family: var(--font-mono); font-size: 0.85rem; margin-top: 0.25rem;">
          Cant. Fisica: <strong>${data.comparativa.recepcion_cantidad}</strong><br/>
          Contrato: <strong>${formatoColones(data.comparativa.contrato_precio)}</strong>
        </div>
      </div>
      <div style="border: 1px solid var(--line-subtle); padding: 0.85rem; background: var(--bg-canvas);">
        <div class="field-label">3. FACTURA XML</div>
        <div style="font-family: var(--font-mono); font-size: 0.85rem; margin-top: 0.25rem;">
          Cant. Cobrada: <strong>${data.comparativa.factura_cantidad}</strong><br/>
          Precio Cobrado: <strong>${formatoColones(data.comparativa.factura_precio)}</strong>
        </div>
      </div>
    </div>

    ${data.discrepancias.length > 0 ? `
      <div style="border-left: 3px solid var(--vermilion); padding-left: 1rem;">
        <div class="field-label" style="color: var(--vermilion); margin-bottom: 0.35rem;">CAUSAS DE RETENCION DEL PAGO:</div>
        ${data.discrepancias.map((d) => `<div style="font-size: 0.82rem; margin-bottom: 0.35rem; color: var(--ink-primary);">• ${d}</div>`).join('')}
      </div>
    ` : `
      <div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--oxide); font-weight: 600;">
        Cruce exacto en las tres vias: cantidad recibida igual a facturada y tarifa conforme al Contrato Marco. Listo para transferencia SINPE.
      </div>
    `}
  `;
}

function inicializarThreeWayMatch(ordenes) {
  const sel = document.getElementById('twm-oc');
  if (!sel || !ordenes) return;

  if (sel.options.length === 0) {
    sel.innerHTML = ordenes.map((o) =>
      `<option value="${o.id}" data-cant="${o.cantidad}" data-precio="${o.precio_unitario_colones}">${o.numero_oc} — ${o.descripcion_erp_original} (${o.cantidad} u. @ ₡${o.precio_unitario_colones})</option>`
    ).join('');
    sel.value = '7'; // OC-1061 (300 sacos a 6300)

    sel.addEventListener('change', () => {
      const opt = sel.options[sel.selectedIndex];
      document.getElementById('twm-cant-rec').value = opt.dataset.cant;
      document.getElementById('twm-cant-fact').value = opt.dataset.cant;
      document.getElementById('twm-precio-fact').value = opt.dataset.precio;
    });
  }

  ejecutarCotejoThreeWay({
    orden_compra_id: Number(sel.value || 7),
    cantidad_recibida_bodega: Number(document.getElementById('twm-cant-rec').value),
    cantidad_facturada: Number(document.getElementById('twm-cant-fact').value),
    precio_unitario_facturado: Number(document.getElementById('twm-precio-fact').value),
    numero_factura: document.getElementById('twm-num-fact').value
  });
}

function renderizarResumenMateriales(materiales) {
  const cont = document.getElementById('resumen-materiales-cards');
  if (!cont) return;

  const principales = [...materiales]
    .sort((a, b) => a.orden_prioridad_global - b.orden_prioridad_global)
    .slice(0, 4);

  cont.innerHTML = principales.map((m) => {
    const escalaMax = Math.max(m.punto_reorden * 1.4, m.stock_actual * 1.15, 1);
    const pctStock = Math.min(100, Math.round((m.stock_actual / escalaMax) * 100));
    const pctPR = Math.min(95, Math.round((m.punto_reorden / escalaMax) * 100));
    const clase = m.requiere_reposicion_hoy ? 'critical' : (m.estado_stock === 'ALERTA_PREVENTIVA' ? 'warning' : 'ok');

    return `
      <div style="padding: 1.1rem 0; border-bottom: 1px solid var(--line-subtle); display: grid; grid-template-columns: 1.3fr 1fr auto; gap: 1.25rem; align-items: center;">
        <div>
          <div style="display: flex; align-items: center; gap: 0.55rem; margin-bottom: 0.3rem;">
            <span class="sku-tag">#${m.orden_prioridad_global} ${m.codigo_estandar}</span>
            <span class="status-pill ${m.requiere_reposicion_hoy ? 'pill-critical' : 'pill-ok'}">
              ${m.requiere_reposicion_hoy ? 'REPONER HOY' : 'EN RANGO'}
            </span>
          </div>
          <div style="font-weight: 600; font-size: 0.94rem;">${m.nombre_estandar}</div>
          <div style="font-family: var(--font-mono); font-size: 0.74rem; color: var(--ink-muted); margin-top: 0.15rem;">
            Stock Actual: <strong>${m.stock_actual} ${m.unidad_medida}</strong> &nbsp;|&nbsp; PR: <strong>${m.punto_reorden}</strong> &nbsp;|&nbsp; SS: <strong>${m.stock_seguridad}</strong>
          </div>
        </div>
        <div class="meter-box">
          <div class="meter-top">
            <span>${m.ratio_stock_pr_pct}% del PR</span>
            <span>Autonomia: ${m.dias_autonomia}d</span>
          </div>
          <div class="meter-bar">
            <div class="meter-fill ${clase}" data-target-width="${pctStock}%"></div>
            <div class="meter-pr-line" style="left: ${pctPR}%;"></div>
          </div>
        </div>
        <button type="button" class="btn-tech btn-ver-kardex" data-id="${m.id}" style="padding: 0.45rem 0.75rem;">
          KARDEX
        </button>
      </div>
    `;
  }).join('');

  requestAnimationFrame(() => {
    cont.querySelectorAll('.meter-fill').forEach((el) => {
      el.style.width = el.dataset.targetWidth || '0%';
    });
  });

  cont.querySelectorAll('.btn-ver-kardex').forEach((btn) => {
    btn.addEventListener('click', () => abrirDrawerTrazabilidad(btn.dataset.id));
  });
}

function renderizarAlertasActivas(alertasReorden, alertasSistema) {
  const cont = document.getElementById('contenedor-alertas-activas');
  if (!cont) return;

  const topAlertas = (alertasSistema || []).slice(0, 4);
  cont.innerHTML = topAlertas.map((a) => `
    <div style="padding: 1rem 1.15rem; border: 1px solid var(--line-subtle); background: var(--bg-canvas); margin-bottom: 0.9rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
        <span class="status-pill ${a.severidad === 'CRITICA' ? 'pill-critical' : 'pill-warning'}">${a.codigo_alerta} // ${a.tipo_alerta}</span>
        <span style="font-family: var(--font-mono); font-size: 0.74rem; font-weight: 600;">${formatoColones(a.impacto_colones)}</span>
      </div>
      <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.25rem;">${a.titulo}</div>
      <div style="font-size: 0.8rem; color: var(--ink-secondary); line-height: 1.5;">${a.detalle_tecnico}</div>
    </div>
  `).join('');
}

function renderizarTablaMateriales(materiales) {
  const tbody = document.getElementById('tbody-materiales');
  if (!tbody) return;

  const ordenados = [...materiales].sort((a, b) => a.orden_prioridad_global - b.orden_prioridad_global);

  tbody.innerHTML = ordenados.map((m, idx) => {
    const escalaMax = Math.max(m.punto_reorden * 1.45, m.stock_actual * 1.15, 1);
    const pctStock = Math.min(100, Math.round((m.stock_actual / escalaMax) * 100));
    const pctPR = Math.min(95, Math.round((m.punto_reorden / escalaMax) * 100));
    const clase = m.requiere_reposicion_hoy ? 'critical' : (m.estado_stock === 'ALERTA_PREVENTIVA' ? 'warning' : 'ok');

    return `
      <tr class="stagger-row ${m.requiere_reposicion_hoy ? 'row-alert' : ''}" style="--idx: ${idx};">
        <td><span class="sku-tag">#${m.orden_prioridad_global}</span></td>
        <td>
          <div style="font-weight: 600;">${m.nombre_estandar}</div>
          <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--ink-muted); margin-top: 2px;">
            ${m.codigo_estandar} &nbsp;|&nbsp; ${m.taxonomia}
          </div>
        </td>
        <td class="num-cell">${m.demanda_diaria_prom} / ${m.demanda_diaria_max} ${m.unidad_medida}</td>
        <td class="num-cell">${m.tiempo_entrega_dias} dias</td>
        <td class="num-cell" style="font-weight: 600;">${formatoNumero(m.stock_seguridad)} ${m.unidad_medida}</td>
        <td class="num-cell" style="font-weight: 700;">${formatoNumero(m.punto_reorden)} ${m.unidad_medida}</td>
        <td class="num-cell" style="font-weight: 700; color: ${m.requiere_reposicion_hoy ? 'var(--vermilion)' : 'var(--ink-primary)'};">
          ${formatoNumero(m.stock_actual)} ${m.unidad_medida}
        </td>
        <td>
          <div class="meter-box">
            <div class="meter-top">
              <span>${m.ratio_stock_pr_pct}% PR</span>
              <span>${m.dias_autonomia}d stock</span>
            </div>
            <div class="meter-bar">
              <div class="meter-fill ${clase}" data-target-width="${pctStock}%"></div>
              <div class="meter-pr-line" style="left: ${pctPR}%;"></div>
            </div>
          </div>
        </td>
        <td>
          <span class="status-pill ${m.requiere_reposicion_hoy ? 'pill-critical' : (m.estado_stock === 'ALERTA_PREVENTIVA' ? 'pill-warning' : 'pill-ok')}">
            ${m.requiere_reposicion_hoy ? `REPONER (-${m.deficit_unidades})` : `HOLGURA (+${m.holgura_unidades})`}
          </span>
        </td>
        <td>
          <button type="button" class="btn-tech btn-ver-kardex" data-id="${m.id}" style="padding: 0.42rem 0.7rem;">
            TRAZABILIDAD
          </button>
        </td>
      </tr>
    `;
  }).join('');

  requestAnimationFrame(() => {
    tbody.querySelectorAll('.meter-fill').forEach((el) => {
      el.style.width = el.dataset.targetWidth || '0%';
    });
  });

  tbody.querySelectorAll('.btn-ver-kardex').forEach((btn) => {
    btn.addEventListener('click', () => abrirDrawerTrazabilidad(btn.dataset.id));
  });
}

function renderizarCurvaAgotamiento(materiales, materialIdForzado, overrideParams = null) {
  const sel = document.getElementById('sel-curva-material');
  const contSvg = document.getElementById('contenedor-svg-curva');
  const contMet = document.getElementById('contenedor-metricas-curva');
  if (!sel || !contSvg || !contMet || !materiales || materiales.length === 0) return;

  if (sel.options.length === 0) {
    sel.innerHTML = materiales.map((m) =>
      `<option value="${m.id}">${m.codigo_estandar} — ${m.nombre_estandar}</option>`
    ).join('');
    sel.value = '4';
    sel.addEventListener('change', () => {
      renderizarCurvaAgotamiento(estadoGlobal.materiales, Number(sel.value));
    });
  }

  const matId = Number(materialIdForzado || sel.value || 4);
  const baseMat = materiales.find((x) => x.id === matId) || materiales[0];

  const dProm = overrideParams ? Number(overrideParams.dProm) : Number(baseMat.demanda_diaria_prom);
  const dMax = overrideParams ? Math.max(dProm, Number(overrideParams.dMax)) : Number(baseMat.demanda_diaria_max);
  const leadTime = overrideParams ? Math.max(0.5, Number(overrideParams.leadTime)) : Number(baseMat.tiempo_entrega_dias);
  const stockAct = overrideParams ? Math.max(0, Number(overrideParams.stockAct)) : Number(baseMat.stock_actual);

  const ssCalc = Number(((dMax - dProm) * leadTime).toFixed(2));
  const prCalc = Number(((dProm * leadTime) + ssCalc).toFixed(2));
  const reqHoy = stockAct <= prCalc;
  const auton = dProm > 0 ? Number((stockAct / dProm).toFixed(2)) : 999;

  const m = {
    ...baseMat,
    demanda_diaria_prom: dProm,
    demanda_diaria_max: dMax,
    tiempo_entrega_dias: leadTime,
    stock_actual: stockAct,
    stock_seguridad: ssCalc,
    punto_reorden: prCalc,
    requiere_reposicion_hoy: reqHoy,
    dias_autonomia: auton
  };

  const maxY = Math.max(m.stock_actual * 1.25, m.punto_reorden * 1.35, 10);
  const diasHorizonte = Math.max(7, Math.ceil(m.tiempo_entrega_dias * 2));
  const w = 580;
  const h = 230;
  const padL = 48;
  const padR = 20;
  const padT = 22;
  const padB = 32;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const xCoord = (dia) => padL + (dia / diasHorizonte) * plotW;
  const yCoord = (val) => padT + plotH - (Math.max(0, val) / maxY) * plotH;

  const ptsProm = [];
  const ptsMax = [];
  for (let d = 0; d <= diasHorizonte; d += 0.5) {
    const sProm = Math.max(0, m.stock_actual - m.demanda_diaria_prom * d);
    const sMax = Math.max(0, m.stock_actual - m.demanda_diaria_max * d);
    ptsProm.push(`${xCoord(d).toFixed(1)},${yCoord(sProm).toFixed(1)}`);
    ptsMax.push(`${xCoord(d).toFixed(1)},${yCoord(sMax).toFixed(1)}`);
  }

  const yPR = yCoord(m.punto_reorden).toFixed(1);
  const ySS = yCoord(m.stock_seguridad).toFixed(1);

  contSvg.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" style="width: 100%; height: auto; font-family: 'IBM Plex Mono', monospace;">
      <rect x="${padL}" y="${ySS}" width="${plotW}" height="${(padT + plotH - ySS).toFixed(1)}" fill="rgba(200, 50, 20, 0.08)" />
      <line x1="${padL}" y1="${yPR}" x2="${w - padR}" y2="${yPR}" stroke="#121210" stroke-width="1.5" stroke-dasharray="5,4" />
      <text x="${w - padR - 4}" y="${Number(yPR) - 6}" text-anchor="end" font-size="9.5" font-weight="600" fill="#121210">
        PUNTO REORDEN (PR = ${m.punto_reorden} ${m.unidad_medida})
      </text>
      <line x1="${padL}" y1="${ySS}" x2="${w - padR}" y2="${ySS}" stroke="#C83214" stroke-width="1.2" stroke-dasharray="3,3" />
      <text x="${w - padR - 4}" y="${Number(ySS) - 6}" text-anchor="end" font-size="9" font-weight="600" fill="#C83214">
        STOCK SEGURIDAD (SS = ${m.stock_seguridad} ${m.unidad_medida})
      </text>
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#121210" stroke-width="1.5" />
      <line x1="${padL}" y1="${padT + plotH}" x2="${w - padR}" y2="${padT + plotH}" stroke="#121210" stroke-width="1.5" />
      <polyline points="${ptsMax.join(' ')}" fill="none" stroke="#C83214" stroke-width="2" class="svg-draw-path" />
      <polyline points="${ptsProm.join(' ')}" fill="none" stroke="#1B3B9B" stroke-width="2.5" class="svg-draw-path" />
      <circle cx="${xCoord(0)}" cy="${yCoord(m.stock_actual)}" r="4.5" fill="#121210" />
      <text x="${padL + 8}" y="${Math.max(15, yCoord(m.stock_actual) - 6)}" font-size="9.5" font-weight="700" fill="#121210">
        HOY: ${m.stock_actual} ${m.unidad_medida}
      </text>
      <text x="${padL}" y="${h - 8}" font-size="9" fill="#4A4943">Dia 0</text>
      <text x="${xCoord(m.tiempo_entrega_dias)}" y="${h - 8}" text-anchor="middle" font-size="9" font-weight="600" fill="#C83214">
        Entrega L = ${m.tiempo_entrega_dias}d
      </text>
      <text x="${w - padR}" y="${h - 8}" text-anchor="end" font-size="9" fill="#4A4943">Dia +${diasHorizonte}</text>
    </svg>
  `;

  contMet.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
      <span class="sku-tag">${m.codigo_estandar} // CALCULADORA WHAT-IF</span>
      <span class="status-pill ${m.requiere_reposicion_hoy ? 'pill-critical' : 'pill-ok'}">
        ${m.requiere_reposicion_hoy ? 'REPOSICION OBLIGATORIA HOY' : 'DENTRO DE MARGEN'}
      </span>
    </div>
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.6rem; margin-bottom: 0.9rem; background: var(--bg-canvas); padding: 0.75rem; border: 1px solid var(--line-subtle);">
      <div>
        <label class="field-label" style="font-size: 0.63rem;">Dem. Prom (d)</label>
        <input type="number" id="sim-d-prom" class="field-input" value="${m.demanda_diaria_prom}" step="1" style="width: 100%; padding: 0.35rem;" />
      </div>
      <div>
        <label class="field-label" style="font-size: 0.63rem;">Dem. Max</label>
        <input type="number" id="sim-d-max" class="field-input" value="${m.demanda_diaria_max}" step="1" style="width: 100%; padding: 0.35rem;" />
      </div>
      <div>
        <label class="field-label" style="font-size: 0.63rem;">Entrega L (d)</label>
        <input type="number" id="sim-lead" class="field-input" value="${m.tiempo_entrega_dias}" step="0.5" style="width: 100%; padding: 0.35rem;" />
      </div>
      <div>
        <label class="field-label" style="font-size: 0.63rem;">Stock Actual</label>
        <input type="number" id="sim-stock" class="field-input" value="${m.stock_actual}" step="1" style="width: 100%; padding: 0.35rem;" />
      </div>
    </div>
    <div style="font-family: var(--font-mono); font-size: 0.79rem; line-height: 1.75; color: var(--ink-secondary); margin-bottom: 1rem;">
      • <strong>SS = (d_max − d) × L:</strong> (${m.demanda_diaria_max} − ${m.demanda_diaria_prom}) × ${m.tiempo_entrega_dias} = <strong>${m.stock_seguridad} ${m.unidad_medida}</strong><br/>
      • <strong>PR = (d × L) + SS:</strong> (${m.demanda_diaria_prom} × ${m.tiempo_entrega_dias}) + ${m.stock_seguridad} = <strong>${m.punto_reorden} ${m.unidad_medida}</strong><br/>
      • <strong>Autonomia actual:</strong> ${m.dias_autonomia} dias | <strong>Proveedor optimo:</strong> ${m.proveedor_sugerido ? `${m.proveedor_sugerido.nombre_comercial.split(' ')[0]} (${formatoColones(m.proveedor_sugerido.precio_colones)})` : 'Contrato Marco'}
    </div>
    <button type="button" id="btn-auto-oc-curva" class="btn-tech btn-primary" style="width: 100%; justify-content: center;">
      GENERAR OC CON PROVEEDOR MAS BARATO (${formatoNumero(m.cantidad_sugerida_oc)} ${m.unidad_medida})
    </button>
  `;

  ['sim-d-prom', 'sim-d-max', 'sim-lead', 'sim-stock'].forEach((inputId) => {
    document.getElementById(inputId)?.addEventListener('change', () => {
      renderizarCurvaAgotamiento(materiales, matId, {
        dProm: document.getElementById('sim-d-prom').value,
        dMax: document.getElementById('sim-d-max').value,
        leadTime: document.getElementById('sim-lead').value,
        stockAct: document.getElementById('sim-stock').value
      });
    });
  });

  document.getElementById('btn-auto-oc-curva')?.addEventListener('click', async () => {
    const provId = m.proveedor_sugerido ? m.proveedor_sugerido.proveedor_id : (m.proveedor_contrato_id || 1);
    const precio = m.proveedor_sugerido ? m.proveedor_sugerido.precio_colones : (m.precio_contrato_colones || 1000);
    const res = await fetch('/api/ordenes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        area_solicitante: 'Bodega Central',
        ubicacion_id: 1,
        proveedor_id: provId,
        material_id: m.id,
        cantidad: m.cantidad_sugerida_oc,
        precio_unitario_colones: precio,
        cotizaciones_presentadas: 3
      })
    });
    const data = await res.json();
    if (res.ok) {
      mostrarNotificacion(
        `ORDEN ${data.orden.numero_oc} CREADA (${m.cantidad_sugerida_oc} ${m.unidad_medida} @ ${formatoColones(precio)}). Requiere firma de: ${data.control_aprobacion.rol_aprobador_requerido}.`
      );
      await cargarDashboard();
    }
  });
}

function renderizarSelectoresFormulario(materiales, ubicaciones) {
  const selMat = document.getElementById('mov-material');
  const selOrig = document.getElementById('mov-origen');
  const selDest = document.getElementById('mov-destino');
  const selOcMat = document.getElementById('oc-material');
  const selOcProv = document.getElementById('oc-proveedor');

  if (selMat) {
    const valPrev = selMat.value;
    const htmlOpts = materiales.map((m) =>
      `<option value="${m.id}">${m.codigo_estandar} — ${m.nombre_estandar} (${m.stock_actual} ${m.unidad_medida})</option>`
    ).join('');
    selMat.innerHTML = htmlOpts;
    if (valPrev) selMat.value = valPrev;
    if (selOcMat && selOcMat.options.length === 0) selOcMat.innerHTML = htmlOpts;
  }

  if (selOrig && selOrig.options.length === 0) {
    const optsUbi = ubicaciones.map((u) => `<option value="${u.id}">${u.codigo} — ${u.nombre}</option>`).join('');
    selOrig.innerHTML = optsUbi;
    selDest.innerHTML = optsUbi;
    selOrig.value = '2';
    selDest.value = '1';
  }

  if (selOcProv && selOcProv.options.length === 0) {
    selOcProv.innerHTML = `
      <option value="3">PROV-C — Aceros y Metales CR (Fuera de contrato)</option>
      <option value="1">PROV-A — Construplaza (Contrato Marco CM-2026-001)</option>
      <option value="7">PROV-NOV — Novex (Contrato Respaldo CM-2026-002)</option>
      <option value="2">PROV-B — Ferreteria del Este (Fuera de contrato)</option>
      <option value="6">PROV-F — EPA (Ferreteria Retail)</option>
    `;
  }
}

function renderizarUltimosMovimientos(movimientos) {
  const tbody = document.getElementById('tbody-ultimos-movimientos');
  if (!tbody) return;

  tbody.innerHTML = (movimientos || []).map((mv, idx) => {
    let pill = 'pill-info';
    if (mv.tipo_movimiento === 'ENTRADA') pill = 'pill-ok';
    if (mv.tipo_movimiento === 'SALIDA') pill = 'pill-critical';
    if (mv.tipo_movimiento === 'TRASLADO') pill = 'pill-warning';

    return `
      <tr class="stagger-row" style="--idx: ${idx};">
        <td><span class="sku-tag">${mv.codigo_movimiento}</span></td>
        <td style="font-family: var(--font-mono); font-size: 0.78rem;">${mv.fecha_hora}</td>
        <td><span class="status-pill ${pill}">${mv.tipo_movimiento}</span></td>
        <td><strong>${mv.codigo_estandar}</strong> — ${mv.nombre_estandar}</td>
        <td class="num-cell" style="font-weight: 600;">${formatoNumero(mv.cantidad)} ${mv.unidad_medida}</td>
        <td style="font-size: 0.8rem;">${mv.ubicacion_origen_nombre || 'Proveedor'} &rarr; ${mv.ubicacion_destino_nombre || 'Consumo Obra'}</td>
        <td><span class="sku-tag">${mv.documento_origen}</span></td>
        <td style="font-family: var(--font-mono); font-size: 0.76rem;">${mv.lote_serie}</td>
        <td>${mv.usuario_responsable}</td>
        <td class="num-cell" style="font-weight: 700;">${formatoNumero(mv.saldo_resultante_material)} ${mv.unidad_medida}</td>
      </tr>
    `;
  }).join('');
}

function renderizarAuditoriaGasto(auditoria) {
  const panelEscenarios = document.getElementById('panel-escenarios-fuga');
  const contPares = document.getElementById('contenedor-pares-duplicados');
  const tbody = document.getElementById('tbody-ordenes-auditoria');
  if (!auditoria) return;

  const r = auditoria.resumen_octubre_a3;
  panelEscenarios.innerHTML = `
    <div style="border: 1px solid var(--line-strong); padding: 1.35rem; background: var(--bg-canvas);">
      <span class="sku-tag" style="margin-bottom: 0.6rem;">ESCENARIO 1 // SOBREPRECIO PURO</span>
      <div style="font-family: var(--font-mono); font-size: 1.5rem; font-weight: 700; color: var(--amber);">
        ${formatoColones(r.escenario_1_sobreprecio_tarifario.fuga_mensual_colones)} / mes
      </div>
      <div style="font-family: var(--font-mono); font-size: 0.82rem; margin: 0.35rem 0;">
        Proyeccion Anual: <strong>${formatoColones(r.escenario_1_sobreprecio_tarifario.proyeccion_anual_colones)}</strong>
      </div>
      <p style="font-size: 0.8rem; color: var(--ink-secondary); line-height: 1.5;">
        Diferencia pagada sobre tarifa de contrato (₡6 300 cemento y ₡2 050 varilla).
      </p>
    </div>
    <div style="border: 1px solid var(--vermilion); padding: 1.35rem; background: var(--vermilion-soft);">
      <span class="sku-tag" style="margin-bottom: 0.6rem; border-color: var(--vermilion); color: var(--vermilion);">
        ESCENARIO 2 // SOBREPRECIO + OC-1042 DUPLICADA
      </span>
      <div style="font-family: var(--font-mono); font-size: 1.5rem; font-weight: 700; color: var(--vermilion);">
        ${formatoColones(r.escenario_2_sobreprecio_mas_duplicado_exacto.fuga_mensual_colones)} / mes
      </div>
      <div style="font-family: var(--font-mono); font-size: 0.82rem; margin: 0.35rem 0;">
        Proyeccion Anual: <strong>${formatoColones(r.escenario_2_sobreprecio_mas_duplicado_exacto.proyeccion_anual_colones)}</strong>
      </div>
      <p style="font-size: 0.8rem; color: var(--ink-secondary); line-height: 1.5;">
        Incluye la emision doble de <code>OC-1042</code> (₡1 290 000) mas ₡193 000 de sobreprecios restantes.
      </p>
    </div>
    <div style="border: 1px solid var(--line-strong); padding: 1.35rem; background: var(--bg-canvas);">
      <span class="sku-tag" style="margin-bottom: 0.6rem;">ESCENARIO 3 // MAXIMA EXPOSICION</span>
      <div style="font-family: var(--font-mono); font-size: 1.5rem; font-weight: 700;">
        ${formatoColones(r.escenario_3_maximo_riesgo_ambos_duplicados.fuga_mensual_colones)} / mes
      </div>
      <div style="font-family: var(--font-mono); font-size: 0.82rem; margin: 0.35rem 0;">
        Proyeccion Anual: <strong>${formatoColones(r.escenario_3_maximo_riesgo_ambos_duplicados.proyeccion_anual_colones)}</strong>
      </div>
      <p style="font-size: 0.8rem; color: var(--ink-secondary); line-height: 1.5;">
        Gasto fuera de contrato (Prov. B, C, D): <strong>${formatoColones(r.gasto_proveedores_fuera_contrato_colones)}</strong> (${r.porcentaje_maverick_spend}%).
      </p>
    </div>
  `;

  contPares.innerHTML = auditoria.pares_duplicados_detectados.map((p) => `
    <div style="border: 1px solid var(--line-strong); padding: 1.35rem; background: var(--bg-canvas);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
        <span class="status-pill ${p.severidad === 'CRITICA' ? 'pill-critical' : 'pill-warning'}">${p.clasificacion}</span>
        <span style="font-family: var(--font-mono); font-weight: 700;">${p.orden_original} &lt;-&gt; ${p.orden_sospechosa}</span>
      </div>
      <div style="font-weight: 700; font-size: 0.98rem; margin-bottom: 0.4rem;">${p.articulo} — ${p.proveedor} (${p.area})</div>
      <div style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--ink-secondary); line-height: 1.65;">
        • Diferencia de fechas: <strong>${p.diferencia_dias} dias</strong> (${p.fecha_original} vs ${p.fecha_sospechosa})<br/>
        • Variacion de cantidad: <strong>${p.variacion_cantidad_pct}%</strong> (${p.cantidad_original} vs ${p.cantidad_sospechosa})<br/>
        • Monto Orden Sospechosa: <strong>${formatoColones(p.monto_orden_sospechosa)}</strong> (Acumulado Par: ${formatoColones(p.monto_acumulado_par)})
        ${p.evade_umbral_aprobacion ? `<br/><span style="color: var(--vermilion); font-weight: 600;">• Fraccionamiento evade umbral de: ${p.umbral_evadido}</span>` : ''}
      </div>
    </div>
  `).join('');

  tbody.innerHTML = auditoria.lineas_analizadas.map((oc, idx) => {
    const esCritica = oc.es_duplicado_exacto || oc.es_cuasi_duplicado || oc.sobreprecio_total_calculado > 0;
    let pill = `<span class="status-pill pill-ok">CUMPLE CONTRATO</span>`;
    if (oc.es_duplicado_exacto) pill = `<span class="status-pill pill-critical">DUPLICADA EXACTA</span>`;
    else if (oc.es_cuasi_duplicado) pill = `<span class="status-pill pill-critical">FRACCIONADA / DUPLICADA</span>`;
    else if (oc.proveedor_fuera_de_contrato) pill = `<span class="status-pill pill-warning">FUERA DE CONTRATO</span>`;
    else if (oc.sobreprecio_total_calculado > 0) pill = `<span class="status-pill pill-warning">SOBREPRECIO TARIFA</span>`;

    return `
      <tr class="stagger-row ${esCritica ? 'row-alert' : ''}" style="--idx: ${idx};">
        <td><span class="sku-tag">${oc.numero_oc}</span></td>
        <td style="font-family: var(--font-mono); font-size: 0.8rem;">${oc.fecha_emision}</td>
        <td>${oc.area_solicitante}</td>
        <td><strong>${oc.proveedor_nombre}</strong></td>
        <td>${oc.descripcion_erp_original}</td>
        <td class="num-cell">${formatoNumero(oc.cantidad)}</td>
        <td class="num-cell">${formatoColones(oc.precio_unitario_colones)}</td>
        <td class="num-cell">${formatoColones(oc.precio_contrato_oficial)}</td>
        <td class="num-cell" style="font-weight: 600;">${formatoColones(oc.monto_total_colones)}</td>
        <td class="num-cell" style="font-weight: 700; color: ${oc.sobreprecio_total_calculado > 0 ? 'var(--vermilion)' : 'var(--oxide)'};">
          ${formatoColones(oc.sobreprecio_total_calculado)}
        </td>
        <td>${pill}</td>
        <td>
          <button type="button" class="btn-tech btn-ver-oc-doc" data-id="${oc.id}" style="padding: 0.35rem 0.65rem;">
            VER OC
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-ver-oc-doc').forEach((btn) => {
    btn.addEventListener('click', () => abrirComprobanteOC(Number(btn.dataset.id)));
  });
}

function abrirComprobanteOC(ocId) {
  if (!estadoGlobal || !estadoGlobal.auditoria_gasto) return;
  const oc = estadoGlobal.auditoria_gasto.lineas_analizadas.find((o) => o.id === ocId);
  if (!oc) return;

  document.getElementById('drawer-sku').textContent = `COMPROBANTE FORMAL // ${oc.numero_oc}`;
  document.getElementById('drawer-title').textContent = `Orden de Compra ${oc.numero_oc} — Constructora Del Valle S.A.`;

  const body = document.getElementById('drawer-body-content');
  body.innerHTML = `
    <div style="border: 2px solid var(--line-strong); padding: 1.75rem; background: var(--bg-surface);">
      <div style="display: flex; justify-content: space-between; border-bottom: 2px solid var(--line-strong); padding-bottom: 1rem; margin-bottom: 1.25rem;">
        <div>
          <div style="font-family: var(--font-display); font-size: 1.25rem; font-weight: 700;">CONSTRUCTORA DEL VALLE S.A.</div>
          <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--ink-secondary);">Cedula Juridica: 3-101-482910 | Departamento de Abastecimiento</div>
        </div>
        <div style="text-align: right; font-family: var(--font-mono);">
          <div style="font-size: 1.15rem; font-weight: 700;">${oc.numero_oc}</div>
          <div style="font-size: 0.75rem;">Fecha Emision: ${oc.fecha_emision}</div>
        </div>
      </div>

      <div class="split-2col-equal" style="margin-bottom: 1.25rem;">
        <div style="border: 1px solid var(--line-subtle); padding: 0.9rem; background: var(--bg-canvas);">
          <div class="field-label">PROVEEDOR ADJUDICADO</div>
          <div style="font-weight: 700; margin-top: 0.25rem;">${oc.proveedor_nombre} (${oc.proveedor_codigo})</div>
          <div style="font-family: var(--font-mono); font-size: 0.74rem; color: var(--ink-secondary);">
            Contrato Marco: ${oc.tiene_contrato_marco ? 'ACTIVO (CM-2026-001)' : 'NO POSEE CONTRATO VIGENTE'}
          </div>
        </div>
        <div style="border: 1px solid var(--line-subtle); padding: 0.9rem; background: var(--bg-canvas);">
          <div class="field-label">CENTRO DE COSTO Y AUTORIZACION A1</div>
          <div style="font-weight: 700; margin-top: 0.25rem;">Area: ${oc.area_solicitante}</div>
          <div style="font-family: var(--font-mono); font-size: 0.74rem; color: var(--ink-secondary);">
            Nivel Exigido: ${oc.rol_aprobador_requerido} (${oc.cotizaciones_presentadas}/${oc.cotizaciones_requeridas} cotizaciones)
          </div>
        </div>
      </div>

      <table class="clean-table" style="border: 1px solid var(--line-strong); margin-bottom: 1.25rem;">
        <thead>
          <tr>
            <th>SKU Estandar</th>
            <th>Descripcion en Orden</th>
            <th class="num-cell">Cantidad</th>
            <th class="num-cell">Precio OC</th>
            <th class="num-cell">Tarifa Contrato</th>
            <th class="num-cell">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><span class="sku-tag">${oc.codigo_estandar}</span></td>
            <td><strong>${oc.descripcion_erp_original}</strong></td>
            <td class="num-cell">${formatoNumero(oc.cantidad)} ${oc.unidad_medida}</td>
            <td class="num-cell">${formatoColones(oc.precio_unitario_colones)}</td>
            <td class="num-cell">${formatoColones(oc.precio_contrato_oficial)}</td>
            <td class="num-cell" style="font-weight: 700;">${formatoColones(oc.monto_total_colones)}</td>
          </tr>
        </tbody>
      </table>

      <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 1rem; border-top: 1px solid var(--line-subtle);">
        <div>
          <span class="status-pill ${oc.estado_aprobacion === 'APROBADA' ? 'pill-ok' : 'pill-critical'}">
            ESTADO: ${oc.estado_aprobacion}
          </span>
          <div style="font-family: var(--font-mono); font-size: 0.74rem; margin-top: 0.35rem; color: var(--ink-secondary);">
            Firmado por: ${oc.aprobado_por || 'PENDIENTE DE FIRMA'} | Sobreprecio detectado: ${formatoColones(oc.sobreprecio_total_calculado)}
          </div>
        </div>
        <button type="button" onclick="window.print()" class="btn-tech btn-primary">IMPRIMIR COMPROBANTE OC</button>
      </div>
    </div>
  `;

  document.getElementById('drawer-backdrop').classList.add('open');
  document.getElementById('kardex-drawer').classList.add('open');
}

function renderizarCircuitoA1() {
  const contNodos = document.getElementById('circuit-nodes-container');
  const contDetalle = document.getElementById('circuit-detail-panel');
  if (!contNodos || !contDetalle) return;

  contNodos.innerHTML = ETAPAS_CIRCUITO_A1.map((et, idx) => `
    <div class="step-card ${idx === etapaCircuitoActiva ? 'active' : ''}" data-step="${idx}">
      <div style="font-family: var(--font-mono); font-size: 0.7rem; color: ${idx === etapaCircuitoActiva ? '#FF7A5C' : 'var(--vermilion)'}; font-weight: 600; margin-bottom: 0.35rem;">
        ${et.numero}
      </div>
      <div style="font-family: var(--font-display); font-weight: 700; font-size: 0.95rem; margin-bottom: 0.25rem;">${et.titulo}</div>
      <div style="font-family: var(--font-mono); font-size: 0.7rem; opacity: 0.75;">${et.documento.split('(')[0]}</div>
    </div>
  `).join('');

  const actual = ETAPAS_CIRCUITO_A1[etapaCircuitoActiva];
  contDetalle.innerHTML = `
    <div>
      <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 1rem;">
        <span class="panel-tag">${actual.numero}</span>
        <h3 style="font-family: var(--font-display); font-size: 1.3rem;">${actual.titulo}</h3>
      </div>
      <div class="split-2col-equal" style="margin-bottom: 1.15rem; gap: 1rem;">
        <div style="border: 1px solid var(--line-subtle); padding: 1rem; background: var(--bg-canvas);">
          <div class="field-label" style="margin-bottom: 0.3rem;">QUIEN EJECUTA LA ETAPA</div>
          <div style="font-weight: 600; font-size: 0.9rem;">${actual.ejecuta}</div>
        </div>
        <div style="border: 1px solid var(--line-subtle); padding: 1rem; background: var(--bg-canvas);">
          <div class="field-label" style="margin-bottom: 0.3rem;">DOCUMENTO GENERADO</div>
          <div style="font-family: var(--font-mono); font-weight: 600; font-size: 0.86rem; color: var(--cobalt);">${actual.documento}</div>
        </div>
      </div>
      <div style="border-left: 3px solid var(--vermilion); padding-left: 1rem; margin-bottom: 0.85rem;">
        <div class="field-label" style="color: var(--vermilion); margin-bottom: 0.3rem;">CONTROL APLICADO</div>
        <p style="font-size: 0.88rem; line-height: 1.6;">${actual.control}</p>
      </div>
      <p style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--ink-secondary);">
        <strong>Riesgo mitigado:</strong> ${actual.riesgoMitigado}
      </p>
    </div>
    <div style="border: 1px solid var(--line-subtle); padding: 1.25rem; background: var(--bg-canvas); display: flex; flex-direction: column; justify-content: center;">
      <div class="field-label" style="margin-bottom: 0.75rem;">ESQUEMA DEL THREE-WAY MATCH (COTEJO DE TRES VIAS)</div>
      <svg viewBox="0 0 540 190" style="width: 100%; height: auto; font-family: 'IBM Plex Mono', monospace;">
        <rect x="10" y="15" width="150" height="58" fill="#FAF9F5" stroke="#121210" stroke-width="1.5" />
        <text x="20" y="36" font-size="10" font-weight="600" fill="#121210">1. ORDEN DE COMPRA</text>
        <text x="20" y="54" font-size="9" fill="#45443F">Precio + Condicion</text>

        <rect x="195" y="15" width="150" height="58" fill="#FAF9F5" stroke="#121210" stroke-width="1.5" />
        <text x="205" y="36" font-size="10" font-weight="600" fill="#121210">2. RECEPCION CIEGA</text>
        <text x="205" y="54" font-size="9" fill="#45443F">Cantidad Real Kardex</text>

        <rect x="380" y="15" width="150" height="58" fill="#FAF9F5" stroke="#121210" stroke-width="1.5" />
        <text x="390" y="36" font-size="10" font-weight="600" fill="#121210">3. FACTURA XML</text>
        <text x="390" y="54" font-size="9" fill="#45443F">Cobro del Proveedor</text>

        <path d="M 85 73 L 270 120" stroke="#121210" stroke-width="1.5" />
        <path d="M 270 73 L 270 120" stroke="#C83214" stroke-width="2" />
        <path d="M 455 73 L 270 120" stroke="#121210" stroke-width="1.5" />

        <rect x="120" y="120" width="300" height="55" fill="#121210" />
        <text x="142" y="143" font-size="10.5" font-weight="600" fill="#F4F2EC">MOTOR THREE-WAY MATCH CONTABLE</text>
        <text x="142" y="160" font-size="9" fill="#22C55E">SI (Cant_Fact == Cant_Rec) &amp;&amp; (Precio == OC) -&gt; PAGO</text>
      </svg>
    </div>
  `;

  contNodos.querySelectorAll('.step-card').forEach((card) => {
    card.addEventListener('click', () => {
      etapaCircuitoActiva = Number(card.dataset.step);
      renderizarCircuitoA1();
    });
  });
}

function renderizarBandejaAprobaciones(ordenes) {
  const cont = document.getElementById('bandeja-oc-pendientes');
  if (!cont) return;

  const relevantes = (ordenes || []).filter(
    (o) => o.estado_aprobacion === 'PENDIENTE_APROBACION' || o.estado_aprobacion === 'OBSERVADA_DUPLICADO'
  );

  if (relevantes.length === 0) {
    cont.innerHTML = `<div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--ink-muted);">No hay ordenes pendientes de firma.</div>`;
    return;
  }

  cont.innerHTML = relevantes.map((oc) => `
    <div style="border: 1px solid var(--line-strong); padding: 1rem; margin-bottom: 0.75rem; background: var(--bg-canvas); display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
      <div>
        <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.3rem;">
          <span class="sku-tag">${oc.numero_oc}</span>
          <span class="status-pill ${oc.estado_aprobacion === 'PENDIENTE_APROBACION' ? 'pill-warning' : 'pill-critical'}">${oc.estado_aprobacion}</span>
          <span style="font-family: var(--font-mono); font-weight: 700;">${formatoColones(oc.monto_total_colones)}</span>
        </div>
        <div style="font-size: 0.88rem; font-weight: 600;">${oc.descripcion_erp_original} (${oc.cantidad} ${oc.unidad_medida}) — ${oc.proveedor_nombre}</div>
        <div style="font-family: var(--font-mono); font-size: 0.74rem; color: var(--ink-secondary); margin-top: 0.2rem;">
          Requiere Rol: <strong>${oc.rol_aprobador_requerido}</strong> | Cotizaciones: ${oc.cotizaciones_presentadas}/${oc.cotizaciones_requeridas}
        </div>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button type="button" class="btn-tech btn-primary btn-firmar-oc" data-id="${oc.id}" data-accion="APROBAR">APROBAR</button>
        <button type="button" class="btn-tech btn-firmar-oc" data-id="${oc.id}" data-accion="RECHAZAR">RECHAZAR</button>
      </div>
    </div>
  `).join('');

  cont.querySelectorAll('.btn-firmar-oc').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const rol = document.getElementById('rol-firmante-activo').value;
      const res = await fetch(`/api/ordenes/${btn.dataset.id}/aprobar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rol_usuario: rol, nombre_aprobador: rol, accion: btn.dataset.accion })
      });
      const payload = await res.json();
      if (!res.ok) {
        mostrarNotificacion(`BLOQUEO MATRIZ A1: ${payload.error}`);
      } else {
        mostrarNotificacion(`ORDEN ${payload.numero_oc} -> ${payload.estado_aprobacion}`);
        cargarDashboard();
      }
    });
  });
}

function renderizarTablaA2() {
  const tbody = document.getElementById('tbody-a2-reclasificacion');
  if (!tbody) return;

  tbody.innerHTML = LINEAS_ERP_A2.map((item, idx) => {
    const gastoReal = item.cant * item.precio;
    const ahorro = item.cant * (item.precio - item.menorPrecio);
    return `
      <tr class="stagger-row" style="--idx: ${idx};">
        <td class="num-cell">#${item.linea}</td>
        <td style="font-family: var(--font-mono); font-weight: 600;">"${item.desc}"</td>
        <td>${item.area} / ${item.prov}</td>
        <td class="num-cell">${formatoNumero(item.cant)}</td>
        <td class="num-cell">${formatoColones(item.precio)}</td>
        <td class="num-cell">${formatoColones(gastoReal)}</td>
        <td style="font-family: var(--font-mono); font-size: 0.76rem;">${item.cat}</td>
        <td><span class="sku-tag">${item.sku}</span></td>
        <td class="num-cell">${formatoColones(item.menorPrecio)}</td>
        <td class="num-cell" style="font-weight: 700; color: ${ahorro > 0 ? 'var(--oxide)' : 'var(--ink-muted)'};">
          ${ahorro > 0 ? formatoColones(ahorro) : '₡0'}
        </td>
      </tr>
    `;
  }).join('');
}

function renderizarMatrizProveedores(evaluacion, pesosCustom = null) {
  const tbodyA4 = document.getElementById('tbody-matriz-a4');
  const panelRanking = document.getElementById('panel-ranking-a4');
  const tbodyComp = document.getElementById('tbody-comparador-precios');
  if (!evaluacion || !tbodyA4) return;

  const provsBase = evaluacion.ranking_proveedores_a4;
  const construplaza = provsBase.find((p) => p.codigo === 'PROV-A');
  const novex = provsBase.find((p) => p.codigo === 'PROV-NOV');
  const epa = provsBase.find((p) => p.codigo === 'PROV-F');

  const pesosActivos = pesosCustom || evaluacion.criterios_ponderacion.map((c) => c.peso_pct);
  const sumaPesos = pesosActivos.reduce((a, b) => a + Number(b), 0) || 100;

  let totalC1 = 0;
  let totalC2 = 0;
  let totalC3 = 0;

  tbodyA4.innerHTML = evaluacion.criterios_ponderacion.map((c, idx) => {
    const peso = Number(pesosActivos[idx]);
    const factor = peso / sumaPesos;
    const n1 = construplaza.desglose_criterios[idx].nota_1_a_5;
    const n2 = novex.desglose_criterios[idx].nota_1_a_5;
    const n3 = epa.desglose_criterios[idx].nota_1_a_5;

    const p1 = n1 * factor;
    const p2 = n2 * factor;
    const p3 = n3 * factor;
    totalC1 += p1;
    totalC2 += p2;
    totalC3 += p3;

    return `
      <tr>
        <td><strong>${c.nombre}</strong></td>
        <td class="num-cell">
          <input type="number" class="field-input input-peso-a4" data-idx="${idx}" value="${peso}" min="0" max="100" style="width: 64px; padding: 0.25rem 0.4rem; text-align: right;" /> %
        </td>
        <td class="num-cell">Nota ${n1} &rarr; <strong>${p1.toFixed(2)}</strong></td>
        <td class="num-cell">Nota ${n2} &rarr; <strong>${p2.toFixed(2)}</strong></td>
        <td class="num-cell">Nota ${n3} &rarr; <strong>${p3.toFixed(2)}</strong></td>
      </tr>
    `;
  }).join('') + `
    <tr style="background: var(--bg-muted); font-weight: 700;">
      <td>PUNTAJE PONDERADO TOTAL (Ajustable en vivo)</td>
      <td class="num-cell">${sumaPesos}%</td>
      <td class="num-cell" style="color: var(--oxide);">${totalC1.toFixed(2)} / 5.00</td>
      <td class="num-cell" style="color: var(--cobalt);">${totalC2.toFixed(2)} / 5.00</td>
      <td class="num-cell" style="color: var(--amber);">${totalC3.toFixed(2)} / 5.00</td>
    </tr>
  `;

  tbodyA4.querySelectorAll('.input-peso-a4').forEach((inp) => {
    inp.addEventListener('change', () => {
      const nuevos = Array.from(tbodyA4.querySelectorAll('.input-peso-a4')).map((el) => Number(el.value || 0));
      renderizarMatrizProveedores(evaluacion, nuevos);
    });
  });

  const rankingDinamico = [
    { ...construplaza, puntaje_total_5: totalC1, indice_desempeno_100: Number(((totalC1 / 5) * 100).toFixed(1)) },
    { ...novex, puntaje_total_5: totalC2, indice_desempeno_100: Number(((totalC2 / 5) * 100).toFixed(1)) },
    { ...epa, puntaje_total_5: totalC3, indice_desempeno_100: Number(((totalC3 / 5) * 100).toFixed(1)) }
  ].sort((a, b) => b.puntaje_total_5 - a.puntaje_total_5);

  panelRanking.innerHTML = `
    ${rankingDinamico.map((p, i) => `
      <div style="margin-bottom: 1.15rem;">
        <div style="display: flex; justify-content: space-between; font-size: 0.9rem; font-weight: 600; margin-bottom: 0.35rem;">
          <span>#${i + 1} ${p.nombre_comercial} (Credito ${p.plazo_credito_dias}d)</span>
          <span style="font-family: var(--font-mono);">${p.puntaje_total_5.toFixed(2)} / 5.00 (${p.indice_desempeno_100}%)</span>
        </div>
        <div class="meter-bar">
          <div class="meter-fill ${i === 0 ? 'ok' : (i === 1 ? 'warning' : 'critical')}" style="width: ${p.indice_desempeno_100}%;"></div>
        </div>
      </div>
    `).join('')}
    <div style="border: 1px solid var(--line-strong); padding: 1.15rem; background: var(--bg-canvas); margin-top: 1.25rem;">
      <span class="sku-tag" style="margin-bottom: 0.5rem;">ESTRATEGIA RECOMENDADA: ${evaluacion.estrategia_recomendada.modelo}</span>
      <p style="font-size: 0.85rem; line-height: 1.6; color: var(--ink-secondary);">
        ${evaluacion.estrategia_recomendada.justificacion}
      </p>
    </div>
  `;

  tbodyComp.innerHTML = evaluacion.comparador_precios_vigentes.map((item) => {
    const [o1, o2, o3] = item.ofertas_ordenadas;
    const fmt = (of) => of ? `<strong>${of.proveedor_nombre.split(' ')[0]}</strong>: ${formatoColones(of.precio_colones)}` : '—';
    return `
      <tr>
        <td><span class="sku-tag">${item.codigo_estandar}</span></td>
        <td><strong>${item.nombre_estandar}</strong></td>
        <td style="color: var(--oxide);">${fmt(o1)}</td>
        <td>${fmt(o2)}</td>
        <td>${fmt(o3)}</td>
        <td class="num-cell" style="color: var(--vermilion); font-weight: 600;">+${item.brecha_maxima_pct}%</td>
        <td><span class="sku-tag">Adjudicar 80% a ${o1 ? o1.proveedor_nombre.split(' ')[0] : 'Contrato'}</span></td>
      </tr>
    `;
  }).join('');
}

async function abrirDrawerTrazabilidad(materialId) {
  const res = await fetch(`/api/materiales/${materialId}/trazabilidad`);
  if (!res.ok) return;
  const data = await res.json();

  document.getElementById('drawer-sku').textContent = `${data.material.codigo_estandar} // ${data.material.taxonomia}`;
  document.getElementById('drawer-title').textContent = data.material.nombre_estandar;

  const body = document.getElementById('drawer-body-content');
  body.innerHTML = `
    <div class="split-3col" style="margin-bottom: 1.5rem;">
      <div style="border: 1px solid var(--line-strong); padding: 1.15rem; background: var(--bg-canvas);">
        <div class="field-label">STOCK ACTUAL</div>
        <div style="font-family: var(--font-mono); font-size: 1.45rem; font-weight: 700; margin-top: 0.25rem;">
          ${formatoNumero(data.material.stock_actual)} ${data.material.unidad_medida}
        </div>
      </div>
      <div style="border: 1px solid var(--line-strong); padding: 1.15rem; background: var(--bg-canvas);">
        <div class="field-label">PUNTO DE REORDEN (PR)</div>
        <div style="font-family: var(--font-mono); font-size: 1.45rem; font-weight: 700; color: var(--vermilion); margin-top: 0.25rem;">
          ${formatoNumero(data.material.punto_reorden)} ${data.material.unidad_medida}
        </div>
      </div>
      <div style="border: 1px solid var(--line-strong); padding: 1.15rem; background: var(--bg-canvas);">
        <div class="field-label">STOCK DE SEGURIDAD (SS)</div>
        <div style="font-family: var(--font-mono); font-size: 1.45rem; font-weight: 700; margin-top: 0.25rem;">
          ${formatoNumero(data.material.stock_seguridad)} ${data.material.unidad_medida}
        </div>
      </div>
    </div>

    <div class="table-wrap" style="border: 1px solid var(--line-strong); margin-bottom: 1.5rem;">
      <table class="clean-table">
        <thead>
          <tr>
            <th>Codigo</th>
            <th>Fecha</th>
            <th>Tipo</th>
            <th class="num-cell">Cant.</th>
            <th>Documento / OC</th>
            <th>Lote / Serie</th>
            <th>Responsable</th>
            <th class="num-cell">Saldo</th>
          </tr>
        </thead>
        <tbody>
          ${data.historial_movimientos.map((m) => `
            <tr>
              <td><span class="sku-tag">${m.codigo_movimiento}</span></td>
              <td style="font-family: var(--font-mono); font-size: 0.75rem;">${m.fecha_hora}</td>
              <td><span class="status-pill ${m.tipo_movimiento === 'ENTRADA' ? 'pill-ok' : (m.tipo_movimiento === 'SALIDA' ? 'pill-critical' : 'pill-warning')}">${m.tipo_movimiento}</span></td>
              <td class="num-cell" style="font-weight: 600;">${m.cantidad}</td>
              <td><span class="sku-tag">${m.documento_origen}</span></td>
              <td style="font-family: var(--font-mono); font-size: 0.75rem;">${m.lote_serie}</td>
              <td>${m.usuario_responsable}</td>
              <td class="num-cell" style="font-weight: 700;">${m.saldo_resultante_material}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('drawer-backdrop').classList.add('open');
  document.getElementById('kardex-drawer').classList.add('open');
}

function cerrarDrawer() {
  document.getElementById('drawer-backdrop').classList.remove('open');
  document.getElementById('kardex-drawer').classList.remove('open');
}

async function ejecutarSondeoApi(endpoint) {
  const urlLabel = document.getElementById('api-probe-url');
  const out = document.getElementById('api-probe-output');
  if (urlLabel) urlLabel.textContent = `ENDPOINT ACTIVO: GET ${endpoint}`;
  const res = await fetch(endpoint);
  const data = await res.json();
  if (out) out.textContent = JSON.stringify(data, null, 2);
}

document.addEventListener('DOMContentLoaded', () => {
  cargarDashboard();
  ejecutarSondeoApi('/alertas/reorden');

  // Navegacion principal en Sidebar
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => activarPagina(item.dataset.page));
  });

  document.querySelectorAll('.btn-ir-modulo').forEach((btn) => {
    btn.addEventListener('click', () => activarPagina(btn.dataset.target));
  });

  // Sub-navegacion interna (Segmented controls)
  document.querySelectorAll('.subnav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const bar = btn.closest('.subnav-bar');
      const group = bar.dataset.group;
      bar.querySelectorAll('.subnav-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll(`.subview-pane[data-group="${group}"]`).forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.sub);
      if (target) target.classList.add('active');
    });
  });

  document.getElementById('btn-close-drawer')?.addEventListener('click', cerrarDrawer);
  document.getElementById('drawer-backdrop')?.addEventListener('click', cerrarDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarDrawer();
  });

  document.getElementById('form-movimiento')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tipo = document.getElementById('mov-tipo').value;
    const payload = {
      tipo_movimiento: tipo,
      material_id: Number(document.getElementById('mov-material').value),
      cantidad: Number(document.getElementById('mov-cantidad').value),
      ubicacion_origen_id: tipo === 'ENTRADA' ? null : Number(document.getElementById('mov-origen').value),
      ubicacion_destino_id: tipo === 'SALIDA' ? null : Number(document.getElementById('mov-destino').value),
      documento_origen: document.getElementById('mov-doc').value,
      lote_serie: document.getElementById('mov-lote').value,
      usuario_responsable: document.getElementById('mov-usuario').value,
      observaciones: document.getElementById('mov-obs').value
    };

    const res = await fetch('/api/movimientos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      mostrarNotificacion(`ERROR KARDEX: ${data.error}`);
      return;
    }

    mostrarNotificacion(
      data.alerta_reorden_disparada
        ? `ALERTA GENERADA: ${data.alerta_reorden_disparada.codigo_alerta} — ${data.alerta_reorden_disparada.titulo}`
        : `MOVIMIENTO ${data.movimiento.codigo_movimiento} REGISTRADO. SALDO: ${data.estado_inventario.stock_actual}`
    );
    await cargarDashboard();
  });

  document.getElementById('btn-simular-alerta')?.addEventListener('click', async () => {
    const res = await fetch('/api/movimientos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo_movimiento: 'SALIDA',
        material_id: 1,
        cantidad: 35,
        ubicacion_origen_id: 2,
        documento_origen: 'VALE-OBR-DEMO-999',
        lote_serie: 'LOTE-CEM-1026A',
        usuario_responsable: 'Ing. Valeria Fonseca',
        observaciones: 'Consumo intensivo de cemento en obra — Cruza Punto de Reorden (165 sacos)'
      })
    });
    const data = await res.json();
    if (res.ok) {
      mostrarNotificacion(
        `DEMO EN VIVO: Cemento paso de 190 a ${data.estado_inventario.stock_actual} sacos (bajo PR de 165). Alerta critica activada.`
      );
      await cargarDashboard();
    } else {
      mostrarNotificacion(`AVISO: ${data.error}`);
    }
  });

  document.getElementById('btn-reset-db')?.addEventListener('click', async () => {
    await fetch('/api/reset', { method: 'POST' });
    mostrarNotificacion('BASE DE DATOS RESTAURADA A LOS DATOS SEMILLA OFICIALES.');
    await cargarDashboard();
  });

  document.getElementById('btn-recalcular-duplicados')?.addEventListener('click', async () => {
    const ventana = document.getElementById('filtro-ventana-dias').value;
    const tol = document.getElementById('filtro-tolerancia-pct').value;
    const res = await fetch(`/api/ordenes/posibles-duplicados?ventana_dias=${ventana}&tolerancia_pct=${tol}`);
    const data = await res.json();
    renderizarAuditoriaGasto(data);
    mostrarNotificacion(`ESCANEO COMPLETADO: ${data.pares_duplicados_detectados.length} pares sospechosos.`);
  });

  document.getElementById('form-nueva-oc')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      area_solicitante: document.getElementById('oc-area').value,
      ubicacion_id: 2,
      proveedor_id: Number(document.getElementById('oc-proveedor').value),
      material_id: Number(document.getElementById('oc-material').value),
      cantidad: Number(document.getElementById('oc-cantidad').value),
      precio_unitario_colones: Number(document.getElementById('oc-precio').value),
      cotizaciones_presentadas: Number(document.getElementById('oc-cotizaciones').value),
      fecha_emision: '2026-10-16'
    };

    const res = await fetch('/api/ordenes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      mostrarNotificacion(`ERROR OC: ${data.error}`);
      return;
    }

    mostrarNotificacion(
      `ORDEN ${data.orden.numero_oc} CREADA (${formatoColones(data.orden.monto_total_colones)}) — Requiere: ${data.control_aprobacion.rol_aprobador_requerido}`
    );
    await cargarDashboard();
  });

  document.querySelectorAll('.btn-api-probe').forEach((btn) => {
    btn.addEventListener('click', () => ejecutarSondeoApi(btn.dataset.endpoint));
  });

  // Eventos del Validador Three-Way Match en vivo
  document.getElementById('form-three-way')?.addEventListener('submit', (e) => {
    e.preventDefault();
    ejecutarCotejoThreeWay({
      orden_compra_id: Number(document.getElementById('twm-oc').value),
      cantidad_recibida_bodega: Number(document.getElementById('twm-cant-rec').value),
      cantidad_facturada: Number(document.getElementById('twm-cant-fact').value),
      precio_unitario_facturado: Number(document.getElementById('twm-precio-fact').value),
      numero_factura: document.getElementById('twm-num-fact').value
    });
  });

  document.getElementById('btn-twm-discrepancia')?.addEventListener('click', () => {
    document.getElementById('twm-oc').value = '1'; // OC-1041
    document.getElementById('twm-cant-rec').value = '185'; // Llegaron 15 sacos menos
    document.getElementById('twm-cant-fact').value = '200'; // Cobran 200
    document.getElementById('twm-precio-fact').value = '6450'; // Cobran con sobreprecio
    ejecutarCotejoThreeWay({
      orden_compra_id: 1,
      cantidad_recibida_bodega: 185,
      cantidad_facturada: 200,
      precio_unitario_facturado: 6450,
      numero_factura: 'FE-00100029510'
    });
    mostrarNotificacion('THREE-WAY MATCH: Factura bloqueada por faltante de 15 sacos y sobreprecio de 150 colones/u.');
  });

  // Boton Maximizar Vista (oculta/muestra sidebar y expande el lienzo al 100%)
  document.getElementById('btn-toggle-maximize')?.addEventListener('click', (e) => {
    const shell = document.querySelector('.app-shell');
    const colapsado = shell.classList.toggle('sidebar-collapsed');
    e.currentTarget.textContent = colapsado ? 'MOSTRAR MENU LATERAL' : 'MAXIMIZAR VISTA';
  });

  // Boton Exportar CSV de Inventario y Punto de Reorden
  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    if (!estadoGlobal || !estadoGlobal.materiales) return;
    const encabezados = ['Prioridad', 'SKU', 'Material', 'Unidad', 'Demanda_Prom', 'Demanda_Max', 'Entrega_Dias', 'Stock_Seguridad', 'Punto_Reorden', 'Stock_Actual', 'Reponer_Hoy'];
    const filas = estadoGlobal.materiales.map((m) => [
      m.orden_prioridad_global,
      m.codigo_estandar,
      `"${m.nombre_estandar}"`,
      m.unidad_medida,
      m.demanda_diaria_prom,
      m.demanda_diaria_max,
      m.tiempo_entrega_dias,
      m.stock_seguridad,
      m.punto_reorden,
      m.stock_actual,
      m.requiere_reposicion_hoy ? 'SI' : 'NO'
    ]);
    const csvContent = [encabezados.join(','), ...filas.map((f) => f.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'reporte_inventario_constructora_del_valle.csv';
    link.click();
    URL.revokeObjectURL(url);
    mostrarNotificacion('ARCHIVO CSV EXPORTADO CORRECTAMENTE.');
  });
});
