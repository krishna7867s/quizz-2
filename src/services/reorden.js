/**
 * Servicio de Calculo de Niveles de Stock, Punto de Reorden (PR),
 * Stock de Seguridad (SS) y Trazabilidad de Movimientos Kardex.
 *
 * Formulas oficiales (Ejercicio A5):
 *   SS = (demanda_diaria_max - demanda_diaria_prom) * tiempo_entrega_dias
 *   PR = (demanda_diaria_prom * tiempo_entrega_dias) + SS
 */

function calcularMetricasReorden(material, stockActual) {
  const dProm = Number(material.demanda_diaria_prom);
  const dMax = Number(material.demanda_diaria_max);
  const leadTime = Number(material.tiempo_entrega_dias);
  const actual = Number(stockActual);

  const consumoDuranteEntrega = Number((dProm * leadTime).toFixed(2));
  const stockSeguridad = Number(((dMax - dProm) * leadTime).toFixed(2));
  const puntoReorden = Number((consumoDuranteEntrega + stockSeguridad).toFixed(2));
  const holguraUnidades = Number((actual - puntoReorden).toFixed(2));
  const diasAutonomia = dProm > 0 ? Number((actual / dProm).toFixed(2)) : 999;
  const diasHastaReorden = dProm > 0 ? Number(((actual - puntoReorden) / dProm).toFixed(2)) : 999;
  const ratioSobrePR = puntoReorden > 0 ? Number(((actual / puntoReorden) * 100).toFixed(1)) : 100;

  // Consumo del stock de seguridad cuando el stock cae por debajo del PR
  const deficitSobrePR = actual < puntoReorden ? Number((puntoReorden - actual).toFixed(2)) : 0;
  const pctStockSeguridadConsumido =
    actual < puntoReorden && stockSeguridad > 0
      ? Number(Math.min(100, (deficitSobrePR / stockSeguridad) * 100).toFixed(1))
      : 0;

  let estadoStock = 'OPTIMO';
  let nivelPrioridad = 4;
  let accionRecomendada = 'Stock operativo dentro de parametros normales';

  if (actual <= consumoDuranteEntrega) {
    estadoStock = 'CRITICO_ROTURA';
    nivelPrioridad = 1;
    accionRecomendada = 'Emision inmediata de OC urgente — Stock de seguridad consumido en mas del 65%';
  } else if (actual <= puntoReorden) {
    estadoStock = 'REPOSICION_INMEDIATA';
    nivelPrioridad = 1;
    accionRecomendada = 'Emitir Orden de Compra hoy — Existencia por debajo del Punto de Reorden';
  } else if (diasHastaReorden <= 1.0) {
    estadoStock = 'ALERTA_PREVENTIVA';
    nivelPrioridad = 2;
    accionRecomendada = 'Programar reposicion en las proximas 24 horas (cercano al umbral PR)';
  }

  const cantidadSugerida = Math.max(
    0,
    Number((Math.max(Number(material.stock_maximo || puntoReorden * 1.5), puntoReorden + consumoDuranteEntrega) - actual).toFixed(2))
  );

  return {
    demanda_diaria_prom: dProm,
    demanda_diaria_max: dMax,
    tiempo_entrega_dias: leadTime,
    consumo_durante_entrega: consumoDuranteEntrega,
    stock_seguridad: stockSeguridad,
    punto_reorden: puntoReorden,
    stock_actual: actual,
    holgura_unidades: holguraUnidades,
    deficit_unidades: deficitSobrePR,
    dias_autonomia: diasAutonomia,
    dias_hasta_reorden: diasHastaReorden,
    ratio_stock_pr_pct: ratioSobrePR,
    pct_ss_consumido: pctStockSeguridadConsumido,
    requiere_reposicion_hoy: actual <= puntoReorden,
    estado_stock: estadoStock,
    nivel_prioridad: nivelPrioridad,
    accion_recomendada: accionRecomendada,
    cantidad_sugerida_oc: cantidadSugerida
  };
}

function obtenerMaterialesConStock(db) {
  const materiales = db.prepare(`
    SELECT
      m.*,
      p.nombre_comercial AS proveedor_contrato_nombre,
      p.codigo AS proveedor_contrato_codigo,
      COALESCE((SELECT SUM(su.cantidad) FROM stock_ubicacion su WHERE su.material_id = m.id), 0) AS stock_actual
    FROM materiales m
    LEFT JOIN proveedores p ON p.id = m.proveedor_contrato_id
    ORDER BY m.id ASC
  `).all();

  const desgloseStmt = db.prepare(`
    SELECT
      su.ubicacion_id,
      u.codigo AS ubicacion_codigo,
      u.nombre AS ubicacion_nombre,
      u.tipo AS ubicacion_tipo,
      su.cantidad,
      su.ultima_actualizacion
    FROM stock_ubicacion su
    JOIN ubicaciones u ON u.id = su.ubicacion_id
    WHERE su.material_id = ?
    ORDER BY u.id ASC
  `);

  const mejorProveedorStmt = db.prepare(`
    SELECT
      hp.proveedor_id,
      pr.nombre_comercial,
      pr.codigo AS proveedor_codigo,
      hp.precio_colones,
      pr.plazo_credito_dias
    FROM historico_precios_proveedor hp
    JOIN proveedores pr ON pr.id = hp.proveedor_id
    WHERE hp.material_id = ?
      AND hp.id IN (
        SELECT MAX(id) FROM historico_precios_proveedor
        WHERE material_id = ?
        GROUP BY proveedor_id
      )
    ORDER BY hp.precio_colones ASC
    LIMIT 1
  `);

  const resultado = materiales.map((mat) => {
    const metricas = calcularMetricasReorden(mat, mat.stock_actual);
    const desgloseUbicaciones = desgloseStmt.all(mat.id);
    const mejorOferta = mejorProveedorStmt.get(mat.id, mat.id);

    let aliases = [];
    try {
      aliases = JSON.parse(mat.aliases_erp || '[]');
    } catch {
      aliases = [];
    }

    return {
      id: mat.id,
      codigo_estandar: mat.codigo_estandar,
      nombre_estandar: mat.nombre_estandar,
      taxonomia: `${mat.categoria_nombre} > ${mat.subcategoria_nombre}`,
      categoria_codigo: mat.categoria_codigo,
      categoria_nombre: mat.categoria_nombre,
      subcategoria_codigo: mat.subcategoria_codigo,
      subcategoria_nombre: mat.subcategoria_nombre,
      unidad_medida: mat.unidad_medida,
      stock_minimo: mat.stock_minimo,
      stock_maximo: mat.stock_maximo,
      precio_contrato_colones: mat.precio_contrato_colones,
      proveedor_contrato_id: mat.proveedor_contrato_id,
      proveedor_contrato_nombre: mat.proveedor_contrato_nombre,
      aliases_erp: aliases,
      ...metricas,
      costo_estimado_reposicion: Number(
        (metricas.cantidad_sugerida_oc * (mejorOferta ? mejorOferta.precio_colones : (mat.precio_contrato_colones || 0))).toFixed(2)
      ),
      proveedor_sugerido: mejorOferta || null,
      ubicaciones: desgloseUbicaciones
    };
  });

  // Ordenar ranking de prioridad para identificar el orden exacto de reposicion
  const ordenadosPorUrgencia = [...resultado].sort((a, b) => {
    if (a.requiere_reposicion_hoy !== b.requiere_reposicion_hoy) {
      return a.requiere_reposicion_hoy ? -1 : 1;
    }
    return a.ratio_stock_pr_pct - b.ratio_stock_pr_pct;
  });

  ordenadosPorUrgencia.forEach((item, index) => {
    item.orden_prioridad_global = index + 1;
  });

  return resultado;
}

function obtenerAlertasReorden(db) {
  const todos = obtenerMaterialesConStock(db);
  const bajoReorden = todos
    .filter((m) => m.requiere_reposicion_hoy || m.estado_stock === 'ALERTA_PREVENTIVA')
    .sort((a, b) => a.orden_prioridad_global - b.orden_prioridad_global);

  const alertasRegistradas = db.prepare(`
    SELECT a.*, m.codigo_estandar, m.nombre_estandar
    FROM alertas a
    LEFT JOIN materiales m ON m.id = a.material_id
    WHERE a.tipo_alerta IN ('REORDEN_CRITICO', 'REORDEN_PREVENTIVO')
    ORDER BY a.id DESC
  `).all();

  return {
    fecha_corte: new Date().toISOString(),
    total_materiales_bajo_pr: todos.filter((m) => m.requiere_reposicion_hoy).length,
    total_alertas_preventivas: todos.filter((m) => !m.requiere_reposicion_hoy && m.estado_stock === 'ALERTA_PREVENTIVA').length,
    cola_prioridad_reposicion: bajoReorden,
    alertas_sistema: alertasRegistradas
  };
}

function obtenerTrazabilidadMaterial(db, materialId) {
  const materiales = obtenerMaterialesConStock(db);
  const material = materiales.find((m) => m.id === Number(materialId));
  if (!material) {
    return null;
  }

  const movimientos = db.prepare(`
    SELECT
      mv.*,
      uo.codigo AS ubicacion_origen_codigo,
      uo.nombre AS ubicacion_origen_nombre,
      ud.codigo AS ubicacion_destino_codigo,
      ud.nombre AS ubicacion_destino_nombre,
      oc.numero_oc,
      oc.fecha_emision AS fecha_oc,
      oc.precio_unitario_colones AS precio_oc,
      oc.es_fuera_contrato,
      pr.nombre_comercial AS proveedor_nombre
    FROM movimientos_inventario mv
    LEFT JOIN ubicaciones uo ON uo.id = mv.ubicacion_origen_id
    LEFT JOIN ubicaciones ud ON ud.id = mv.ubicacion_destino_id
    LEFT JOIN ordenes_compra oc ON oc.id = mv.orden_compra_id
    LEFT JOIN proveedores pr ON pr.id = oc.proveedor_id
    WHERE mv.material_id = ?
    ORDER BY mv.fecha_hora DESC, mv.id DESC
  `).all(Number(materialId));

  return {
    material,
    campos_minimos_trazabilidad: [
      'codigo_movimiento (Identificador unico inmutable del asiento Kardex)',
      'fecha_hora (Marca temporal ISO-8601 exacta de la transaccion)',
      'tipo_movimiento (ENTRADA | SALIDA | TRASLADO | AJUSTE)',
      'material_id / codigo_estandar (SKU normalizado del catalogo maestro)',
      'cantidad y unidad_medida (Magnitud fisica validada en recepcion o despacho)',
      'ubicacion_origen_id y ubicacion_destino_id (Bodega u Obra que entrega y recibe)',
      'documento_origen y orden_compra_id (OC + Boleta de Recepcion o Vale de Salida de Obra)',
      'lote_serie (Numero de lote de fabricacion, colada de acero o tajo de origen)',
      'usuario_responsable (Firma digital del bodeguero o ingeniero residente)',
      'saldo_resultante_material (Existencia acumulada post-movimiento para auditoria)'
    ],
    total_movimientos: movimientos.length,
    historial_movimientos: movimientos
  };
}

function registrarMovimientoKardex(db, payload) {
  const {
    tipo_movimiento,
    material_id,
    cantidad,
    ubicacion_origen_id,
    ubicacion_destino_id,
    documento_origen,
    orden_compra_id,
    lote_serie,
    usuario_responsable,
    costo_unitario_colones,
    observaciones
  } = payload;

  const tiposValidos = ['ENTRADA', 'SALIDA', 'TRASLADO', 'AJUSTE'];
  if (!tiposValidos.includes(tipo_movimiento)) {
    throw new Error(`Tipo de movimiento invalido. Valores permitidos: ${tiposValidos.join(', ')}`);
  }

  const matId = Number(material_id);
  const cant = Number(cantidad);
  if (!matId || Number.isNaN(cant) || cant <= 0) {
    throw new Error('Debe especificar un material_id valido y una cantidad numerica mayor a cero.');
  }

  if (!documento_origen || !String(documento_origen).trim()) {
    throw new Error('El campo documento_origen (OC, Recepcion o Vale de Salida) es obligatorio para la trazabilidad.');
  }

  if (!usuario_responsable || !String(usuario_responsable).trim()) {
    throw new Error('El campo usuario_responsable es obligatorio.');
  }

  const material = db.prepare('SELECT * FROM materiales WHERE id = ?').get(matId);
  if (!material) {
    throw new Error(`No existe el material con id ${matId}.`);
  }

  const obtenerStockUbicacion = (ubicId) => {
    const row = db.prepare('SELECT cantidad FROM stock_ubicacion WHERE material_id = ? AND ubicacion_id = ?').get(matId, ubicId);
    return row ? Number(row.cantidad) : 0;
  };

  const actualizarStockUbicacion = (ubicId, nuevaCantidad) => {
    const existe = db.prepare('SELECT id FROM stock_ubicacion WHERE material_id = ? AND ubicacion_id = ?').get(matId, ubicId);
    if (existe) {
      db.prepare('UPDATE stock_ubicacion SET cantidad = ?, ultima_actualizacion = datetime(\'now\') WHERE id = ?')
        .run(nuevaCantidad, existe.id);
    } else {
      db.prepare('INSERT INTO stock_ubicacion (material_id, ubicacion_id, cantidad, ultima_actualizacion) VALUES (?, ?, ?, datetime(\'now\'))')
        .run(matId, ubicId, nuevaCantidad);
    }
  };

  db.exec('BEGIN');
  try {
    if (tipo_movimiento === 'ENTRADA') {
      const destId = Number(ubicacion_destino_id || 1);
      const actualDest = obtenerStockUbicacion(destId);
      actualizarStockUbicacion(destId, Number((actualDest + cant).toFixed(2)));
    } else if (tipo_movimiento === 'SALIDA') {
      const origId = Number(ubicacion_origen_id || 2);
      const actualOrig = obtenerStockUbicacion(origId);
      if (actualOrig < cant) {
        throw new Error(
          `Stock insuficiente en la ubicacion seleccionada (Disponible: ${actualOrig} ${material.unidad_medida}, Solicitado: ${cant} ${material.unidad_medida}).`
        );
      }
      actualizarStockUbicacion(origId, Number((actualOrig - cant).toFixed(2)));
    } else if (tipo_movimiento === 'TRASLADO') {
      const origId = Number(ubicacion_origen_id);
      const destId = Number(ubicacion_destino_id);
      if (!origId || !destId || origId === destId) {
        throw new Error('Para un TRASLADO debe indicar ubicacion_origen_id y ubicacion_destino_id distintas.');
      }
      const actualOrig = obtenerStockUbicacion(origId);
      if (actualOrig < cant) {
        throw new Error(`Stock insuficiente en ubicacion de origen para trasladar (Disponible: ${actualOrig}).`);
      }
      const actualDest = obtenerStockUbicacion(destId);
      actualizarStockUbicacion(origId, Number((actualOrig - cant).toFixed(2)));
      actualizarStockUbicacion(destId, Number((actualDest + cant).toFixed(2)));
    } else if (tipo_movimiento === 'AJUSTE') {
      const destId = Number(ubicacion_destino_id || ubicacion_origen_id || 1);
      actualizarStockUbicacion(destId, Number(cant.toFixed(2)));
    }

    const totalRow = db.prepare('SELECT COALESCE(SUM(cantidad), 0) AS total FROM stock_ubicacion WHERE material_id = ?').get(matId);
    const nuevoSaldoTotal = Number(totalRow.total);

    const seqRow = db.prepare('SELECT COUNT(*) AS c FROM movimientos_inventario').get();
    const codigoMovimiento = `MOV-2026-${String(seqRow.c + 1).padStart(3, '0')}`;
    const loteFinal = lote_serie && String(lote_serie).trim()
      ? String(lote_serie).trim()
      : `LOTE-${material.codigo_estandar.split('-')[1]}-${Date.now().toString().slice(-4)}`;

    const costoUnit = Number(costo_unitario_colones || material.precio_contrato_colones || 0);

    const insertResult = db.prepare(`
      INSERT INTO movimientos_inventario (
        codigo_movimiento, fecha_hora, tipo_movimiento, material_id, cantidad,
        costo_unitario_colones, ubicacion_origen_id, ubicacion_destino_id,
        documento_origen, orden_compra_id, lote_serie, usuario_responsable,
        saldo_resultante_material, observaciones
      ) VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      codigoMovimiento,
      tipo_movimiento,
      matId,
      cant,
      costoUnit,
      ubicacion_origen_id ? Number(ubicacion_origen_id) : null,
      ubicacion_destino_id ? Number(ubicacion_destino_id) : null,
      String(documento_origen).trim(),
      orden_compra_id ? Number(orden_compra_id) : null,
      loteFinal,
      String(usuario_responsable).trim(),
      nuevoSaldoTotal,
      observaciones ? String(observaciones).trim() : null
    );

    const metricasActualizadas = calcularMetricasReorden(material, nuevoSaldoTotal);
    let alertaGenerada = null;

    if (metricasActualizadas.requiere_reposicion_hoy) {
      const alertSeq = db.prepare('SELECT COUNT(*) AS c FROM alertas').get();
      const codigoAlerta = `ALT-PR-${String(alertSeq.c + 1).padStart(3, '0')}`;
      const titulo = `Stock bajo Punto de Reorden tras ${tipo_movimiento}: ${material.nombre_estandar}`;
      const detalle = `El movimiento ${codigoMovimiento} (${documento_origen}) situo el stock en ${nuevoSaldoTotal} ${material.unidad_medida}, por debajo del Punto de Reorden calculado (${metricasActualizadas.punto_reorden} ${material.unidad_medida}). Cantidad sugerida a pedir: ${metricasActualizadas.cantidad_sugerida_oc} ${material.unidad_medida}.`;
      const impacto = Number((metricasActualizadas.cantidad_sugerida_oc * costoUnit).toFixed(2));

      db.prepare(`
        INSERT INTO alertas (
          codigo_alerta, tipo_alerta, severidad, material_id, orden_compra_id,
          titulo, detalle_tecnico, impacto_colones, estado, fecha_generacion
        ) VALUES (?, 'REORDEN_CRITICO', 'CRITICA', ?, ?, ?, ?, ?, 'ACTIVA', datetime('now'))
      `).run(codigoAlerta, matId, orden_compra_id || null, titulo, detalle, impacto);

      alertaGenerada = {
        codigo_alerta: codigoAlerta,
        severidad: 'CRITICA',
        titulo,
        detalle_tecnico: detalle,
        impacto_colones: impacto
      };
    }

    db.exec('COMMIT');

    const movimientoCreado = db.prepare('SELECT * FROM movimientos_inventario WHERE id = ?').get(insertResult.lastInsertRowid);
    return {
      movimiento: movimientoCreado,
      estado_inventario: metricasActualizadas,
      alerta_reorden_disparada: alertaGenerada
    };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = {
  calcularMetricasReorden,
  obtenerMaterialesConStock,
  obtenerAlertasReorden,
  obtenerTrazabilidadMaterial,
  registrarMovimientoKardex
};
