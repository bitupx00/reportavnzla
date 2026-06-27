# ReportaVNZLA — API Reference

> **Base URL:** `https://reportavnzla.com`
> **Versión:** v1 (API v1 con prefijo `/api/v1/`)
> **Stack:** Next.js 14 (App Router) + Drizzle ORM + Neon PostgreSQL
> **CORS:** Habilitado en todos los endpoints (`Access-Control-Allow-Origin: *`)

---

## Tabla de Contenidos

1. [Autenticación y Rate Limiting](#autenticación-y-rate-limiting)
2. [Esquema de Base de Datos](#esquema-de-base-de-datos)
3. [API v1 — Personas](#api-v1--personas)
4. [API v1 — Estadísticas](#api-v1--estadísticas)
5. [API v1 — Deduplicación](#api-v1--deduplicación)
6. [API v1 — Sincronización](#api-v1--sincronización)
7. [API v1 — Edificios Dañados](#api-v1--edificios-dañados)
8. [API v1 — Recursos / Centros de Acopio](#api-v1--recursos--centros-de-acopio)
9. [API v1 — Notificaciones y Suscripciones](#api-v1--notificaciones-y-suscripciones)
10. [API v1 — Feed y Telegram](#api-v1--feed-y-telegram)
11. [API Legacy (sin prefijo v1)](#api-legacy-sin-prefijo-v1)
12. [API Admin](#api-admin)
13. [API Cron (Vercel Cron Jobs)](#api-cron-vercel-cron-jobs)
14. [Script de Sincronización Unificado](#script-de-sincronización-unificado)
15. [Códigos de Error](#códigos-de-error)

---

## Autenticación y Rate Limiting

### Rate Limit Público

La mayoría de endpoints de escritura (POST) están protegidos por **rate limiting por IP**:

| Parámetro | Valor |
|-----------|-------|
| **Límite** | 40 solicitudes por ventana |
| **Ventana** | 10 minutos |
| **Response** | `429 Too Many Requests` |

### Bypass de Rate Limit (Sync Interno)

Los scripts de sincronización interna usan un header secreto para bypass del rate limit:

```
x-sync-secret: DEDUP_VNZLA_2026
```

> ⚠️ **Importante:** Este header permite saltar el rate limit. Nunca exponer públicamente.

### Anti-Spam

Todos los endpoints de escritura pasan por `motivoRechazo()` que bloquea:
- URLs/enlaces en campos de texto (nombre, descripción)
- Fuentes bloqueadas (configurable via `/api/admin/block-source`)
- Contenido que coincida con patrones de spam

---

## Esquema de Base de Datos

### Tabla: `personas`

Registro principal de personas reportadas como desaparecidas.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | `uuid` | PK, auto-generado | Identificador único |
| `nombre` | `varchar(100)` | NOT NULL | Nombre(s) |
| `apellido` | `varchar(100)` | NOT NULL | Apellido(s) |
| `cedula` | `varchar(20)` | nullable | Cédula de identidad |
| `edad` | `integer` | nullable | Edad |
| `genero` | `varchar(20)` | nullable | Género |
| `ultima_ubicacion` | `text` | nullable | Última ubicación conocida |
| `descripcion` | `text` | nullable | Descripción física / notas |
| `foto_url` | `text` | nullable | URL de fotografía |
| `estado` | `enum` | NOT NULL, default `buscado` | `buscado` \| `encontrado` \| `fallecido` |
| `lat` | `real` | nullable | Latitud |
| `lng` | `real` | nullable | Longitud |
| `fecha_encontrado` | `timestamp(tz)` | nullable | Fecha en que fue encontrado |
| `notas` | `text` | nullable | Notas internas |
| `reportado_por_nombre` | `varchar(150)` | nullable | Nombre de quien reportó |
| `reportado_por_telefono` | `varchar(30)` | nullable | Teléfono de quien reportó |
| `reportado_por_email` | `varchar(150)` | nullable | Email de quien reportó |
| `fuente_id` | `uuid` | FK → `fuentes_datos.id` | Fuente de datos |
| `external_id` | `varchar(100)` | nullable, indexado | ID en la fuente original (ej: `vtb-abc123`) |
| `created_at` | `timestamp(tz)` | NOT NULL, default `now()` | Fecha de creación |
| `updated_at` | `timestamp(tz)` | NOT NULL, default `now()` | Fecha de última actualización |

**Índices:** `personas_nombre_idx`, `personas_cedula_idx`, `personas_estado_idx`

### Tabla: `edificios`

Registro de edificios dañados por el terremoto.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `uuid` PK | Identificador único |
| `external_id` | `varchar(200)` | ID en la fuente original |
| `nombre` | `varchar(300)` NOT NULL | Nombre del edificio |
| `direccion` | `text` | Dirección |
| `ciudad` | `varchar(100)` | Ciudad (indexado) |
| `zona` | `varchar(200)` | Zona/barrio |
| `lat` / `lng` | `real` | Coordenadas |
| `nivel_danio` | `varchar(20)` | `total` \| `severo` \| `parcial` (indexado) |
| `estado` | `varchar(50)` | Estado/provincia |
| `foto_url` | `text` | URL de foto |
| `fuente` | `varchar(100)` | Fuente de datos |
| `nombres_atrapados` | `text` | Nombres de personas atrapadas |
| `tiene_desaparecidos` | `boolean` | Si hay desaparecidos reportados |

### Tabla: `avisos`

Testimonios/avisos sobre una persona específica.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `uuid` PK | Identificador |
| `persona_id` | `uuid` FK → `personas.id` CASCADE | Persona relacionada |
| `nombre_aviso` | `varchar(150)` NOT NULL | Nombre de quien avisa |
| `telefono_aviso` | `varchar(30)` | Teléfono |
| `mensaje` | `text` NOT NULL | Contenido del aviso |

### Tabla: `medios`

Fotos y videos adjuntos a una persona.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `uuid` PK | Identificador |
| `persona_id` | `uuid` FK → `personas.id` CASCADE | Persona relacionada |
| `tipo` | `enum` | `foto` \| `video` |
| `url` | `text` NOT NULL | URL del medio |
| `thumbnail_url` | `text` | URL del thumbnail |
| `descripcion` | `text` | Descripción |

### Tabla: `sync_log`

Registro de sincronizaciones de fuentes externas.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `uuid` PK | Identificador |
| `source` | `varchar(50)` NOT NULL | Fuente (DTV, VTB, TVE, SOS) |
| `status` | `varchar(20)` NOT NULL | Estado del sync |
| `total_fetched` | `integer` | Total registros procesados |
| `new_inserted` | `integer` | Nuevos insertados |
| `status_changed` | `integer` | Cambios de estado |
| `errors` | `integer` | Errores |
| `duration_ms` | `integer` | Duración en ms |

### Tabla: `fuentes_datos`

Catálogo de fuentes de datos externas.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `uuid` PK | Identificador |
| `nombre` | `varchar(150)` NOT NULL | Nombre de la fuente |
| `url` | `text` | URL de la fuente |
| `tipo` | `enum` | `supabase` \| `scraping` \| `manual` \| `ia` \| `api` |
| `activa` | `boolean` | Si está activa |
| `last_sync` | `timestamp(tz)` | Última sincronización |

---

## API v1 — Personas

### `GET /api/v1/personas`

Listar personas con filtros avanzados y paginación.

**Cache:** `s-maxage=60, stale-while-revalidate=300`

#### Query Parameters

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `q` | `string` | `""` | Búsqueda libre en nombre, apellido, cédula, ubicación, descripción. Multi-palabra: AND entre palabras |
| `estado` | `string` | `""` | Filtrar por estado: `buscado`, `encontrado`, `fallecido` |
| `cedula` | `string` | `""` | Filtrar por cédula (búsqueda parcial, LIKE) |
| `nombre` | `string` | `""` | Filtrar por nombre (LIKE) |
| `apellido` | `string` | `""` | Filtrar por apellido (LIKE) |
| `edad_min` | `integer` | — | Edad mínima |
| `edad_max` | `integer` | — | Edad máxima |
| `genero` | `string` | `""` | Filtrar por género |
| `ubicacion` | `string` | `""` | Filtrar por ubicación (LIKE) |
| `external_id` | `string` | `""` | Buscar por ID externo exacto |
| `page` | `integer` | `0` | Número de página (0-indexed) |
| `limit` | `integer` | `50` | Registros por página (máx: 200) |
| `sort` | `string` | `created_at` | Columna de ordenamiento: `created_at`, `updated_at`, `nombre`, `apellido`, `edad`, `estado` |
| `order` | `string` | `desc` | Dirección: `asc` o `desc` |

#### Response 200

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "nombre": "María",
      "apellido": "González",
      "cedula": "V-12345678",
      "edad": 30,
      "genero": "F",
      "estado": "buscado",
      "ultimaUbicacion": "Caracas",
      "descripcion": null,
      "fotoUrl": "https://...",
      "lat": 10.4806,
      "lng": -66.9036,
      "externalId": "dtv-12345",
      "reportadoPorNombre": "Juan Pérez",
      "createdAt": "2026-06-15T10:30:00Z",
      "updatedAt": "2026-06-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 50678,
    "page": 0,
    "limit": 50,
    "totalPages": 1014,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

#### Ejemplos

```bash
# Buscar personas llamadas "María González"
curl "https://reportavnzla.com/api/v1/personas?q=María%20González"

# Personas encontradas, página 2
curl "https://reportavnzla.com/api/v1/personas?estado=encontrado&page=1&limit=20"

# Por rango de edad
curl "https://reportavnzla.com/api/v1/personas?edad_min=18&edad_max=65&estado=buscado"
```

---

### `POST /api/v1/personas`

Crear una o múltiples personas. Soporta **insert individual** y **batch** (array, máx 100).

**Rate Limit:** 40 req/10min por IP (bypass con `x-sync-secret`)

#### Headers

| Header | Requerido | Descripción |
|--------|-----------|-------------|
| `Content-Type` | Sí | `application/json` |
| `x-sync-secret` | No | Bypass rate limit para sync interno |
| `x-source` | No | Identifica la fuente del import |

#### Body (individual)

```json
{
  "nombre": "María",
  "apellido": "González",
  "cedula": "V-12345678",
  "edad": 30,
  "genero": "F",
  "estado": "buscado",
  "ultima_ubicacion": "Caracas, Dtto. Capital",
  "descripcion": "Última vez vista en...",
  "foto_url": "https://ejemplo.com/foto.jpg",
  "lat": 10.4806,
  "lng": -66.9036,
  "reportado_por_nombre": "Juan Pérez",
  "reportado_por_telefono": "0414-1234567"
}
```

#### Body (batch — array)

```json
[
  { "nombre": "Persona 1", "apellido": "González" },
  { "nombre": "Persona 2", "apellido": "Rodríguez", "estado": "encontrado" }
]
```

> **Campos especiales en batch:** `foto_url` o `fotoUrl`, `external_id` o `externalId`, `reportado_por_nombre` o `reportadoPorNombre` — ambos formatos aceptados.

#### Comportamiento Upsert

Si un registro tiene `external_id` y ya existe en la DB:
1. **Estado diferente** → actualiza `estado` en el registro existente (ej: `buscado` → `encontrado`)
2. **Estado igual** → skip (no modifica)
3. **Sin external_id** → insert como nuevo

#### Response 201 (individual)

```json
{
  "success": true,
  "data": { "id": "uuid", "nombre": "María", ... }
}
```

#### Response 201 (batch)

```json
{
  "success": true,
  "inserted": 45,
  "updated": 12,
  "skipped": 43,
  "total": 100
}
```

#### Errores

| Status | Descripción |
|--------|-------------|
| `400` | Datos inválidos, spam detectado |
| `429` | Rate limit excedido |
| `201` | Creado exitosamente |

---

### `PATCH /api/v1/personas`

Actualizar campos de una persona existente.

#### Body

```json
{
  "id": "uuid-requerido",
  "estado": "encontrado",
  "notas": "Encontrado en hospital XXX",
  "fecha_encontrado": "2026-06-20T14:30:00Z",
  "nombre": "Nuevo nombre",
  "ultima_ubicacion": "Nueva ubicación",
  "lat": 10.5,
  "lng": -66.9
}
```

> Si `estado` cambia a `encontrado` y no se proporciona `fecha_encontrado`, se establece automáticamente a `now()`.

#### Response 200

```json
{ "success": true, "data": { ...registro actualizado... } }
```

#### Response 404

```json
{ "success": false, "error": "Registro no encontrado" }
```

---

### `GET /api/v1/personas/:id`

Obtener detalle de una persona por UUID.

#### Response 200

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "nombre": "María",
    "apellido": "González",
    "cedula": "V-12345678",
    "edad": 30,
    "genero": "F",
    "estado": "buscado",
    "ultimaUbicacion": "Caracas",
    "descripcion": "...",
    "fotoUrl": "https://...",
    "lat": 10.4806,
    "lng": -66.9036,
    "fechaEncontrado": null,
    "notas": null,
    "reportadoPorNombre": "Juan Pérez",
    "reportadoPorTelefono": "0414-1234567",
    "reportadoPorEmail": null,
    "externalId": "dtv-12345",
    "fuenteId": null,
    "createdAt": "2026-06-15T10:30:00Z",
    "updatedAt": "2026-06-15T10:30:00Z"
  }
}
```

#### Response 404

```json
{ "success": false, "error": "Persona no encontrada" }
```

---

## API v1 — Estadísticas

### `GET /api/v1/stats`

Estadísticas generales del sistema.

#### Response 200

```json
{
  "success": true,
  "total": 50678,
  "buscados": 45016,
  "encontrados": 5662,
  "fallecidos": 0
}
```

---

### `GET /api/v1/stats-fuentes`

Estadísticas desglosadas por fuente y estado. Usado por el dashboard y el cron job.

#### Response 200

```json
{
  "success": true,
  "total": 50678,
  "byEstado": [
    { "estado": "buscado", "cnt": 45016 },
    { "estado": "encontrado", "cnt": 5662 },
    { "estado": "fallecido", "cnt": 0 }
  ],
  "bySource": [
    { "fuente": "dtv", "estado": "buscado", "cnt": 27840 },
    { "fuente": "dtv", "estado": "encontrado", "cnt": 4252 },
    { "fuente": "vtb", "estado": "buscado", "cnt": 12532 },
    { "fuente": "vtb", "estado": "encontrado", "cnt": 1140 },
    { "fuente": "tve", "estado": "buscado", "cnt": 4012 },
    { "fuente": "tve", "estado": "encontrado", "cnt": 266 },
    { "fuente": "sos", "estado": "buscado", "cnt": 628 },
    { "fuente": "sos", "estado": "encontrado", "cnt": 4 }
  ]
}
```

---

## API v1 — Deduplicación

### `GET /api/v1/dedup?mode=ultimate`

**Dry-run** del dedup ultimate. Analiza duplicados por nombre normalizado (full name: palabras ordenadas alfabéticamente). **No elimina nada**.

#### Query Parameters

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `mode` | `string` | `ultimate` — nombre completo normalizado |

#### Response 200

```json
{
  "success": true,
  "mode": "ultimate",
  "duplicate_groups": 22759,
  "duplicates_would_remove": 32505,
  "total_records": 50678
}
```

---

### `POST /api/v1/dedup`

Ejecutar dedup de forma legacy (DELETE con CTE SQL).

#### Body

```json
{ "secret": "DEDUP_VNZLA_2026" }
```

> ⚠️ Requiere el secret correcto.

---

### `GET /api/v1/dedup2?mode=ultimate`

Dry-run del dedup v2 (misma lógica, ruta diferente para bypass de cache de Vercel).

---

### `POST /api/v1/dedup2`

Ejecutar dedup v2. Mismo comportamiento que dedup pero en ruta fresca.

#### Body

```json
{ "secret": "DEDUP_VNZLA_2026" }
```

#### Response 200

```json
{
  "success": true,
  "deleted_count": 13426,
  "total_after": 48548
}
```

---

### `GET /api/v1/dedup3?mode=ultimate`

Dry-run del dedup v3. Usa **batch DELETE** en vez de CTE para compatibilidad con Neon PostgreSQL.

Lógica de dedup:
1. Normaliza el nombre completo: concatenar `nombre + apellido`, dividir en palabras, ordenar alfabéticamente, unir con espacio
2. Agrupa por nombre normalizado
3. De cada grupo, **mantiene** el registro con:
   - Estado `encontrado` (prioridad 1)
   - Foto (prioridad 2)
   - Más reciente (prioridad 3)
4. Elimina los duplicados en batches de 500

---

### `POST /api/v1/dedup3`

Ejecutar dedup v3 con batch DELETE.

#### Body

```json
{ "secret": "DEDUP_VNZLA_2026" }
```

#### Response 200

```json
{
  "success": true,
  "mode": "ultimate",
  "groups_found": 100,
  "deleted": 150,
  "kept": 100,
  "total_records": 50528
}
```

---

## API v1 — Sincronización

### `POST /api/v1/sync/pull`

Pull masivo desde fuentes externas. Soporta 4 fuentes: DTV, VTB, TVE, SOS.

#### Body

```json
{
  "sources": ["dtv", "vtb"],
  "secret": "DEDUP_VNZLA_2026"
}
```

#### Comportamiento

1. Para cada fuente, hace paginación completa de la API externa
2. Normaliza datos (split nombre/apellido, mapeo de estados)
3. Inserta via `POST /api/v1/personas` con `x-sync-secret`
4. Ejecuta dedup post-sync
5. Registra resultados en `sync_log`

#### Mapeo de Estados por Fuente

| Fuente | Estado Externo → Estado Interno |
|---------|-------------------------------|
| DTV | `localizado` → `encontrado`, otros → `buscado` |
| VTB | `found` → `encontrado`, `missing` → `buscado` |
| TVE | `found` → `encontrado`, otros → `buscado` |
| SOS | `found`, `found_alive`, `encontrado`, `localizado`, `rescatado` → `encontrado` |

#### Response 200

```json
{
  "success": true,
  "results": {
    "dtv": { "fetched": 54000, "inserted": 42000, "updated": 500, "errors": 0 },
    "vtb": { "fetched": 19000, "inserted": 18500, "updated": 0, "errors": 0 }
  }
}
```

---

### `GET /api/v1/sync`

Obtener historial de sincronizaciones.

#### Response 200

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "source": "DTV",
      "status": "completed",
      "totalFetched": 54000,
      "newInserted": 42000,
      "statusChanged": 500,
      "errors": 0,
      "durationMs": 95000,
      "startedAt": "2026-06-25T20:00:00Z",
      "completedAt": "2026-06-25T20:01:35Z"
    }
  ]
}
```

---

## API v1 — Edificios Dañados

### `GET /api/v1/edificios`

Listar edificios dañados. Soporta filtros y modo ligero para mapa.

#### Query Parameters

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `mapa` | `integer` | `0` | Si `1`, retorna solo campos necesarios para el mapa (id, nombre, lat, lng, nivelDanio, direccion, nombresAtrapados, tieneDesaparecidos) |
| `ciudad` | `string` | — | Filtrar por ciudad |
| `nivel` | `string` | — | Filtrar por nivel de daño: `total`, `severo`, `parcial` |
| `estado` | `string` | — | Filtrar por estado/provincia |
| `desaparecidos` | `boolean` | — | Si `true`, solo edificios con desaparecidos |
| `limit` | `integer` | `100` | Máximo de resultados |

#### Response 200

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "nombre": "Torre Promotora Paraíso",
      "direccion": "Av. Bolívar, Cagua",
      "ciudad": "Cagua",
      "zona": "Centro",
      "lat": 10.1892,
      "lng": -67.4731,
      "nivelDanio": "severo",
      "estado": "Aragua",
      "fuente": "terremotovenezuela.com",
      "nombresAtrapados": "Juan Pérez, María González",
      "tieneDesaparecidos": true
    }
  ],
  "total": 596
}
```

---

### `POST /api/v1/edificios`

Agregar un edificio dañado.

#### Body

```json
{
  "nombre": "Edificio XYZ",
  "direccion": "Av. Principal",
  "ciudad": "Caracas",
  "zona": "Centro",
  "lat": 10.4806,
  "lng": -66.9036,
  "nivel_danio": "severo",
  "estado": "Distrito Capital",
  "fuente": "manual",
  "nombres_atrapados": "Juan Pérez",
  "tiene_desaparecidos": true
}
```

---

## API v1 — Notificaciones y Suscripciones

### `POST /api/v1/subscriptions`

Registrar una suscripción de notificaciones (Telegram bot o webhook).

#### Body (Telegram)

```json
{
  "canal": "telegram",
  "telegramBotToken": "123456:ABC-DEF...",
  "telegramChatId": "-1001234567890",
  "q": "González",
  "estado": "buscado"
}
```

#### Body (Webhook)

```json
{
  "canal": "webhook",
  "webhookUrl": "https://tu-servidor.com/webhook",
  "q": "María",
  "estado": "buscado"
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `canal` | `string` | Sí | `telegram` o `webhook` |
| `telegramBotToken` | `string` | Si canal=telegram | Token del bot de Telegram |
| `telegramChatId` | `string` | Si canal=telegram | Chat ID del bot |
| `webhookUrl` | `string` | Si canal=webhook | URL HTTPS del webhook |
| `q` | `string` | No | Filtro de búsqueda (nombre/apellido, máx 120 chars) |
| `estado` | `string` | No | Filtro de estado: `buscado`, `encontrado`, `fallecido` |

#### Response 201

```json
{
  "success": true,
  "id": "uuid",
  "token": "uuid-token-gestion",
  "mensaje": "Guarda el token para gestionar o eliminar la suscripción."
}
```

> ⚠️ **Importante:** Guarda el `token` retornado — es necesario para consultar o eliminar la suscripción.

---

### `GET /api/v1/subscriptions?id=UUID&token=UUID`

Consultar estado de una suscripción.

#### Query Parameters

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | `string` | ID de la suscripción |
| `token` | `string` | Token de gestión retornado al crear |

#### Response 200

```json
{
  "success": true,
  "suscripcion": {
    "id": "uuid",
    "canal": "telegram",
    "telegramChatId": "-1001234567890",
    "q": "González",
    "estado": "buscado",
    "activo": true,
    "createdAt": "2026-06-20T..."
  }
}
```

---

### `DELETE /api/v1/subscriptions?id=UUID&token=UUID`

Desactivar una suscripción.

#### Response 200

```json
{ "success": true, "mensaje": "Suscripción desactivada" }
```

---

### `GET /api/v1/notify`

Enviar notificaciones pendientes a todos los suscriptores activos. **Protegido.**

#### Autenticación

Requiere **uno** de:
- Header: `Authorization: Bearer ${CRON_SECRET}`
- Query param: `?secret=${NOTIFY_SECRET}`

#### Comportamiento

Para cada suscripción activa:
1. Consulta personas nuevas/modificadas desde `ultimo_check`
2. Aplica filtros configurados (q, estado)
3. Envía notificación:
   - **Telegram:** mensaje individual por persona con emoji de estado, nombre, ubicación y enlace
   - **Webhook:** POST con payload `{ suscripcionId, personas: [{ ...persona, url }] }`
4. Actualiza `ultimo_check` a `now()`

#### Response 200

```json
{
  "success": true,
  "suscripciones": 3,
  "notificacionesEnviadas": 25
}
```

---

### `POST /api/v1/telegram`

Enviar un mensaje de prueba con un bot de Telegram.

#### Body

```json
{
  "botToken": "123456:ABC-DEF...",
  "chatId": "-1001234567890",
  "message": "✅ ReportaVNZLA conectado"
}
```

#### Response 200

```json
{ "success": true, "mensaje": "Mensaje enviado a Telegram" }
```

#### Errores

| Status | Descripción |
|--------|-------------|
| `400` | `botToken` y `chatId` requeridos, o Telegram rechazó el envío |

---

## API v1 — Feed

### `GET /api/v1/feed`

Feed para bots e integraciones (Telegram, Discord, etc.). Diseñado para **polling** eficiente.

#### Query Parameters

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `since` | `ISO 8601` | — | Solo personas creadas/actualizadas después de esta fecha |
| `q` | `string` | `""` | Búsqueda por nombre/apellido/cédula |
| `estado` | `string` | `""` | Filtrar por estado |
| `limit` | `integer` | `50` | Máx 100 |

#### Response 200

```json
{
  "success": true,
  "serverTime": "2026-06-26T12:00:00Z",
  "count": 15,
  "data": [
    {
      "id": "uuid",
      "nombre": "María",
      "apellido": "González",
      "cedula": "V-12345678",
      "edad": 30,
      "estado": "encontrado",
      "ultimaUbicacion": "Caracas",
      "descripcion": "...",
      "fotoUrl": "https://...",
      "lat": 10.4806,
      "lng": -66.9036,
      "createdAt": "2026-06-25T...",
      "updatedAt": "2026-06-25T...",
      "url": "https://reportavnzla.com/persona/uuid"
    }
  ]
}
```

> **Patrón de polling:** Usa `since=2026-06-26T12:00:00Z` con el `serverTime` de la respuesta anterior como próxima llamada.

---

## API v1 — Recursos / Centros de Acopio

### `GET /api/v1/recursos`

Listar recursos y centros de acopio.

#### Response 200

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "nombre": "Club Italo de Valencia",
      "tipo": "centro_acopio",
      "ubicacion": "Valencia, Carabobo",
      "lat": 10.1712,
      "lng": -67.9375,
      "contacto": "0414-5551234",
      "descripcion": "Recibe: alimentos no perecederos...",
      "estado": "active"
    }
  ]
}
```

---

## API Legacy (sin prefijo v1)

> ⚠️ Estos endpoints están mantenidos para compatibilidad hacia atrás. **Para desarrollo nuevo, usa `/api/v1/`.**

### `GET /api/personas`

Versión legacy de `/api/v1/personas`. Mismos parámetros y respuesta. Endpoint original del MVP.

### `GET /api/personas/:id`

Detalle de persona (legacy). Equivalente a `/api/v1/personas/:id`.

### `GET /api/personas/mapa`

Personas con coordenadas para el mapa interactivo. Retorna solo registros con `lat` y `lng` no nulos.

### `POST /api/personas`

Reportar persona desaparecida (legacy). Versión simplificada sin upsert, sin anti-spam, sin rate limit bypass.

### `GET /api/buscar`

Búsqueda unificada de personas por texto libre. Wrapper sobre `/api/personas?q=...`.

### `GET /api/edificios`

Edificios dañados (legacy). Equivalente a `/api/v1/edificios`.

### `POST /api/edificios`

Agregar edificio (legacy).

### `GET /api/recursos`

Recursos/centros de acopio (legacy).

### `GET /api/social-posts`

Posts de redes sociales relacionados con el terremoto. Scraper de Twitter/X, Instagram.

### `GET /api/por-identificar`

Personas sin identificar o con información incompleta. Registros donde falta nombre, apellido, o ubicación.

### `GET /api/medios?persona_id=UUID`

Listar fotos/videos de una persona específica.

### `GET /api/avisos?persona_id=UUID`

Listar testimonios/avisos sobre una persona.

### `POST /api/avisos`

Agregar un aviso/testimonio sobre una persona.

### `GET /api/stats`

Estadísticas generales (legacy). Equivalente a `/api/v1/stats`.

---

## API Admin

> ⚠️ Todos los endpoints `/api/admin/*` requieren autenticación. Verificar `CRON_SECRET` o configuración de Vercel.

### `GET /api/admin/dedup`

Panel de deduplicación: muestra estadísticas de duplicados y permite ejecutar dedup.

### `POST /api/admin/dedup`

Ejecutar dedup manualmente con opciones avanzadas (dry-run, modo, límite).

### `POST /api/admin/import-localizados`

Importar registros de personas localizadas desde JSON. Acepta array de personas con estado `encontrado`.

#### Body

```json
[
  { "nombre": "Persona", "apellido": "González", "estado": "encontrado", "ubicacion": "Hospital X" }
]
```

---

### `POST /api/admin/import-centros`

Importar centros de acopio desde JSON.

#### Body

```json
[
  { "nombre": "Centro X", "tipo": "centro_acopio", "ubicacion": "Caracas", "contacto": "0414-1234567" }
]
```

---

### `GET /api/admin/block-source`

**Dry-run:** Busca registros inyectados por una fuente de spam.

#### Query Parameters

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `q` | `string` | Texto a buscar en: nombre, apellido, remitente, email, teléfono, external_id, descripción, ubicación, foto_url |
| `apply` | `1` | Si está presente, **elimina** los registros que coincidan (sin `apply` es solo conteo) |
| `id` | `uuid` | Eliminar un registro específico por ID (requiere `apply=1`) |

#### Response (dry-run)

```json
{
  "dryRun": true,
  "q": "spam-domain.com",
  "coincidencias": 42,
  "ejemplos": [
    { "id": "uuid", "nombre": "Spam", "apellido": "Bot", "rep": "spammer", "email": "spam@spam-domain.com" }
  ]
}
```

#### Response (aplicado)

```json
{ "applied": true, "q": "spam-domain.com", "eliminados": 42 }
```

---

### `GET /api/admin/cleanup`

Limpieza general de datos (eliminar registros huérfanos, regenerar índices, etc.).

---

## API Cron (Vercel Cron Jobs)

### `GET /api/cron/dedup`

Ejecutado automáticamente por Vercel Cron. Ejecuta dedup periódico sin intervención manual.

**Autenticación:** Requiere header `Authorization: Bearer ${CRON_SECRET}`.

**Comportamiento:**
1. Ejecuta dry-run del dedup ultimate
2. Si hay duplicados, ejecuta dedup real
3. Registra resultado

#### Response 200

```json
{
  "success": true,
  "mode": "ultimate",
  "duplicates_found": 500,
  "deleted": 500,
  "total_after": 50000
}
```

#### Response 401

```json
{ "error": "No autorizado' }
```

---

## Script de Sincronización Unificado

### `scripts/sync_all.py`

Script Python que sincroniza datos de todas las fuentes externas en un solo comando.

#### Uso

```bash
# Sync todas las fuentes
python3 -u scripts/sync_all.py

# Sync fuente específica
python3 -u scripts/sync_all.py dtv
python3 -u scripts/sync_all.py vtb
python3 -u scripts/sync_all.py tve
python3 -u scripts/sync_all.py sos

# Sync múltiples fuentes
python3 -u scripts/sync_all.py vtb tve sos

# Sync DTV desde página específica (resumen)
python3 -u scripts/sync_all.py dtv --start-page 130

# Salida a log
python3 -u scripts/sync_all.py dtv 2>&1 | tee /tmp/sync_dtv.log
```

#### Fuentes Soportadas

| Fuente | API | Total Registros | Estado |
|--------|-----|-----------------|--------|
| **DTV** (Detrás de la Verdad) | `venezuela-te-busca-app.hellogafaro.workers.dev/api/persons` | ~54,000 | ✅ Completo |
| **VTB** (Venezuela Te Busca) | `venezuela-te-busca-app.hellogafaro.workers.dev/api/persons` | ~19,000 | ✅ Completo |
| **TVE** (Terremoto Venezuela) | Scraping de `terremotovenezuela.app` | ~21,000 | ✅ Completo |
| **SOS** (SOS Venezuela) | Scraping/API | ~2,500 | ✅ Completo |

#### Flujo de Sincronización

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐     ┌──────────────┐
│  API Externa │────▶│  Normalización   │────▶│ POST /personas│────▶│  Dedup Post  │
│  (paginación)│     │  (nombre, estado)│     │ (con bypass)  │     │  (opcional)  │
└──────────────┘     └──────────────────┘     └──────────────┘     └──────────────┘
```

1. **Fetch:** Paginación completa de la API externa (100 registros/página)
2. **Normalización:**
   - Split `nombre_completo` → `nombre` + `apellido`
   - Mapeo de estados (ver tabla arriba)
   - Generación de `external_id` (ej: `dtv-UUID`, `vtb-UUID`)
   - Normalización de ubicación
3. **Insert:** Via `POST /api/v1/personas` con header `x-sync-secret` para bypass de rate limit
4. **Dedup:** Post-sync, ejecuta dry-run del dedup y reporta grupos duplicados

#### Variables de Entorno

| Variable | Descripción |
|----------|-------------|
| `API_BASE_URL` | Base URL de ReportaVNZLA (default: `https://reportavnzla.com`) |
| `SYNC_SECRET` | Secret para bypass de rate limit (default: `DEDUP_VNZLA_2026`) |

#### Log de Progreso

```
[SYNC] 🚀 ReportaVNZLA Unified Sync — fuentes: ['dtv']
[SYNC]    Hora: 2026-06-25 21:04:16
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[DTV] 🔄 Iniciando sync completo... (desde página 130)
[DTV] Page 130/550 — new:0 dup:5 found:21
[DTV] Page 140/550 — new:0 dup:480 found:256
...
[DTV] ✅ Done — new:0 upd:292 dup:16959 err:0 found:5397
[SYNC] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧹 Dedup post-import...
[DEDUP]   Grupos: 22759, Removibles: 32505
[DEDUP]   ✅ Eliminados: 0
[STATS] RESUMEN FINAL
[STATS]   DTV  : +     0 nuevos,  16959 dup,   0 err,  5397 encontrados
[STATS]   TOTAL: +     0 nuevos,  16959 dup,   0 err,  5397 encontrados
```

---

## Códigos de Error

Todos los endpoints retornan un formato consistente:

```json
{ "success": false, "error": "Mensaje descriptivo" }
```

| Código HTTP | Significado | Cuándo Ocurre |
|-------------|-------------|---------------|
| `200` | OK | Operación exitosa |
| `201` | Created | Recurso creado (POST) |
| `204` | No Content | OPTIONS / CORS preflight |
| `400` | Bad Request | Datos inválidos, spam, campos faltantes |
| `401` | Unauthorized | Falta autenticación (admin/cron endpoints) |
| `404` | Not Found | Recurso no existe |
| `429` | Too Many Requests | Rate limit excedido |
| `500` | Internal Server Error | Error del servidor |

---

## Notas para Desarrolladores

### Convenciones

- **Campos JSON:** camelCase (`createdAt`, `fotoUrl`, `ultimaUbicacion`)
- **Columnas DB:** snake_case (`created_at`, `foto_url`, `ultima_ubicacion`)
- **Drizzle ORM** mapea automáticamente entre ambos

### External ID

Cada registro importado tiene un `external_id` que identifica su origen:
- `vtb-` → Venezuela Te Busca
- `dtv-` → Detrás de la Verdad
- `tve-` → Terremoto Venezuela
- `sos-` → SOS Venezuela
- Sin prefijo → Reporte manual directo

### Prefijo de Fuentes en Búsqueda Stats

El campo `external_id` se usa para determinar la fuente estadísticamente:
- Contiene `vtb` → fuente DTV
- Contiene `dtv` → fuente DTV
- Contiene `tve` → fuente TVE
- Contiene `sos` → fuente SOS
- Sin external_id → fuente manual

### Rate Limit Bypass

Para scripts de sincronización, siempre incluir:
```python
headers = {"x-sync-secret": "DEDUP_VNZLA_2026"}
```

### Anti-Spam

El módulo `lib/antispam.ts` bloquea automáticamente:
- URLs/enlaces en campos de texto
- Dominios bloqueados
- Patrones de inyección de datos
- Fuentes previamente bloqueadas via `/api/admin/block-source`