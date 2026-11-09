const { getDb } = require('./connection');

const forceReset = process.argv.includes('--reset');
const db = getDb({ forceReset: true });
const countMat = db.prepare('SELECT COUNT(*) as total FROM materiales').get();
const countOc = db.prepare('SELECT COUNT(*) as total FROM ordenes_compra').get();
const countMov = db.prepare('SELECT COUNT(*) as total FROM movimientos_inventario').get();

console.log(
  `[DB INIT] Base de datos inicializada correctamente (${forceReset ? 'RESET COMPLETO' : 'VERIFICACION'}). ` +
  `Materiales: ${countMat.total} | Ordenes de Compra: ${countOc.total} | Movimientos Kardex: ${countMov.total}`
);
