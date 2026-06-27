import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'API de Reconocimiento Facial — para desarrolladores · ReportaVNZLA',
  description:
    'Documentación de la API de reconocimiento facial (FR-API) de ReportaVNZLA: cotejo de rostros, búsqueda de parecidos, deduplicación y conciliación entre bases. Descarga el esquema OpenAPI y la guía.',
}

const FR_BASE = 'https://fr-api.reportavnzla.com:8443'

type Endpoint = {
  method: string
  path: string
  auth: boolean
  desc: string
}

const ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/health', auth: false, desc: 'Estado del servicio y de la colección vectorial.' },
  { method: 'GET', path: '/openapi.json', auth: false, desc: 'Esquema OpenAPI público (también proxeado en /api/fr/openapi).' },
  { method: 'POST', path: '/v1/check-duplicate', auth: true, desc: 'Sube una foto → ¿ya hay una persona registrada con ese rostro?' },
  { method: 'POST', path: '/v1/search', auth: true, desc: 'Sube una foto → lista de personas parecidas con su score.' },
  { method: 'GET', path: '/v1/duplicates?source=', auth: true, desc: 'Cruza una fuente contra la base y lista posibles duplicados.' },
  { method: 'GET', path: '/v1/reconcile', auth: true, desc: 'Concilia la misma persona entre bases DISTINTAS y trae sus imágenes de cada base.' },
  { method: 'POST', path: '/v1/index', auth: true, desc: 'Indexa un registro nuevo (embeddings + payload).' },
  { method: 'POST', path: '/v1/index/commit', auth: true, desc: 'Confirma/persiste el lote de indexación.' },
  { method: 'GET', path: '/v1/groups', auth: true, desc: 'Lista los grupos (clusters de identidad) conocidos.' },
  { method: 'GET', path: '/v1/groups/{id}/cluster', auth: true, desc: 'Devuelve los miembros de un grupo/cluster concreto.' },
]

const MODES = [
  {
    n: '1',
    title: 'Cotejo (check-duplicate)',
    body: 'Subes una foto y el servicio responde si ya existe una persona registrada con ese rostro. Útil al dar de alta un reporte para no crear duplicados.',
  },
  {
    n: '2',
    title: 'Búsqueda (search)',
    body: 'Subes una foto y obtienes la lista de personas más parecidas ordenadas por score. Asistivo: siempre requiere verificación humana.',
  },
  {
    n: '3',
    title: 'Deduplicación (duplicates)',
    body: 'Cruzas una fuente completa contra la base y obtienes los pares de registros que probablemente sean la misma persona.',
  },
  {
    n: '4',
    title: 'Conciliación (reconcile)',
    body: 'Concilia rostros entre TODAS las bases de datos distintas, sin filtrar por fuente, para unificar identidades repartidas entre plataformas.',
  },
  {
    n: '5',
    title: 'Ingesta (index / commit)',
    body: 'Indexas registros nuevos con su embedding y metadatos (nombre, edad, contacto, ubicación, imagen) para que entren al índice vectorial.',
  },
]

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-gray-900 rounded-lg p-4 text-sm text-green-400 overflow-x-auto whitespace-pre">
      <code>{children}</code>
    </pre>
  )
}

const CURL_CHECK = `curl -X POST "${FR_BASE}/v1/check-duplicate" \\
  -H "X-API-Key: TU_API_KEY" \\
  -F "file=@foto.jpg"`

const CURL_RECONCILE = `# Concilia la misma persona entre bases distintas (azure ↔ reportavnzla, etc.)
curl "${FR_BASE}/v1/reconcile?min_score=0.55&limit=800" \\
  -H "X-API-Key: TU_API_KEY"
# opcional: limita a ciertas fuentes con &sources=azure,reportavnzla`

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
            <a
              href="/api/fr/openapi"
              download
              className="bg-white text-red-800 px-6 py-2 rounded-lg font-semibold hover:bg-red-50 transition"
            >
              ⬇ Descargar OpenAPI (JSON)
            </a>
            <a
              href="/fr-api-docs.md"
              download
              className="border-2 border-white text-white px-6 py-2 rounded-lg font-semibold hover:bg-white/10 transition"
            >
              ⬇ Descargar guía (Markdown)
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12 space-y-12">
        {/* Qué es */}
        <section className="bg-white rounded-xl p-8 shadow-sm border">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">¿Qué es el FR-API?</h2>
          <p className="text-gray-600 mb-4">
            El FR-API es un servicio de reconocimiento facial que convierte cada rostro en un vector
            de 512 dimensiones y los compara por similitud de coseno sobre una base vectorial. Permite
            detectar si dos fotos corresponden a la misma persona, aunque provengan de plataformas
            distintas. Su objetivo es ayudar a <strong>cruzar y unificar</strong> reportes de personas
            desaparecidas tras el terremoto de Venezuela 2026.
          </p>
          <p className="text-sm text-gray-500">
            Es una herramienta <strong>asistiva</strong>: los resultados se entregan con un score de
            similitud y siempre deben ser confirmados por una persona antes de tomar decisiones.
          </p>
        </section>

        {/* Modos */}
        <section>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Modos de uso</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MODES.map((m) => (
              <div key={m.n} className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="flex items-center gap-3 mb-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-700 font-bold">
                    {m.n}
                  </span>
                  <h3 className="font-semibold text-gray-800">{m.title}</h3>
                </div>
                <p className="text-sm text-gray-600">{m.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Base URL */}
        <section>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">URL Base</h2>
          <div className="bg-gray-900 rounded-lg p-4 font-mono text-green-400 text-sm overflow-x-auto">
            {FR_BASE}
          </div>
          <p className="text-gray-500 text-sm mt-2">
            Todas las respuestas son JSON. El esquema OpenAPI público está en{' '}
            <code className="text-red-700">{FR_BASE}/openapi.json</code>.
          </p>
        </section>

        {/* Autenticación */}
        <section>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Autenticación</h2>
          <p className="text-gray-600 mb-3">
            Las rutas <code className="text-red-700">/v1/*</code> requieren una API key. Tu backend (el
            del partner) debe enviarla en el header <code className="text-red-700">X-API-Key</code>.
            <strong> Nunca</strong> incluyas la clave en código que corra en el navegador: realiza las
            llamadas desde tu servidor.
          </p>
          <CodeBlock>{`X-API-Key: TU_API_KEY`}</CodeBlock>
          <p className="text-gray-500 text-sm mt-2">
            Las rutas públicas (<code className="text-red-700">/health</code>,{' '}
            <code className="text-red-700">/openapi.json</code>) no necesitan clave.
          </p>
        </section>

        {/* Endpoints */}
        <section id="endpoints">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Endpoints</h2>
          <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Método</th>
                  <th className="px-4 py-3 font-semibold">Ruta</th>
                  <th className="px-4 py-3 font-semibold">Auth</th>
                  <th className="px-4 py-3 font-semibold">Descripción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ENDPOINTS.map((e) => (
                  <tr key={`${e.method} ${e.path}`} className="align-top">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${
                          e.method === 'GET' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {e.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-800 whitespace-nowrap">{e.path}</td>
                    <td className="px-4 py-3">
                      {e.auth ? (
                        <span className="text-xs font-semibold text-red-700">API key</span>
                      ) : (
                        <span className="text-xs text-gray-400">pública</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{e.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Ejemplos */}
        <section>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Ejemplos (curl)</h2>

          <h3 className="font-semibold text-gray-800 mb-2">Cotejo — /v1/check-duplicate</h3>
          <p className="text-gray-600 text-sm mb-3">
            Envía una foto como <code className="text-red-700">multipart/form-data</code> en el campo{' '}
            <code className="text-red-700">file</code>.
          </p>
          <CodeBlock>{CURL_CHECK}</CodeBlock>

          <h3 className="font-semibold text-gray-800 mb-2 mt-8">Conciliación — /v1/reconcile</h3>
          <p className="text-gray-600 text-sm mb-3">
            Encuentra a la <b>misma persona</b> reportada en bases distintas y devuelve <b>sus imágenes de cada base</b>.
            Ajusta <code className="text-red-700">min_score</code> (similitud mínima) y <code className="text-red-700">limit</code>;
            opcionalmente <code className="text-red-700">sources=A,B</code> para limitar las fuentes.
          </p>
          <CodeBlock>{CURL_RECONCILE}</CodeBlock>
        </section>

        {/* Descargas */}
        <section className="bg-gradient-to-r from-red-50 to-rose-50 rounded-xl p-8 border">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Documentación descargable</h2>
          <p className="text-gray-600 mb-6">
            Importa el esquema OpenAPI en tu cliente (Postman, Insomnia, openapi-generator) o lee la guía
            completa en Markdown.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="/api/fr/openapi"
              download
              className="bg-red-700 text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-800 transition"
            >
              ⬇ Descargar OpenAPI (JSON)
            </a>
            <a
              href="/fr-api-docs.md"
              download
              className="border-2 border-red-700 text-red-700 px-6 py-2 rounded-lg font-semibold hover:bg-red-50 transition"
            >
              ⬇ Descargar guía (Markdown)
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}
