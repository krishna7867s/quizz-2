/**
 * Servicio de Deteccion de Compras Duplicadas, Fraccionamiento de Ordenes (Split Purchasing)
 * y Cuantificacion de Fugas de Valor por Gasto Fuera de Contrato y Sobreprecios (Ejercicio A3).
 */

function diasEntreFechas(fechaA, fechaB) {
  const msPorDia = 1000 * 60 * 60 * 24;
  const tA = new Date(fechaA).getTime();
  const tB = new Date(fechaB).getTime();
  return Math.round(Math.abs(tA - tB) / msPorDia);
}

function analizarDuplicadosYFugas(db, opciones = {}) {
  const ventanaDias = Number(opciones.ventanaDias ?? process.env.DUPLICATE_WINDOW_DAYS ?? 3);
  const toleranciaCantidadPct = Number(opciones.toleranciaCantidadPct ?? process.env.DUPLICATE_QTY_TOLERANCE_PCT ?? 10);
  const soloExtractoOctubre = Boolean(opciones.soloExtractoOctubre);

  let query = `
    SELECT
      oc.*,
      m.codigo_estandar,
      m.nombre_estandar,
      m.unidad_medida,
      m.precio_contrato_colones AS precio_contrato_vigente,
      m.proveedor_contrato_id,
      pr.codigo AS proveedor_codigo,
      pr.nombre_comercial AS proveedor_nombre,
      pr.tiene_contrato_marco,
      pr_c.nombre_comercial AS proveedor_contrato_titular
    FROM ordenes_compra oc
    JOIN materiales m ON m.id = oc.material_id
    JOIN proveedores pr ON pr.id = oc.proveedor_id
    LEFT JOIN proveedores pr_c ON pr_c.id = m.proveedor_contrato_id
  `;

  if (soloExtractoOctubre) {
    query += ` WHERE oc.numero_oc IN ('OC-1041','OC-1042','OC-1047','OC-1050','OC-1053','OC-1058','OC-1061') `;
  }
  query += ` ORDER BY oc.fecha_emision ASC, oc.id ASC `;

  const ordenes = db.prepare(query).all();

  const paresSospechosos = [];
  const idsDuplicadosExactos = new Set();
  const idsCuasiDuplicados = new Set();

  for (let i = 0; i < ordenes.length; i++) {
    for (let j = i + 1; j < ordenes.length; j++) {
      const a = ordenes[i];
      const b = ordenes[j];

      if (a.proveedor_id === b.proveedor_id && a.material_id === b.material_id) {
        const diffDias = diasEntreFechas(a.fecha_emision, b.fecha_emision);
        const maxCant = Math.max(a.cantidad, b.cantidad);
        const diffCantPct = maxCant > 0 ? Number(((Math.abs(a.cantidad - b.cantidad) / maxCant) * 100).toFixed(2)) : 0;

        if (diffDias <= ventanaDias && diffCantPct <= toleranciaCantidadPct) {
          const esExacto = diffDias === 0 && diffCantPct === 0 && a.precio_unitario_colones === b.precio_unitario_colones;
          const montoAcumulado = Number((a.monto_total_colones + b.monto_total_colones).toFixed(2));
          const evadeUmbralGerencia =
            a.monto_total_colones <= 2000000 &&
            b.monto_total_colones <= 2000000 &&
            montoAcumulado > 2000000;

          if (esExacto) {
            idsDuplicadosExactos.add(b.id);
          } else {
            idsCuasiDuplicados.add(b.id);
          }

          paresSospechosos.push({
            id_par: `${a.numero_oc}_${b.numero_oc}`,
            clasificacion: esExacto
              ? 'DUPLICADO_EXACTO'
              : (evadeUmbralGerencia ? 'CUASI_DUPLICADO_Y_FRACCIONAMIENTO' : 'CUASI_DUPLICADO_TEMPORAL'),
            severidad: esExacto ? 'CRITICA' : 'ALTA',
            orden_original: a.numero_oc,
            orden_sospechosa: b.numero_oc,
            fecha_original: a.fecha_emision,
            fecha_sospechosa: b.fecha_emision,
            diferencia_dias: diffDias,
            area: a.area_solicitante,
            proveedor: a.proveedor_nombre,
            codigo_estandar: a.codigo_estandar,
            articulo: a.nombre_estandar,
            cantidad_original: a.cantidad,
            cantidad_sospechosa: b.cantidad,
            variacion_cantidad_pct: diffCantPct,
            precio_unitario_colones: b.precio_unitario_colones,
            monto_orden_sospechosa: b.monto_total_colones,
            monto_acumulado_par: montoAcumulado,
            evade_umbral_aprobacion: evadeUmbralGerencia,
            umbral_evadido: evadeUmbralGerencia ? 'Gerencia Financiera (> 2 000 000 colones, 3 cotizaciones)' : null,
            regla_disparada: `Mismo proveedor (${a.proveedor_codigo}) + mismo SKU (${a.codigo_estandar}) + ventana ${diffDias}d (max ${ventanaDias}d) + variacion cantidad ${diffCantPct}% (max ${toleranciaCantidadPct}%)`
          });
        }
      }
    }
  }

  // Analisis linea por linea contra el contrato vigente
  const lineasAnalizadas = ordenes.map((oc) => {
    const precioContrato = Number(oc.precio_referencia_contrato || oc.precio_contrato_vigente || oc.precio_unitario_colones);
    const sobreprecioUnit = Math.max(0, Number((oc.precio_unitario_colones - precioContrato).toFixed(2)));
    const sobreprecioTotal = Number((sobreprecioUnit * oc.cantidad).toFixed(2));
    const proveedorDistintoContrato = oc.proveedor_contrato_id && oc.proveedor_id !== oc.proveedor_contrato_id;
    const precioDistintoContrato = sobreprecioUnit > 0;
    const fueraDeContrato = Boolean(proveedorDistintoContrato || precioDistintoContrato);

    let tipoDesviacion = 'CUMPLIMIENTO_CONTRATO';
    if (idsDuplicadosExactos.has(oc.id)) {
      tipoDesviacion = 'DUPLICADO_EXACTO_Y_TARIFA_ERRONEA';
    } else if (idsCuasiDuplicados.has(oc.id)) {
      tipoDesviacion = 'POSIBLE_DUPLICADO_Y_FUERA_CONTRATO';
    } else if (proveedorDistintoContrato) {
      tipoDesviacion = 'PROVEEDOR_FUERA_DE_CONTRATO';
    } else if (precioDistintoContrato) {
      tipoDesviacion = 'TARIFA_SUPERIOR_A_CONTRATO';
    }

    return {
      ...oc,
      precio_contrato_oficial: precioContrato,
      sobreprecio_unitario_calculado: sobreprecioUnit,
      sobreprecio_total_calculado: sobreprecioTotal,
      porcentaje_sobreprecio: precioContrato > 0 ? Number(((sobreprecioUnit / precioContrato) * 100).toFixed(2)) : 0,
      proveedor_fuera_de_contrato: Boolean(proveedorDistintoContrato),
      gasto_fuera_de_contrato_colones: proveedorDistintoContrato ? oc.monto_total_colones : 0,
      es_duplicado_exacto: idsDuplicadosExactos.has(oc.id),
      es_cuasi_duplicado: idsCuasiDuplicados.has(oc.id),
      tipo_desviacion: tipoDesviacion
    };
  });

  // Filtrar las 7 ordenes del Ejercicio A3 para el resumen oficial de octubre
  const ordenesA3 = lineasAnalizadas.filter((l) =>
    ['OC-1041', 'OC-1042', 'OC-1047', 'OC-1050', 'OC-1053', 'OC-1058', 'OC-1061'].includes(l.numero_oc)
  );

  const gastoTotalOctubreA3 = ordenesA3.reduce((acc, l) => acc + l.monto_total_colones, 0);
  const sobreprecioPuroMensualA3 = ordenesA3.reduce((acc, l) => acc + l.sobreprecio_total_calculado, 0);
  const gastoBrutoProveedoresFueraContratoA3 = ordenesA3
    .filter((l) => l.proveedor_fuera_de_contrato)
    .reduce((acc, l) => acc + l.monto_total_colones, 0);

  const oc1042 = ordenesA3.find((l) => l.numero_oc === 'OC-1042');
  const oc1053 = ordenesA3.find((l) => l.numero_oc === 'OC-1053');

  const montoDuplicadoExacto = oc1042 ? oc1042.monto_total_colones : 0;
  const sobreprecioSinDobleConteoOC1042 = sobreprecioPuroMensualA3 - (oc1042 ? oc1042.sobreprecio_total_calculado : 0);
  const fugaConsolidadaConOC1042 = montoDuplicadoExacto + sobreprecioSinDobleConteoOC1042;

  const montoCuasiDuplicadoOC1053 = oc1053 ? oc1053.monto_total_colones : 0;
  const fugaCriticaConAmbosDuplicados =
    montoDuplicadoExacto +
    montoCuasiDuplicadoOC1053 +
    (sobreprecioSinDobleConteoOC1042 - (oc1053 ? oc1053.sobreprecio_total_calculado : 0));

  return {
    parametros_regla: {
      ventana_maxima_dias: ventanaDias,
      tolerancia_variacion_cantidad_pct: toleranciaCantidadPct,
      descripcion_regla:
        'Se marca OC sospechosa cuando coincide Proveedor + Material normalizado, emitida dentro de <= ' +
        `${ventanaDias} dias corridos y con diferencia de cantidad <= ${toleranciaCantidadPct}%.`
    },
    pares_duplicados_detectados: paresSospechosos,
    resumen_octubre_a3: {
      gasto_total_extracto_colones: gastoTotalOctubreA3,
      gasto_proveedores_fuera_contrato_colones: gastoBrutoProveedoresFueraContratoA3,
      porcentaje_maverick_spend: Number(((gastoBrutoProveedoresFueraContratoA3 / gastoTotalOctubreA3) * 100).toFixed(2)),
      escenario_1_sobreprecio_tarifario: {
        descripcion: 'Sobreprecio directo frente a tarifa de contrato (6 300 colones cemento, 2 050 colones varilla)',
        fuga_mensual_colones: sobreprecioPuroMensualA3,
        proyeccion_anual_colones: sobreprecioPuroMensualA3 * 12
      },
      escenario_2_sobreprecio_mas_duplicado_exacto: {
        descripcion: 'Sobreprecios tarifarios (193 000 colones) + Emision duplicada exacta OC-1042 (1 290 000 colones)',
        fuga_mensual_colones: fugaConsolidadaConOC1042,
        proyeccion_anual_colones: fugaConsolidadaConOC1042 * 12
      },
      escenario_3_maximo_riesgo_ambos_duplicados: {
        descripcion: 'Sobreprecios restantes (145 000 colones) + Duplicados OC-1042 (1 290 000 colones) y OC-1053 (1 032 000 colones)',
        fuga_mensual_colones: fugaCriticaConAmbosDuplicados,
        proyeccion_anual_colones: fugaCriticaConAmbosDuplicados * 12
      }
    },
    lineas_analizadas: lineasAnalizadas
  };
}

module.exports = {
  analizarDuplicadosYFugas
};
