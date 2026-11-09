const path = require('node:path');
const express = require('express');
const apiRouter = require('./routes/api');
const { getDb } = require('./db/connection');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inicializar base de datos al arrancar
getDb();

// Exponer tanto bajo /api/* como en las rutas directas de la arquitectura de referencia del enunciado
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Servir interfaz web y reporte tecnico imprimible
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[CONSTRUCTORA DEL VALLE S.A.] Servidor activo en http://localhost:${PORT}`);
    console.log(`[INFORME TECNICO PDF]         Disponible en http://localhost:${PORT}/informe.html`);
  });
}

module.exports = app;
