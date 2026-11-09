const express = require('express');
const { getDb } = require('../db/connection');
const {
  obtenerMaterialesConStock,
  obtenerAlertasReorden,
  obtenerTrazabilidadMaterial,
  registrarMovimientoKardex
} = require('../services/reorden');
const { analizarDuplicadosYFugas } = require('../services/duplicados');
const {
  determinarNivelAprobacion,
  crearOrdenCompraConControl,
  aprobarOrdenCompra,
  obtenerMatrizProveedoresYComparador
} = require('../services/aprobaciones');
const {
  evaluarPromocionesParaOrden,
  ejecutarCincoCasosPruebaPromociones
} = require('../services/promociones');

const router = express.Router();

// Resumen integral para el Dashboard e Informe Parte A + Parte B
router.get('/dashboard', (req, res) => {
  try {
    const db = getDb();
    const materiales = obtenerMaterialesConStock(db);
    const alertasReorden = obtenerAlertasReorden(db);
    const auditoriaGasto = analizarDuplicadosYFugas(db);
    const proveedoresMatriz = obtenerMatrizProveedoresYComparador(db);
    const promocionesAuditoria = ejecutarCincoCasosPruebaPromociones(db);
    const ubicaciones = db.prepare('SELECT * FROM ubicaciones ORDER BY id ASC').all();
    const matrizAprobacion = db.prepare('SELECT * FROM matriz_aprobacion ORDER BY nivel ASC').all();
    const ultimosMovimientos = db.prepare(`
      SELECT
        mv.*,
        m.codigo_estandar,
        m.nombre_estandar,
        m.unidad_medida,
        uo.nombre AS ubicacion_origen_nombre,
        ud.nombre AS ubicacion_destino_nombre,
        oc.numero_oc
      FROM movimientos_inventario mv
      JOIN materiales m ON m.id = mv.material_id
      LEFT JOIN ubicaciones uo ON uo.id = mv.ubicacion_origen_id
      LEFT JOIN ubicaciones ud ON ud.id = mv.ubicacion_destino_id
      LEFT JOIN ordenes_compra oc ON oc.id = mv.orden_compra_id
      ORDER BY mv.id DESC
      LIMIT 15
    `).all();

    const alertasActivas = db.prepare(`
      SELECT a.*, m.codigo_estandar, m.nombre_estandar, oc.numero_oc
      FROM alertas a
      LEFT JOIN materiales m ON m.id = a.material_id
      LEFT JOIN ordenes_compra oc ON oc.id = a.orden_compra_id
      ORDER BY a.id DESC
    `).all();

    // Calculo oficial del Ejercicio A2 (8 lineas ERP reclasificadas)
    const ahorroCementoA2 = (200 * (6450 - 6300)) + (40 * (7100 - 6300)); // 30 000 + 32 000 = 62 000
    const ahorroVarillaA2 = 60 * (2600 - 2150); // 27 000
    const ahorroGuantesA2 = 80 * (1200 - 850); // 28 000

    res.json({
      empresa: 'Constructora Del Valle S.A.',
      fecha_sistema: new Date().toISOString(),
      kpis: {
        valor_inventario_colones: materiales.reduce(
          (acc, m) => acc + (m.stock_actual * (m.precio_contrato_colones || 0)),
          0
        ),
        materiales_bajo_pr: alertasReorden.total_materiales_bajo_pr,
        ordenes_duplicadas_detectadas: auditoriaGasto.pares_duplicados_detectados.length,
        fuga_mensual_identificada_colones:
          auditoriaGasto.resumen_octubre_a3.escenario_2_sobreprecio_mas_duplicado_exacto.fuga_mensual_colones,
        proyeccion_fuga_anual_colones:
          auditoriaGasto.resumen_octubre_a3.escenario_2_sobreprecio_mas_duplicado_exacto.proyeccion_anual_colones,
        ahorro_homologacion_a2_colones: ahorroCementoA2 + ahorroVarillaA2,
        ahorro_homologacion_a2_ampliado_colones: ahorroCementoA2 + ahorroVarillaA2 + ahorroGuantesA2
      },
      ubicaciones,
      matriz_aprobacion: matrizAprobacion,
      materiales,
      alertas_reorden: alertasReorden,
      auditoria_gasto: auditoriaGasto,
      proveedores_evaluacion: proveedoresMatriz,
      promociones_opcion3: promocionesAuditoria,
      ultimos_movimientos: ultimosMovimientos,
      alertas_activas: alertasActivas
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /materiales -> Lista completa con PR y SS calculados dinamicamente
router.get('/materiales', (req, res) => {
  try {
    const db = getDb();
    res.json(obtenerMaterialesConStock(db));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /materiales/:id/stock -> Endpoint de arquitectura de referencia (stock actual, PR y estado)
router.get('/materiales/:id/stock', (req, res) => {
  try {
    const db = getDb();
    const todos = obtenerMaterialesConStock(db);
    const mat = todos.find((m) => m.id === Number(req.params.id) || m.codigo_estandar === req.params.id);
    if (!mat) {
      return res.status(404).json({ error: `Material '${req.params.id}' no encontrado.` });
    }
    return res.json({
      id: mat.id,
      codigo_estandar: mat.codigo_estandar,
      nombre_estandar: mat.nombre_estandar,
      unidad_medida: mat.unidad_medida,
      stock_actual: mat.stock_actual,
      stock_seguridad: mat.stock_seguridad,
      punto_reorden: mat.punto_reorden,
      holgura_unidades: mat.holgura_unidades,
      dias_autonomia: mat.dias_autonomia,
      requiere_reposicion_hoy: mat.requiere_reposicion_hoy,
      estado_stock: mat.estado_stock,
      orden_prioridad_global: mat.orden_prioridad_global,
      accion_recomendada: mat.accion_recomendada,
      ubicaciones: mat.ubicaciones
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /materiales/:id/trazabilidad -> Historial Kardex y OC de origen de cada entrada
router.get('/materiales/:id/trazabilidad', (req, res) => {
  try {
    const db = getDb();
    const data = obtenerTrazabilidadMaterial(db, req.params.id);
    if (!data) {
      return res.status(404).json({ error: `Material con id ${req.params.id} no existe.` });
    }
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /movimientos -> Registra entrada/salida/traslado/ajuste, recalcula stock y dispara alerta PR
router.post('/movimientos', (req, res) => {
  try {
    const db = getDb();
    const resultado = registrarMovimientoKardex(db, req.body || {});
    return res.status(201).json(resultado);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /alertas/reorden -> Materiales bajo el punto de reorden y orden de prioridad
router.get('/alertas/reorden', (req, res) => {
  try {
    const db = getDb();
    return res.json(obtenerAlertasReorden(db));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /ordenes/posibles-duplicados -> OC sospechosas segun regla definida y analisis de fugas A3
router.get('/ordenes/posibles-duplicados', (req, res) => {
  try {
    const db = getDb();
    const ventanaDias = req.query.ventana_dias ? Number(req.query.ventana_dias) : undefined;
    const toleranciaPct = req.query.tolerancia_pct ? Number(req.query.tolerancia_pct) : undefined;
    const resultado = analizarDuplicadosYFugas(db, {
      ventanaDias,
      toleranciaCantidadPct: toleranciaPct
    });
    return res.json(resultado);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /ordenes -> Listado completo de ordenes de compra con estado de aprobacion
router.get('/ordenes', (req, res) => {
  try {
    const db = getDb();
    const auditoria = analizarDuplicadosYFugas(db);
    return res.json(auditoria.lineas_analizadas);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /ordenes -> Emite una nueva OC validando la Matriz de Aprobacion A1 y el acumulado de 30 dias
router.post('/ordenes', (req, res) => {
  try {
    const db = getDb();
    const creada = crearOrdenCompraConControl(db, req.body || {});
    return res.status(201).json(creada);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// PATCH /ordenes/:id/aprobar -> Aprueba o rechaza una OC verificando rol segun Matriz A1
router.patch('/ordenes/:id/aprobar', (req, res) => {
  try {
    const db = getDb();
    const actualizada = aprobarOrdenCompra(db, req.params.id, req.body || {});
    return res.json(actualizada);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /aprobaciones/simular -> Simula que rol aprueba segun monto y acumulado de 30 dias
router.post('/aprobaciones/simular', (req, res) => {
  try {
    const db = getDb();
    const { monto_colones, area_solicitante, proveedor_id, fecha_emision } = req.body || {};
    const resultado = determinarNivelAprobacion(
      db,
      Number(monto_colones || 0),
      area_solicitante || 'Obras',
      Number(proveedor_id || 1),
      fecha_emision
    );
    return res.json(resultado);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /proveedores/comparador -> Matriz ponderada A4 + Comparador de precios Opcion 1
router.get('/proveedores/comparador', (req, res) => {
  try {
    const db = getDb();
    return res.json(obtenerMatrizProveedoresYComparador(db));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /promociones/auditoria -> Motor de codigos de promocion y los 5 casos de prueba (Opcion 3)
router.get('/promociones/auditoria', (req, res) => {
  try {
    const db = getDb();
    return res.json(ejecutarCincoCasosPruebaPromociones(db));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /promociones/evaluar -> Evalua promociones vigentes para cualquier OC
router.post('/promociones/evaluar', (req, res) => {
  try {
    const db = getDb();
    return res.json(evaluarPromocionesParaOrden(db, req.body || {}));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /reset -> Restaura los datos semilla para demostracion en vivo
router.post('/reset', (req, res) => {
  try {
    getDb({ forceReset: true });
    return res.json({ ok: true, mensaje: 'Base de datos restaurada a los datos semilla oficiales.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
