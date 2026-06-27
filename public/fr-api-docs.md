# FR-API — Documentación técnica

**API de reconocimiento facial ASISTIVO** para reunificación de personas tras el
terremoto de Venezuela. Permite a cualquier plataforma autorizada:

1. **Buscar por rostro** una foto contra el índice global (1:N).
2. **Detectar duplicados** antes de crear un nuevo reporte (anti-duplicado).
3. **Subir (indexar) sus propios registros** para que sean buscables.
4. **Depurar su propia base** de duplicados por rostro.
5. **Conciliar identidades entre bases de datos DISTINTAS** — encontrar a la
   misma persona reportada en varias plataformas y traer **sus imágenes de cada base**.

> **Es ASISTIVO.** Todo lo que devuelve son *posibles coincidencias* que
> **SIEMPRE** requieren verificación humana. El sistema nunca afirma una
> identificación de forma definitiva. Mantén siempre un humano en el bucle.

---

## Base URL

```
http://hbdesk.sytes.net:8808
```

(HTTP por ahora; TLS en camino.) Docs interactivas: `GET /docs` (Swagger),
`GET /redoc`. El esquema OpenAPI declara el candado de seguridad por API key.

---

## Autenticación

Todas las rutas `/v1/*` requieren API key. `/health` es público.

- **Header principal:** `X-API-Key: <tu-clave>`
- **Alternativa:** `Authorization: Bearer <tu-clave>`
- **Rate-limit:** **120 peticiones por minuto por clave** (ventana fija de 1 min,
  compartida entre todos los workers vía Redis). Al superarlo: `429 Too Many Requests`.
- Clave inválida o ausente: `401 Unauthorized`.

```bash
curl http://hbdesk.sytes.net:8808/v1/search \
  -H "X-API-Key: TU_CLAVE" \
  -F "file=@foto.jpg"
```

> **Patrón servidor-a-servidor (obligatorio):** la API key vive **solo en tu
> backend**, nunca en el navegador. El cliente sube la foto a *tu* servidor y
> *tu* servidor llama al FR-API con la clave. Así evitas exponer la clave, y
> evitas CORS y mixed-content. (Ya implementado así en reportavnzla mediante un
> route handler que reenvía el `multipart` al FR-API.)

---

## Tabla de endpoints

| Método | Ruta | Auth | Para qué |
|---|---|:---:|---|
| `GET`  | `/health` | público | Estado del servicio y nº de caras indexadas |
| `POST` | `/v1/check-duplicate` | sí | Foto → ¿esta persona ya está registrada? (anti-duplicado) |
| `POST` | `/v1/search` | sí | Búsqueda 1:N → top-10 posibles coincidencias por persona |
| `POST` | `/v1/index` | sí | Indexa UN registro tuyo (foto + datos). Idempotente |
| `POST` | `/v1/index/commit` | sí | Cierre de lote (no-op de compatibilidad) |
| `GET`  | `/v1/duplicates` | sí | **Modo 3:** depura TU base por rostro (pares duplicados) |
| `GET`  | `/v1/reconcile` | sí | **Concilia identidades entre bases DISTINTAS** (con imágenes) |
| `GET`  | `/v1/groups` | sí | Lista de grupos (proxy a la fuente externa) |
| `GET`  | `/v1/groups/{id}/cluster` | sí | Agrupa por rostro las fotos de un grupo |

**Modelo del índice:** cada punto/payload tiene los campos:
`record_id`, `source`, `group_id`, `person_name`, `age`, `last_seen_location`,
`contact_phone`, `image_url`, `external_id`. El embedding es de **512 dimensiones**,
distancia **coseno**.

---

## Bandas de confianza y umbral

El score es la **similitud coseno** entre la cara de la consulta y la cara
candidata (rango aproximado 0–1). El **umbral de referencia es `0.35`**.

| Banda | Rango de score | Interpretación |
|---|---|---|
| `alta` | `score >= 0.50` | Muy probablemente la misma persona |
| `media` | `0.35 <= score < 0.50` | Posible; requiere mirada humana |
| `baja` | `score < 0.35` | Poco probable (por debajo del umbral) |

Cada candidato incluye su campo `band` con uno de esos tres valores. Decide
siempre con criterio humano; las bandas son una ayuda, no un veredicto.

---

## `GET /health`

Estado del servicio. **No requiere API key.**

```bash
curl http://hbdesk.sytes.net:8808/health
```

**Respuesta `200`:**

```json
{
  "ok": true,
  "model": "buffalo_l",
  "indexed": 1842
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `ok` | bool | Siempre `true` si el servicio responde |
| `model` | string | Modelo de reconocimiento facial cargado |
| `indexed` | int | Número de caras actualmente indexadas en Qdrant |

---

## `POST /v1/check-duplicate`

Anti-duplicado en el momento del registro. Recibe la foto que alguien va a
reportar y responde si esa persona **probablemente YA está reportada** (en tu
base o en cualquier otra fuente). Busca en **todo** el índice; cada candidato
trae su `source` para que sepas de qué plataforma viene la coincidencia.

**Body:** `multipart/form-data`

| Campo | Tipo | Req | Descripción |
|---|---|:---:|---|
| `file` | archivo | sí | Imagen JPG, PNG, WEBP o HEIC |

```bash
curl -X POST http://hbdesk.sytes.net:8808/v1/check-duplicate \
  -H "X-API-Key: TU_CLAVE" \
  -F "file=@foto.jpg"
```

**Respuesta `200`:**

```json
{
  "ok": true,
  "model": "buffalo_l",
  "threshold": 0.35,
  "faces_detected": 1,
  "possible_duplicate": true,
  "best_score": 0.97,
  "message": "Creemos que esta persona ya podría estar registrada.",
  "candidates": [
    {
      "record_id": "reportavnzla:123",
      "group_id": "reportavnzla:123",
      "person_name": "Katherine Mendoza",
      "age": 22,
      "last_seen_location": "Catia la Mar",
      "contact_phone": null,
      "image_url": "https://tu-cdn/fotos/123.jpg",
      "source": "reportavnzla",
      "score": 0.97,
      "band": "alta",
      "group_size": 1
    }
  ]
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `ok` | bool | Operación correcta |
| `model` | string | Modelo facial |
| `threshold` | float | Umbral de referencia (0.35) |
| `faces_detected` | int | Caras detectadas en la imagen subida |
| `possible_duplicate` | bool | `true` si hay >=1 candidato con `score >= threshold` |
| `best_score` | float \| null | Mejor score encontrado (o `null` si no hubo candidatos) |
| `message` | string | Mensaje listo para mostrar al usuario |
| `candidates` | array | Hasta 5 candidatos, ordenados por `score` desc |

Campos de cada **candidate**: `record_id`, `group_id`, `person_name`, `age`,
`last_seen_location`, `contact_phone`, `image_url`, `source`, `score` (float),
`band` (string: `alta`/`media`/`baja`), `group_size` (int).

**Errores:**

- `422` — no se detectó ninguna cara (puedes dejar registrar igual; el FR no aplica).
- `400` — no se pudo leer la imagen.
- `503` — índice no disponible.

---

## `POST /v1/search`

Búsqueda 1:N. Foto → **top-10 posibles coincidencias** colapsadas por persona
(`group_id`), ordenadas por `score` descendente.

**Body:** `multipart/form-data`

| Campo | Tipo | Req | Descripción |
|---|---|:---:|---|
| `file` | archivo | sí | Imagen JPG, PNG, WEBP o HEIC |

```bash
curl -X POST http://hbdesk.sytes.net:8808/v1/search \
  -H "X-API-Key: TU_CLAVE" \
  -F "file=@foto.jpg"
```

**Respuesta `200`:**

```json
{
  "ok": true,
  "model": "buffalo_l",
  "threshold": 0.35,
  "query": {
    "faces_detected": 1,
    "det_score": 0.91,
    "bbox": [120.5, 80.0, 320.0, 360.0]
  },
  "results": [
    {
      "record_id": "azure:88",
      "group_id": "g-0007",
      "person_name": "José Pérez",
      "age": 34,
      "last_seen_location": "Maiquetía",
      "contact_phone": "+58412...",
      "image_url": "https://…",
      "source": "azure",
      "score": 0.88,
      "band": "alta",
      "group_size": 3
    }
  ]
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `ok` | bool | Operación correcta |
| `model` | string | Modelo facial |
| `threshold` | float | Umbral de referencia (0.35) |
| `query.faces_detected` | int | Caras detectadas en la imagen |
| `query.det_score` | float \| null | Confianza de detección de la cara principal |
| `query.bbox` | float[4] | Caja del rostro `[x1, y1, x2, y2]` |
| `results` | array | Hasta 10 resultados (mismos campos de `candidate` de arriba) |

**Errores:** `422` (sin rostro o imagen ilegible), `503` (índice no disponible).

---

## `POST /v1/index`

Indexa **UN** registro de tu plataforma (su foto + datos) para que sea buscable
por rostro. **Idempotente** por `(source, external_id)`: reindexar el mismo
registro lo actualiza, no lo duplica. **Tolerante sin rostro:** si la imagen no
tiene cara, responde `indexed: false` sin error (no rompe tu registro).

**Body:** `multipart/form-data`

| Campo | Tipo | Req | Descripción |
|---|---|:---:|---|
| `external_id` | string | sí | ID único del registro en TU plataforma |
| `file` | archivo | sí* | Imagen subida (*o* `image_url`) |
| `image_url` | string | sí* | URL `http(s)` **o** data-URI base64 (`data:image/jpeg;base64,...`) |
| `person_name` | string | no | Nombre para mostrar en candidatos |
| `age` | string | no | Edad (se guarda como entero si es numérico) |
| `last_seen_location` | string | no | Última ubicación conocida |
| `contact_phone` | string | no | Teléfono de contacto |
| `source` | string | no | Etiqueta de tu plataforma (default: la de tu API key) |
| `persist` | string | no | `"true"`/`"false"`. Default `"true"` (ver `/v1/index/commit`) |

Debes enviar **`file` o `image_url`** (uno de los dos). El `record_id` resultante
es `"<source>:<external_id>"`. Cada registro de plataforma es su propio grupo
(`group_id == record_id`).

```bash
# Por URL de imagen
curl -X POST http://hbdesk.sytes.net:8808/v1/index \
  -H "X-API-Key: TU_CLAVE" \
  -F "external_id=123" \
  -F "person_name=Katherine Mendoza" \
  -F "age=22" \
  -F "last_seen_location=Catia la Mar" \
  -F "contact_phone=+58412..." \
  -F "source=reportavnzla" \
  -F "image_url=https://tu-cdn/fotos/123.jpg"

# Por archivo subido
curl -X POST http://hbdesk.sytes.net:8808/v1/index \
  -H "X-API-Key: TU_CLAVE" \
  -F "external_id=123" \
  -F "person_name=Katherine Mendoza" \
  -F "file=@123.jpg"
```

**Respuesta `200` (indexado):**

```json
{ "ok": true, "indexed": true, "record_id": "reportavnzla:123" }
```

**Respuesta `200` (sin rostro / sin imagen / ilegible):**

```json
{ "ok": true, "indexed": false, "record_id": "reportavnzla:123", "reason": "sin rostro" }
```

| Campo | Tipo | Descripción |
|---|---|---|
| `ok` | bool | Operación correcta |
| `indexed` | bool | `true` si se indexó la cara; `false` si no había rostro/imagen |
| `record_id` | string | `"<source>:<external_id>"` |
| `reason` | string | Presente solo si `indexed: false` (`"sin imagen"`, `"imagen ilegible"`, `"sin rostro"`) |

---

## `POST /v1/index/commit`

Cierre de lote. **No-op de compatibilidad:** Qdrant persiste automáticamente, así
que no necesitas llamarlo, pero existe para flujos de backfill que esperan un
commit explícito al final.

```bash
curl -X POST http://hbdesk.sytes.net:8808/v1/index/commit \
  -H "X-API-Key: TU_CLAVE"
```

**Respuesta `200`:**

```json
{ "ok": true, "indexed": 1842 }
```

| Campo | Tipo | Descripción |
|---|---|---|
| `ok` | bool | Operación correcta |
| `indexed` | int | Total de caras indexadas tras el commit |

---

## `GET /v1/duplicates`  (Modo 3 — depura TU base)

Cruza **tu propia base** por rostro y devuelve los posibles **pares duplicados**
(mismo `source`) para que los confirmes/elimines. Asistivo.

**Query params:**

| Param | Tipo | Default | Descripción |
|---|---|---|---|
| `source` | string | (tu clave) | Fuente a depurar. Si se omite, usa la etiqueta de tu API key |
| `min_score` | float | `0.6` | Score mínimo para considerar un par |
| `limit` | int | `200` | Máx. de registros a recorrer (tope interno 500) |

```bash
curl "http://hbdesk.sytes.net:8808/v1/duplicates?source=reportavnzla&min_score=0.6&limit=300" \
  -H "X-API-Key: TU_CLAVE"
```

**Respuesta `200`:**

```json
{
  "ok": true,
  "source": "reportavnzla",
  "checked": 300,
  "duplicates": [
    {
      "a": "reportavnzla:123",
      "b": "reportavnzla:481",
      "score": 0.93,
      "a_name": "Katherine Mendoza",
      "b_name": "Katherine M.",
      "a_image": "https://…/123.jpg",
      "b_image": "https://…/481.jpg"
    }
  ]
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `ok` | bool | Operación correcta |
| `source` | string | Fuente depurada |
| `checked` | int | Registros recorridos |
| `duplicates` | array | Pares candidatos, ordenados por `score` desc |

Cada par: `a`/`b` (record_id), `score` (float), `a_name`/`b_name`,
`a_image`/`b_image` (URLs).

**Errores:** `400` (falta `source`), `502` (error de Qdrant).

---

## `GET /v1/reconcile`  ⭐ Conciliación entre bases DISTINTAS

**El endpoint clave para cruzar plataformas.** Recorre el índice y **agrupa por
rostro registros que provienen de fuentes (`source`) DIFERENTES** y que son, muy
probablemente, **la misma persona**. Devuelve cada *identidad conciliada* con
**sus imágenes de cada base** (lo primordial son las imágenes), más los datos.

A diferencia de `/v1/duplicates` (que depura una sola base), `/v1/reconcile`
**solo** reporta grupos que abarcan **>=2 fuentes distintas** — es decir, casos
en los que la misma persona aparece en plataformas diferentes.

**Query params:**

| Param | Tipo | Default | Descripción |
|---|---|---|---|
| `min_score` | float | `0.5` | Similitud coseno mínima para unir dos caras |
| `limit` | int | `300` | Máx. de puntos a recorrer. **Tope: 800**. Acota el coste |
| `sources` | string | (todas) | Limita a estas fuentes, p. ej. `"azure,reportavnzla"` |

> El `limit` acota el coste deliberadamente (no es O(N²) sin tope). Para
> conciliar bases grandes, pagina/recorre por lotes o usa `sources` para
> restringir el cruce a las fuentes que te interesan.

```bash
# Conciliar todas las fuentes (umbral 0.5, hasta 300 puntos)
curl "http://hbdesk.sytes.net:8808/v1/reconcile?min_score=0.5&limit=300" \
  -H "X-API-Key: TU_CLAVE"

# Conciliar SOLO entre dos fuentes concretas
curl "http://hbdesk.sytes.net:8808/v1/reconcile?sources=azure,reportavnzla&min_score=0.55&limit=800" \
  -H "X-API-Key: TU_CLAVE"
```

**Respuesta `200`:**

```json
{
  "ok": true,
  "min_score": 0.5,
  "checked": 300,
  "groups": [
    {
      "score": 0.91,
      "sources": ["azure", "reportavnzla"],
      "records": [
        {
          "record_id": "azure:88",
          "source": "azure",
          "person_name": "José Pérez",
          "age": 34,
          "last_seen_location": "Maiquetía",
          "contact_phone": "+58412...",
          "image_url": "https://azure-cdn/…/88.jpg"
        },
        {
          "record_id": "reportavnzla:512",
          "source": "reportavnzla",
          "person_name": "Jose P.",
          "age": null,
          "last_seen_location": "La Guaira",
          "contact_phone": null,
          "image_url": "https://tu-cdn/fotos/512.jpg"
        }
      ]
    }
  ]
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `ok` | bool | Operación correcta |
| `min_score` | float | Umbral usado en la conciliación |
| `checked` | int | Puntos del índice recorridos |
| `groups` | array | Identidades conciliadas, ordenadas por `score` desc |

Cada **group**:

| Campo | Tipo | Descripción |
|---|---|---|
| `score` | float | Score **mínimo** de las aristas internas del grupo (cohesión peor caso) |
| `sources` | string[] | Fuentes distintas que abarca el grupo (siempre >=2), ordenadas |
| `records` | array | Un registro por aparición, **con su `image_url` de cada base** |

Cada **record** dentro de un grupo:
`record_id`, `source`, `person_name`, `age`, `last_seen_location`,
`contact_phone`, `image_url`.

> **Solo se incluyen grupos que abarcan >=2 fuentes distintas.** Compara
> visualmente las `image_url` de cada base junto a los datos para confirmar (o
> descartar) que es la misma persona. **Verificación humana obligatoria.**

**Errores:** `502` (error de Qdrant).

---

## `GET /v1/groups`

Lista de grupos (proxy a la fuente externa de datos). Útil para navegar y revisar.

**Query params:**

| Param | Tipo | Default | Descripción |
|---|---|---|---|
| `limit` | int | `20` | Tamaño de página |
| `offset` | int | `0` | Desplazamiento |
| `q` | string | `""` | Texto de búsqueda opcional |

```bash
curl "http://hbdesk.sytes.net:8808/v1/groups?limit=20&offset=0&q=mendoza" \
  -H "X-API-Key: TU_CLAVE"
```

Devuelve el JSON de grupos de la fuente externa tal cual (lista paginada de
grupos con sus conteos). **Errores:** `502` si la fuente externa no responde.

---

## `GET /v1/groups/{group_id}/cluster`

Agrupa **por rostro** todas las imágenes de un grupo a la vez: detecta **todas**
las caras de cada foto (aunque haya varias personas), las agrupa en "personas"
(caras mutuamente parecidas) y devuelve cada persona con los registros donde
aparece. Las imágenes **sin rostro** se separan para verificación manual.

```bash
curl "http://hbdesk.sytes.net:8808/v1/groups/g-0007/cluster" \
  -H "X-API-Key: TU_CLAVE"
```

**Respuesta `200`:**

```json
{
  "ok": true,
  "model": "buffalo_l",
  "threshold": 0.35,
  "group": { "...": "metadatos del grupo de la fuente externa" },
  "clusters": [
    {
      "distinct_records": 3,
      "members": [
        {
          "record_id": "…", "person_name": "…", "age": 22,
          "last_seen_location": "…", "contact_phone": null,
          "image_url": "https://…", "duplicate_role": "primary",
          "img_w": 800, "img_h": 600, "bbox": [120, 80, 320, 360],
          "score": 1.0, "det": 0.92
        }
      ]
    }
  ],
  "no_face": [
    { "record_id": "…", "image_url": "https://…", "motivo": "no se detectó rostro" }
  ],
  "has_duplicates": true
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `ok` | bool | Operación correcta |
| `model` / `threshold` | string / float | Modelo y umbral |
| `group` | object | Metadatos del grupo (de la fuente externa) |
| `clusters` | array | Personas detectadas; cada una con `distinct_records` y `members` |
| `no_face` | array | Registros sin rostro detectable (verificación manual) |
| `has_duplicates` | bool | Si el grupo tiene duplicados propuestos |

Cada **member**: `record_id`, `person_name`, `age`, `last_seen_location`,
`contact_phone`, `image_url`, `duplicate_role`, `img_w`, `img_h`,
`bbox` (`[x1,y1,x2,y2]`), `score` (float), `det` (float).

**Errores:** `503` (modelo no cargado), `502` (fuente externa no responde).

---

## Cómo añadir tu base de datos al índice

El cruce entre plataformas (`/v1/check-duplicate`, `/v1/reconcile`,
`/v1/duplicates`) solo funciona con lo que esté **indexado**. Para sumar tu base:

1. **Pide una API key** al administrador del FR-API (se te asigna una etiqueta de
   `source`).
2. **Repara las URLs de imagen ANTES de ingerir.** Si tu fuente tiene URLs
   malformadas (espacios, protocolo faltante, dobles barras, dominios viejos),
   corrígelas primero. Una URL rota = registro no indexado. Si prefieres no
   depender de URLs, sube los bytes directamente con el campo `file` o un
   data-URI base64 en `image_url`.
3. **Ingiere registro a registro** con `POST /v1/index`, usando tu `external_id`
   propio y un `source` estable. Es **idempotente**: puedes reanudar un backfill
   interrumpido sin duplicar nada.
4. **Backfill de lotes grandes:** respeta el rate-limit de **120/min**. Al final
   del lote puedes llamar `POST /v1/index/commit` (opcional, no-op).
5. **Mantén el índice fresco:** cada vez que crees/edites un reporte con foto en
   tu plataforma, vuelve a llamar `/v1/index` con el mismo `external_id`.
6. **Empieza a cruzar:** ya puedes usar `/v1/check-duplicate` al registrar,
   `/v1/duplicates` para limpiar tu base, y `/v1/reconcile` para encontrar a la
   misma persona reportada en otras plataformas.

Ejemplo mínimo de ingesta de un registro nuevo (servidor-a-servidor):

```bash
curl -X POST http://hbdesk.sytes.net:8808/v1/index \
  -H "X-API-Key: TU_CLAVE" \
  -F "external_id=$ID_EN_TU_BD" \
  -F "source=tu-plataforma" \
  -F "person_name=$NOMBRE" \
  -F "image_url=$URL_FOTO_YA_REPARADA"
```

---

## Arquitectura (escala horizontal)

API **stateless** sobre:

- **Qdrant** — base de datos vectorial (colección `faces`, 512-d, coseno).
  Maneja millones de vectores con búsqueda sub-lineal, persistencia propia e
  ingesta concurrente sin locks en proceso.
- **Redis** — rate-limit compartido entre todos los workers/instancias (ventana
  fija por minuto). Si Redis cae, el límite hace *fail-open* (no bloquea tráfico
  legítimo).
- **Multi-worker** — varios workers/instancias detrás de un balanceador, todos
  contra el mismo Qdrant/Redis. Escala horizontal añadiendo nodos; el cuello de
  CPU (cálculo de embeddings faciales) se escala con más nodos o GPU.

Como la API es stateless, cualquier worker atiende cualquier petición; no hay
estado de sesión que sincronizar.

---

## Ética y uso responsable

- **Asistivo, con humano en el bucle.** El sistema nunca confirma una identidad
  de forma automática: solo propone *posibles* coincidencias.
- Trata fotos, embeddings y coincidencias como **datos sensibles**. No los
  reenvíes a servicios de reconocimiento facial de terceros.
- Úsalo únicamente para el fin previsto: ayudar a **reunificar** personas tras el
  terremoto. La decisión final sobre cualquier coincidencia es **siempre humana**.
