# FR-API — Guía de integración para agentes de IA

> **Para el agente que lee este archivo:** este documento describe, con código
> de referencia listo para copiar, cómo integrar el **FR-API de reconocimiento
> facial** en esta aplicación. Implementa el patrón **servidor-a-servidor**
> (la clave NUNCA llega al navegador). Sigue las reglas de la sección
> "Convenciones obligatorias". Cuando termines, valida con la sección
> "Checklist". El FR-API es **asistivo**: toda coincidencia requiere
> verificación humana, nunca confirma identidad de forma automática.

## 0) Qué hace el FR-API

Convierte cada rostro en un vector y los compara por similitud. Sirve para: (1)
avisar de **posibles duplicados al registrar** una persona, (2) **buscar** por
rostro, (3) **depurar** tu propia base de duplicados, (4) **conciliar** la misma
persona entre plataformas distintas.

## 1) Configuración (env)

Crea/añade en `.env.local` (NO lo subas a git):

```bash
FR_API_URL=https://fr-api.reportavnzla.com:8443
FR_API_KEY=__pidela_por_canal_privado__   # secreta; solo en el servidor
```

- `FR_API_URL`: base URL (TLS; admite fotos grandes). Alias para cargas ≤4.5 MB:
  `https://reportavnzla.com/fr-api`.
- `FR_API_KEY`: tu clave. **Solo en el backend.** Nunca la pongas en código que
  corra en el navegador ni la hardcodees en el repo.

## 1.5) Formas de enviar la imagen (acepta CUALQUIERA)

`/v1/check-duplicate`, `/v1/search` y `/v1/index` aceptan la imagen por **cualquier
método**, tú eliges el que tengas:

| Tienes… | Manda… |
|---|---|
| Un archivo / bytes | `file` (multipart/form-data) |
| Una **URL http(s)** (foto fetchable) | campo `image_url` con la URL |
| Un **data-URI base64** (`data:image/...;base64,...`) | campo `image_url` con el data-URI |

- **Formato/extensión:** da igual — JPG, PNG, WebP, BMP, **HEIC/HEIF**… se detecta por
  contenido, no por extensión.
- No mezcles: manda `file` **o** `image_url`, lo que tengas.
- (Nota curl: si pasas un data-URI por línea de comandos usa `--form-string` para que el
  `;` no se interprete; desde código/SDK no aplica.)

**¿Qué ALMACENA el FR-API?** Solo el **embedding** (vector 512-d) + metadatos
(`person_name`, `last_seen_location`, `source`, y el `image_url` que mandaste para
**mostrar** el candidato). **No** guarda la foto en bruto ni consulta tu BD. Por eso, al
**indexar** conviene que `image_url` sea una **URL http(s) pública** (para que los
candidatos se vean); para **cotejar/buscar** (query) cualquier método sirve.

## 2) Convenciones obligatorias (NO las rompas)

1. **Servidor-a-servidor.** El navegador llama a TU backend; TU backend llama al
   FR-API con `X-API-Key`. Crea rutas proxy; no llames al FR-API desde el cliente.
2. **`X-API-Key`** en todas las rutas `/v1/*`. `/health` y `/openapi.json` son públicas.
3. **`source`** = etiqueta de tu plataforma. Al **indexar** se estampa (default =
   la etiqueta de tu key). Al **depurar** (`/v1/duplicates`) pasa **el mismo**
   `source`. Mantén un único valor de `source` consistente en todo tu código.
4. **422 = sin rostro.** El cotejo nunca debe bloquear el registro: si no hay
   rostro o el FR falla, deja continuar (es asistivo).
5. **Idempotente.** `/v1/index` usa tu `external_id` (el id de tu BD); re-indexar
   no duplica. Puedes reanudar backfills sin miedo.
6. **Rate-limit 120/min por key.** En bucles, separa las llamadas (~550 ms).
7. **Privacidad.** No envíes datos privados que no quieras compartir (p. ej.
   teléfonos). Indexa nombre, ubicación pública y la URL pública de la foto.

## 3) Helper del servidor

`src/lib/fr.ts` (o equivalente). Centraliza base URL, clave y la indexación.

```ts
import "server-only";

const RAW = process.env.FR_API_URL || "https://fr-api.reportavnzla.com:8443";
export const FR_BASE = (/^https?:\/\//i.test(RAW) ? RAW : `https://${RAW}`).replace(/\/+$/, "");
export const FR_KEY = process.env.FR_API_KEY || "";
export const FR_SOURCE = "TU_FUENTE";           // <-- una sola etiqueta para TODA tu app
export const frConfigured = () => Boolean(FR_KEY);
export const frHeaders = () => ({ "X-API-Key": FR_KEY });

// Indexa una persona (best-effort: nunca lanza; no manda datos privados).
export async function frIndexPerson(p: {
  externalId: string; imageUrl: string | null; name?: string | null; location?: string | null;
}): Promise<void> {
  if (!frConfigured() || !p.imageUrl) return;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const fd = new FormData();
    fd.append("external_id", p.externalId);
    fd.append("image_url", p.imageUrl);
    fd.append("source", FR_SOURCE);
    if (p.name) fd.append("person_name", p.name);
    if (p.location) fd.append("last_seen_location", p.location);
    await fetch(`${FR_BASE}/v1/index`, { method: "POST", headers: frHeaders(), body: fd, signal: ctrl.signal });
  } catch { /* asistivo: nunca rompe el registro */ } finally { clearTimeout(t); }
}
```

## 4) Rutas proxy (Next.js App Router — adapta a tu framework)

**Anti-duplicado al registrar — PÚBLICA** `src/app/api/fr/check-duplicate/route.ts`
El navegador manda `{ photo: "data:image/jpeg;base64,..." }`; reenviamos como `file`.

```ts
import { NextResponse } from "next/server";
import { FR_BASE, frHeaders, frConfigured } from "@/lib/fr";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!frConfigured()) return NextResponse.json({ ok: true, possible_duplicate: false, disabled: true });
  let photo = "";
  try { photo = (await req.json())?.photo || ""; } catch {}
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(photo);
  if (!m) return NextResponse.json({ ok: true, possible_duplicate: false });
  try {
    const fd = new FormData();
    fd.append("file", new Blob([Buffer.from(m[2], "base64")], { type: m[1] }), "foto.jpg");
    const r = await fetch(`${FR_BASE}/v1/check-duplicate`, { method: "POST", headers: frHeaders(), body: fd });
    if (r.status === 422) return NextResponse.json({ ok: true, possible_duplicate: false, no_face: true });
    return new NextResponse(await r.text(), { status: r.status, headers: { "content-type": "application/json" } });
  } catch { return NextResponse.json({ ok: true, possible_duplicate: false, error: "fr_unreachable" }); }
}
```

**Búsqueda / Duplicados / Conciliación — protégelas con TU sesión de admin.**
`src/app/api/fr/search/route.ts` (POST, multipart `file`):

```ts
import { NextResponse } from "next/server";
import { FR_BASE, frHeaders, frConfigured } from "@/lib/fr";
// import { getAdminSession } from "@/lib/admin";   // <-- tu propia auth
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // const session = await getAdminSession(); if (!session) return NextResponse.json({ ok:false }, { status: 401 });
  if (!frConfigured()) return NextResponse.json({ ok: false, error: "FR no configurado" }, { status: 503 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ ok: false, error: "falta_imagen" }, { status: 400 });
  const fd = new FormData();
  fd.append("file", file, "foto.jpg");
  const r = await fetch(`${FR_BASE}/v1/search`, { method: "POST", headers: frHeaders(), body: fd });
  return new NextResponse(await r.text(), { status: r.status, headers: { "content-type": "application/json" } });
}
```

`src/app/api/fr/duplicates/route.ts` (GET): reenvía a
`${FR_BASE}/v1/duplicates?source=${FR_SOURCE}&min_score=...&limit=...`.
`src/app/api/fr/reconcile/route.ts` (GET): reenvía a
`${FR_BASE}/v1/reconcile?min_score=...&limit=...&sources=...`. Mismo patrón:
proteger con tu auth → `fetch` con `frHeaders()` → passthrough del JSON.

## 5) Anti-duplicado en el formulario de registro (cliente)

Cuando el usuario elige la foto de una persona buscada, llama al proxy y, si hay
coincidencia, muestra un aviso. **No bloquea** el envío.

```tsx
async function onPhotoChosen(dataUrl: string) {
  const r = await fetch("/api/fr/check-duplicate", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ photo: dataUrl }),
  });
  const d = await r.json();
  if (d?.possible_duplicate && d.candidates?.length) {
    // Muestra: "Creemos que esta persona ya podría estar registrada. ¿Es la misma?"
    // con d.candidates[i].image_url / person_name / score / source y botones Sí/No.
    // "No" oculta el aviso; en ambos casos el usuario puede continuar.
  }
}
```

Tras crear el reporte en TU base, indexa la foto (en tu server action / handler):

```ts
import { frIndexPerson } from "@/lib/fr";
// ...después de guardar con éxito:
if (photoUrl) {
  await frIndexPerson({ externalId: nuevoId, imageUrl: photoUrl, name, location });
}
```

## 6) Cruzar TU base y detectar duplicados (script)

```ts
const FR = process.env.FR_API_URL, KEY = process.env.FR_API_KEY, SOURCE = "TU_FUENTE";
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// 1) Indexa toda tu base (idempotente, reanudable)
for (const p of await db.personas()) {            // ajusta a tu BD
  if (!p.foto_url) continue;
  const fd = new FormData();
  fd.append("external_id", String(p.id));
  fd.append("source", SOURCE);
  fd.append("person_name", p.nombre ?? "");
  fd.append("last_seen_location", p.ubicacion ?? "");
  fd.append("image_url", p.foto_url);
  await fetch(`${FR}/v1/index`, { method: "POST", headers: { "X-API-Key": KEY! }, body: fd });
  await sleep(550);                               // respeta 120/min
}

// 2) Pide los duplicados de TU base (pasa el MISMO source)
const dups = await (await fetch(
  `${FR}/v1/duplicates?source=${SOURCE}&min_score=0.6&limit=500`,
  { headers: { "X-API-Key": KEY! } },
)).json();
// dups.duplicates: [{ a, b, score, a_name, b_name, a_image, b_image }]  -> revisión humana
```

> `/v1/duplicates` revisa hasta 500 registros por llamada. Para bases mayores con
> cobertura total, haz una búsqueda por registro (`POST /v1/search`) y filtra los
> resultados con `source === "TU_FUENTE"` y `score` alto (excluyendo el propio id).

## 7) Endpoints (resumen)

| Método | Ruta | `source` | Para qué |
|---|---|---|---|
| POST | `/v1/check-duplicate` | salida | Foto → ¿ya registrada? (campo `file`) |
| POST | `/v1/search` | salida | Foto → parecidos (top-10) (campo `file`) |
| POST | `/v1/index` | entrada (opc) | Sube un registro (`external_id`, `file`\|`image_url`, …) |
| GET | `/v1/duplicates?source=` | entrada | Pares duplicados dentro de UNA base |
| GET | `/v1/reconcile?sources=` | entrada (opc) | Misma persona entre bases distintas |
| GET | `/health` · `/openapi.json` | — | Públicas |

`source` es **salida** cuando comparas una foto (te dice de qué base viene cada
match) y **entrada** cuando depuras/concilias bases.

## Piso de score 0.51 y multi-rostro (recuadros)

- **Piso 0.51:** `/v1/check-duplicate` y `/v1/search` solo devuelven matches con
  `score >= 0.51` ("trae solo lo más cercano"). Ajustable por petición con
  `?min_score=`. Cada respuesta trae el `min_score` aplicado. `band`: `alta`≥0.50
  (con el piso 0.51, en la práctica todo lo devuelto es `alta`).
- **Multi-rostro:** si la imagen tiene varias personas, la respuesta incluye un
  arreglo `faces` con una entrada por rostro: `bbox` `[x1,y1,x2,y2]` (px de la
  imagen enviada), `matched` (bool), `color` (`green`=coincide / `yellow`=no),
  `best_score`, `candidates`. Úsalo para **dibujar recuadros** verde/amarillo.
  El indexado (`/v1/index`) también guarda **todas** las caras de una foto grupal,
  así una foto con varias personas es buscable por cada una.

## 8) Checklist (valida al terminar)

- [ ] `FR_API_KEY` en env del servidor; **no** aparece en bundles del cliente.
- [ ] Existen rutas proxy; el cliente NUNCA llama al FR-API directamente.
- [ ] `check-duplicate` no bloquea el registro (maneja 422 y errores → continuar).
- [ ] Al crear un reporte con foto, se llama a `/v1/index` (best-effort).
- [ ] Backfill y `/v1/duplicates` usan el **mismo** `source`.
- [ ] Las rutas de búsqueda/duplicados/conciliación están detrás de tu auth.
- [ ] Prueba: `curl $FR_API_URL/health` → `{"ok":true,...}`.

## 9) Referencia completa

- Página de desarrolladores: https://reportavnzla.com/desarrolladores/fr
- OpenAPI (JSON): https://reportavnzla.com/api/fr/openapi
- Guía detallada (Markdown): https://reportavnzla.com/fr-api-docs.md
