import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import initSqlJs from "sql.js";

let _dbPromise;

function getProjectRootDir() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, "..");
}

function resolveSqliteFile(config) {
  const root = getProjectRootDir();
  const raw = config?.sqlite?.file ?? "data/app.sqlite";
  return path.isAbsolute(raw) ? raw : path.resolve(root, raw);
}

async function initDbOnce(config) {
  if (_dbPromise) return _dbPromise;

  _dbPromise = (async () => {
    const root = getProjectRootDir();
    const sqliteFile = resolveSqliteFile(config);
    await fs.mkdir(path.dirname(sqliteFile), { recursive: true });

    const SQL = await initSqlJs({
      locateFile: (file) =>
        path.resolve(root, "node_modules", "sql.js", "dist", file),
    });

    let fileBytes;
    try {
      fileBytes = await fs.readFile(sqliteFile);
    } catch {
      fileBytes = undefined;
    }

    const db = fileBytes
      ? new SQL.Database(new Uint8Array(fileBytes))
      : new SQL.Database();

    const schemaSql = await fs.readFile(
      path.resolve(root, "schema.sql"),
      "utf8",
    );
    db.run(schemaSql);

    async function persist() {
      const data = db.export();
      await fs.writeFile(sqliteFile, Buffer.from(data));
    }

    // Ensure file exists with schema even on first run
    await persist();

    return { db, persist, sqliteFile };
  })();

  return _dbPromise;
}

export async function getDb(config) {
  return initDbOnce(config);
}

export async function initDb(config) {
  await initDbOnce(config);
}

export function sqlGetOne(db, sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    if (!stmt.step()) return null;
    return stmt.getAsObject();
  } finally {
    stmt.free();
  }
}

export function sqlGetAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  const rows = [];
  try {
    stmt.bind(params);
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}
