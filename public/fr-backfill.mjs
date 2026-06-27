// fr-backfill.mjs — sube tu base de datos (Neon / Supabase / Postgres) al índice
// del FR-API, para que el anti-duplicado y las búsquedas funcionen contra TUS
// datos. Idempotente (por external_id) y reanudable: puedes cortarlo y volver a
// correrlo sin duplicar. Respeta el rate-limit (120/min).
//
// REQUISITOS:  node >= 18  y  el driver de Postgres:   npm i pg
// USO:         node fr-backfill.mjs            (lee tu .env del directorio)
//
// ANTES de correr, valida tu config con fr-doctor.py. El FR-API NO lee tu BD:
// este script es justamente el puente (tu BD -> /v1/index -> índice del FR-API).

import { Pool } from "pg";
import fs from "node:fs";

// --- 1) Carga simple del .env (sin dependencias) ---------------------------
function loadEnv(path = ".env") {
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, "utf8").split("\n")) {
    const s = line.trim();
    if (!s || s.startsWith("#") || !s.includes("=")) continue;
    const i = s.indexOf("=");
    const k = s.slice(0, i).trim();
    const v = s.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv();

// --- 2) AJUSTA a TU tabla y columnas (o pásalas por entorno) ----------------
const TABLE = process.env.FR_TABLE || "personas";          // tu tabla de personas
const COL_ID = process.env.FR_COL_ID || "id";              // id único (-> external_id)
const COL_NAME = process.env.FR_COL_NAME || "nombre";      // nombre
const COL_PHOTO = process.env.FR_COL_PHOTO || "foto_url";  // URL pública de la foto
const COL_LOCATION = process.env.FR_COL_LOCATION || "ubicacion"; // visto en / lugar

// --- 3) Config del FR-API y la BD (del .env) -------------------------------
const FR = (process.env.FR_API_URL || "https://fr-api.reportavnzla.com:8443").replace(/\/+$/, "");
const KEY = process.env.FR_API_KEY || "";
const SOURCE = process.env.FR_SOURCE || "";
const DB =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_PRISMA_URL;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- 4) Validaciones rápidas (fallar temprano, claro) ----------------------
if (KEY.length !== 48) {
  console.error(`✖ FR_API_KEY inválida (tiene ${KEY.length} chars, deben ser 48). Corre fr-doctor.py.`);
  process.exit(1);
}
if (!SOURCE) console.warn("⚠ FR_SOURCE vacío: usará la etiqueta de tu API key por defecto. Mejor ponlo explícito (= source_default de /v1/whoami).");
if (!DB) { console.error("✖ Falta DATABASE_URL / POSTGRES_URL en tu .env"); process.exit(1); }

// --- 5) Backfill ------------------------------------------------------------
const pool = new Pool({ connectionString: DB, ssl: { rejectUnauthorized: false } });
const sql =
  `SELECT "${COL_ID}" AS id, "${COL_NAME}" AS name, ` +
  `"${COL_PHOTO}" AS photo, "${COL_LOCATION}" AS location ` +
  `FROM "${TABLE}" WHERE "${COL_PHOTO}" IS NOT NULL`;

let ok = 0, noface = 0, err = 0, n = 0;
const { rows } = await pool.query(sql);
console.log(`registros con foto: ${rows.length}  (source=${SOURCE || "[etiqueta de tu key]"})`);

for (const r of rows) {
  n++;
  const fd = new FormData();
  fd.append("external_id", String(r.id));      // idempotente: re-correr no duplica
  if (SOURCE) fd.append("source", SOURCE);
  fd.append("image_url", String(r.photo));      // el FR descarga la foto del lado servidor
  if (r.name) fd.append("person_name", String(r.name));
  if (r.location) fd.append("last_seen_location", String(r.location));
  try {
    const res = await fetch(`${FR}/v1/index`, { method: "POST", headers: { "X-API-Key": KEY }, body: fd });
    if (res.status === 401) { console.error("✖ 401: FR_API_KEY inválida. Aborto."); process.exit(1); }
    if (res.status === 429) { await sleep(2000); n--; continue; } // backoff y reintenta esta fila
    const d = await res.json();
    if (d.indexed) ok++; else noface++;          // indexed=false suele ser "sin rostro"
  } catch (e) {
    err++;
    if (err <= 3) console.warn("  error en", r.id, e.message);
  }
  if (n % 100 === 0) console.log(`  ${n}/${rows.length} | indexados=${ok} sin_rostro=${noface} err=${err}`);
  await sleep(550); // ~110/min, por debajo del límite de 120/min
}

console.log(`\nFIN backfill → indexados=${ok} sin_rostro=${noface} errores=${err}`);

// --- 6) Confirmación con whoami --------------------------------------------
try {
  const w = await (await fetch(`${FR}/v1/whoami`, { headers: { "X-API-Key": KEY } })).json();
  console.log(`whoami → source_default=${w.source_default} | indexed_my_source=${w.indexed_my_source}`);
} catch { /* opcional */ }

await pool.end();
