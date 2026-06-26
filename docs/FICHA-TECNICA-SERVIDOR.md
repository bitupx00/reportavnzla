# Ficha Técnica del Servidor — Debian 13 (hub de intercambio de datos)

> Especificaciones reales del servidor donde vivirá la base de datos PostgreSQL de intercambio.
> Verificado en vivo el **2026-06-26**. Para entregar a desarrolladores que vayan a integrar.

---

## 1. Hardware

| Componente | Valor |
|------------|-------|
| Tipo | **Servidor físico (bare metal)** — no virtualizado |
| CPU | **Intel Core i3-10100F @ 3.60 GHz** — 4 núcleos / **8 hilos (vCPU)** |
| RAM | **31 GiB** (≈ 25 GiB disponibles en reposo) |
| Swap | **0 (sin swap)** ⚠️ recomendable añadir 8–16 GB como red de seguridad |
| Disco sistema | **SSD** `sda` 954 GB → `/` (55G, 20% uso) y `/var` (22G, 35% uso) |
| Disco datos | **SSD** `sda7` → `/srv` **861 GB, 530 GB libres** |
| Disco extra | **SSD** `sdb` 238 GB |
| **NVMe libre** | **SKHynix NVMe 238 GB — sin montar/usar** ✅ ideal para el cluster de intercambio o el WAL |
| Estado | Carga muy baja (load avg ~0.5), uptime 3 días |

**Lectura:** máquina holgada. Todos los discos son SSD/NVMe (óptimo para ingesta intensiva). Hay un **NVMe de 238 GB sin usar** perfecto para aislar la I/O del nuevo cluster.

---

## 2. Sistema Operativo

| | |
|---|---|
| SO | **Debian GNU/Linux 13 (trixie)** |
| Kernel | 6.12.90+deb13.1-amd64 |
| Acceso | SSH `servidor01@hbdesk.sytes.net` puerto **2222** (auth por contraseña; credenciales en `~/.ssh/huabodesk-credentials.env`) |

---

## 3. PostgreSQL (instancia existente)

| | |
|---|---|
| Versión | **PostgreSQL 17.10** (Debian 17.10-0+deb13u1) — última estable ✅ |
| Cluster | `main` · puerto **5432** · online |
| Data dir | `/var/lib/postgresql/17/main` |
| SSL/TLS | **Activado** (`ssl = on`) ✅ |
| listen_addresses | `*` (escucha en todas las interfaces) |
| max_connections | **100** |
| shared_buffers | 128 MB (valor por defecto, bajo) |
| effective_cache_size | 4 GB |
| work_mem | 4 MB |
| maintenance_work_mem | 64 MB |
| max_wal_size | 1 GB |

### Bases de datos actuales (NO tocar)
| Base | Tamaño |
|------|--------|
| postgres | 4.0 GB |
| huabodesk | 7.5 MB |
| huaboconta | 7.5 MB |
| vmail | 7.7 MB |

> La BD de intercambio será **independiente** de estas (cluster/puerto aparte).

### Extensiones
| Extensión | Estado |
|-----------|--------|
| `pg_stat_statements` | ✅ instalada |
| `pg_trgm` (búsqueda por similitud) | ✅ instalada |
| `pgcrypto` | ✅ disponible |
| `uuid-ossp` | ✅ disponible |
| **PostGIS** (geo) | ❌ **NO disponible — falta instalar** `postgresql-17-postgis-3` |

---

## 4. Red / Seguridad

| | |
|---|---|
| Firewall | **ufw activo** |
| Puertos abiertos al exterior | **22** (SSH backup), **2222** (SSH principal), **80** (HTTP), **443** (HTTPS) |
| PostgreSQL 5432 | Escucha en `0.0.0.0` **pero el firewall lo BLOQUEA al exterior** ✅ (solo accesible localmente) |
| PgBouncer | ❌ **NO instalado** |

**Implicación para desarrolladores:** hoy **no hay acceso directo a PostgreSQL desde internet** (correcto). El acceso externo será **vía API HTTPS (443)**. Si algún socio necesitara `psql` directo, habría que abrir un puerto dedicado con TLS + allowlist de IP.

---

## 5. Software en ejecución (coexistencia)

- App **HuaboDesk**: `node` (~1.4 GB) + `next-server` (~0.7 GB) corriendo.
- Entorno gráfico (plasmashell/kwin) presente — es un equipo con escritorio.
- Consumo total en reposo ~6 GB de 31 GB → **~25 GB libres** para el nuevo servicio.

---

## 6. Veredicto de viabilidad y dimensionamiento recomendado

✅ **Totalmente viable.** El servidor tiene de sobra para un hub de intercambio con ingesta masiva. Plan afinado a estas specs (31 GB RAM, 8 vCPU, SSD/NVMe):

1. **Cluster PostgreSQL 17 dedicado**, separado del contable:
   ```bash
   sudo pg_createcluster 17 exchange -p 5433 --start
   ```
   Idealmente con su **data dir en el NVMe libre** (`/mnt/nvme/exchange`) para aislar I/O.

2. **Instalar lo que falta:**
   ```bash
   sudo apt install postgresql-17-postgis-3 pgbouncer
   ```

3. **`postgresql.conf` del cluster `exchange`** (afinado a 31 GB, **dejando RAM al cluster contable y a la app**):
   | Parámetro | Valor |
   |-----------|-------|
   | shared_buffers | **8 GB** |
   | effective_cache_size | **18 GB** |
   | work_mem | 64 MB |
   | maintenance_work_mem | 2 GB |
   | max_wal_size | 16 GB |
   | wal_compression | on |
   | synchronous_commit | off (ingesta veloz; riesgo < 1 s ante crash) |
   | max_connections | 200 (con PgBouncer delante) |
   | autovacuum | agresivo (scale_factor 0.02, 6 workers) |

4. **PgBouncer** en modo `transaction` (10 000 clientes → ~40 conexiones reales).

5. **Añadir swap** (8–16 GB) — hoy hay 0; útil como colchón ante picos.

6. **Acceso de plataformas:** API-first por **HTTPS (443)**. Postgres directo solo read-only, con TLS + allowlist, si se autoriza.

### Comparativa rápida
| Recurso | Disponible | Necesario (arranque) | Margen |
|---------|------------|----------------------|--------|
| vCPU | 8 | 2–4 | ✅ |
| RAM | ~25 GB libres | 8–12 GB | ✅ |
| Disco | 530 GB (/srv) + 238 GB NVMe | decenas de GB iniciales | ✅✅ |
| PG | 17.10 | ≥ 14 | ✅ |
| PostGIS | ❌ falta | requerido (geo) | instalar |
| PgBouncer | ❌ falta | requerido (escala) | instalar |

---

## 7. Datos de conexión que un desarrollador necesitará (cuando se aprovisione)

```
# Acceso vía API (modelo recomendado)
Base URL:        https://<dominio-intercambio>/v1
Auth:            X-Api-Key: <key>   (o Authorization: Bearer <key>)
Formato:         JSON · CORS abierto · idempotente por external_id

# Acceso directo PostgreSQL (solo socios autorizados, read-only)
Host:            hbdesk.sytes.net
Puerto:          5433   (cluster exchange; requiere abrir en ufw + TLS + allowlist)
Base de datos:   exchange
SSL:             require (obligatorio)
Rol:             ro_<plataforma> (solo SELECT)
Connection URI:  postgresql://ro_xxx:<pass>@hbdesk.sytes.net:5433/exchange?sslmode=require
```

> Pendiente para activar: instalar PostGIS + PgBouncer, crear cluster `exchange`, aplicar el esquema (ver `INTERCAMBIO-API-POSTGRESQL.md`), abrir puerto/allowlist si se da acceso directo.
