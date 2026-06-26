# Ficha Técnica del Servidor de Base de Datos (intercambio de datos)

> Aspecto técnico del servidor que **aloja la base de datos PostgreSQL** del hub de intercambio.
> El servidor se usa **únicamente como base de datos** (no como hosting de aplicaciones).
> Información para que los desarrolladores la tengan en cuenta al integrar. Verificado el 2026-06-26.
>
> ✅ **Estado: APROVISIONADO (2026-06-26).** Cluster PostgreSQL 17 dedicado `exchange` operativo (aislado del resto), con PostGIS, PgBouncer, esquema completo, RLS y roles (lectura/escritura). Acceso actualmente **solo local** (sin exposición a internet); el acceso de plataformas se habilita por API o canal controlado. Credenciales por canal privado.
>
> ⚠️ Este documento **no incluye** datos de acceso (host, usuario, contraseñas, puertos de administración). Esos se entregan por canal privado a las plataformas autorizadas.

---

## 1. Capacidad de cómputo

| Componente | Valor |
|------------|-------|
| Tipo | Servidor físico (bare metal), no virtualizado |
| CPU | Intel Core i3-10100F @ 3.60 GHz — 4 núcleos / **8 hilos (vCPU)** |
| RAM | **31 GiB** (~25 GiB disponibles para el servicio de base de datos) |
| Almacenamiento | **Todo SSD/NVMe** |
| • Volumen de datos | SSD ~861 GB con **~530 GB libres** |
| • NVMe dedicable | **NVMe 238 GB libre** → reservable para el cluster de intercambio (aísla la I/O) |
| Estado | Carga baja, amplio margen libre |

**Conclusión:** capacidad sobrada para ingesta intensiva. Discos SSD/NVMe (óptimo para escrituras concurrentes) y un NVMe libre para dedicar al cluster de intercambio.

---

## 2. Sistema operativo

| | |
|---|---|
| SO | Debian GNU/Linux 13 (trixie) |
| Kernel | 6.12 (amd64) |

---

## 3. Motor de base de datos

| | |
|---|---|
| Motor | **PostgreSQL 17.10** (última estable) |
| Cifrado | **TLS/SSL activado** ✅ |
| Capacidad geoespacial | PostGIS **a instalar** (`postgresql-17-postgis-3`) — requerido para ubicaciones/búsqueda por cercanía |
| Pooling de conexiones | PgBouncer **a instalar** — requerido para alta concurrencia |
| Extensiones ya disponibles | `pg_trgm` (similitud de texto), `pgcrypto`, `uuid-ossp`, `pg_stat_statements` |

> El cluster de intercambio se creará **aislado** (cluster/puerto propio, datos en NVMe dedicado), **independiente de cualquier otro servicio** del servidor: memoria, WAL, configuración y seguridad separados.

---

## 4. Acceso y conectividad (para desarrolladores)

| Modelo | Detalle |
|--------|---------|
| **API REST (recomendado)** | Acceso por **HTTPS**. Autenticación con **API key** (`X-Api-Key` / `Authorization: Bearer`). JSON, CORS, idempotente por `external_id`, asíncrono y bidireccional (enviar/recibir). |
| **PostgreSQL directo** | Solo para socios autorizados y **solo lectura**. Requiere **TLS obligatorio** + lista blanca de IP. Las credenciales y el endpoint se entregan por canal privado. |

> El puerto de PostgreSQL **no está expuesto a internet**; el acceso directo se habilita de forma controlada solo cuando se autoriza a una plataforma.

---

## 5. Dimensionamiento recomendado para el cluster de intercambio

Afinado a las specs reales (31 GB RAM, 8 vCPU, SSD/NVMe):

| Parámetro PostgreSQL | Valor recomendado |
|----------------------|-------------------|
| shared_buffers | 8 GB |
| effective_cache_size | 18 GB |
| work_mem | 64 MB |
| maintenance_work_mem | 2 GB |
| max_wal_size | 16 GB |
| wal_compression | on |
| synchronous_commit | off (ingesta veloz; riesgo < 1 s ante crash) |
| max_connections | 200 (con PgBouncer delante) |
| autovacuum | agresivo (scale_factor 0.02, 6 workers) |

**Complementos:** PgBouncer en modo `transaction` (miles de clientes → ~40 conexiones reales) y añadir swap (8–16 GB) como colchón.

### Margen disponible vs. necesario
| Recurso | Disponible | Necesario (arranque) | Margen |
|---------|------------|----------------------|--------|
| vCPU | 8 | 2–4 | ✅ |
| RAM | ~25 GB libres | 8–12 GB | ✅ |
| Disco | 530 GB SSD + 238 GB NVMe | decenas de GB iniciales | ✅✅ |
| PostgreSQL | 17.10 | ≥ 14 | ✅ |
| PostGIS | a instalar | requerido | pendiente |
| PgBouncer | a instalar | requerido | pendiente |

---

## 6. Resumen ejecutivo

✅ **El servidor es idóneo** como hub de base de datos para intercambio de datos a escala: PostgreSQL 17 sobre hardware SSD/NVMe con CPU y RAM holgadas, TLS activo y espacio amplio. Lo único pendiente a nivel de software es **instalar PostGIS y PgBouncer** y **crear el cluster dedicado** de intercambio. El detalle de esquema, escala y API está en `INTERCAMBIO-API-POSTGRESQL.md`.
