const test = require('node:test');
const assert = require('node:assert/strict');
const { getDb } = require('../src/db/connection');
const {
  obtenerMaterialesConStock,
  obtenerAlertasReorden,
  obtenerTrazabilidadMaterial,
  registrarMovimientoKardex
} = require('../src/services/reorden');
const { analizarDuplicadosYFugas } = require('../src/services/duplicados');
const {
  determinarNivelAprobacion,
  crearOrdenCompraConControl,
  aprobarOrdenCompra,
  obtenerMatrizProveedoresYComparador
} = require('../src/services/aprobaciones');
const { ejecutarCincoCasosPruebaPromociones } = require('../src/services/promociones');

test('Ejercicio A5: Calculo exacto de Stock de Seguridad (SS) y Punto de Reorden (PR)', () => {
  const db = getDb({ freshMemory: true });
  const materiales = obtenerMaterialesConStock(db);

  const cemento = materiales.find((m) => m.codigo_estandar === 'MAT-CEM-001');
  const varilla = materiales.find((m) => m.codigo_estandar === 'MAT-ACE-003');
  const block = materiales.find((m) => m.codigo_estandar === 'MAT-MAM-012');
  const arena = materiales.find((m) => m.codigo_estandar === 'MAT-AGR-004');

  // Cemento gris 50 kg: d=40, dMax=55, L=3 -> SS = (55-40)*3 = 45, PR = 40*3 + 45 = 165, Stock = 190
  assert.equal(cemento.stock_seguridad, 45);
  assert.equal(cemento.punto_reorden, 165);
  assert.equal(cemento.stock_actual, 190);
  assert.equal(cemento.requiere_reposicion_hoy, false);

  // Varilla #3: d=120, dMax=160, L=5 -> SS = (160-120)*5 = 200, PR = 120*5 + 200 = 800, Stock = 850
  assert.equal(varilla.stock_seguridad, 200);
  assert.equal(varilla.punto_reorden, 800);
  assert.equal(varilla.stock_actual, 850);
  assert.equal(varilla.requiere_reposicion_hoy, false);

  // Block 12x20x40: d=600, dMax=900, L=4 -> SS = (900-600)*4 = 1200, PR = 600*4 + 1200 = 3600, Stock = 2800
  assert.equal(block.stock_seguridad, 1200);
  assert.equal(block.punto_reorden, 3600);
  assert.equal(block.stock_actual, 2800);
  assert.equal(block.requiere_reposicion_hoy, true);

  // Arena m3: d=6, dMax=10, L=2 -> SS = (10-6)*2 = 8, PR = 6*2 + 8 = 20, Stock = 14
  assert.equal(arena.stock_seguridad, 8);
  assert.equal(arena.punto_reorden, 20);
  assert.equal(arena.stock_actual, 14);
  assert.equal(arena.requiere_reposicion_hoy, true);

  // Prioridad de reposicion: 1) Arena (70% del PR), 2) Block (77.8% del PR)
  const alertas = obtenerAlertasReorden(db);
  assert.equal(alertas.cola_prioridad_reposicion[0].codigo_estandar, 'MAT-AGR-004');
  assert.equal(alertas.cola_prioridad_reposicion[1].codigo_estandar, 'MAT-MAM-012');
});

test('Ejercicio A3: Deteccion de compras duplicadas (OC-1041/1042 y OC-1050/1053) y cuantificacion de fuga', () => {
  const db = getDb({ freshMemory: true });
  const analisis = analizarDuplicadosYFugas(db, { ventanaDias: 3, toleranciaCantidadPct: 10 });

  assert.equal(analisis.pares_duplicados_detectados.length, 2);

  const parCemento = analisis.pares_duplicados_detectados.find((p) => p.orden_sospechosa === 'OC-1042');
  assert.ok(parCemento);
  assert.equal(parCemento.clasificacion, 'DUPLICADO_EXACTO');
  assert.equal(parCemento.diferencia_dias, 0);
  assert.equal(parCemento.variacion_cantidad_pct, 0);

  const parVarilla = analisis.pares_duplicados_detectados.find((p) => p.orden_sospechosa === 'OC-1053');
  assert.ok(parVarilla);
  assert.equal(parVarilla.diferencia_dias, 1);
  assert.equal(parVarilla.variacion_cantidad_pct, 4);
  assert.equal(parVarilla.evade_umbral_aprobacion, true);

  // Sobreprecio puro octubre = 30k + 30k + 32k + 50k + 48k + 33k = 223 000 colones
  assert.equal(analisis.resumen_octubre_a3.escenario_1_sobreprecio_tarifario.fuga_mensual_colones, 223000);
  assert.equal(analisis.resumen_octubre_a3.escenario_1_sobreprecio_tarifario.proyeccion_anual_colones, 2676000);

  // Sobreprecio (193 000) + OC-1042 duplicada (1 290 000) = 1 483 000 colones/mes
  assert.equal(analisis.resumen_octubre_a3.escenario_2_sobreprecio_mas_duplicado_exacto.fuga_mensual_colones, 1483000);
  assert.equal(analisis.resumen_octubre_a3.escenario_2_sobreprecio_mas_duplicado_exacto.proyeccion_anual_colones, 17796000);
});

test('Kardex y Alerta Automatica: Una salida de Cemento que cruce el PR (165) genera alerta critica', () => {
  const db = getDb({ freshMemory: true });

  // Cemento inicia en 190 sacos (65 en Obra Escazu id=2). Si salen 35 sacos, queda en 155 (< PR de 165)
  const resultado = registrarMovimientoKardex(db, {
    tipo_movimiento: 'SALIDA',
    material_id: 1,
    cantidad: 35,
    ubicacion_origen_id: 2,
    documento_origen: 'VALE-OBR-990',
    lote_serie: 'LOTE-CEM-1026A',
    usuario_responsable: 'Ing. Valeria Fonseca',
    observaciones: 'Colado de columnas eje 4'
  });

  assert.equal(resultado.estado_inventario.stock_actual, 155);
  assert.equal(resultado.estado_inventario.requiere_reposicion_hoy, true);
  assert.ok(resultado.alerta_reorden_disparada);
  assert.equal(resultado.alerta_reorden_disparada.severidad, 'CRITICA');

  // Verificar trazabilidad actualizada
  const trazabilidad = obtenerTrazabilidadMaterial(db, 1);
  assert.equal(trazabilidad.material.stock_actual, 155);
  assert.equal(trazabilidad.historial_movimientos[0].documento_origen, 'VALE-OBR-990');
});

test('Ejercicio A1 y A4: Matriz de aprobacion antifraccionamiento y evaluacion ponderada de proveedores', () => {
  const db = getDb({ freshMemory: true });

  // Evaluar matriz ponderada A4: Construplaza (4.60), Novex (4.40), EPA (3.10)
  const comparador = obtenerMatrizProveedoresYComparador(db);
  assert.equal(comparador.ranking_proveedores_a4[0].puntaje_total_5, 4.6);
  assert.equal(comparador.ranking_proveedores_a4[1].puntaje_total_5, 4.4);
  assert.equal(comparador.ranking_proveedores_a4[2].puntaje_total_5, 3.1);

  // Crear una OC pequena en Obras con Proveedor C (donde ya acumulan 2 107 000 colones en octubre)
  // Aunque la nueva OC sea de 150 000 colones (< 250 000), el acumulado de 30 dias supera 2 000 000
  // por lo que debe escalar a Gerencia Financiera (nivel 3, 3 cotizaciones)
  const nuevaOc = crearOrdenCompraConControl(db, {
    area_solicitante: 'Obras',
    ubicacion_id: 2,
    proveedor_id: 3,
    material_id: 2,
    cantidad: 70,
    precio_unitario_colones: 2150,
    cotizaciones_presentadas: 3,
    fecha_emision: '2026-10-15'
  });

  assert.equal(nuevaOc.control_aprobacion.escalado_por_fraccionamiento, true);
  assert.equal(nuevaOc.control_aprobacion.rol_aprobador_requerido, 'Gerencia Financiera');

  // Intentar aprobar con rol insuficiente (Jefatura del Area Solicitante) debe lanzar error
  assert.throws(() => {
    aprobarOrdenCompra(db, nuevaOc.orden.id, {
      rol_usuario: 'Jefatura del Area Solicitante',
      nombre_aprobador: 'Ing. Valeria Fonseca',
      accion: 'APROBAR'
    });
  }, /Autorizacion denegada por segregacion de funciones/);

  // Aprobar con Gerencia Financiera debe funcionar
  const aprobada = aprobarOrdenCompra(db, nuevaOc.orden.id, {
    rol_usuario: 'Gerencia Financiera',
    nombre_aprobador: 'MSc. Laura Chinchilla',
    accion: 'APROBAR'
  });
  assert.equal(aprobada.estado_aprobacion, 'APROBADA');
});

test('Integridad de Archivos de Entregables (Esquema SQL, Seed SQL, Dashboard e Informe PDF)', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '..');

  assert.ok(fs.existsSync(path.join(root, 'src', 'db', 'schema.sql')));
  assert.ok(fs.existsSync(path.join(root, 'src', 'db', 'seed.sql')));
  assert.ok(fs.existsSync(path.join(root, 'public', 'index.html')));
  assert.ok(fs.existsSync(path.join(root, 'public', 'informe.html')));
  assert.ok(fs.existsSync(path.join(root, '.env.example')));
  assert.ok(fs.existsSync(path.join(root, 'README.md')));
});

test('Integracion Opcion 3 (Caso Joaquin, AON): Motor de promociones y los 5 casos de prueba', () => {
  const db = getDb({ freshMemory: true });
  const promoRes = ejecutarCincoCasosPruebaPromociones(db);

  assert.equal(promoRes.cinco_casos_prueba.length, 5);
  // Caso 1 (Vencida) -> 0 ahorro
  assert.equal(promoRes.cinco_casos_prueba[0].ahorro_aplicado_colones, 0);
  // Caso 2 (Monto bajo el minimo) -> 0 ahorro
  assert.equal(promoRes.cinco_casos_prueba[1].ahorro_aplicado_colones, 0);
  // Caso 3 (Dos promociones en conflicto: 8% sobre 1 890 000 = 151 200 vs Bono 75 000 -> Gana 151 200)
  assert.equal(promoRes.cinco_casos_prueba[2].promocion_aplicada.codigo_promo, 'PROMO-CPL-VOL8');
  assert.equal(promoRes.cinco_casos_prueba[2].ahorro_aplicado_colones, 151200);
  // Caso 4 (Categoria no aplicable) -> 0 ahorro
  assert.equal(promoRes.cinco_casos_prueba[3].ahorro_aplicado_colones, 0);
  // Caso 5 (Caso valido 12% sobre 73 500 = 8 820)
  assert.equal(promoRes.cinco_casos_prueba[4].promocion_aplicada.codigo_promo, 'PROMO-NVX-HID12');
  assert.equal(promoRes.cinco_casos_prueba[4].ahorro_aplicado_colones, 8820);
});

