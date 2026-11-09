-- =============================================================================
-- CONSTRUCTORA DEL VALLE S.A. — SISTEMA DE CONTROL DE INVENTARIOS Y ABASTECIMIENTO
-- Esquema Relacional Normalizado (3FN) — SQLite / PostgreSQL Compatible
-- =============================================================================

PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS auditoria_promociones;
DROP TABLE IF EXISTS promociones;
DROP TABLE IF EXISTS alertas;
DROP TABLE IF EXISTS historico_precios_proveedor;
DROP TABLE IF EXISTS equivalencias_proveedor;
DROP TABLE IF EXISTS movimientos_inventario;
DROP TABLE IF EXISTS stock_ubicacion;
DROP TABLE IF EXISTS ordenes_compra;
DROP TABLE IF EXISTS materiales;
DROP TABLE IF EXISTS proveedores;
DROP TABLE IF EXISTS ubicaciones;
DROP TABLE IF EXISTS matriz_aprobacion;

-- 1. Tabla de Ubicaciones (Bodegas y Frentes de Obra)
CREATE TABLE ubicaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('BODEGA_CENTRAL', 'FRENTE_OBRA', 'PLANTA_MANTENIMIENTO')),
    responsable TEXT NOT NULL,
    provincia TEXT NOT NULL,
    activa INTEGER NOT NULL DEFAULT 1
);

-- 2. Tabla de Proveedores Homologados y No Homologados (Ejercicios A2, A3, A4)
CREATE TABLE proveedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL UNIQUE,
    nombre_comercial TEXT NOT NULL,
    razon_social TEXT NOT NULL,
    cedula_juridica TEXT NOT NULL,
    tiene_contrato_marco INTEGER NOT NULL DEFAULT 0,
    numero_contrato TEXT,
    plazo_credito_dias INTEGER NOT NULL DEFAULT 0,
    -- Calificaciones Matriz Ponderada Ejercicio A4 (escala 1 a 5)
    nota_precio REAL NOT NULL DEFAULT 3.0,
    nota_calidad REAL NOT NULL DEFAULT 3.0,
    nota_plazo_entrega REAL NOT NULL DEFAULT 3.0,
    nota_credito REAL NOT NULL DEFAULT 3.0,
    nota_posventa REAL NOT NULL DEFAULT 3.0,
    nota_cobertura_riesgo REAL NOT NULL DEFAULT 3.0,
    estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('HOMOLOGADO_PRINCIPAL', 'HOMOLOGADO_RESPALDO', 'CONDICIONADO', 'NO_AUTORIZADO'))
);

-- 3. Catálogo Normalizado de Materiales con Taxonomía de Dos Niveles (Ejercicios A2 y A5)
CREATE TABLE materiales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_estandar TEXT NOT NULL UNIQUE,
    nombre_estandar TEXT NOT NULL,
    categoria_codigo TEXT NOT NULL,
    categoria_nombre TEXT NOT NULL,
    subcategoria_codigo TEXT NOT NULL,
    subcategoria_nombre TEXT NOT NULL,
    unidad_medida TEXT NOT NULL,
    demanda_diaria_prom REAL NOT NULL CHECK (demanda_diaria_prom >= 0),
    demanda_diaria_max REAL NOT NULL CHECK (demanda_diaria_max >= demanda_diaria_prom),
    tiempo_entrega_dias REAL NOT NULL CHECK (tiempo_entrega_dias > 0),
    stock_minimo REAL NOT NULL DEFAULT 0,
    stock_maximo REAL NOT NULL DEFAULT 0,
    precio_contrato_colones REAL,
    proveedor_contrato_id INTEGER,
    aliases_erp TEXT NOT NULL DEFAULT '[]',
    FOREIGN KEY (proveedor_contrato_id) REFERENCES proveedores(id)
);

-- 4. Existencias por Ubicación (Sincronizadas mediante movimientos del Kardex)
CREATE TABLE stock_ubicacion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL,
    ubicacion_id INTEGER NOT NULL,
    cantidad REAL NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
    ultima_actualizacion TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(material_id, ubicacion_id),
    FOREIGN KEY (material_id) REFERENCES materiales(id),
    FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id)
);

-- 5. Matriz de Aprobación Institucional y Reglas Antifraccionamiento (Ejercicio A1)
CREATE TABLE matriz_aprobacion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nivel INTEGER NOT NULL UNIQUE,
    monto_minimo REAL NOT NULL,
    monto_maximo REAL,
    rol_aprobador TEXT NOT NULL,
    cotizaciones_requeridas INTEGER NOT NULL,
    requiere_comite INTEGER NOT NULL DEFAULT 0,
    ventana_acumulacion_dias INTEGER NOT NULL DEFAULT 30
);

-- 6. Órdenes de Compra (OC) con Control de Contratos y Aprobación (Ejercicios A1 y A3)
CREATE TABLE ordenes_compra (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_oc TEXT NOT NULL UNIQUE,
    fecha_emision TEXT NOT NULL,
    area_solicitante TEXT NOT NULL,
    ubicacion_id INTEGER NOT NULL,
    proveedor_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL,
    descripcion_erp_original TEXT NOT NULL,
    cantidad REAL NOT NULL CHECK (cantidad > 0),
    precio_unitario_colones REAL NOT NULL CHECK (precio_unitario_colones > 0),
    monto_total_colones REAL NOT NULL,
    precio_referencia_contrato REAL,
    es_fuera_contrato INTEGER NOT NULL DEFAULT 0,
    sobreprecio_unitario_colones REAL NOT NULL DEFAULT 0,
    sobreprecio_total_colones REAL NOT NULL DEFAULT 0,
    estado_aprobacion TEXT NOT NULL DEFAULT 'APROBADA' CHECK (estado_aprobacion IN ('PENDIENTE_APROBACION', 'APROBADA', 'OBSERVADA_DUPLICADO', 'RECHAZADA')),
    rol_aprobador_requerido TEXT NOT NULL,
    cotizaciones_requeridas INTEGER NOT NULL DEFAULT 1,
    cotizaciones_presentadas INTEGER NOT NULL DEFAULT 1,
    aprobado_por TEXT,
    usuario_creador TEXT NOT NULL DEFAULT 'sistema.erp',
    FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id),
    FOREIGN KEY (proveedor_id) REFERENCES proveedores(id),
    FOREIGN KEY (material_id) REFERENCES materiales(id)
);

-- 7. Kardex de Movimientos con Trazabilidad Completa de Existencias (Ejercicio A5 y Parte B)
CREATE TABLE movimientos_inventario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_movimiento TEXT NOT NULL UNIQUE,
    fecha_hora TEXT NOT NULL DEFAULT (datetime('now')),
    tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN ('ENTRADA', 'SALIDA', 'TRASLADO', 'AJUSTE')),
    material_id INTEGER NOT NULL,
    cantidad REAL NOT NULL CHECK (cantidad > 0),
    costo_unitario_colones REAL NOT NULL DEFAULT 0,
    ubicacion_origen_id INTEGER,
    ubicacion_destino_id INTEGER,
    documento_origen TEXT NOT NULL,
    orden_compra_id INTEGER,
    lote_serie TEXT NOT NULL,
    usuario_responsable TEXT NOT NULL,
    saldo_resultante_material REAL NOT NULL,
    observaciones TEXT,
    FOREIGN KEY (material_id) REFERENCES materiales(id),
    FOREIGN KEY (ubicacion_origen_id) REFERENCES ubicaciones(id),
    FOREIGN KEY (ubicacion_destino_id) REFERENCES ubicaciones(id),
    FOREIGN KEY (orden_compra_id) REFERENCES ordenes_compra(id)
);

-- 8. Alertas Operativas de Punto de Reorden, Duplicidad y Fuga de Valor
CREATE TABLE alertas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_alerta TEXT NOT NULL UNIQUE,
    tipo_alerta TEXT NOT NULL CHECK (tipo_alerta IN ('REORDEN_CRITICO', 'REORDEN_PREVENTIVO', 'OC_DUPLICADA', 'FRACCIONAMIENTO_OC', 'SOBREPRECIO_CONTRATO', 'VARIACION_PRECIO_MERCADO')),
    severidad TEXT NOT NULL CHECK (severidad IN ('CRITICA', 'ALTA', 'MEDIA', 'BAJA')),
    material_id INTEGER,
    orden_compra_id INTEGER,
    titulo TEXT NOT NULL,
    detalle_tecnico TEXT NOT NULL,
    impacto_colones REAL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA', 'EN_GESTION', 'RESUELTA')),
    fecha_generacion TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (material_id) REFERENCES materiales(id),
    FOREIGN KEY (orden_compra_id) REFERENCES ordenes_compra(id)
);

-- 9. Equivalencias de Catálogo y Comparador de Precios por Proveedor (Integración Opción 1)
CREATE TABLE equivalencias_proveedor (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL,
    proveedor_id INTEGER NOT NULL,
    sku_proveedor TEXT NOT NULL,
    nombre_en_proveedor TEXT NOT NULL,
    disponibilidad_inmediata INTEGER NOT NULL DEFAULT 1,
    UNIQUE(material_id, proveedor_id),
    FOREIGN KEY (material_id) REFERENCES materiales(id),
    FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
);

CREATE TABLE historico_precios_proveedor (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL,
    proveedor_id INTEGER NOT NULL,
    precio_colones REAL NOT NULL,
    fecha_captura TEXT NOT NULL,
    fuente_extraccion TEXT NOT NULL,
    variacion_porcentual REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (material_id) REFERENCES materiales(id),
    FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
);

-- 10. Motor de Codigos de Promocion y Descuentos (Integracion Opcion 3 — Caso Joaquin, AON)
CREATE TABLE promociones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_promo TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    proveedor_id INTEGER NOT NULL,
    fecha_inicio TEXT NOT NULL,
    fecha_fin TEXT NOT NULL,
    tipo_descuento TEXT NOT NULL CHECK (tipo_descuento IN ('PORCENTAJE', 'MONTO_FIJO', 'ESCALONADO_VOLUMEN', 'BONIFICACION_2X1')),
    valor_descuento REAL NOT NULL,
    monto_minimo_oc REAL NOT NULL DEFAULT 0,
    cantidad_minima REAL NOT NULL DEFAULT 0,
    categoria_aplicable TEXT,
    material_id INTEGER,
    prioridad INTEGER NOT NULL DEFAULT 1,
    acumulable INTEGER NOT NULL DEFAULT 0,
    activa INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (proveedor_id) REFERENCES proveedores(id),
    FOREIGN KEY (material_id) REFERENCES materiales(id)
);

CREATE TABLE auditoria_promociones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orden_compra_id INTEGER,
    referencia_caso TEXT NOT NULL,
    fecha_evaluacion TEXT NOT NULL DEFAULT (datetime('now')),
    codigo_promo_aplicada TEXT,
    monto_bruto_colones REAL NOT NULL,
    ahorro_aplicado_colones REAL NOT NULL DEFAULT 0,
    monto_neto_colones REAL NOT NULL,
    regla_resolucion TEXT NOT NULL,
    promociones_descartadas_json TEXT NOT NULL DEFAULT '[]',
    FOREIGN KEY (orden_compra_id) REFERENCES ordenes_compra(id)
);

CREATE INDEX idx_oc_material_prov_fecha ON ordenes_compra(material_id, proveedor_id, fecha_emision);
CREATE INDEX idx_mov_material_fecha ON movimientos_inventario(material_id, fecha_hora);
CREATE INDEX idx_stock_mat_ubi ON stock_ubicacion(material_id, ubicacion_id);
