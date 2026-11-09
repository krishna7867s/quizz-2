-- =============================================================================
-- CONSTRUCTORA DEL VALLE S.A. — DATOS SEMILLA OFICIALES (PARTE A + PARTE B)
-- =============================================================================

-- 1. Ubicaciones Operativas (Tres áreas de Constructora Del Valle S.A.)
INSERT INTO ubicaciones (id, codigo, nombre, tipo, responsable, provincia, activa) VALUES
(1, 'BOD-CEN-01', 'Bodega Central — El Coyol', 'BODEGA_CENTRAL', 'Ing. Mauricio Elizondo', 'Alajuela', 1),
(2, 'OBR-ESC-02', 'Frente de Obra — Residencial Del Valle', 'FRENTE_OBRA', 'Ing. Valeria Fonseca', 'San Jose', 1),
(3, 'MNT-OCH-03', 'Planta y Taller de Mantenimiento', 'PLANTA_MANTENIMIENTO', 'Tec. Rodolfo Solano', 'Cartago', 1);

-- 2. Proveedores (Incluye Proveedores A-F de Ejercicios A2/A3 y Referencias A4: Construplaza, Novex, EPA)
INSERT INTO proveedores (
    id, codigo, nombre_comercial, razon_social, cedula_juridica,
    tiene_contrato_marco, numero_contrato, plazo_credito_dias,
    nota_precio, nota_calidad, nota_plazo_entrega, nota_credito, nota_posventa, nota_cobertura_riesgo, estado
) VALUES
(1, 'PROV-A', 'Construplaza (Proveedor A)', 'Mayorista Construplaza del Valle S.A.', '3-101-512890', 1, 'CM-2026-001', 60, 5.0, 5.0, 4.0, 5.0, 4.0, 4.0, 'HOMOLOGADO_PRINCIPAL'),
(2, 'PROV-B', 'Ferreteria del Este (Proveedor B)', 'Suministros Ferreteros Cartago S.A.', '3-101-609112', 0, NULL, 15, 2.0, 3.5, 3.0, 2.0, 3.0, 3.0, 'CONDICIONADO'),
(3, 'PROV-C', 'Aceros y Metales CR (Proveedor C)', 'Distribuidora Metalurgica Central S.A.', '3-101-448210', 0, NULL, 30, 3.5, 4.5, 4.0, 3.5, 3.5, 3.5, 'CONDICIONADO'),
(4, 'PROV-D', 'Deposito San Nicolas (Proveedor D)', 'Comercializadora San Nicolas S.R.L.', '3-102-771034', 0, NULL, 0, 1.5, 3.0, 3.0, 1.5, 2.5, 2.5, 'NO_AUTORIZADO'),
(5, 'PROV-E', 'Seguridad Industrial Tica (Proveedor E)', 'Equipos de Proteccion del Istmo S.A.', '3-101-889120', 1, 'CM-2026-004', 45, 5.0, 4.5, 4.5, 4.5, 4.0, 4.0, 'HOMOLOGADO_PRINCIPAL'),
(6, 'PROV-F', 'EPA (Proveedor F)', 'Ferreteria EPA Costa Rica S.A.', '3-101-390455', 0, NULL, 15, 2.0, 4.0, 3.0, 2.0, 4.0, 5.0, 'HOMOLOGADO_RESPALDO'),
(7, 'PROV-NOV', 'Novex', 'Ferreteria Novex Costa Rica S.A.', '3-101-740119', 1, 'CM-2026-002', 30, 4.0, 5.0, 5.0, 4.0, 4.0, 4.0, 'HOMOLOGADO_RESPALDO');

-- 3. Matriz de Aprobación Institucional Mejorada (Ejercicio A1)
INSERT INTO matriz_aprobacion (id, nivel, monto_minimo, monto_maximo, rol_aprobador, cotizaciones_requeridas, requiere_comite, ventana_acumulacion_dias) VALUES
(1, 1, 0, 250000, 'Jefatura del Area Solicitante', 1, 0, 30),
(2, 2, 250001, 2000000, 'Jefatura de Compras', 2, 0, 30),
(3, 3, 2000001, 10000000, 'Gerencia Financiera', 3, 0, 30),
(4, 4, 10000001, NULL, 'Gerencia General + Comite de Compras', 3, 1, 30);

-- 4. Catálogo Maestro de Materiales Normalizado (Ejercicios A2 y A5)
-- Nota: El Punto de Reorden (PR) y el Stock de Seguridad (SS) NO se digitan; el motor los calcula en vivo:
-- SS = (demanda_diaria_max - demanda_diaria_prom) * tiempo_entrega_dias
-- PR = (demanda_diaria_prom * tiempo_entrega_dias) + SS
INSERT INTO materiales (
    id, codigo_estandar, nombre_estandar,
    categoria_codigo, categoria_nombre,
    subcategoria_codigo, subcategoria_nombre,
    unidad_medida, demanda_diaria_prom, demanda_diaria_max, tiempo_entrega_dias,
    stock_minimo, stock_maximo, precio_contrato_colones, proveedor_contrato_id, aliases_erp
) VALUES
(
    1, 'MAT-CEM-001', 'Cemento gris uso general 50 kg',
    'MAT-OBR', 'Materiales de Obra Gris',
    'CEM-AGL', 'Cementos y Aglomerantes',
    'sacos', 40, 55, 3,
    120, 450, 6300, 1,
    '["Cemento gris 50 kg", "Saco cemento uso general", "CEM-GRIS-50"]'
),
(
    2, 'MAT-ACE-003', 'Varilla corrugada #3 (3/8 pulg x 6 m) Grado 40',
    'MAT-OBR', 'Materiales de Obra Gris',
    'ACE-REF', 'Acero de Refuerzo Estructural',
    'unid.', 120, 160, 5,
    600, 1800, 2050, 1,
    '["Varilla #3 grado 40", "Hierro 3/8 x 6 m", "Varilla #3"]'
),
(
    3, 'MAT-MAM-012', 'Block estructural de concreto 12 x 20 x 40 cm',
    'MAT-OBR', 'Materiales de Obra Gris',
    'MAM-BLO', 'Mamposteria y Prefabricados',
    'unid.', 600, 900, 4,
    2400, 7200, 485, 1,
    '["Block 12 x 20 x 40", "Bloque concreto 12x20x40"]'
),
(
    4, 'MAT-AGR-004', 'Arena lavada de rio para concreto (m3)',
    'MAT-OBR', 'Materiales de Obra Gris',
    'AGR-PET', 'Agregados Petreos',
    'm3', 6, 10, 2,
    12, 45, 16500, 1,
    '["Arena (m3)", "Arena fina lavada m3"]'
),
(
    5, 'EPP-GUA-001', 'Guantes de proteccion recubiertos en nitrilo talla L',
    'SEG-EPP', 'Seguridad Ocupacional y EPP',
    'PRO-MAN', 'Proteccion Manual',
    'pares', 12, 18, 3,
    36, 220, 850, 5,
    '["Guantes de nitrilo talla L", "Guantes trabajo L"]'
),
(
    6, 'HID-PVC-012', 'Tubo PVC presion 1/2 pulg x 6 m SDR 13.5',
    'MEC-HID', 'Instalaciones Hidrosanitarias',
    'TUB-PVC', 'Tuberia y Accesorios PVC',
    'unid.', 8, 14, 2,
    16, 80, 2450, 7,
    '["Tubo PVC 1/2 SDR 13.5", "Tuberia PVC potable 1/2"]'
);

-- 5. Stock por Ubicación (Suma exacta igual al Stock Actual de Ejercicio A5)
-- Cemento: 110 + 65 + 15 = 190 sacos (PR = 165, SS = 45)
-- Varilla #3: 500 + 310 + 40 = 850 unid. (PR = 800, SS = 200)
-- Block 12x20x40: 1600 + 1200 + 0 = 2800 unid. (PR = 3600, SS = 1200) -> BAJO PUNTO DE REORDEN
-- Arena (m3): 8 + 6 + 0 = 14 m3 (PR = 20, SS = 8) -> BAJO PUNTO DE REORDEN
-- Guantes: 90 + 50 + 0 = 140 pares (PR = 54, SS = 18)
-- Tubo PVC: 10 + 0 + 15 = 25 unid. (PR = 28, SS = 12) -> BAJO PUNTO DE REORDEN
INSERT INTO stock_ubicacion (material_id, ubicacion_id, cantidad, ultima_actualizacion) VALUES
(1, 1, 110, '2026-10-28 08:30:00'),
(1, 2, 65,  '2026-10-28 14:15:00'),
(1, 3, 15,  '2026-10-27 11:00:00'),
(2, 1, 500, '2026-10-28 09:00:00'),
(2, 2, 310, '2026-10-28 16:20:00'),
(2, 3, 40,  '2026-10-26 10:00:00'),
(3, 1, 1600, '2026-10-28 07:45:00'),
(3, 2, 1200, '2026-10-28 15:10:00'),
(3, 3, 0,    '2026-10-25 08:00:00'),
(4, 1, 8,    '2026-10-28 07:30:00'),
(4, 2, 6,    '2026-10-28 17:00:00'),
(4, 3, 0,    '2026-10-25 08:00:00'),
(5, 1, 90,   '2026-10-27 09:30:00'),
(5, 2, 50,   '2026-10-27 13:45:00'),
(5, 3, 0,    '2026-10-25 08:00:00'),
(6, 1, 10,   '2026-10-27 10:15:00'),
(6, 2, 0,    '2026-10-25 08:00:00'),
(6, 3, 15,   '2026-10-27 16:00:00');

-- 6. Órdenes de Compra de Octubre (Extracto Exacto de Ejercicio A3 + Líneas A2)
INSERT INTO ordenes_compra (
    id, numero_oc, fecha_emision, area_solicitante, ubicacion_id,
    proveedor_id, material_id, descripcion_erp_original,
    cantidad, precio_unitario_colones, monto_total_colones,
    precio_referencia_contrato, es_fuera_contrato,
    sobreprecio_unitario_colones, sobreprecio_total_colones,
    estado_aprobacion, rol_aprobador_requerido, cotizaciones_requeridas, cotizaciones_presentadas,
    aprobado_por, usuario_creador
) VALUES
(
    1, 'OC-1041', '2026-10-02', 'Obras', 2,
    1, 1, 'Cemento gris 50 kg',
    200, 6450, 1290000,
    6300, 0, 150, 30000,
    'APROBADA', 'Jefatura de Compras', 2, 2,
    'Lic. Marco Vindas', 'v.fonseca@delvalle.cr'
),
(
    2, 'OC-1042', '2026-10-02', 'Obras', 2,
    1, 1, 'Cemento gris 50 kg',
    200, 6450, 1290000,
    6300, 0, 150, 30000,
    'OBSERVADA_DUPLICADO', 'Jefatura de Compras', 2, 1,
    'Lic. Marco Vindas', 'v.fonseca@delvalle.cr'
),
(
    3, 'OC-1047', '2026-10-06', 'Mantenimiento', 3,
    2, 1, 'Saco cemento uso general',
    40, 7100, 284000,
    6300, 1, 800, 32000,
    'APROBADA', 'Jefatura de Compras', 2, 1,
    'Tec. Rodolfo Solano', 'r.solano@delvalle.cr'
),
(
    4, 'OC-1050', '2026-10-08', 'Obras', 2,
    3, 2, 'Varilla #3 grado 40',
    500, 2150, 1075000,
    2050, 1, 100, 50000,
    'APROBADA', 'Jefatura de Compras', 2, 2,
    'Lic. Marco Vindas', 'v.fonseca@delvalle.cr'
),
(
    5, 'OC-1053', '2026-10-09', 'Obras', 2,
    3, 2, 'Varilla #3',
    480, 2150, 1032000,
    2050, 1, 100, 48000,
    'OBSERVADA_DUPLICADO', 'Gerencia Financiera', 3, 2,
    'Lic. Marco Vindas', 'v.fonseca@delvalle.cr'
),
(
    6, 'OC-1058', '2026-10-13', 'Mantenimiento', 3,
    4, 2, 'Hierro 3/8 x 6 m',
    60, 2600, 156000,
    2050, 1, 550, 33000,
    'APROBADA', 'Jefatura del Area Solicitante', 1, 1,
    'Tec. Rodolfo Solano', 'r.solano@delvalle.cr'
),
(
    7, 'OC-1061', '2026-10-15', 'Bodega Central', 1,
    1, 1, 'CEM-GRIS-50',
    300, 6300, 1890000,
    6300, 0, 0, 0,
    'APROBADA', 'Jefatura de Compras', 2, 2,
    'Lic. Marco Vindas', 'm.elizondo@delvalle.cr'
),
(
    8, 'OC-1064', '2026-10-18', 'Bodega Central', 1,
    5, 5, 'Guantes de nitrilo talla L',
    100, 850, 85000,
    850, 0, 0, 0,
    'APROBADA', 'Jefatura del Area Solicitante', 1, 1,
    'Ing. Mauricio Elizondo', 'm.elizondo@delvalle.cr'
),
(
    9, 'OC-1068', '2026-10-19', 'Obras', 2,
    6, 5, 'Guantes trabajo L',
    80, 1200, 96000,
    850, 1, 350, 28000,
    'APROBADA', 'Jefatura del Area Solicitante', 1, 1,
    'Ing. Valeria Fonseca', 'v.fonseca@delvalle.cr'
),
(
    10, 'OC-1072', '2026-10-21', 'Mantenimiento', 3,
    2, 6, 'Tubo PVC 1/2 SDR 13.5',
    25, 2900, 72500,
    2450, 1, 450, 11250,
    'APROBADA', 'Jefatura del Area Solicitante', 1, 1,
    'Tec. Rodolfo Solano', 'r.solano@delvalle.cr'
),
(
    11, 'OC-1085', '2026-10-29', 'Obras', 2,
    1, 3, 'Block 12 x 20 x 40',
    5000, 485, 2425000,
    485, 0, 0, 0,
    'PENDIENTE_APROBACION', 'Gerencia Financiera', 3, 3,
    NULL, 'v.fonseca@delvalle.cr'
);

-- 7. Movimientos del Kardex (Trazabilidad Completa de Entradas, Salidas y Traslados)
INSERT INTO movimientos_inventario (
    codigo_movimiento, fecha_hora, tipo_movimiento, material_id, cantidad, costo_unitario_colones,
    ubicacion_origen_id, ubicacion_destino_id, documento_origen, orden_compra_id,
    lote_serie, usuario_responsable, saldo_resultante_material, observaciones
) VALUES
-- Cemento gris 50 kg (Saldo final = 190 sacos)
('MOV-2026-001', '2026-10-02 09:15:00', 'ENTRADA', 1, 200, 6450, NULL, 2, 'OC-1041 / REC-401', 1, 'LOTE-CEM-1026A', 'Ing. Valeria Fonseca', 200, 'Recepcion en Obra Residencial Del Valle'),
('MOV-2026-002', '2026-10-06 11:20:00', 'ENTRADA', 1, 40, 7100, NULL, 3, 'OC-1047 / REC-405', 3, 'LOTE-CEM-1026B', 'Tec. Rodolfo Solano', 240, 'Compra urgente taller mantenimiento fuera de contrato'),
('MOV-2026-003', '2026-10-10 14:00:00', 'SALIDA', 1, 135, 6450, 2, NULL, 'VALE-OBR-881', NULL, 'LOTE-CEM-1026A', 'Maestro Guillermo Mora', 105, 'Colado de fundaciones bloque B'),
('MOV-2026-004', '2026-10-15 08:40:00', 'ENTRADA', 1, 300, 6300, NULL, 1, 'OC-1061 / REC-419', 7, 'LOTE-CEM-1026C', 'Ing. Mauricio Elizondo', 405, 'Ingreso a Bodega Central bajo tarifa contrato CM-2026-001'),
('MOV-2026-005', '2026-10-20 10:15:00', 'TRASLADO', 1, 80, 6300, 1, 2, 'GUIA-TRAS-112', NULL, 'LOTE-CEM-1026C', 'Ing. Mauricio Elizondo', 405, 'Abastecimiento interno Bodega Central hacia Obra Escazu'),
('MOV-2026-006', '2026-10-24 16:30:00', 'SALIDA', 1, 190, 6300, 1, NULL, 'VALE-OBR-904', NULL, 'LOTE-CEM-1026C', 'Ing. Valeria Fonseca', 215, 'Fundicion losa entrepiso nivel 2'),
('MOV-2026-007', '2026-10-27 15:00:00', 'SALIDA', 1, 25, 7100, 3, NULL, 'VALE-MNT-210', NULL, 'LOTE-CEM-1026B', 'Tec. Rodolfo Solano', 190, 'Reparacion de cunetas y bases en plantel'),

-- Varilla #3 grado 40 (Saldo final = 850 unid.)
('MOV-2026-008', '2026-10-08 10:00:00', 'ENTRADA', 2, 500, 2150, NULL, 2, 'OC-1050 / REC-409', 4, 'COLADA-ACE-7741', 'Ing. Valeria Fonseca', 500, 'Recepcion acero corrugado grado 40 en obra'),
('MOV-2026-009', '2026-10-09 13:30:00', 'ENTRADA', 2, 480, 2150, NULL, 1, 'OC-1053 / REC-411', 5, 'COLADA-ACE-7742', 'Ing. Mauricio Elizondo', 980, 'Recepcion segundo camion redirigido a Bodega Central'),
('MOV-2026-010', '2026-10-13 09:45:00', 'ENTRADA', 2, 60, 2600, NULL, 3, 'OC-1058 / REC-415', 6, 'COLADA-ACE-8019', 'Tec. Rodolfo Solano', 1040, 'Compra directa mantenimiento con sobreprecio'),
('MOV-2026-011', '2026-10-22 15:20:00', 'SALIDA', 2, 190, 2150, 2, NULL, 'VALE-OBR-899', NULL, 'COLADA-ACE-7741', 'Ing. Valeria Fonseca', 850, 'Armado de vigas sismorresistentes eje C-F'),

-- Block 12 x 20 x 40 (Saldo final = 2800 unid. -> Bajo PR de 3600)
('MOV-2026-012', '2026-10-05 07:30:00', 'ENTRADA', 3, 4600, 485, NULL, 1, 'OC-1039 / REC-398', NULL, 'LOTE-BLK-992', 'Ing. Mauricio Elizondo', 4600, 'Recepcion lote inicial mamposteria estructural'),
('MOV-2026-013', '2026-10-12 08:15:00', 'TRASLADO', 3, 2200, 485, 1, 2, 'GUIA-TRAS-108', NULL, 'LOTE-BLK-992', 'Ing. Mauricio Elizondo', 4600, 'Despacho programado a Frente de Obra Escazu'),
('MOV-2026-014', '2026-10-26 17:00:00', 'SALIDA', 3, 1800, 485, 2, NULL, 'VALE-OBR-915', NULL, 'LOTE-BLK-992', 'Ing. Valeria Fonseca', 2800, 'Levantamiento de paredes niveles 1 y 2 — Dispara alerta PR'),

-- Arena m3 (Saldo final = 14 m3 -> Bajo PR de 20 m3)
('MOV-2026-015', '2026-10-14 07:00:00', 'ENTRADA', 4, 32, 16500, NULL, 1, 'OC-1059 / REC-417', NULL, 'TAJO-GUAPILES-44', 'Ing. Mauricio Elizondo', 32, 'Ingreso de dos vagonetas articuladas 16 m3'),
('MOV-2026-016', '2026-10-28 11:45:00', 'SALIDA', 4, 18, 16500, 2, NULL, 'VALE-OBR-921', NULL, 'TAJO-GUAPILES-44', 'Ing. Valeria Fonseca', 14, 'Dosificacion de mortero y concreto en sitio — Dispara alerta critica PR'),

-- Guantes nitrilo L (Saldo final = 140 pares)
('MOV-2026-017', '2026-10-18 10:00:00', 'ENTRADA', 5, 100, 850, NULL, 1, 'OC-1064 / REC-422', 8, 'LOTE-EPP-310', 'Ing. Mauricio Elizondo', 100, 'Dotacion mensual seguridad ocupacional'),
('MOV-2026-018', '2026-10-19 14:10:00', 'ENTRADA', 5, 80, 1200, NULL, 2, 'OC-1068 / REC-425', 9, 'LOTE-EPP-314', 'Ing. Valeria Fonseca', 180, 'Compra de guantes en obra sin consultar stock de Bodega Central'),
('MOV-2026-019', '2026-10-25 08:00:00', 'SALIDA', 5, 40, 850, 2, NULL, 'VALE-EPP-109', NULL, 'LOTE-EPP-314', 'Ing. Valeria Fonseca', 140, 'Entrega a cuadrilla de armadores y albaniles'),

-- Tubo PVC 1/2 SDR 13.5 (Saldo final = 25 unid.)
('MOV-2026-020', '2026-10-21 09:30:00', 'ENTRADA', 6, 25, 2900, NULL, 3, 'OC-1072 / REC-430', 10, 'EXTRUSION-PVC-09', 'Tec. Rodolfo Solano', 25, 'Repuestos red hidraulica taller y bodega');

-- 8. Alertas Iniciales Detectadas por el Motor (Reorden A5 + Auditoría A3)
INSERT INTO alertas (
    codigo_alerta, tipo_alerta, severidad, material_id, orden_compra_id,
    titulo, detalle_tecnico, impacto_colones, estado, fecha_generacion
) VALUES
(
    'ALT-PR-001', 'REORDEN_CRITICO', 'CRITICA', 4, NULL,
    'Rotura inminente de Punto de Reorden: Arena lavada (m3)',
    'Stock actual (14 m3) inferior al Punto de Reorden calculado (20 m3). Se ha consumido el 75% del Stock de Seguridad (8 m3). Autonomia restante: 2.33 dias frente a Lead Time de 2 dias.',
    330000, 'ACTIVA', '2026-10-28 11:46:00'
),
(
    'ALT-PR-002', 'REORDEN_CRITICO', 'CRITICA', 3, NULL,
    'Stock bajo Punto de Reorden: Block 12 x 20 x 40 cm',
    'Stock actual (2 800 unid.) inferior al Punto de Reorden calculado (3 600 unid.). Deficit de 800 unidades respecto al umbral de reposicion con tiempo de entrega de 4 dias.',
    1746000, 'ACTIVA', '2026-10-26 17:05:00'
),
(
    'ALT-DUP-001', 'OC_DUPLICADA', 'CRITICA', 1, 2,
    'Orden de Compra Duplicada Exacta: OC-1041 y OC-1042',
    'Ambas ordenes fueron emitidas el 02/10 por el area de Obras al Proveedor A por 200 sacos de Cemento gris 50 kg a 6 450 colones/u. Variacion de cantidad: 0%, diferencia temporal: 0 dias.',
    1290000, 'ACTIVA', '2026-10-02 16:10:00'
),
(
    'ALT-DUP-002', 'FRACCIONAMIENTO_OC', 'ALTA', 2, 5,
    'Posible Duplicidad y Fraccionamiento de Umbral: OC-1050 y OC-1053',
    'Emitidas con 24 horas de diferencia (08/10 y 09/10) al Proveedor C por 500 y 480 unidades de Varilla #3 (variacion 4.0%). La suma acumulada (2 107 000 colones) supera el umbral de 2 000 000 colones de Gerencia Financiera.',
    1032000, 'ACTIVA', '2026-10-09 14:00:00'
),
(
    'ALT-FUG-001', 'SOBREPRECIO_CONTRATO', 'ALTA', 1, 3,
    'Fuga de Valor por Compras Fuera de Contrato y Sobreprecios (Octubre)',
    'Se detectaron 6 ordenes en octubre con precio superior al Contrato Marco CM-2026-001 (Cemento 6 300 colones, Varilla 2 050 colones). Sobreprecio directo mensual: 223 000 colones (1 483 000 colones incluyendo OC-1042 duplicada).',
    1483000, 'ACTIVA', '2026-10-16 08:00:00'
);

-- 9. Equivalencias y Catálogo Comparador de Proveedores (Integración Opción 1 + A4)
INSERT INTO equivalencias_proveedor (material_id, proveedor_id, sku_proveedor, nombre_en_proveedor, disponibilidad_inmediata) VALUES
(1, 1, 'CPL-CEM-50UG', 'Cemento Uso General Holcim/Cemex 50kg (Tarifa Contrato)', 1),
(1, 7, 'NVX-104920', 'Cemento Gris Uso General Saco 50kg', 1),
(1, 6, 'EPA-0491822', 'Saco Cemento Gris Multiuso 50kg', 1),
(2, 1, 'CPL-VAR-38G40', 'Varilla Corrugada #3 3/8 x 6m Grado 40 ASTM A615', 1),
(2, 7, 'NVX-208114', 'Varilla Deformada #3 (9.5mm) x 6m G40', 1),
(2, 6, 'EPA-0883104', 'Hierro Corrugado 3/8 x 6m Grado 40', 1),
(3, 1, 'CPL-BLK-122040', 'Bloque Estructural Concreto 12x20x40cm Clase A', 1),
(3, 7, 'NVX-301940', 'Block Modular 12x20x40cm 70kg/cm2', 1),
(3, 6, 'EPA-0319002', 'Bloque Cemento 12x20x40 Estándar', 1),
(4, 1, 'CPL-AGR-ARENA', 'Arena de Rio Lavada Modulo Finura 2.6 (m3)', 1),
(4, 7, 'NVX-309811', 'Arena Lavada para Concreto Granel (m3)', 1),
(4, 6, 'EPA-0399120', 'Arena Construccion en Saco Equivalente m3', 1),
(5, 5, 'SIT-EPP-NITL', 'Guante Tejido Nylon Palma Nitrilo Talla L Par', 1),
(5, 7, 'NVX-501290', 'Guante Trabajo Recubierto Nitrilo L', 1),
(5, 6, 'EPA-0912044', 'Guante Seguridad Nitrilo Talla Grande', 1),
(6, 7, 'NVX-402135', 'Tubo PVC Agua Fria 1/2 pulg SDR 13.5 x 6m', 1),
(6, 1, 'CPL-PVC-12135', 'Tuberia PVC Presion 12mm (1/2) SDR 13.5 Mexichem', 1),
(6, 6, 'EPA-0611290', 'Tubo PVC 1/2 x 6m SDR 13.5 Blanco', 1);

INSERT INTO historico_precios_proveedor (material_id, proveedor_id, precio_colones, fecha_captura, fuente_extraccion, variacion_porcentual) VALUES
-- Cemento 50kg
(1, 1, 6300, '2026-10-01 06:00:00', 'Contrato Marco CM-2026-001', 0.0),
(1, 1, 6300, '2026-10-28 06:00:00', 'Contrato Marco CM-2026-001', 0.0),
(1, 7, 6480, '2026-10-01 06:00:00', 'Catalogo Mayorista Novex JSON', 0.0),
(1, 7, 6420, '2026-10-28 06:00:00', 'Catalogo Mayorista Novex JSON', -0.93),
(1, 6, 6850, '2026-10-01 06:00:00', 'Lista Precios EPA CSV', 0.0),
(1, 6, 7100, '2026-10-28 06:00:00', 'Lista Precios EPA CSV', 3.65),
-- Varilla #3
(2, 1, 2050, '2026-10-01 06:00:00', 'Contrato Marco CM-2026-001', 0.0),
(2, 1, 2050, '2026-10-28 06:00:00', 'Contrato Marco CM-2026-001', 0.0),
(2, 7, 2120, '2026-10-01 06:00:00', 'Catalogo Mayorista Novex JSON', 0.0),
(2, 7, 2110, '2026-10-28 06:00:00', 'Catalogo Mayorista Novex JSON', -0.47),
(2, 6, 2490, '2026-10-01 06:00:00', 'Lista Precios EPA CSV', 0.0),
(2, 6, 2580, '2026-10-28 06:00:00', 'Lista Precios EPA CSV', 3.61),
-- Block 12x20x40
(3, 1, 485, '2026-10-28 06:00:00', 'Contrato Marco CM-2026-001', 0.0),
(3, 7, 505, '2026-10-28 06:00:00', 'Catalogo Mayorista Novex JSON', 1.0),
(3, 6, 560, '2026-10-28 06:00:00', 'Lista Precios EPA CSV', 4.67),
-- Arena m3
(4, 1, 16500, '2026-10-28 06:00:00', 'Contrato Marco CM-2026-001', 0.0),
(4, 7, 17200, '2026-10-28 06:00:00', 'Catalogo Mayorista Novex JSON', 0.0),
(4, 6, 21400, '2026-10-28 06:00:00', 'Lista Precios EPA CSV', 5.42),
-- Guantes nitrilo L
(5, 5, 850, '2026-10-28 06:00:00', 'Contrato Marco CM-2026-004', 0.0),
(5, 7, 940, '2026-10-28 06:00:00', 'Catalogo Mayorista Novex JSON', 0.0),
(5, 6, 1200, '2026-10-28 06:00:00', 'Lista Precios EPA CSV', 0.0),
-- Tubo PVC 1/2
(6, 7, 2450, '2026-10-28 06:00:00', 'Contrato Marco CM-2026-002', 0.0),
(6, 1, 2520, '2026-10-28 06:00:00', 'Contrato Marco CM-2026-001', 0.0),
(6, 6, 2900, '2026-10-28 06:00:00', 'Lista Precios EPA CSV', 3.57);

-- 10. Tabla de Promociones Negociadas con Proveedores (Integracion Opcion 3 — Caso Joaquin, AON)
INSERT INTO promociones (
    id, codigo_promo, nombre, proveedor_id, fecha_inicio, fecha_fin,
    tipo_descuento, valor_descuento, monto_minimo_oc, cantidad_minima,
    categoria_aplicable, material_id, prioridad, acumulable, activa
) VALUES
(
    1, 'PROMO-CPL-VOL8', 'Descuento 8% por Lote Mayorista de Obra Gris (>= 250 unid.)',
    1, '2026-10-01', '2026-12-31',
    'PORCENTAJE', 8.0, 1200000, 250,
    'MAT-OBR', NULL, 1, 0, 1
),
(
    2, 'PROMO-CPL-BONO75K', 'Bono Fijo de 75 000 colones en Compras Superiores a 1.5M',
    1, '2026-10-01', '2026-12-31',
    'MONTO_FIJO', 75000, 1500000, 100,
    'MAT-OBR', NULL, 2, 0, 1
),
(
    3, 'PROMO-SEP-VENCIDA', 'Promocion Trimestre Anterior Cemento 10% (Vencida)',
    1, '2026-07-01', '2026-09-30',
    'PORCENTAJE', 10.0, 500000, 100,
    'MAT-OBR', 1, 1, 0, 1
),
(
    4, 'PROMO-NVX-HID12', 'Descuento 12% Especial en Tuberias e Hidrosanitarios Novex',
    7, '2026-10-01', '2026-11-30',
    'PORCENTAJE', 12.0, 50000, 20,
    'MEC-HID', NULL, 1, 0, 1
),
(
    5, 'PROMO-EPP-2X1', 'Bonificacion 2x1 en Lotes de Seguridad Ocupacional (>= 200 pares)',
    5, '2026-10-01', '2026-12-31',
    'BONIFICACION_2X1', 50.0, 150000, 200,
    'SEG-EPP', 5, 1, 0, 1
);

