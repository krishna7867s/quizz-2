const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

let dbInstance = null;

function getDatabasePath() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL === ':memory:') {
    return ':memory:';
  }
  const customPath = process.env.DATABASE_URL || './data/inventario_del_valle.sqlite';
  return path.resolve(process.cwd(), customPath);
}

function initializeSchemaAndSeed(db, forceReset = false) {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const seedPath = path.join(__dirname, 'seed.sql');

  const tableCheck = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='materiales'"
  ).get();

  if (!tableCheck || forceReset) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    db.exec(schemaSql);
    db.exec(seedSql);
  }
}

function getDb(options = {}) {
  if (options.freshMemory) {
    const memDb = new DatabaseSync(':memory:');
    memDb.exec('PRAGMA foreign_keys = ON;');
    initializeSchemaAndSeed(memDb, true);
    return memDb;
  }

  if (!dbInstance) {
    const dbPath = getDatabasePath();
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    dbInstance = new DatabaseSync(dbPath);
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    initializeSchemaAndSeed(dbInstance, Boolean(options.forceReset));
  } else if (options.forceReset) {
    initializeSchemaAndSeed(dbInstance, true);
  }

  return dbInstance;
}

module.exports = {
  getDb,
  initializeSchemaAndSeed
};
