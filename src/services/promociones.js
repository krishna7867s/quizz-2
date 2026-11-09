/**
 * Motor de Codigos de Promocion y Descuentos Negociados (Integracion Opcion 3 — Caso Joaquin, AON)
 * Evalua vigencia, monto minimo, cantidad minima, categoria/articulo y resuelve conflictos
 * aplicando la regla de Maximización de Ahorro Neto (Best-Value Non-Cumulative Rule).
 */

function calcularAhorroPromocion(promo, montoBruto, cantidad, precioUnitario) {
  if (promo.tipo_descuento === 'PORCENTAJE' || promo.tipo_descuento === 'ESCALONADO_VOLUMEN') {
    return Number(((montoBruto * promo.valor_descuento) / 100).toFixed(2));
  }
  if (promo.tipo_descuento === 'MONTO_FIJO') {
    return Number(Math.min(montoBruto, promo.valor_descuento).toFixed(2));
  }
  if (promo.tipo_descuento === 'BONIFICACION_2X1') {
    const unidadesGratis = Math.floor(cantidad / 2);
    return Number((unidadesGratis * precioUnitario).toFixed(2));
  }
  return 0;
}

function evaluarPromocionesParaOrden(db, payload) {
  const {
    orden_compra_id,
    referencia_caso,
    proveedor_id,
    material_id,
    cantidad,
    precio_unitario_colones,
    fecha_orden
  } = payload;

  const material = db.prepare('SELECT * FROM materiales WHERE id = ?').get(Number(material_id));
  if (!material) {
    throw new Error(`Material ${material_id} no encontrado para evaluar promociones.`);
  }

  const cant = Number(cantidad);
  const precio = Number(precio_unitario_colones || material.precio_contrato_colones || 0);
  const montoBruto = Number((cant * precio).toFixed(2));
  const fechaEval = fecha_orden || '2026-10-20';

  const promocionesProveedor = db.prepare(`
    SELECT p.*, pr.nombre_comercial AS proveedor_nombre
    FROM promociones p
    JOIN proveedores pr ON pr.id = p.proveedor_id
    WHERE p.proveedor_id = ? AND p.activa = 1
    ORDER BY p.prioridad ASC, p.id ASC
  `).all(Number(proveedor_id));

  const candidatasValidas = [];
  const descartadas = [];

  for (const promo of promocionesProveedor) {
    // 1. Validar vigencia temporal
    if (fechaEval < promo.fecha_inicio || fechaEval > promo.fecha_fin) {
      descartadas.push({
        codigo_promo: promo.codigo_promo,
        motivo_descarte: `PROMOCION_VENCIDA_O_FUERA_DE_VIGENCIA (Vigencia: ${promo.fecha_inicio} a ${promo.fecha_fin}, Fecha OC: ${fechaEval})`
      });
      continue;
    }

    // 2. Validar categoria aplicable
    if (promo.categoria_aplicable && promo.categoria_aplicable !== material.categoria_codigo) {
      descartadas.push({
        codigo_promo: promo.codigo_promo,
        motivo_descarte: `CATEGORIA_NO_APLICABLE (Exige categoria ${promo.categoria_aplicable}, pero el articulo pertenece a ${material.categoria_codigo})`
      });
      continue;
    }

    // 3. Validar articulo especifico si aplica
    if (promo.material_id && Number(promo.material_id) !== Number(material.id)) {
      descartadas.push({
        codigo_promo: promo.codigo_promo,
        motivo_descarte: `ARTICULO_NO_APLICABLE (Exclusiva para material ID ${promo.material_id})`
      });
      continue;
    }

    // 4. Validar monto minimo de compra
    if (montoBruto < promo.monto_minimo_oc) {
      descartadas.push({
        codigo_promo: promo.codigo_promo,
        motivo_descarte: `MONTO_BAJO_EL_MINIMO (Monto OC: ${montoBruto} colones < Minimo requerido: ${promo.monto_minimo_oc} colones)`
      });
      continue;
    }

    // 5. Validar cantidad minima de unidades
    if (cant < promo.cantidad_minima) {
      descartadas.push({
        codigo_promo: promo.codigo_promo,
        motivo_descarte: `CANTIDAD_BAJO_EL_MINIMO (Cantidad OC: ${cant} < Minimo requerido: ${promo.cantidad_minima})`
      });
      continue;
    }

    const ahorroCalculado = calcularAhorroPromocion(promo, montoBruto, cant, precio);
    candidatasValidas.push({
      ...promo,
      ahorro_calculado_colones: ahorroCalculado
    });
  }

  // Regla de conflicto: Seleccionar la promocion que maximiza el ahorro para la empresa
  candidatasValidas.sort((a, b) => {
    if (b.ahorro_calculado_colones !== a.ahorro_calculado_colones) {
      return b.ahorro_calculado_colones - a.ahorro_calculado_colones;
    }
    return a.prioridad - b.prioridad;
  });

  let ganadora = null;
  if (candidatasValidas.length > 0) {
    ganadora = candidatasValidas[0];
    for (let i = 1; i < candidatasValidas.length; i++) {
      const otra = candidatasValidas[i];
      descartadas.push({
        codigo_promo: otra.codigo_promo,
        motivo_descarte: `CONFLICTO_PROMOCIONES_NO_ACUMULABLES (Generaba ${otra.ahorro_calculado_colones} colones de ahorro frente a ${ganadora.ahorro_calculado_colones} colones de la promocion ganadora ${ganadora.codigo_promo})`
      });
    }
  }

  const ahorroFinal = ganadora ? ganadora.ahorro_calculado_colones : 0;
  const montoNeto = Number((montoBruto - ahorroFinal).toFixed(2));
  const reglaResolucion = ganadora
    ? `Aplicada ${ganadora.codigo_promo} por regla de Maximo Beneficio Economico (Ahorro: ${ahorroFinal} colones)`
    : 'Ninguna promocion cumplio la totalidad de condiciones de negocio';

  db.prepare(`
    INSERT INTO auditoria_promociones (
      orden_compra_id, referencia_caso, fecha_evaluacion, codigo_promo_aplicada,
      monto_bruto_colones, ahorro_aplicado_colones, monto_neto_colones,
      regla_resolucion, promociones_descartadas_json
    ) VALUES (?, ?, datetime('now'), ?, ?, ?, ?, ?, ?)
  `).run(
    orden_compra_id || null,
    referencia_caso || 'EVALUACION_AUTOMATICA_OC',
    ganadora ? ganadora.codigo_promo : null,
    montoBruto,
    ahorroFinal,
    montoNeto,
    reglaResolucion,
    JSON.stringify(descartadas)
  );

  return {
    referencia_caso: referencia_caso || 'EVALUACION_OC',
    material: material.nombre_estandar,
    categoria: material.categoria_codigo,
    monto_bruto_colones: montoBruto,
    promocion_aplicada: ganadora ? {
      codigo_promo: ganadora.codigo_promo,
      nombre: ganadora.nombre,
      tipo_descuento: ganadora.tipo_descuento,
      ahorro_colones: ahorroFinal
    } : null,
    ahorro_aplicado_colones: ahorroFinal,
    monto_neto_colones: montoNeto,
    regla_resolucion: reglaResolucion,
    promociones_descartadas: descartadas
  };
}

function ejecutarCincoCasosPruebaPromociones(db) {
  db.prepare('DELETE FROM auditoria_promociones').run();

  const casos = [
    {
      // Caso 1: Promocion vencida (compra en fecha donde solo se intenta usar promo de trimestre anterior o bajo minimo actual)
      referencia_caso: 'CASO 1: Promocion Vencida (PROMO-SEP-VENCIDA fuera de vigencia en octubre)',
      proveedor_id: 1,
      material_id: 1,
      cantidad: 120,
      precio_unitario_colones: 6300,
      fecha_orden: '2026-10-15'
    },
    {
      // Caso 2: Monto bajo el minimo requerido
      referencia_caso: 'CASO 2: Monto Bajo el Minimo (Compra de 50 sacos = 315 000 colones < 1 200 000 colones)',
      proveedor_id: 1,
      material_id: 1,
      cantidad: 50,
      precio_unitario_colones: 6300,
      fecha_orden: '2026-10-15'
    },
    {
      // Caso 3: Dos promociones vigentes en conflicto (PROMO-CPL-VOL8 8% vs PROMO-CPL-BONO75K fijo 75 000)
      referencia_caso: 'CASO 3: Dos Promociones en Conflicto (OC-1061 de 300 sacos = 1 890 000 colones -> Gana 8% = 151 200 vs Bono 75 000)',
      orden_compra_id: 7,
      proveedor_id: 1,
      material_id: 1,
      cantidad: 300,
      precio_unitario_colones: 6300,
      fecha_orden: '2026-10-15'
    },
    {
      // Caso 4: Categoria no aplicable (Intentar aplicar promo de Hidrosanitarios MEC-HID a Cemento MAT-OBR en Novex)
      referencia_caso: 'CASO 4: Categoria No Aplicable (Material MAT-OBR evaluado contra promo exclusiva MEC-HID en Novex)',
      proveedor_id: 7,
      material_id: 1,
      cantidad: 40,
      precio_unitario_colones: 6420,
      fecha_orden: '2026-10-20'
    },
    {
      // Caso 5: Caso valido directo (Tubo PVC MEC-HID en Novex con 12% de descuento)
      referencia_caso: 'CASO 5: Caso Valido Sin Conflicto (Compra de 30 tubos PVC en Novex -> Aplica PROMO-NVX-HID12 del 12%)',
      proveedor_id: 7,
      material_id: 6,
      cantidad: 30,
      precio_unitario_colones: 2450,
      fecha_orden: '2026-10-21'
    }
  ];

  const resultadosCasos = casos.map((c) => evaluarPromocionesParaOrden(db, c));

  const catalogoPromociones = db.prepare(`
    SELECT p.*, pr.nombre_comercial AS proveedor_nombre
    FROM promociones p
    JOIN proveedores pr ON pr.id = p.proveedor_id
    ORDER BY p.id ASC
  `).all();

  const codigosUsados = new Set(
    resultadosCasos.filter((r) => r.promocion_aplicada).map((r) => r.promocion_aplicada.codigo_promo)
  );

  const promocionesSinUsar = catalogoPromociones.filter(
    (p) => !codigosUsados.has(p.codigo_promo) && p.fecha_fin >= '2026-10-01'
  );

  return {
    catalogo_promociones: catalogoPromociones,
    cinco_casos_prueba: resultadosCasos,
    ahorro_total_simulado_colones: resultadosCasos.reduce((acc, r) => acc + r.ahorro_aplicado_colones, 0),
    descuentos_dejados_sobre_la_mesa: promocionesSinUsar
  };
}

module.exports = {
  evaluarPromocionesParaOrden,
  ejecutarCincoCasosPruebaPromociones
};
