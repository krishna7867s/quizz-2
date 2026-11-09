# Constructora Del Valle S.A. — Sistema de Control de Inventarios, Kardex y Auditoria de Compras

Solucion integral para el **Quiz #2 — Trabajo Practico de Gestion de Inventarios (Compras y Proveedores)**. Incluye la resolucion completa de la **Parte A (Ejercicios A1 a A5)** y la implementacion funcional de la **Parte B (Opcion 2: Control de Inventario para una Empresa de Construccion)** bajo el **Camino 2 (Back end propio en Node.js + Base de Datos Relacional SQLite)**, incorporando todos los criterios de puntos extra:

1. **Interfaz web interactiva (Dashboard de Ingenieria)** conectada en tiempo real a la API REST (`http://localhost:3000`).
2. **Informe escrito listo para imprimir/exportar a PDF** con diagramas tecnicos vectoriales del circuito de compra y modelo entidad-relacion (`http://localhost:3000/informe.html`).
3. **Integracion entre opciones (Opcion 2 + Opcion 1)**: el modulo de reorden sugiere automaticamente el proveedor mas economico cruzando el catalogo normalizado con el comparador de precios de Construplaza, Novex y EPA.
4. **Aplicacion en vivo de la Matriz de Aprobacion de A1**: las ordenes de compra quedan en estado `PENDIENTE_APROBACION` hasta que las firma el rol exigido segun el monto individual o el acumulado movil de 30 dias (bloqueo antifraccionamiento).
5. **Suite de pruebas automatizadas** con el corredor nativo `node --test`.

---

## Estructura del Proyecto

```text
quiz#2/
├── src/
│   ├── db/
│   │   ├── connection.js      # Conexion SQLite nativa (node:sqlite) e inicializacion
│   │   ├── init.js            # Script CLI para crear/reiniciar esquema y datos semilla
│   │   ├── schema.sql         # Esquema relacional normalizado (9 tablas con FKs e indices)
│   │   └── seed.sql           # Datos semilla oficiales de Constructora Del Valle S.A.
│   ├── routes/
│   │   └── api.js             # Endpoints REST de materiales, kardex, alertas, ordenes y proveedores
│   ├── services/
│   │   ├── reorden.js         # Calculo dinamico de SS, PR, prioridades y trazabilidad Kardex
│   │   ├── duplicados.js      # Regla parametrica de deteccion de OC duplicadas y fugas A3
│   │   └── aprobaciones.js    # Motor de Matriz A1 (acumulado 30d), Matriz A4 y Comparador Opcion 1
│   └── index.js               # Servidor HTTP Express
├── public/
│   ├── index.html             # Aplicacion web principal (6 modulos interactivos)
│   ├── informe.html           # Entregable 1: Informe escrito completo (imprimible a PDF)
│   ├── styles.css             # Sistema de diseno industrial suizo (grilla expuesta 1px)
│   └── app.js                 # Cliente JS con animaciones interpoladas y trazabilidad en vivo
├── tests/
│   └── inventario.test.js     # Pruebas automatizadas de reglas de negocio y casos borde
├── .env.example               # Variables de entorno de referencia (sin credenciales sensibles)
└── package.json
```

---

## Requisitos e Instrucciones de Ejecucion

### 1. Requisitos previos
- **Node.js v22.5.0 o superior** (probado en Node.js v24.19.0 con soporte nativo `node:sqlite`).

### 2. Configuracion de variables de entorno
Copie el archivo `.env.example` a `.env` (opcional; el sistema aplica valores por defecto seguros si no existe `.env`):

```powershell
Copy-Item .env.example .env
```

### 3. Inicializar o restaurar la base de datos con datos semilla
```powershell
npm run db:reset
```

### 4. Ejecutar las pruebas automatizadas
```powershell
npm test
```

### 5. Iniciar el servidor y abrir la interfaz
```powershell
npm start
```
- **Dashboard Interactivo (Sistema en Vivo):** `http://localhost:3000`
- **Informe Escrito Completo (Exportable a PDF):** `http://localhost:3000/informe.html`

---

## Documentacion de Reglas de Negocio y Endpoints REST

### 1. Calculo Dinamico de Stock de Seguridad y Punto de Reorden (`src/services/reorden.js`)
El Punto de Reorden (`PR`) nunca se digita manualmente en la base de datos; se calcula en cada consulta y transaccion mediante las ecuaciones:
- `SS = (demanda_diaria_max - demanda_diaria_prom) * tiempo_entrega_dias`
- `PR = (demanda_diaria_prom * tiempo_entrega_dias) + SS`

| Material (SKU) | Demanda Prom. (`d`) | Demanda Max. | Entrega (`L`) | Stock Seguridad (`SS`) | Punto Reorden (`PR`) | Stock Actual | Estado Inicial |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Arena (`MAT-AGR-004`)** | 6 m3 | 10 m3 | 2 dias | **8 m3** | **20 m3** | **14 m3** | Reponer Hoy — Prioridad #1 (70.0% del PR) |
| **Block (`MAT-MAM-012`)** | 600 unid. | 900 unid. | 4 dias | **1 200 unid.** | **3 600 unid.** | **2 800 unid.** | Reponer Hoy — Prioridad #2 (77.8% del PR) |
| **Varilla #3 (`MAT-ACE-003`)** | 120 unid. | 160 unid. | 5 dias | **200 unid.** | **800 unid.** | **850 unid.** | Alerta Preventiva — Prioridad #3 (+50 unid.) |
| **Cemento (`MAT-CEM-001`)** | 40 sacos | 55 sacos | 3 dias | **45 sacos** | **165 sacos** | **190 sacos** | Alerta Preventiva — Prioridad #4 (+25 sacos) |

### 2. Regla de Deteccion de Compras Duplicadas y Fraccionamiento (`src/services/duplicados.js`)
Dos ordenes de compra se marcan como sospechosas de duplicidad cuando cumplen simultaneamente:
1. Mismo proveedor (`proveedor_id`) y mismo material normalizado (`material_id`).
2. Diferencia entre fechas de emision menor o igual a `DUPLICATE_WINDOW_DAYS` (por defecto **3 dias**).
3. Variacion porcentual de cantidad menor o igual a `DUPLICATE_QTY_TOLERANCE_PCT` (por defecto **10%**).
4. Adicionalmente, si la suma de ambas ordenes supera un umbral de la Matriz de Aprobacion A1 (p. ej. ₡2 000 000 para Gerencia Financiera), se reporta **Evasion de Umbral por Fraccionamiento** (caso `OC-1050` + `OC-1053` = ₡2 107 000).

### 3. Endpoints Principales
- `GET /materiales/:id/stock` — Devuelve existencia actual consolidada y por bodega, `SS`, `PR` y estado de reposicion.
- `GET /materiales/:id/trazabilidad` — Devuelve el historial completo de movimientos Kardex y de que OC proviene cada entrada.
- `POST /movimientos` — Registra `ENTRADA`, `SALIDA`, `TRASLADO` o `AJUSTE`, recalcula el saldo y genera alerta automatica si `stock_actual <= PR`.
- `GET /alertas/reorden` — Lista priorizada de materiales bajo el punto de reorden.
- `GET /ordenes/posibles-duplicados` — Ejecuta el detector de duplicados y cuantifica el gasto fuera de contrato y sobreprecios.
- `POST /ordenes` y `PATCH /ordenes/:id/aprobar` — Emision y aprobacion de OC validando la Matriz A1 y la segregacion de roles.
- `GET /proveedores/comparador` — Matriz ponderada A4 y comparador de precios entre Construplaza, Novex y EPA.

---

## Nota Etica y de Fuentes de Datos
Para la integracion del comparador de precios entre proveedores (Construplaza, Novex y EPA), los precios historicos y equivalencias provienen de capturas locales simuladas en `src/db/seed.sql`, respetando las politicas de `robots.txt` y terminos de servicio de los portales comerciales.
