import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'API de Reconocimiento Facial — para desarrolladores · ReportaVNZLA',
  description:
    'Documentación de la API de reconocimiento facial (FR-API) de ReportaVNZLA: cotejo de rostros, búsqueda de parecidos, deduplicación y conciliación entre bases. Cruza tu base de datos para detectar duplicados. Descarga el esquema OpenAPI y la guía.',
}

const FR_BASE = 'https://fr-api.reportavnzla.com:8443'
const FR_ALIAS = 'https://reportavnzla.com/fr-api'

type Endpoint = {
  method: string
  path: string
  auth: boolean
  params?: string
  desc: string
}

const ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/health', auth: false, desc: 'Estado del servicio y de la colección vectorial.' },
  { method: 'GET', path: '/openapi.json', auth: false, desc: 'Esquema OpenAPI público (también en /api/fr/openapi).' },
  { method: 'GET', path: '/v1/whoami', auth: true, desc: 'Autodiagnóstico: valida tu key y devuelve tu source, cuántos registros tienes indexados y el min_score. Empieza por aquí.' },
  { method: 'POST', path: '/v1/check-duplicate', auth: true, params: 'file', desc: 'Foto → ¿ya hay una persona registrada con ese rostro? (anti-duplicado al registrar).' },
  { method: 'POST', path: '/v1/search', auth: true, params: 'file', desc: 'Foto → personas más parecidas (top-10) con su score y su source. Busca en TODAS las bases.' },
  { method: 'POST', path: '/v1/index', auth: true, params: 'external_id, file|image_url, person_name?, last_seen_location?, age?, contact_phone?, source?', desc: 'Sube/indexa UN registro de tu base. Idempotente por external_id.' },
  { method: 'POST', path: '/v1/index/commit', auth: true, desc: 'Cierre de lote (no-op con el backend actual; devuelve el total).' },
  { method: 'GET', path: '/v1/duplicates', auth: true, params: 'source?, min_score=0.6, limit=500', desc: 'Cruza UNA base contra sí misma → pares duplicados. source = el mismo con que indexaste (default = etiqueta de tu key).' },
  { method: 'GET', path: '/v1/reconcile', auth: true, params: 'min_score=0.55, limit=800, sources?', desc: 'Misma persona entre bases DISTINTAS → grupos con las imágenes de cada base.' },
  { method: 'GET', path: '/v1/groups', auth: true, params: 'limit=20, offset=0, q?', desc: 'Lista de grupos/clusters de identidad.' },
  { method: 'GET', path: '/v1/groups/{id}/cluster', auth: true, desc: 'Miembros de un grupo/cluster concreto.' },
]

const MODES = [
  { n: '1', title: 'Cotejo (check-duplicate)', body: 'Subes una foto y el servicio responde si ya existe una persona registrada con ese rostro. Útil al dar de alta un reporte para no crear duplicados.' },
  { n: '2', title: 'Búsqueda (search)', body: 'Subes una foto y obtienes la lista de personas más parecidas ordenadas por score. Asistivo: siempre requiere verificación humana.' },
  { n: '3', title: 'Deduplicación (duplicates)', body: 'Cruzas tu base contra sí misma y obtienes los pares de registros que probablemente sean la misma persona.' },
  { n: '4', title: 'Conciliación (reconcile)', body: 'Encuentra a la misma persona reportada en bases DISTINTAS y trae sus imágenes de cada base, para unificar identidades entre plataformas.' },
  { n: '5', title: 'Ingesta (index)', body: 'Subes tus registros (foto + metadatos) al índice vectorial para que sean buscables y comparables por rostro.' },
]

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-gray-900 rounded-lg p-4 text-sm text-green-400 overflow-x-auto whitespace-pre">
      <code>{children}</code>
    </pre>
  )
}

function H2({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="text-2xl font-bold text-gray-800 mb-4 scroll-mt-20">
      {children}
    </h2>
  )
}

const CURL_WHOAMI = `# Paso 0: ¿tu key sirve? ¿qué source y cuántos indexados tienes?
curl "${FR_BASE}/v1/whoami" -H "X-API-Key: TU_API_KEY"
# 401 = key inválida/truncada (deben ser 48 caracteres)
# -> { "key_label":"…", "source_default":"…", "indexed_my_source":0,
#      "min_score_default":0.51, "reference_threshold":0.35 }`

const CURL_CHECK = `curl -X POST "${FR_BASE}/v1/check-duplicate" \\
  -H "X-API-Key: TU_API_KEY" \\
  -F "file=@foto.jpg"`

const RESP_CHECK = `{
  "ok": true, "faces_detected": 1,
  "possible_duplicate": true, "best_score": 0.97,
  "candidates": [
    { "record_id": "tu-fuente:123", "person_name": "Katherine Mendoza",
      "last_seen_location": "Catia la Mar", "image_url": "https://…",
      "score": 0.97, "band": "alta", "source": "reportavnzla" }
  ]
}`

const RESP_FACES = `{
  "ok": true, "faces_detected": 2, "min_score": 0.51,
  "possible_duplicate": true,
  "faces": [
    { "bbox": [67,117,132,215], "matched": true,  "color": "green",
      "best_score": 0.99, "band": "alta", "candidates": [ /* … */ ] },
    { "bbox": [240,110,300,205], "matched": false, "color": "yellow",
      "best_score": 0.0, "band": null, "candidates": [] }
  ],
  "candidates": [ /* coincidencias agregadas de todos los rostros, score >= 0.51 */ ]
}`

const CURL_INDEX = `# Sube/indexa UN registro de tu base. Idempotente por external_id (tu id).
curl -X POST "${FR_BASE}/v1/index" \\
  -H "X-API-Key: TU_API_KEY" \\
  -F "external_id=ID_EN_TU_BD" \\
  -F "person_name=Katherine Mendoza" \\
  -F "last_seen_location=Catia la Mar" \\
  -F "image_url=https://tu-cdn/fotos/123.jpg"   # o  -F "file=@foto.jpg"
# -> {"ok":true,"indexed":true,"record_id":"tu-fuente:ID_EN_TU_BD"}`

const CURL_DUPLICATES = `# Cruza TU base por rostro y lista pares duplicados.
# "source" debe ser EL MISMO con que indexaste (paso 1). Por defecto es la
# etiqueta de tu API key; si indexaste con otro source, pásalo igual aquí.
curl "${FR_BASE}/v1/duplicates?source=TU_FUENTE&min_score=0.6&limit=500" \\
  -H "X-API-Key: TU_API_KEY"`

const RESP_DUPLICATES = `{
  "checked": 500,
  "duplicates": [
    { "a": "tu-fuente:12", "b": "tu-fuente:88", "score": 0.94,
      "a_name": "José Pérez",  "b_name": "Jose Perez",
      "a_image": "https://…",  "b_image": "https://…" }
  ]
}`

const CURL_RECONCILE = `# Misma persona en bases distintas (azure ↔ reportavnzla ↔ …)
curl "${FR_BASE}/v1/reconcile?min_score=0.55&limit=800" \\
  -H "X-API-Key: TU_API_KEY"
# opcional: limita a ciertas fuentes con &sources=azure,tu-fuente`

const JS_BACKFILL = `const FR  = "${FR_BASE}";
const KEY = "TU_API_KEY";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 1) trae TUS registros (ajusta a tu BD)
const personas = await db.query(
  "SELECT id, nombre, ubicacion, foto_url FROM personas"
);

// 2) súbelos al índice (idempotente; reanudable)
for (const p of personas) {
  if (!p.foto_url) continue;                  // sin foto no se compara
  const fd = new FormData();
  fd.append("external_id", String(p.id));     // tu id → no duplica
  fd.append("person_name", p.nombre ?? "");
  fd.append("last_seen_location", p.ubicacion ?? "");
  fd.append("image_url", p.foto_url);
  const r = await fetch(FR + "/v1/index",
    { method: "POST", headers: { "X-API-Key": KEY }, body: fd });
  console.log(p.id, (await r.json()).indexed ? "ok" : "sin-rostro");
  await sleep(550);                            // ~110/min < límite 120/min
}`

const JS_DEDUP_FULL = `// Cobertura TOTAL (bases > 500): una búsqueda por registro.
const UMBRAL = 0.6, vistos = new Set(), duplicados = [];

for (const p of personas) {
  if (!p.foto_url) continue;
  const fd = new FormData();
  fd.append("file", await (await fetch(p.foto_url)).blob());
  const { results = [] } = await (await fetch(FR + "/v1/search",
    { method: "POST", headers: { "X-API-Key": KEY }, body: fd })).json();

  for (const m of results) {
    const yoMismo = m.record_id === "tu-fuente:" + p.id;
    if (yoMismo || m.score < UMBRAL) continue;
    if (m.source === "tu-fuente") {            // duplicado DENTRO de tu base
      const k = [String(p.id), m.record_id].sort().join("|");
      if (!vistos.has(k)) { vistos.add(k); duplicados.push({ a: p.id, b: m.record_id, score: m.score }); }
    }
    // m.source !== "tu-fuente"  → la misma persona en OTRA plataforma
  }
  await sleep(550);
}
console.table(duplicados);   // pares para revisión humana`

export default function FRDevelopersPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-800 to-red-600 text-white py-16">
        <div className="max-w-5xl mx-auto px-4">
          <a href="/desarrolladores" className="text-sm text-red-100 hover:text-white transition">
            ← Volver a la API para desarrolladores
          </a>
          <h1 className="text-4xl font-bold mt-4">API de Reconocimiento Facial</h1>
          <p className="text-xl text-red-100 max-w-2xl mt-3">
            FR-API: cotejo de rostros, búsqueda de parecidos, deduplicación y conciliación de
            identidades entre bases de datos. Asistivo — siempre requiere verificación humana.
          </p>
          <div className="flex flex-wrap gap-4 mt-6">
            <a href="/api/fr/openapi" download className="bg-white text-red-800 px-6 py-2 rounded-lg font-semibold hover:bg-red-50 transition">
              ⬇ Descargar OpenAPI (JSON)
            </a>
            <a href="/fr-api-docs.md" download className="border-2 border-white text-white px-6 py-2 rounded-lg font-semibold hover:bg-white/10 transition">
              ⬇ Descargar guía (Markdown)
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12 space-y-12">
        {/* Qué es */}
        <section className="bg-white rounded-xl p-8 shadow-sm border">
          <H2>¿Qué es el FR-API?</H2>
          <p className="text-gray-600 mb-4">
            El FR-API convierte cada rostro en un vector de 512 dimensiones y los compara por
            similitud de coseno sobre una base vectorial. Detecta si dos fotos corresponden a la
            misma persona, aunque provengan de plataformas distintas. Su objetivo es ayudar a{' '}
            <strong>cruzar y unificar</strong> reportes de personas desaparecidas tras el terremoto
            de Venezuela 2026.
          </p>
          <p className="text-sm text-gray-500">
            Es <strong>asistivo</strong>: cada resultado trae un score de similitud y siempre debe
            confirmarse por una persona antes de tomar decisiones (fusionar, eliminar, contactar).
          </p>
        </section>

        {/* Modos */}
        <section>
          <H2>Modos de uso</H2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MODES.map((m) => (
              <div key={m.n} className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-3 mb-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-700 font-bold">{m.n}</span>
                  <h3 className="font-semibold text-gray-800">{m.title}</h3>
                </div>
                <p className="text-sm text-gray-600">{m.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Base URL */}
        <section>
          <H2>URL Base</H2>
          <div className="bg-gray-900 rounded-lg p-4 font-mono text-green-400 text-sm overflow-x-auto">{FR_BASE}</div>
          <ul className="text-gray-600 text-sm mt-3 space-y-1 list-disc pl-5">
            <li>Todas las respuestas son JSON. OpenAPI público en <code className="text-red-700">{FR_BASE}/openapi.json</code>.</li>
            <li>Soporta fotos grandes (decenas de MB). <strong>Alias</strong> para cargas pequeñas: <code className="text-red-700">{FR_ALIAS}</code> (límite 4.5 MB/archivo).</li>
            <li><strong>Rate-limit:</strong> 120 peticiones/min por clave.</li>
          </ul>
        </section>

        {/* Autenticación */}
        <section>
          <H2>Autenticación</H2>
          <p className="text-gray-600 mb-3">
            Las rutas <code className="text-red-700">/v1/*</code> requieren API key en el header{' '}
            <code className="text-red-700">X-API-Key</code>. <strong>Nunca</strong> la incluyas en
            código que corra en el navegador: llama al FR-API <strong>desde tu servidor</strong>
            (patrón servidor-a-servidor). Las rutas <code className="text-red-700">/health</code> y{' '}
            <code className="text-red-700">/openapi.json</code> son públicas.
          </p>
          <CodeBlock>{`X-API-Key: TU_API_KEY`}</CodeBlock>
        </section>

        {/* Primer paso: validar config */}
        <section className="bg-blue-50 rounded-xl p-8 border border-blue-200">
          <H2>Paso 0 — Valida tu configuración (evita el 90% de los problemas)</H2>
          <p className="text-gray-700 mb-4">
            Antes de integrar, confirma que tu <code className="text-red-700">.env</code> está bien.
            Descarga <strong>fr-doctor</strong> (script sin dependencias) y córrelo en la carpeta de
            tu <code className="text-red-700">.env</code> — te dice en segundos si la key autentica,
            si tu <code className="text-red-700">FR_SOURCE</code> coincide y si ya indexaste datos:
          </p>
          <div className="flex flex-wrap gap-3 mb-5">
            <a href="/fr-doctor.py" download className="bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold hover:bg-blue-800 transition">
              ⬇ Descargar fr-doctor.py
            </a>
          </div>
          <CodeBlock>{`python fr-doctor.py            # lee tu .env y diagnostica`}</CodeBlock>
          <p className="text-gray-600 text-sm mt-4 mb-2">O a mano, con <code className="text-red-700">/v1/whoami</code>:</p>
          <CodeBlock>{CURL_WHOAMI}</CodeBlock>
        </section>

        {/* El FR no lee tu BD */}
        <section className="bg-amber-50 rounded-xl p-8 border border-amber-200">
          <H2>Importante: el FR-API NO consulta tu base de datos</H2>
          <p className="text-gray-700">
            El FR-API es un <strong>índice vectorial centralizado</strong>. <strong>No</strong> se
            conecta a tu Neon/Supabase/Postgres. Solo encuentra caras que <strong>tú</strong> hayas
            subido con <code className="text-red-700">POST /v1/index</code>.
          </p>
          <p className="text-gray-700 mt-3">
            Flujo: <code className="text-red-700">tu BD → /v1/index → índice del FR-API → /v1/check-duplicate busca ahí</code>.
            Si nunca indexaste, <code className="text-red-700">check-duplicate</code> siempre dirá
            “sin duplicado” (no hay con qué comparar). Haz el <a href="#cruzar" className="text-red-700 underline">backfill</a> primero.
          </p>
        </section>

        {/* source: entrada vs salida */}
        <section className="bg-amber-50 rounded-xl p-8 border border-amber-200">
          <H2>El parámetro <code className="text-red-700">source</code>: entrada vs. salida</H2>
          <p className="text-gray-700 mb-4">
            <code className="text-red-700">source</code> es la etiqueta de la plataforma de origen de
            un registro. Significa cosas distintas según el endpoint:
          </p>
          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr><th className="px-4 py-2 font-semibold">Endpoint</th><th className="px-4 py-2 font-semibold">source</th><th className="px-4 py-2 font-semibold">Qué significa</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                <tr><td className="px-4 py-2 font-mono">POST /v1/search</td><td className="px-4 py-2"><b className="text-green-700">salida</b></td><td className="px-4 py-2">En cada resultado: de qué base viene ese parecido. No se envía.</td></tr>
                <tr><td className="px-4 py-2 font-mono">POST /v1/check-duplicate</td><td className="px-4 py-2"><b className="text-green-700">salida</b></td><td className="px-4 py-2">En cada candidato: de qué base es. No se envía.</td></tr>
                <tr><td className="px-4 py-2 font-mono">POST /v1/index</td><td className="px-4 py-2"><b className="text-blue-700">entrada (opc.)</b></td><td className="px-4 py-2">Etiqueta de TU plataforma al subir un registro. Default = la de tu key.</td></tr>
                <tr><td className="px-4 py-2 font-mono">GET /v1/duplicates?source=</td><td className="px-4 py-2"><b className="text-blue-700">entrada</b></td><td className="px-4 py-2">Qué base depurar (pares dentro de UNA base). Sin él = tu propia base.</td></tr>
                <tr><td className="px-4 py-2 font-mono">GET /v1/reconcile?sources=</td><td className="px-4 py-2"><b className="text-blue-700">entrada (opc.)</b></td><td className="px-4 py-2">Limitar la conciliación a ciertas bases.</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-gray-600 text-sm mt-4">
            <strong>Regla simple:</strong> comparar una foto (search / check-duplicate) → <strong>no</strong>{' '}
            mandas <code className="text-red-700">source</code>; depurar o conciliar bases → <strong>sí</strong>{' '}
            indicas la(s) fuente(s).
          </p>
        </section>

        {/* Flujo: cruzar tu base */}
        <section className="bg-white rounded-xl p-8 shadow-sm border">
          <H2 id="cruzar">Cruzar tu base de datos y detectar duplicados</H2>
          <p className="text-gray-600 mb-6">
            Dos pasos: <strong>(1)</strong> subes tus registros al índice una vez, y{' '}
            <strong>(2)</strong> pides los duplicados. Re-ejecuta el paso 1 al agregar registros
            nuevos (es idempotente, solo añade lo nuevo).
          </p>

          <h3 className="font-semibold text-gray-800 mb-2">Paso 1 — Indexar tu base</h3>
          <p className="text-gray-600 text-sm mb-3">
            Un <code className="text-red-700">POST /v1/index</code> por persona. Solo entran fotos con
            rostro (las demás devuelven <code className="text-red-700">indexed:false</code>, sin fallar).
          </p>
          <CodeBlock>{CURL_INDEX}</CodeBlock>
          <p className="text-gray-600 text-sm mt-4 mb-2">Recorriendo tu BD (Node.js):</p>
          <CodeBlock>{JS_BACKFILL}</CodeBlock>

          <h3 className="font-semibold text-gray-800 mb-2 mt-8">Paso 2 — Pedir los duplicados</h3>
          <p className="text-gray-600 text-sm mb-3">
            <strong>Opción rápida:</strong> <code className="text-red-700">/v1/duplicates</code> te
            devuelve los pares (con los dos ids de tu BD, el score y las dos fotos para revisar). Pasa
            el mismo <code className="text-red-700">source</code> con que indexaste en el paso 1.
          </p>
          <CodeBlock>{CURL_DUPLICATES}</CodeBlock>
          <CodeBlock>{RESP_DUPLICATES}</CodeBlock>
          <p className="text-amber-700 text-sm mt-3 rounded-lg bg-amber-50 px-3 py-2 border border-amber-200">
            ⚠️ <code className="text-red-700">/v1/duplicates</code> revisa hasta <strong>500 registros</strong> por
            llamada. Si tu base es mayor y quieres cobertura total con un solo endpoint, escríbenos para
            subir el límite/añadir paginación — o usa la opción de abajo.
          </p>
          <p className="text-gray-600 text-sm mt-5 mb-2">
            <strong>Opción de cobertura total</strong> (bases &gt; 500): una búsqueda por registro;
            de paso detecta si la persona está también en <strong>otras plataformas</strong>.
          </p>
          <CodeBlock>{JS_DEDUP_FULL}</CodeBlock>

          <h3 className="font-semibold text-gray-800 mb-2 mt-8">Paso 3 — Revisar (humano) y limpiar</h3>
          <p className="text-gray-600 text-sm">
            Empieza por los pares de banda <strong>alta</strong>. Muestra las dos fotos a un revisor;
            si confirma, fusionas/eliminas en <strong>tu</strong> BD. El FR no borra nada por ti.
          </p>
        </section>

        {/* Endpoints */}
        <section id="endpoints">
          <H2>Endpoints</H2>
          <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Método</th>
                  <th className="px-4 py-3 font-semibold">Ruta</th>
                  <th className="px-4 py-3 font-semibold">Auth</th>
                  <th className="px-4 py-3 font-semibold">Parámetros</th>
                  <th className="px-4 py-3 font-semibold">Descripción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ENDPOINTS.map((e) => (
                  <tr key={`${e.method} ${e.path}`} className="align-top">
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${e.method === 'GET' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{e.method}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-800 whitespace-nowrap">{e.path}</td>
                    <td className="px-4 py-3">
                      {e.auth ? <span className="text-xs font-semibold text-red-700">API key</span> : <span className="text-xs text-gray-400">pública</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{e.params || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{e.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Ejemplos */}
        <section>
          <H2>Ejemplos (curl)</H2>

          <h3 className="font-semibold text-gray-800 mb-2">Cotejo — /v1/check-duplicate</h3>
          <p className="text-gray-600 text-sm mb-3">
            Foto como <code className="text-red-700">multipart/form-data</code> en el campo{' '}
            <code className="text-red-700">file</code>. <code className="text-red-700">422</code> = sin
            rostro (deja registrar igual).
          </p>
          <CodeBlock>{CURL_CHECK}</CodeBlock>
          <p className="text-gray-600 text-sm mt-3 mb-2">Respuesta:</p>
          <CodeBlock>{RESP_CHECK}</CodeBlock>

          <h3 className="font-semibold text-gray-800 mb-2 mt-8">Conciliación — /v1/reconcile</h3>
          <p className="text-gray-600 text-sm mb-3">
            Encuentra a la <b>misma persona</b> reportada en bases distintas y devuelve <b>sus imágenes
            de cada base</b>. Ajusta <code className="text-red-700">min_score</code> y{' '}
            <code className="text-red-700">limit</code>; opcional <code className="text-red-700">sources=A,B</code>.
          </p>
          <CodeBlock>{CURL_RECONCILE}</CodeBlock>
        </section>

        {/* Bandas */}
        <section>
          <H2>Score y bandas</H2>
          <p className="text-gray-600 mb-3">
            Cada coincidencia trae un <code className="text-red-700">score</code> (0–1, similitud de
            coseno) y una <code className="text-red-700">band</code>:
          </p>
          <div className="flex flex-wrap gap-3">
            <span className="rounded-full bg-green-100 text-green-700 px-3 py-1 text-sm font-semibold">alta ≥ 0.50</span>
            <span className="rounded-full bg-amber-100 text-amber-700 px-3 py-1 text-sm font-semibold">media 0.35 – 0.50</span>
            <span className="rounded-full bg-gray-100 text-gray-600 px-3 py-1 text-sm font-semibold">baja &lt; 0.35</span>
          </div>
          <p className="text-gray-500 text-sm mt-3">
            <strong>Piso de 0.51:</strong> <code className="text-red-700">/v1/check-duplicate</code> y{' '}
            <code className="text-red-700">/v1/search</code> solo devuelven coincidencias con{' '}
            <code className="text-red-700">score ≥ 0.51</code> (trae solo lo más cercano). Puedes
            ajustarlo por petición con <code className="text-red-700">?min_score=</code>.
          </p>
        </section>

        {/* Multi-rostro y recuadros */}
        <section className="bg-white rounded-xl p-8 shadow-sm border">
          <H2>Multi-rostro y recuadros (verde / amarillo)</H2>
          <p className="text-gray-600 mb-4">
            Si la imagen tiene <strong>varias personas</strong>, se coteja <strong>cada rostro</strong>.
            La respuesta de <code className="text-red-700">/v1/check-duplicate</code> y{' '}
            <code className="text-red-700">/v1/search</code> incluye un arreglo{' '}
            <code className="text-red-700">faces</code> con un elemento por rostro detectado, listo
            para dibujar recuadros: <span className="font-semibold text-green-700">verde</span> si
            coincide (≥ 0.51), <span className="font-semibold text-amber-600">amarillo</span> si no.
          </p>
          <CodeBlock>{RESP_FACES}</CodeBlock>
          <p className="text-gray-500 text-sm mt-3">
            <code className="text-red-700">bbox</code> = <code className="text-red-700">[x1,y1,x2,y2]</code>{' '}
            en píxeles de la imagen enviada. <code className="text-red-700">matched</code>/<code className="text-red-700">color</code>{' '}
            indican el recuadro; <code className="text-red-700">best_score</code> el mejor parecido de
            ese rostro; <code className="text-red-700">candidates</code> sus coincidencias.
          </p>
        </section>

        {/* Solución de problemas */}
        <section>
          <H2>Solución de problemas</H2>
          <div className="space-y-3">
            {[
              ['Registro / búsqueda sin error ni respuesta', 'Casi siempre la API key está mal copiada (truncada). Corre fr-doctor o GET /v1/whoami: un 401 confirma la key. Las claves son de 48 caracteres. Los proxies no rompen el registro, así que un 401 se ve como “sin coincidencias”.'],
              ['Siempre da possible_duplicate:false / 0 resultados', 'Probablemente no has indexado tu base. GET /v1/whoami → indexed_my_source. Si es 0, haz el backfill con POST /v1/index. El FR-API no lee tu BD.'],
              ['"Me sigue diciendo 0.35"', 'Es el campo threshold (referencia histórica) — NO controla nada. El piso real es min_score (0.51). Para cambiarlo, pasa ?min_score= en la petición; FR_MIN_SCORE en tu .env no aplica por sí solo.'],
              ['/v1/duplicates devuelve vacío', 'Tu source no coincide con el de indexación. Usa el mismo source con que indexaste (= source_default de /v1/whoami = la etiqueta de tu key), o pásalo explícito con ?source=.'],
              ['HTTP 429', 'Límite de 120 peticiones/min por clave. En backfills, separa ~550 ms entre llamadas.'],
            ].map(([q, a]) => (
              <details key={q} className="rounded-xl border bg-white p-4">
                <summary className="cursor-pointer font-semibold text-gray-800">{q}</summary>
                <p className="mt-2 text-sm text-gray-600">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Descargas */}
        <section className="bg-gradient-to-r from-red-50 to-rose-50 rounded-xl p-8 border">
          <H2>Documentación descargable</H2>
          <p className="text-gray-600 mb-6">
            Importa el esquema OpenAPI en tu cliente (Postman, Insomnia, openapi-generator), lee la
            guía completa, o entrega la <strong>guía para agentes de IA</strong> a tu equipo: es un
            archivo único con código de referencia (proxies, registro, backfill) para que un agente
            de IA replique la integración. Guárdalo en tu repo como{' '}
            <code className="text-red-700">AGENTS.md</code> o <code className="text-red-700">docs/FR-API.md</code>.
          </p>
          <div className="flex flex-wrap gap-4">
            <a href="/fr-api-agent-guide.md" download className="bg-red-700 text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-800 transition">
              ⬇ Guía para agentes de IA (Markdown)
            </a>
            <a href="/fr-doctor.py" download className="border-2 border-red-700 text-red-700 px-6 py-2 rounded-lg font-semibold hover:bg-red-50 transition">
              ⬇ fr-doctor.py (diagnóstico)
            </a>
            <a href="/api/fr/openapi" download className="border-2 border-red-700 text-red-700 px-6 py-2 rounded-lg font-semibold hover:bg-red-50 transition">
              ⬇ OpenAPI (JSON)
            </a>
            <a href="/fr-api-docs.md" download className="border-2 border-red-700 text-red-700 px-6 py-2 rounded-lg font-semibold hover:bg-red-50 transition">
              ⬇ Guía detallada (Markdown)
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}
