# Plataforma de Intercambio de Datos — PostgreSQL dedicado (Debian 13)

> **Objetivo:** Una base de datos PostgreSQL **dedicada** en el servidor Debian 13, **aislada** de cualquier otro servicio del servidor, pensada como **hub de intercambio de datos** al que muchas plataformas autorizadas (ReportaVNZLA, venezuela-ayuda y otras) puedan **enviar y recibir millones de registros simultáneamente vía API**. El servidor se usa **solo como base de datos** (no para hosting de aplicaciones).
>
> Este documento es el **plan + la documentación completa**. No ejecuta cambios en producción: deja todo listo para aplicar cuando lo autorices.

Fecha: 2026-06-26 · Autor: equipo ReportaVNZLA

---

## 0. TL;DR — ¿Es viable en nuestro Debian 13?

**Sí, es viable**, con matices importantes:

| Pregunta | Respuesta corta |
|----------|-----------------|
| ¿Aislado de otros servicios del servidor? | ✅ Sí. Recomendado: **instancia (cluster) PostgreSQL aparte en otro puerto** (p. ej. 5433), no solo otra `database` en el mismo cluster. Aísla CPU, RAM, WAL, fallos y seguridad. |
| ¿Millones de registros? | ✅ PostgreSQL maneja cientos de millones de filas sin problema con **particionado + índices correctos + autovacuum afinado**. |
| ¿Millones **simultáneos** vía API? | ⚠️ El cuello de botella **no es PostgreSQL**, es el **número de conexiones**. Postgres NO debe recibir miles de conexiones directas. Se resuelve con **PgBouncer** (pooling) + **ingesta por lotes/COPY** + **cola de escritura**. |
| ¿Acceso directo psql de plataformas externas? | ⚠️ Posible pero **NO recomendado** como modelo principal. Mejor: **todas pasan por nuestra API** (un solo punto, con rate-limit y auth). Acceso `psql` directo solo para socios muy confiables, con rol de **solo-lectura** y réplica. |
| ¿Hardware suficiente? | ✅ **Sí** (verificado, ver §1): 8 vCPU, 31 GiB RAM, todo SSD/NVMe con un NVMe libre dedicable. Holgado para arrancar. |

**Decisión arquitectónica recomendada:** *API-first*. Las plataformas hablan con **nuestra API REST** (asíncrona, idempotente, con `external_id`), y la API escribe a Postgres mediante **lotes** sobre tablas **particionadas**. PostgreSQL queda detrás de **PgBouncer** y solo expone acceso directo (read-only, SSL, IP allowlist) a réplicas para socios selectos.

---

## 1. Capacidad del servidor (verificada)

Las especificaciones reales del servidor están en **`FICHA-TECNICA-SERVIDOR.md`**. Resumen relevante para el dimensionamiento:

| Recurso | Valor | Implicación |
|---------|-------|-------------|
| CPU | 8 vCPU (Intel i3-10100F @ 3.6 GHz) | Suficiente (2–4 necesarios) |
| RAM | 31 GiB (~25 GiB libres) | `shared_buffers ≈ 8 GB` |
| Disco | SSD ~530 GB libres + **NVMe 238 GB libre** | NVMe dedicable al cluster de intercambio |
| PostgreSQL | **17.10** + TLS activo | Óptimo (≥14 recomendado) |
| PostGIS | **a instalar** | Requerido para geo |
| PgBouncer | **a instalar** | Requerido para concurrencia |

**Criterios aplicados:** `shared_buffers ≈ 25%` de la RAM; SSD/NVMe obligatorio para ingesta intensa (✅ todo SSD); WAL ideal en disco separado (✅ NVMe libre); PG ≥ 14 para mejor particionado y `COPY` (✅ 17.10); PostGIS para ubicaciones con búsqueda por cercanía (pendiente de instalar).

---

## 2. Arquitectura propuesta

```
   Plataformas autorizadas (ReportaVNZLA, venezuela-ayuda, otras N)
        │  HTTPS (API key)            ▲  HTTPS (GET ?since=)
        ▼  POST /v1/... (enviar)      │  (recibir)
┌─────────────────────────────────────────────────────┐
│              API Gateway de Intercambio              │  ← Next.js/Node, asíncrono
│   • Auth por API key  • Rate-limit  • Anti-spam      │
│   • Validación  • Idempotencia (external_id/dedup)   │
│   • Escritura por LOTES / COPY  • Cola de ingesta    │
└───────────────┬─────────────────────┬───────────────┘
                │ writes (pool)        │ reads
                ▼                      ▼
        ┌──────────────┐       ┌──────────────┐
        │  PgBouncer    │       │  PgBouncer    │   (pooling: miles de clientes → pocas conexiones)
        │ (transaction) │       │  (read pool)  │
        └──────┬───────┘       └──────┬───────┘
               ▼                       ▼
   ┌───────────────────────┐   ┌───────────────────────┐
   │ PostgreSQL PRIMARIO    │──▶│ Réplica(s) de LECTURA  │  (streaming replication)
   │  cluster `exchange`     │   │  para consultas masivas │
   │  puerto 5433 (aparte)   │   └───────────────────────┘
   │  tablas particionadas   │
   └───────────────────────┘
        (cluster de intercambio aislado del resto del servidor)
```

### 2.1 ¿Otra database o otra instancia?

| Opción | Aislamiento | Complejidad | Recomendación |
|--------|-------------|-------------|----------------|
| **A. Otra `DATABASE` en el cluster existente** | Bajo (comparte RAM/WAL/CPU con lo ya instalado) | Mínima | Solo para PoC/pruebas |
| **B. Otro CLUSTER PostgreSQL (puerto 5433)** en el mismo server | Medio-alto (config, memoria y WAL propios; un fallo no tumba al otro) | Media | ✅ **Recomendado** para empezar |
| **C. Servidor/VM dedicado** | Máximo | Alta | Ideal a futuro / si el volumen crece |

En Debian se crea un cluster aparte fácilmente:
```bash
sudo pg_createcluster 17 exchange -p 5433 --start
```
Así `exchange` tiene su `postgresql.conf`, su `pg_hba.conf`, su memoria y su WAL, **totalmente separado** del resto del servidor.

---

## 3. Esquema de la base de datos `exchange`

Fusión del **template `venezuela-ayuda`** (checkins, help_requests, help_offers, damaged_reports, sightings + PostGIS + RLS + dedup) con el **modelo de ReportaVNZLA** (personas, edificios, recursos). Todo bajo un esquema `exchange`, multi-plataforma y particionado.

### 3.1 Extensiones y enums

```sql
CREATE SCHEMA IF NOT EXISTS exchange;
CREATE EXTENSION IF NOT EXISTS postgis;       -- ubicaciones + búsqueda por cercanía
CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;       -- búsqueda por similitud de nombres
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Estados (compatibles con ambas plataformas)
CREATE TYPE exchange.persona_estado AS ENUM ('buscado','encontrado','fallecido','a_salvo','necesita_ayuda');
CREATE TYPE exchange.daño_severidad AS ENUM ('grietas','parcial','riesgo_colapso','colapsado');
CREATE TYPE exchange.solicitud_estado AS ENUM ('abierta','en_progreso','resuelta');
CREATE TYPE exchange.urgencia AS ENUM ('baja','media','alta','critica');
```

### 3.2 Tabla maestra de plataformas y API keys

```sql
-- Plataformas autorizadas que pueden enviar/recibir
CREATE TABLE exchange.plataformas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,           -- 'reportavnzla', 'venezuela-ayuda', ...
  nombre        text NOT NULL,
  url           text,
  contacto      text,
  activa        boolean NOT NULL DEFAULT true,
  creada_en     timestamptz NOT NULL DEFAULT now()
);

-- API keys (hash, nunca el valor en claro) con permisos por plataforma
CREATE TABLE exchange.api_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plataforma_id uuid NOT NULL REFERENCES exchange.plataformas(id) ON DELETE CASCADE,
  key_hash      text NOT NULL,                  -- sha256(key)
  alias         text,
  permisos      text[] NOT NULL DEFAULT '{read}',   -- {read, write, admin}
  rate_limit_min int NOT NULL DEFAULT 6000,      -- req/min permitidos
  revocada      boolean NOT NULL DEFAULT false,
  creada_en     timestamptz NOT NULL DEFAULT now(),
  ultima_uso    timestamptz
);
CREATE INDEX api_keys_hash_idx ON exchange.api_keys (key_hash) WHERE NOT revocada;

-- Auditoría de intercambio (quién envió/leyó qué y cuándo)
CREATE TABLE exchange.audit_log (
  id            bigserial PRIMARY KEY,
  plataforma_id uuid REFERENCES exchange.plataformas(id),
  accion        text NOT NULL,                  -- 'ingest','read','revoke'...
  recurso       text,                           -- 'personas','edificios'...
  filas         int,
  ip            inet,
  creado_en     timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE (creado_en);
```

### 3.3 Personas (checkins + personas) — **particionada**

```sql
CREATE TABLE exchange.personas (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  -- Identidad
  nombre        text NOT NULL,
  apellido      text,
  cedula        text,
  edad          int,
  genero        text,
  estado        exchange.persona_estado NOT NULL DEFAULT 'buscado',
  -- Ubicación (PostGIS) + texto
  ubicacion_txt text,
  ciudad        text,
  location      geography(Point, 4326),         -- lon/lat; índice GIST
  -- Multimedia
  foto_url      text,
  descripcion   text,
  -- Procedencia / intercambio
  plataforma_id uuid REFERENCES exchange.plataformas(id),
  source        text,                            -- nombre de la fuente original
  source_url    text,
  external_id   text,                            -- id en la plataforma origen
  dedup_key     text,                            -- normalizado: lower(nombre|apellido|ciudad)
  -- Auditoría
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
) PARTITION BY HASH (id);

-- 8 particiones hash (escala escrituras concurrentes y vacuum)
DO $$ BEGIN
  FOR i IN 0..7 LOOP
    EXECUTE format(
      'CREATE TABLE exchange.personas_p%1$s PARTITION OF exchange.personas
         FOR VALUES WITH (MODULUS 8, REMAINDER %1$s);', i);
  END LOOP;
END $$;

-- Clave de deduplicación (idempotencia entre plataformas): único por (plataforma, external_id)
CREATE UNIQUE INDEX personas_plat_extid_uniq
  ON exchange.personas (plataforma_id, external_id)
  WHERE external_id IS NOT NULL;
-- Dedup cruzado por contenido normalizado
CREATE INDEX personas_dedup_idx ON exchange.personas (dedup_key) WHERE dedup_key IS NOT NULL;
-- Geo, texto y tiempo
CREATE INDEX personas_geo_idx   ON exchange.personas USING gist (location);
CREATE INDEX personas_nombre_trgm ON exchange.personas USING gin (lower(nombre || ' ' || coalesce(apellido,'')) gin_trgm_ops);
CREATE INDEX personas_fts_idx   ON exchange.personas USING gin (to_tsvector('spanish', coalesce(nombre,'')||' '||coalesce(apellido,'')));
CREATE INDEX personas_created_idx ON exchange.personas (created_at DESC);
CREATE INDEX personas_estado_idx  ON exchange.personas (estado);
```

### 3.4 Edificios / estructuras dañadas (damaged_reports + edificios)

```sql
CREATE TABLE exchange.edificios (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        text NOT NULL,
  direccion     text,
  ciudad        text,
  location      geography(Point, 4326),
  severidad     exchange.daño_severidad,
  riesgo        text,
  tiene_desaparecidos boolean DEFAULT false,
  nombres_atrapados text,
  foto_url      text,
  notas         text,
  plataforma_id uuid REFERENCES exchange.plataformas(id),
  source        text, source_url text, external_id text, dedup_key text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX edificios_plat_extid_uniq ON exchange.edificios (plataforma_id, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX edificios_geo_idx ON exchange.edificios USING gist (location);
CREATE INDEX edificios_ciudad_idx ON exchange.edificios (lower(ciudad));
```

### 3.5 Recursos: centros de acopio / ayuda (help_offers + recursos) y solicitudes (help_requests)

```sql
CREATE TABLE exchange.recursos (             -- centros de acopio, refugios, ofertas
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,                        -- 'centro_acopio','refugio','hospital','oferta'
  nombre text NOT NULL, direccion text, ciudad text,
  location geography(Point,4326),
  recibe text, contacto text, descripcion text,
  plataforma_id uuid REFERENCES exchange.plataformas(id),
  source text, external_id text, dedup_key text, activo boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE exchange.solicitudes (          -- pedidos de ayuda
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text, urgencia exchange.urgencia DEFAULT 'media',
  estado exchange.solicitud_estado DEFAULT 'abierta',
  descripcion text, items jsonb, lugar text,
  location geography(Point,4326),
  plataforma_id uuid REFERENCES exchange.plataformas(id),
  source text, external_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recursos_geo_idx ON exchange.recursos USING gist (location);
CREATE INDEX solic_geo_idx ON exchange.solicitudes USING gist (location);
CREATE INDEX solic_estado_idx ON exchange.solicitudes (estado);
```

### 3.6 Avistamientos (sightings)

```sql
CREATE TABLE exchange.avistamientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES exchange.personas_p0(id),  -- ver nota partición
  nota text, location geography(Point,4326),
  plataforma_id uuid REFERENCES exchange.plataformas(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
```
> Nota: con tablas particionadas, las FKs hacia ellas tienen limitaciones; en la práctica el `persona_id` se valida en la API o se usa una tabla de avistamientos sin FK dura (recomendado a escala).

---

## 4. Diseño para **millones de registros simultáneos**

El reto no es almacenar millones de filas (Postgres lo hace), es **ingerir muy rápido desde muchos clientes a la vez**. Estrategia en capas:

### 4.1 Conexiones — PgBouncer (obligatorio)
PostgreSQL rinde mal con miles de conexiones (cada una = un proceso). **PgBouncer** en modo `transaction` multiplexa miles de clientes en ~20–50 conexiones reales.

```ini
# /etc/pgbouncer/pgbouncer.ini
[databases]
exchange = host=127.0.0.1 port=5433 dbname=exchange
[pgbouncer]
pool_mode = transaction
max_client_conn = 10000          # clientes simultáneos
default_pool_size = 40           # conexiones reales a Postgres
reserve_pool_size = 10
```
> Regla: `max_connections` de Postgres bajo (p. ej. 100–200) + PgBouncer alto. Nunca al revés.

### 4.2 Escritura por LOTES, no fila por fila
- La API **nunca** hace 1 `INSERT` por request bajo carga. Acumula y hace **multi-row INSERT** o **`COPY`**.
- Patrón **staging + merge**: los lotes caen en una tabla `UNLOGGED` de staging (muy rápida, sin WAL), y un proceso los fusiona a las tablas finales con `INSERT ... ON CONFLICT DO NOTHING`.

```sql
CREATE UNLOGGED TABLE exchange.personas_staging (LIKE exchange.personas);
-- API: COPY exchange.personas_staging FROM STDIN (binario)  ← miles de filas/seg
-- Flush periódico (cada X seg / N filas):
INSERT INTO exchange.personas
SELECT * FROM exchange.personas_staging
ON CONFLICT (plataforma_id, external_id) WHERE external_id IS NOT NULL DO NOTHING;
TRUNCATE exchange.personas_staging;
```

### 4.3 Idempotencia y dedup (clave: "no traer duplicados")
- Único por `(plataforma_id, external_id)` → reenvíos no duplican.
- `dedup_key` normalizado para dedup **entre plataformas distintas**.
- Todo `INSERT` con `ON CONFLICT DO NOTHING`.

### 4.4 Particionado
- `personas` por **HASH(id)** en 8 particiones → reparte la contención de escritura y permite `VACUUM`/índices en paralelo.
- `audit_log` por **RANGE(created_at)** mensual → borrar histórico = `DROP PARTITION` (instantáneo).

### 4.5 Afinado de `postgresql.conf` para ingesta (cluster `exchange`)
```conf
# Memoria (ajustar a la RAM real del server)
shared_buffers = 4GB                 # ~25% RAM
effective_cache_size = 12GB          # ~75% RAM
work_mem = 64MB
maintenance_work_mem = 1GB
# Escritura / WAL (ingesta intensa)
wal_compression = on
max_wal_size = 16GB
min_wal_size = 2GB
checkpoint_completion_target = 0.9
synchronous_commit = off             # +velocidad de ingesta (riesgo: perder <1s ante crash)
# Conexiones (bajo, PgBouncer hace el resto)
max_connections = 200
# Autovacuum agresivo (tablas que crecen rápido)
autovacuum_max_workers = 6
autovacuum_vacuum_scale_factor = 0.02
autovacuum_naptime = 10s
# Observabilidad
shared_preload_libraries = 'pg_stat_statements'
```

### 4.6 Lectura a escala
- **Réplica(s) de solo lectura** (streaming replication) para que las consultas masivas de las plataformas no compitan con la ingesta.
- Las plataformas que **solo leen** apuntan a la réplica (vía su PgBouncer).

---

## 5. Seguridad y acceso de plataformas autorizadas

### 5.1 Dos modelos de acceso

**Modelo A — API-first (recomendado para todas):**
- Las plataformas usan la **API REST** con **API key** (header `Authorization: Bearer <key>` o `X-Api-Key`).
- Ventajas: un solo punto, rate-limit, anti-spam, validación, auditoría, y **nunca expones Postgres** a internet.

**Modelo B — PostgreSQL directo (solo socios muy confiables, solo lectura):**
- Rol por plataforma, **TLS obligatorio**, **IP allowlist** en `pg_hba.conf`, y **RLS** para limitar filas.
```conf
# pg_hba.conf (cluster exchange) — solo TLS, por rol e IP
hostssl exchange  ro_reportavnzla   203.0.113.10/32   scram-sha-256
hostssl exchange  ro_socioX         198.51.100.20/32  scram-sha-256
```
```sql
CREATE ROLE ro_socioX LOGIN PASSWORD '***';
GRANT USAGE ON SCHEMA exchange TO ro_socioX;
GRANT SELECT ON ALL TABLES IN SCHEMA exchange TO ro_socioX;   -- solo lectura
-- Escritura SOLO por la API (rol de servicio), nunca para externos.
```

### 5.2 Row Level Security (aislamiento entre plataformas)
Como en el template venezuela-ayuda (`enable row level security` + escrituras bloqueadas a clientes), aquí:
- **Lectura:** todos los socios ven el dato común (es un hub de intercambio).
- **Escritura:** solo el **rol de servicio de la API**. Las plataformas no escriben directo a las tablas.
```sql
ALTER TABLE exchange.personas ENABLE ROW LEVEL SECURITY;
CREATE POLICY lectura_todos ON exchange.personas FOR SELECT USING (true);
-- Sin policy de INSERT/UPDATE para externos => solo el owner/servicio escribe.
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA exchange FROM PUBLIC;
```

### 5.3 Buenas prácticas
- API keys **hasheadas** (sha256) en BD; se muestran una sola vez al crearlas.
- **Rate-limit por key** (tabla `api_keys.rate_limit_min`).
- **Auditoría** de cada ingest/lectura (`audit_log`).
- **Backups**: `pg_dump` diario + **WAL archiving / PITR** (recuperación a un punto en el tiempo).
- **Aislado** del resto del servidor: cluster, puerto, rol y `pg_hba.conf` propios.

---

## 6. Documentación de la API de intercambio (basada en ReportaVNZLA)

La API de intercambio reutiliza el diseño ya probado en **ReportaVNZLA** (`/api/v1/*`): REST, JSON, **CORS**, **asíncrona**, **idempotente por `external_id`**, **bidireccional** (GET recibir / POST enviar), con **lotes** y **`?since=`** para sincronización incremental.

### 6.1 Autenticación
```
Authorization: Bearer <API_KEY>
# o
X-Api-Key: <API_KEY>
X-Api-Source: mi-plataforma.org      # identifica el origen (auditoría)
```

### 6.2 Endpoints (catálogo)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET`  | `/v1/personas?since=&page=&pageSize=&estado=&q=&bbox=` | Recibir personas (incremental, geo-filtrable) |
| `POST` | `/v1/personas` | Enviar persona(s): objeto o `{items:[…]}` (máx 500) |
| `GET`  | `/v1/edificios?since=&bbox=` | Recibir estructuras dañadas |
| `POST` | `/v1/edificios` | Enviar estructura(s) |
| `GET`  | `/v1/recursos?tipo=&since=` | Recibir centros de acopio / ofertas |
| `POST` | `/v1/recursos` | Enviar recurso(s) |
| `GET`  | `/v1/solicitudes?estado=&since=` | Recibir pedidos de ayuda |
| `POST` | `/v1/solicitudes` | Enviar pedido(s) |
| `GET`  | `/v1/feed?since=` | Feed unificado de novedades (para bots) |
| `POST` | `/v1/avistamientos` | Enviar avistamiento de una persona |
| `GET`  | `/v1/stats` | Conteos globales por tipo/estado |

**Convención de respuesta (paginada):**
```json
{ "success": true, "page": 1, "pageSize": 200, "total": 1234567,
  "count": 200, "data": [ … ], "nextPage": 2 }
```
**Respuesta de ingesta (POST lote):**
```json
{ "success": true, "recibidos": 500, "creados": 488, "duplicados": 12, "rechazados": 0 }
```

### 6.3 Modelo de datos `persona` (payload)
```jsonc
{
  "nombre": "María", "apellido": "González",
  "cedula": "V-12345678", "edad": 34, "genero": "F",
  "estado": "buscado",                 // buscado|encontrado|fallecido|a_salvo|necesita_ayuda
  "ubicacion_txt": "Catia La Mar",
  "lat": 10.60, "lng": -67.03,          // o "location": {"type":"Point","coordinates":[-67.03,10.60]}
  "foto_url": "https://…",
  "descripcion": "…",
  "external_id": "miorg-001",          // idempotencia
  "source": "mi-plataforma.org"
}
```

### 6.4 Ejemplos multi-lenguaje (enviar **y** recibir)

**cURL**
```bash
# Recibir personas nuevas desde una fecha (sync incremental)
curl -H "X-Api-Key: $KEY" \
  "https://intercambio.tu-dominio/v1/personas?since=1782000000000&pageSize=500"

# Enviar lote (idempotente: reenviar no duplica)
curl -X POST "https://intercambio.tu-dominio/v1/personas" \
  -H "X-Api-Key: $KEY" -H "Content-Type: application/json" \
  -H "X-Api-Source: mi-plataforma.org" \
  -d '{"items":[
        {"nombre":"Juan","apellido":"Pérez","estado":"buscado","external_id":"jp-1"},
        {"nombre":"Ana","apellido":"López","estado":"encontrado","external_id":"al-2"}
      ]}'
```

**JavaScript (Node / navegador)**
```js
const API = 'https://intercambio.tu-dominio/v1'
const H = { 'X-Api-Key': KEY, 'Content-Type': 'application/json', 'X-Api-Source': 'mi-plataforma.org' }

// Recibir (paginado incremental)
async function recibir(since) {
  let page = 1, all = []
  while (true) {
    const r = await fetch(`${API}/personas?since=${since}&page=${page}&pageSize=500`, { headers: H })
    const { data, nextPage } = await r.json()
    all.push(...data); if (!nextPage) break; page = nextPage
  }
  return all
}
// Enviar lote
await fetch(`${API}/personas`, { method: 'POST', headers: H,
  body: JSON.stringify({ items: misPersonas }) })
```

**Python**
```python
import requests, time
API='https://intercambio.tu-dominio/v1'; H={'X-Api-Key':KEY,'X-Api-Source':'mi-plataforma.org'}

# Recibir incremental
def recibir(since):
    page, out = 1, []
    while True:
        r = requests.get(f'{API}/personas', headers=H, params={'since':since,'page':page,'pageSize':500}).json()
        out += r['data']
        if not r.get('nextPage'): break
        page = r['nextPage']
    return out

# Enviar lote
requests.post(f'{API}/personas', headers=H, json={'items': mis_personas})
```

**PHP**
```php
$API='https://intercambio.tu-dominio/v1';
$ctx = stream_context_create(['http'=>['header'=>"X-Api-Key: $KEY"]]);
$data = json_decode(file_get_contents("$API/personas?since=$since&pageSize=500", false, $ctx), true);

$ch = curl_init("$API/personas");
curl_setopt_array($ch, [CURLOPT_POST=>true,
  CURLOPT_HTTPHEADER=>["Content-Type: application/json","X-Api-Key: $KEY","X-Api-Source: mi-plataforma.org"],
  CURLOPT_POSTFIELDS=>json_encode(['items'=>$misPersonas]), CURLOPT_RETURNTRANSFER=>true]);
$resp = json_decode(curl_exec($ch), true);
```

### 6.5 Patrón "enviar y recibir simultáneamente"
Un job en cada plataforma, cada N minutos:
1. `GET /v1/personas?since=<última_sync>` → **recibe** lo nuevo de las demás.
2. `POST /v1/personas {items}` → **envía** lo suyo desde la última vez.
3. Guarda el nuevo `since`. El `external_id`/`dedup_key` garantiza **cero duplicados** en ambos sentidos.

---

## 7. Plan de implementación (paso a paso, cuando autorices)

> Nada de esto se ejecuta todavía. Es la receta lista para aplicar cuando se autorice.

**Fase 0 — Verificación** (§1): specs del server + PostGIS disponible.

**Fase 1 — Cluster dedicado**
```bash
sudo pg_createcluster 17 exchange -p 5433 --start
sudo -u postgres psql -p 5433 -c "CREATE DATABASE exchange;"
```

**Fase 2 — Esquema** (§3): aplicar las migraciones SQL (extensiones, enums, tablas, particiones, índices, RLS).

**Fase 3 — PgBouncer** (§4.1): instalar y configurar pooling `transaction`.

**Fase 4 — Afinado** (§4.5): `postgresql.conf` del cluster `exchange`.

**Fase 5 — Roles y seguridad** (§5): rol de servicio (API, escritura), roles `ro_*` (lectura), `pg_hba.conf` con TLS + allowlist, RLS.

**Fase 6 — API Gateway**: desplegar el servicio de intercambio (reusar el patrón `/api/v1` de ReportaVNZLA) apuntando a PgBouncer→`exchange`.

**Fase 7 — Réplica de lectura** (si el volumen lo exige): streaming replication.

**Fase 8 — Backups/monitoreo**: `pg_dump` diario + WAL archiving (PITR) + `pg_stat_statements`.

**Fase 9 — Onboarding de plataformas**: alta en `exchange.plataformas`, emisión de API key, pruebas de envío/recepción, documentación entregada.

---

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Saturar el server (competencia de recursos con otros servicios) | Cluster/puerto aparte; límites de memoria; idealmente servidor dedicado a futuro |
| Miles de conexiones tumban Postgres | **PgBouncer** + `max_connections` bajo |
| Picos de ingesta | Staging `UNLOGGED` + `COPY` + flush por lotes + cola |
| Duplicados entre plataformas | `external_id` único + `dedup_key` + `ON CONFLICT DO NOTHING` |
| Spam/datos basura (ya lo vivimos: TRUSTEDF57) | Anti-spam en la API antes de insertar |
| Exposición de Postgres a internet | Modelo **API-first**; acceso directo solo read-only, TLS, IP allowlist |
| Pérdida de datos | Backups + WAL archiving (PITR); `synchronous_commit=off` solo si se acepta perder <1s |

---

## 9. Qué necesito de ti para continuar

1. **Confirmar la ventana** para aprovisionar (instalar PostGIS/PgBouncer + crear el cluster) sin afectar otros servicios.
2. Confirmar el **modelo de aislamiento** (recomiendo **B: cluster aparte en 5433**).
3. Confirmar el **modelo de acceso** (recomiendo **API-first** para todas; psql directo solo read-only para socios selectos).
4. Con las specs reales, **afino los números** (`shared_buffers`, particiones, pool) y preparo las **migraciones SQL definitivas** + el servicio de API.
```

> Referencias: template de esquema [`mawmawmaw/venezuela-ayuda`](https://github.com/mawmawmaw/venezuela-ayuda) (Supabase/PostGIS/RLS) · API de [ReportaVNZLA](https://reportavnzla.com/desarrolladores) (`/api/v1/*`, idempotente, bidireccional).
