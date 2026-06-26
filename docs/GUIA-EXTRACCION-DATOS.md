# 🔄 Guía de Extracción y Sincronización de Datos — ReportaVNZLA

## Visión General

ReportaVNZLA centraliza datos de personas desaparecidas y encontradas tras el terremoto de Venezuela 2026. Los datos se extraen de múltiples fuentes públicas, se normalizan, se importan a nuestra base de datos (Neon PostgreSQL), y se mantienen sincronizados automáticamente.

---

## 📊 Arquitectura del Sistema

```
┌──────────────────────┐     ┌──────────────────────────┐     ┌──────────────────┐
│  Fuentes Externas     │────▶│  API ReportaVNZLA         │────▶│  Neon PostgreSQL  │
│                       │     │  POST /api/v1/personas     │     │  tabla: personas  │
│  VTB (venezuelatebusca)│    │  POST /api/v1/sync/pull    │     │  tabla: edificios │
│  DTV (desaparecidosve) │    │  POST /api/v1/dedup2       │     │  tabla: recursos  │
│  TVE (terremotovenezuela)│   │                           │     │                  │
│  SOS (sosvenezuela2026) │    │  Cron cada 30 min          │     │                  │
└──────────────────────┘     └──────────────────────────┘     └──────────────────┘
```

---

## 🔌 Fuentes de Datos Integradas

### 1. Venezuela Te Busca (VTB)
- **URL**: `https://venezuelatebusca.com`
- **API**: `https://venezuela-te-busca-app.hellogafaro.workers.dev/api/persons`
- **Prefijo external_id**: `vtb-{id}`
- **Total registros**: ~19,000
- **Método**: API REST pública (GET con paginación `?page=N&limit=100`)
- **Campos mapeados**:
  | Campo API VTB | Campo ReportaVNZLA |
  |---|---|
  | `first_name` | `nombre` |
  | `last_name` | `apellido` |
  | `national_id` | `cedula` |
  | `age` | `edad` |
  | `status` (`found`→`encontrado`) | `estado` |
  | `last_seen_location` | `ultimaUbicacion` |
  | `description` | `descripcion` |
  | `photo_key` | `fotoUrl` (prefijado con base URL) |
  | `reporter_name` | `reportadoPorNombre` |

### 2. Desaparecidos Terremoto Venezuela (DTV)
- **URL**: `https://desaparecidosterremotovenezuela.com`
- **API**: `https://desaparecidos-terremoto-api.theempire.tech/api/personas`
- **Prefijo external_id**: `dtv-{id}`
- **Total registros**: ~46,000
- **Método**: API REST pública (GET con paginación `?page=N&limit=100`)
- **Particularidad**: El campo `nombre` contiene el nombre completo. Se divide en `nombre` (primera palabra) y `apellido` (resto)
- **Campos mapeados**:
  | Campo API DTV | Campo ReportaVNZLA |
  |---|---|
  | `nombre` (completo) | Se divide en nombre + apellido |
  | `edad` | `edad` |
  | `estado` (`localizado`→`encontrado`) | `estado` |
  | `ubicacion` | `ultimaUbicacion` |
  | `descripcion` | `descripcion` |
  | `foto` | `fotoUrl` |
  | `localizadoPor` | `reportadoPorNombre` |

### 3. Terremoto Venezuela (TVE)
- **URL**: `https://terremotovenezuela.app`
- **API**: `https://terremotovenezuela.app/api/missing?status=active&page=N&pageSize=100`
- **Prefijo external_id**: `tve-{id}`
- **Total registros**: ~33,000 (dos estados: `active` + `found`)
- **Método**: API REST pública con paginación y filtro por status
- **Particularidad**: Tiene dos endpoints separados por status. Requiere iterar ambos
- **Campos mapeados**:
  | Campo API TVE | Campo ReportaVNZLA |
  |---|---|
  | `name` (completo) | Se divide en nombre + apellido |
  | `ciPassport` | `cedula` |
  | `age` | `edad` |
  | `status` (`found`→`encontrado`) | `estado` |
  | `location` | `ultimaUbicacion` |
  | `description` | `descripcion` |
  | `photoUrl` | `fotoUrl` |

### 4. SOS Venezuela 2026
- **URL**: `https://sosvenezuela2026.com`
- **API**: `https://sosvenezuela2026.com/api/persons/list?offset=N&limit=100`
- **Prefijo external_id**: `sos-{id}`
- **Total registros**: ~58,000
- **⚠️ Rate Limiting**: Máximo ~7,400 requests antes de recibir HTTP 429. Se usa delay de 1.5s entre requests
- **Método**: API REST con offset-based pagination
- **Campos mapeados**:
  | Campo API SOS | Campo ReportaVNZLA |
  |---|---|
  | `display_name` (completo) | Se divide en nombre + apellido |
  | `cedula_masked` | `cedula` |
  | `status` (`found_alive`→`encontrado`) | `estado` |
  | `parroquia` / `municipio` | `ultimaUbicacion` |
  | `photo_path` | `fotoUrl` |

### 5. Edificios Dañados (terremotovenezuela.com)
- **URL**: `https://terremotovenezuela.com`
- **API**: Supabase REST — `https://jckifxsdlnsvbztxydes.supabase.co/rest/v1/buildings`
- **Prefijo external_id**: `tvc-{id}`
- **Total registros**: ~596 edificios
- **⚠️ NO es de personas**: Es de estructuras/edificios dañados
- **API Key pública**: `sb_publishable_i7iEDrCVZcSt0k3RGFrY4g_WrtZBB4w`
- **Headers**: `apikey: <key>` + `Authorization: Bearer <key>`
- **Almacenamiento**: Tabla `edificios` (separada de `personas`)
- **Campos**: `name`, `address`, `city`, `zone`, `lat`, `lng`, `damage_level` (total/severo/parcial), `trapped_names`, `has_missing_persons`, `main_photo_url`, `notes`

---

## 🔄 Sistema Anti-Duplicados (Triple Capa)

### Capa 1: Dedup por `external_id` (en el momento de inserción)
- **Dónde**: `POST /api/v1/personas` y `POST /api/v1/sync/pull`
- **Cómo**: Antes de insertar, busca si ya existe un registro con el mismo `external_id`
- **Ejemplo**: Si `vtb-12345` ya existe, se salta (no se duplica)
- **Código**: `db().select({id}).from(personas).where(eq(personas.externalId, record.externalId))`

### Capa 2: Dedup por `nombre + apellido` exacto
- **Dónde**: `POST /api/v1/dedup2` (cron cada 30 min)
- **Cómo**: Agrupa por `LOWER(TRIM(nombre)) + LOWER(TRIM(apellido))` y elimina los extras
- **Qué mantiene**: El registro con mejor puntuación (external_id > foto > cédula > edad > más reciente)

### Capa 3: Dedup por `full name normalizado` (palabras ordenadas)
- **Dónde**: `POST /api/v1/dedup2` (pasa 1 del dedup)
- **Cómo**: Une `nombre + apellido`, divide en palabras, las ordena alfabéticamente, y las re-une
- **¿Por qué?**: Para detectar "Juan Carlos Pérez" + "González" == "Juan Carlos" + "Pérez González"
- **SQL**:
  ```sql
  SELECT string_agg(w, ' ' ORDER BY w)
  FROM unnest(string_to_array(
    lower(trim(nombre)) || ' ' || lower(trim(apellido)), ' '
  )) AS w WHERE w <> ''
  ```

### Criterio de "Mejor Registro" (Keep Best)
Al eliminar duplicados, se mantiene el registro con mayor puntuación según:
1. **Tiene `external_id`** → más prioritario (tiene trazabilidad a la fuente)
2. **Tiene `foto_url`** → más prioritario (tiene imagen)
3. **Tiene `cedula`** → más prioritario (identidad verificable)
4. **Tiene `edad`** → más prioritario (datos más completos)
5. **`created_at` más reciente** → último desempate

---

## 📡 Sincronización Automática

### Cron Job (cada 30 minutos)
- **Ejecuta**: `POST /api/v1/sync/pull` con body `{"sources": ["vtb", "dtv", "tve", "sos"], "limit": 500}`
- **Qué hace**:
  1. Por cada fuente, fetch los N registros más recientes de su API
  2. Parsea al formato de ReportaVNZLA con prefijo `external_id`
  3. Busca existentes por `external_id` en lotes de 200
  4. Si no existe → inserta
  5. Si existe y el `estado` cambió → actualiza (buscado→encontrado, etc.)
- **Después del sync**: Si hay más de 100 grupos duplicados, ejecuta `POST /api/v1/dedup2`

### Endpoint de Sync
```
POST /api/v1/sync/pull
Content-Type: application/json

{
  "sources": ["vtb", "dtv", "tve", "sos"],
  "limit": 500
}
```

### Ver Historial de Syncs
```
GET /api/v1/sync/pull
→ Lista los últimos 20 sync con: source, status, newInserted, statusChanged, errors, durationMs
```

---

## 🔍 Scraping Manual (para nuevas fuentes)

### Script de ejemplo para agregar una nueva fuente

```python
#!/usr/bin/env python3
"""Plantilla para importar datos de una nueva fuente a ReportaVNZLA"""
import requests, json, time

API_BASE = "https://reportavnzla.com/api/v1/personas"
SOURCE_PREFIX = "nueva-{id}"  # Prefijo para external_id
SOURCE_URL = "https://ejemplo.com/api/personas"
BATCH_SIZE = 100  # Máximo 100 por request

def split_name(full_name):
    """Divide nombre completo en nombre y apellido"""
    parts = str(full_name).strip().split()
    if len(parts) >= 2:
        return (" ".join(parts[:-1]).title(), parts[-1].title())
    return (parts[0].title() if parts else "", "")

def main():
    offset = 0
    total_imported = 0
    total_dup = 0
    
    while True:
        # 1. Fetch de la fuente
        resp = requests.get(f"{SOURCE_URL}?offset={offset}&limit={BATCH_SIZE}")
        if resp.status_code != 200:
            break
        page = resp.json()
        if not page:
            break
        
        # 2. Mapear al formato de ReportaVNZLA
        personas = []
        for p in page:
            nombre, apellido = split_name(p.get("name", ""))
            if not nombre:
                continue
            personas.append({
                "external_id": SOURCE_PREFIX.replace("{id}", str(p["id"])),
                "nombre": nombre,
                "apellido": apellido,
                "cedula": p.get("id_number") or None,
                "edad": p.get("age") or None,
                "estado": "encontrado" if p.get("status") == "found" else "buscado",
                "foto_url": p.get("photo") or None,
                "ultima_ubicacion": p.get("location") or None,
                "descripcion": p.get("description") or None,
                "fuente": "nuevafuente.com"
            })
        
        # 3. Enviar a ReportaVNZLA (batch de 100)
        for i in range(0, len(personas), BATCH_SIZE):
            batch = personas[i:i+BATCH_SIZE]
            resp = requests.post(API_BASE, json=batch, timeout=60)
            result = resp.json()
            total_imported += result.get("imported", 0)
            total_dup += result.get("skipped", 0)
        
        offset += BATCH_SIZE
        if len(page) < BATCH_SIZE:
            break
        time.sleep(1)  # Ser amable con la API
    
    print(f"✅ Importado: {total_imported}, Duplicados saltados: {total_dup}")

if __name__ == "__main__":
    main()
```

### Reglas al agregar una nueva fuente
1. **Asignar prefijo `external_id` único**: `fuente-{id_original}`
2. **Normalizar nombres**: `title()` para capitalize
3. **Dividir nombre completo**: Si la fuente tiene un solo campo, dividir en nombre+apellido
4. **Mapear estados**: Adaptar al enum de ReportaVNZLA (`buscado`, `encontrado`, `fallecido`)
5. **No duplicar**: El `external_id` garantiza que no se inserten duplicados
6. **Después de importar masivo**: Ejecutar dedup para limpiar residuales
7. **Agregar al sync**: Añadir la función de fetch al endpoint `/api/v1/sync/pull`

---

## 🧹 Depuración de Duplicados

### Ver estado actual (dry-run)
```bash
# Modo ultimate: full name normalizado
curl -s "https://reportavnzla.com/api/v1/dedup2?mode=ultimate"

# Ver estadísticas generales
curl -s "https://reportavnzla.com/api/v1/stats"
```

### Ejecutar dedup
```bash
curl -s -X POST "https://reportavnzla.com/api/v1/dedup2" \
  -H "Content-Type: application/json" \
  -d '{"secret":"DEDUP_VNZLA_2026"}'
```

### Verificar que quedó limpio
```bash
# Debe mostrar 0 grupos duplicados
curl -s "https://reportavnzla.com/api/v1/dedup2?mode=ultimate" | jq '.duplicate_groups'
```

---

## 📊 Estado Actual de la Base de Datos

| Métrica | Valor |
|---|---|
| Total personas únicas | ~62,000 |
| Fuentes activas | 4 (VTB + DTV + TVE + SOS) |
| Edificios dañados | ~596 |
| Duplicados eliminados (histórico) | ~15,000+ |
| Frecuencia de sync | Cada 30 minutos |
| Frecuencia de dedup | Después de cada sync (si hay >100 grupos) |

---

## 🗺️ Mapa de Encontrados

Los registros con `estado: "encontrado"` se muestran en el mapa interactivo con un marcador **verde** 🟢 (vs rojo 🔴 para buscados). El mapa carga desde `/api/personas/mapa` que trae todas las personas con ubicación (coords reales o aproximadas por ciudad).

---

## ⚠️ Fuentes Verificadas (NO válidas para personas)

| Plataforma | URL | Motivo de exclusión |
|---|---|---|
| FUNVISIS | funvisis.gob.ve | CAÍDO (DNS no resuelve) |
| Protección Civil | protegercivil.gob.ve | CAÍDO (DNS no resuelve) |
| INPREVISIS | inprevisis.gob.ve | CAÍDO (DNS no resuelve) |
| Cruz Roja VE | cruzrojavenezuela.org | CAÍDO (DNS no resuelve) |
| Google Person Finder | google.org/personfinder | Archivado Sep 2025 |
| terremotovenezuela.com | terremotovenezuela.com | Edificios (NO personas), 595 estructuras |
| venezuelareporta.com | venezuelareporta.com | Monitoreo de sismos (NO personas) |
| ayuda.quedate.net | ayuda.quedate.net | Refugios (NO personas), API vacía |
| ICRC FamilyLinks | familylinks.icrc.org | Sin emergencia VE registrada |

---

## 🔧 Archivos Clave en el Código

| Archivo | Función |
|---|---|
| `src/db/schema.ts` | Schema Drizzle ORM (tablas personas, edificios, recursos, sync_log) |
| `src/db/index.ts` | Conexión a Neon PostgreSQL |
| `src/app/api/v1/personas/route.ts` | API CRUD de personas (GET + POST con dedup por external_id) |
| `src/app/api/v1/sync/pull/route.ts` | Sync incremental de 4 fuentes |
| `src/app/api/v1/dedup2/route.ts` | Dedup agresivo (full name normalizado + doble pasada) |
| `src/app/api/v1/edificios/route.ts` | Importación de edificios dañados |
| `src/app/api/v1/stats/route.ts` | Estadísticas en tiempo real |
| `src/components/Map.tsx` | Mapa interactivo con Leaflet |

---

## 🚀 Flujo Completo: Agregar una Nueva Fuente

1. **Analizar la fuente**: Navegar, buscar API pública o endpoints, identificar campos
2. **Definir prefijo `external_id`**: Ej: `nueva-{id}`
3. **Crear función de fetch**: `fetchRecentNueva(limit)` en `src/app/api/v1/sync/pull/route.ts`
4. **Crear parser**: Mapear campos de la fuente al schema de personas
5. **Agregar al sync**: Añadir `'nueva'` al tipo y al array de fuentes por defecto
6. **Agregar al cron**: Ya se sincroniza automáticamente cada 30 min
7. **Import inicial masivo**: Script Python (ver plantilla arriba)
8. **Dedup post-import**: `POST /api/v1/dedup2`
9. **Verificar**: `GET /api/v1/dedup2?mode=ultimate` → 0 grupos duplicados
10. **Actualizar UI**: Agregar enlace en la sección de fuentes

---

*Última actualización: 25 de junio de 2026*
