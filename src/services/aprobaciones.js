/**
 * Servicio de Matriz de Aprobacion Institucional (A1),
 * Evaluacion Ponderada de Proveedores (A4) y Comparador de Catalogo (Opcion 1).
 */

function determinarNivelAprobacion(db, montoOrden, areaSolicitante, proveedorId, fechaEmision) {
  const matriz = db.prepare('SELECT * FROM matriz_aprobacion ORDER BY nivel ASC').all();
  const fechaBase = fechaEmision || new Date().toISOString().slice(0, 10);

  // Calcular acumulado movil de 30 dias para evitar fraccionamiento de compras (Split Purchasing)
  const acumRow = db.prepare(`
    SELECT COALESCE(SUM(monto_total_colones), 0) AS acumulado_30d, COUNT(*) AS cant_ordenes_30d
    FROM ordenes_compra
    WHERE area_solicitante = ?
      AND proveedor_id = ?
      AND estado_aprobacion != 'RECHAZADA'
      AND abs(julianday(?) - julianday(fecha_emision)) <= 30
  `).get(areaSolicitante, Number(proveedorId), fechaBase);

  const acumuladoPrevio = Number(acumRow ? acumRow.acumulado_30d : 0);
  const montoEfectivoEvaluacion = Number((acumuladoPrevio + Number(montoOrden)).toFixed(2));

  const buscarTramo = (monto) => {
    for (const fila of matriz) {
      const minOk = monto >= fila.monto_minimo;
      const maxOk = fila.monto_maximo === null || monto <= fila.monto_maximo;
      if (minOk && maxOk) return fila;
    }
    return matriz[matriz.length - 1];
  };

  const tramoIndividual = buscarTramo(Number(montoOrden));
  const tramoAcumulado = buscarTramo(montoEfectivoEvaluacion);

  const escaladoPorFraccionamiento = tramoAcumulado.nivel > tramoIndividual.nivel;
  const tramoFinal = escaladoPorFraccionamiento ? tramoAcumulado : tramoIndividual;

  return {
    monto_orden_colones: Number(montoOrden),
    acumulado_previo_30d_colones: acumuladoPrevio,
    monto_efectivo_evaluado_colones: montoEfectivoEvaluacion,
    nivel_individual: tramoIndividual.nivel,
    nivel_aplicado: tramoFinal.nivel,
    escalado_por_fraccionamiento: escaladoPorFraccionamiento,
    rol_aprobador_requerido: tramoFinal.rol_aprobador,
    cotizaciones_requeridas: tramoFinal.cotizaciones_requeridas,
    requiere_comite: Boolean(tramoFinal.requiere_comite)
  };
}

function crearOrdenCompraConControl(db, payload) {
  const {
    area_solicitante,
    ubicacion_id,
    proveedor_id,
    material_id,
    cantidad,
    precio_unitario_colones,
    cotizaciones_presentadas,
    usuario_creador,
    fecha_emision
  } = payload;

  const matId = Number(material_id);
  const provId = Number(proveedor_id);
  const cant = Number(cantidad);
  const precio = Number(precio_unitario_colones);

  if (!area_solicitante || !matId || !provId || cant <= 0 || precio <= 0) {
    throw new Error('Datos de Orden de Compra incompletos o invalidos.');
  }

  const material = db.prepare('SELECT * FROM materiales WHERE id = ?').get(matId);
  const proveedor = db.prepare('SELECT * FROM proveedores WHERE id = ?').get(provId);
  if (!material || !proveedor) {
    throw new Error('Material o proveedor no existe en el catalogo maestro.');
  }

  const montoTotal = Number((cant * precio).toFixed(2));
  const fecha = fecha_emision || new Date().toISOString().slice(0, 10);

  const evaluacionAprobacion = determinarNivelAprobacion(
    db,
    montoTotal,
    area_solicitante,
    provId,
    fecha
  );

  const precioContrato = Number(material.precio_contrato_colones || precio);
  const sobreprecioUnit = Math.max(0, Number((precio - precioContrato).toFixed(2)));
  const sobreprecioTotal = Number((sobreprecioUnit * cant).toFixed(2));
  const esFueraContrato =
    (material.proveedor_contrato_id && provId !== material.proveedor_contrato_id) || sobreprecioUnit > 0 ? 1 : 0;

  const seqRow = db.prepare('SELECT COUNT(*) AS c FROM ordenes_compra').get();
  const numeroOc = `OC-${1086 + seqRow.c}`;

  const insertOc = db.prepare(`
    INSERT INTO ordenes_compra (
      numero_oc, fecha_emision, area_solicitante, ubicacion_id,
      proveedor_id, material_id, descripcion_erp_original,
      cantidad, precio_unitario_colones, monto_total_colones,
      precio_referencia_contrato, es_fuera_contrato,
      sobreprecio_unitario_colones, sobreprecio_total_colones,
      estado_aprobacion, rol_aprobador_requerido, cotizaciones_requeridas, cotizaciones_presentadas,
      aprobado_por, usuario_creador
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE_APROBACION', ?, ?, ?, NULL, ?)
  `).run(
    numeroOc,
    fecha,
    area_solicitante,
    Number(ubicacion_id || 1),
    provId,
    matId,
    material.nombre_estandar,
    cant,
    precio,
    montoTotal,
    precioContrato,
    esFueraContrato,
    sobreprecioUnit,
    sobreprecioTotal,
    evaluacionAprobacion.rol_aprobador_requerido,
    evaluacionAprobacion.cotizaciones_requeridas,
    Number(cotizaciones_presentadas || 1),
    usuario_creador || 'operador.compras@delvalle.cr'
  );

  const nuevaOc = db.prepare('SELECT * FROM ordenes_compra WHERE id = ?').get(insertOc.lastInsertRowid);
  return {
    orden: nuevaOc,
    control_aprobacion: evaluacionAprobacion,
    alerta_sobreprecio: sobreprecioTotal > 0 ? {
      sobreprecio_unitario_colones: sobreprecioUnit,
      sobreprecio_total_colones: sobreprecioTotal,
      mensaje: `La tarifa ingresada (${precio} colones) supera el precio de contrato marco (${precioContrato} colones).`
    } : null
  };
}

function aprobarOrdenCompra(db, ordenId, payload) {
  const { rol_usuario, nombre_aprobador, accion } = payload;
  const orden = db.prepare('SELECT * FROM ordenes_compra WHERE id = ?').get(Number(ordenId));
  if (!orden) {
    throw new Error(`No existe la Orden de Compra con id ${ordenId}.`);
  }

  if (accion === 'RECHAZAR') {
    db.prepare(`
      UPDATE ordenes_compra
      SET estado_aprobacion = 'RECHAZADA', aprobado_por = ?
      WHERE id = ?
    `).run(`${nombre_aprobador || 'Auditor'} (${rol_usuario || 'Control Interno'})`, orden.id);
    return db.prepare('SELECT * FROM ordenes_compra WHERE id = ?').get(orden.id);
  }

  if (!rol_usuario || !rol_usuario.toLowerCase().includes(orden.rol_aprobador_requerido.toLowerCase().split(' ')[0])) {
    throw new Error(
      `Autorizacion denegada por segregacion de funciones. Esta orden (${orden.monto_total_colones.toLocaleString('es-CR')} colones) requiere firma de: ${orden.rol_aprobador_requerido}. Rol recibido: ${rol_usuario || 'Sin rol'}.`
    );
  }

  if (orden.cotizaciones_presentadas < orden.cotizaciones_requeridas) {
    throw new Error(
      `No se puede aprobar la orden ${orden.numero_oc}: cuenta con ${orden.cotizaciones_presentadas} cotizacion(es), pero el nivel exige minimo ${orden.cotizaciones_requeridas}.`
    );
  }

  db.prepare(`
    UPDATE ordenes_compra
    SET estado_aprobacion = 'APROBADA', aprobado_por = ?
    WHERE id = ?
  `).run(`${nombre_aprobador} — ${rol_usuario}`, orden.id);

  return db.prepare('SELECT * FROM ordenes_compra WHERE id = ?').get(orden.id);
}

function obtenerMatrizProveedoresYComparador(db) {
  const criterios = [
    { codigo: 'precio', nombre: 'Precio competitivo y descuentos por volumen', peso_pct: 25, peso_decimal: 0.25, campo: 'nota_precio' },
    { codigo: 'calidad', nombre: 'Calidad certificada (INTECO / ASTM)', peso_pct: 20, peso_decimal: 0.20, campo: 'nota_calidad' },
    { codigo: 'plazo', nombre: 'Cumplimiento de plazos de entrega (OTIF)', peso_pct: 20, peso_decimal: 0.20, campo: 'nota_plazo_entrega' },
    { codigo: 'credito', nombre: 'Condiciones de credito y capital de trabajo', peso_pct: 15, peso_decimal: 0.15, campo: 'nota_credito' },
    { codigo: 'posventa', nombre: 'Servicio posventa y respaldo tecnico', peso_pct: 10, peso_decimal: 0.10, campo: 'nota_posventa' },
    { codigo: 'riesgo', nombre: 'Cobertura geografica y mitigacion de dependencia', peso_pct: 10, peso_decimal: 0.10, campo: 'nota_cobertura_riesgo' }
  ];

  const proveedoresPrincipales = db.prepare(`
    SELECT * FROM proveedores
    WHERE codigo IN ('PROV-A', 'PROV-NOV', 'PROV-F')
    ORDER BY id ASC
  `).all();

  const evaluacionA4 = proveedoresPrincipales.map((p) => {
    let puntajePonderado = 0;
    const desglose = criterios.map((c) => {
      const nota = Number(p[c.campo]);
      const aporte = Number((nota * c.peso_decimal).toFixed(3));
      puntajePonderado += aporte;
      return {
        criterio: c.nombre,
        peso_pct: c.peso_pct,
        nota_1_a_5: nota,
        puntaje_ponderado: Number(aporte.toFixed(2))
      };
    });

    return {
      id: p.id,
      codigo: p.codigo,
      nombre_comercial: p.nombre_comercial,
      razon_social: p.razon_social,
      plazo_credito_dias: p.plazo_credito_dias,
      tiene_contrato_marco: Boolean(p.tiene_contrato_marco),
      numero_contrato: p.numero_contrato,
      estado: p.estado,
      puntaje_total_5: Number(puntajePonderado.toFixed(2)),
      indice_desempeno_100: Number(((puntajePonderado / 5) * 100).toFixed(1)),
      desglose_criterios: desglose
    };
  }).sort((a, b) => b.puntaje_total_5 - a.puntaje_total_5);

  // Comparador de precios vigentes por producto normalizado (Opcion 1 integrada)
  const materiales = db.prepare('SELECT id, codigo_estandar, nombre_estandar, unidad_medida, precio_contrato_colones FROM materiales ORDER BY id ASC').all();
  const ofertasStmt = db.prepare(`
    SELECT
      hp.proveedor_id,
      pr.codigo AS proveedor_codigo,
      pr.nombre_comercial AS proveedor_nombre,
      pr.plazo_credito_dias,
      eq.sku_proveedor,
      eq.nombre_en_proveedor,
      hp.precio_colones,
      hp.variacion_porcentual,
      hp.fecha_captura,
      hp.fuente_extraccion
    FROM historico_precios_proveedor hp
    JOIN proveedores pr ON pr.id = hp.proveedor_id
    LEFT JOIN equivalencias_proveedor eq ON eq.material_id = hp.material_id AND eq.proveedor_id = hp.proveedor_id
    WHERE hp.material_id = ?
      AND hp.id IN (
        SELECT MAX(id) FROM historico_precios_proveedor
        WHERE material_id = ?
        GROUP BY proveedor_id
      )
    ORDER BY hp.precio_colones ASC
  `);

  const comparadorCatalogo = materiales.map((m) => {
    const ofertas = ofertasStmt.all(m.id, m.id);
    const menorPrecio = ofertas.length > 0 ? ofertas[0].precio_colones : 0;
    const mayorPrecio = ofertas.length > 0 ? ofertas[ofertas.length - 1].precio_colones : 0;
    const brechaPct = menorPrecio > 0 ? Number((((mayorPrecio - menorPrecio) / menorPrecio) * 100).toFixed(1)) : 0;

    return {
      material_id: m.id,
      codigo_estandar: m.codigo_estandar,
      nombre_estandar: m.nombre_estandar,
      unidad_medida: m.unidad_medida,
      mejor_precio_colones: menorPrecio,
      mayor_precio_colones: mayorPrecio,
      brecha_maxima_pct: brechaPct,
      ofertas_ordenadas: ofertas
    };
  });

  return {
    criterios_ponderacion: criterios,
    ranking_proveedores_a4: evaluacionA4,
    estrategia_recomendada: {
      modelo: 'Dual Sourcing Asimetrico (80% Principal / 20% Respaldo)',
      proveedor_principal: 'Construplaza (Proveedor A) — 4.60 / 5.00 pts (80% del volumen)',
      proveedor_respaldo: 'Novex — 4.40 / 5.00 pts (20% del volumen y contingencias)',
      justificacion:
        'Consolidar el 80% en Construplaza maximiza el poder de negociacion por volumen (tarifa contrato de 6 300 colones en cemento y 2 050 colones en varilla con credito a 60 dias), mientras que adjudicar el 20% a Novex mantiene activa una segunda fuente calificada con entrega sobresaliente (5/5 en OTIF), eliminando el riesgo de paro de obra por desabastecimiento sin caer en los sobreprecios retail de EPA (3.10 / 5.00 pts).'
    },
    comparador_precios_vigentes: comparadorCatalogo
  };
}

module.exports = {
  determinarNivelAprobacion,
  crearOrdenCompraConControl,
  aprobarOrdenCompra,
  obtenerMatrizProveedoresYComparador
};
