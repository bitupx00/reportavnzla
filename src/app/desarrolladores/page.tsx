import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'API para Desarrolladores — ReportaVNZLA',
  description: 'Documentación de la API pública de ReportaVNZLA. Integra datos de personas desaparecidas en tu plataforma.',
}

export default function DevelopersPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white py-16">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">🔧</span>
            <h1 className="text-4xl font-bold">API para Desarrolladores</h1>
          </div>
          <p className="text-xl text-blue-100 max-w-2xl">
            Documentación de la API pública de ReportaVNZLA. Conecta tu plataforma 
            y ayuda a cruzar información para encontrar personas desaparecidas.
          </p>
          <div className="flex gap-4 mt-6">
            <a href="#endpoints" className="bg-white text-blue-900 px-6 py-2 rounded-lg font-semibold hover:bg-blue-50 transition">
              Ver Endpoints
            </a>
            <a href="#integrar" className="border-2 border-white text-white px-6 py-2 rounded-lg font-semibold hover:bg-white/10 transition">
              ¿Cómo Integrar?
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12 space-y-12">
        
        {/* Mission */}
        <section className="bg-white rounded-xl p-8 shadow-sm border">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">🎯 Misión de la API</h2>
          <p className="text-gray-600 mb-4">
            La API de ReportaVNZLA permite a otras plataformas de búsqueda, organizaciones humanitarias
            y desarrolladores <strong>cruzar datos y sincronizar información</strong> sobre personas desaparecidas
            tras el terremoto de Venezuela 2026.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2">📥 Importar Datos</h3>
              <p className="text-sm text-blue-700">Envía registros de personas desde tu plataforma. Nos encargamos de deduplicar.</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <h3 className="font-semibold text-green-800 mb-2">📤 Exportar Datos</h3>
              <p className="text-sm text-green-700">Obtiene registros actualizados para cruzar con tu base de datos.</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <h3 className="font-semibold text-purple-800 mb-2">🔄 Sincronizar</h3>
              <p className="text-sm text-purple-700">Mantén tus datos actualizados con cambios de estado y nuevas informaciones.</p>
            </div>
          </div>
        </section>

        {/* Base URL */}
        <section>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">🌐 URL Base</h2>
          <div className="bg-gray-900 rounded-lg p-4 font-mono text-green-400 text-sm overflow-x-auto">
            https://reportavnzla.com/api/v1
          </div>
          <p className="text-gray-500 text-sm mt-2">
            Todas las respuestas son JSON. La API usa CORS para permitir solicitudes desde cualquier origen.
          </p>
        </section>

        {/* Authentication */}
        <section>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">🔑 Autenticación</h2>
          <p className="text-gray-600 mb-3">
            La API es <strong>pública y gratuita</strong> para fines humanitarios. No se requiere autenticación 
            para lecturas. Para escrituras (POST/PATCH), recomendamos incluir un header de identificación:
          </p>
          <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <code className="text-gray-300">X-Source: nombre-de-tu-plataforma</code>
          </div>
        </section>

        {/* Rate Limits */}
        <section>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">⚡ Límites de Uso</h2>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">Operación</th>
                  <th className="text-left p-3">Límite</th>
                  <th className="text-left p-3">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr><td className="p-3">GET (lectura)</td><td className="p-3">60 req/min</td><td className="p-3 text-gray-500">Cache: 60s</td></tr>
                <tr><td className="p-3">POST (crear)</td><td className="p-3">30 req/min</td><td className="p-3 text-gray-500">Max 100/batch</td></tr>
                <tr><td className="p-3">PATCH (actualizar)</td><td className="p-3">60 req/min</td><td className="p-3 text-gray-500">—</td></tr>
                <tr><td className="p-3">POST /sync</td><td className="p-3">10 req/min</td><td className="p-3 text-gray-500">Max 500/batch</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Endpoints */}
        <section id="endpoints">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">📡 Endpoints</h2>
          
          {/* GET /personas */}
          <div className="bg-white rounded-xl shadow-sm border mb-6 overflow-hidden">
            <div className="flex items-center gap-3 bg-green-50 px-6 py-3 border-b">
              <span className="bg-green-600 text-white px-2 py-0.5 rounded text-xs font-bold">GET</span>
              <code className="font-mono text-sm">/api/v1/personas</code>
              <span className="text-gray-500 text-sm ml-auto">Buscar personas</span>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-600">
                Obtiene una lista paginada de personas con filtros avanzados.
              </p>
              <h4 className="font-semibold">Parámetros de Query</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2">Parámetro</th>
                      <th className="text-left p-2">Tipo</th>
                      <th className="text-left p-2">Descripción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr><td className="p-2 font-mono">q</td><td className="p-2">string</td><td className="p-2">Búsqueda general (nombre, apellido, cédula, ubicación, descripción)</td></tr>
                    <tr><td className="p-2 font-mono">estado</td><td className="p-2">string</td><td className="p-2">buscado | encontrado | fallecido</td></tr>
                    <tr><td className="p-2 font-mono">cedula</td><td className="p-2">string</td><td className="p-2">Búsqueda parcial de cédula</td></tr>
                    <tr><td className="p-2 font-mono">nombre</td><td className="p-2">string</td><td className="p-2">Búsqueda parcial de nombre</td></tr>
                    <tr><td className="p-2 font-mono">apellido</td><td className="p-2">string</td><td className="p-2">Búsqueda parcial de apellido</td></tr>
                    <tr><td className="p-2 font-mono">edad_min / edad_max</td><td className="p-2">int</td><td className="p-2">Rango de edad</td></tr>
                    <tr><td className="p-2 font-mono">genero</td><td className="p-2">string</td><td className="p-2">masculino | femenino</td></tr>
                    <tr><td className="p-2 font-mono">ubicacion</td><td className="p-2">string</td><td className="p-2">Búsqueda parcial de ubicación</td></tr>
                    <tr><td className="p-2 font-mono">external_id</td><td className="p-2">string</td><td className="p-2">ID externo de tu plataforma</td></tr>
                    <tr><td className="p-2 font-mono">page</td><td className="p-2">int</td><td className="p-2">Página (default: 0)</td></tr>
                    <tr><td className="p-2 font-mono">limit</td><td className="p-2">int</td><td className="p-2">Registros por página (max: 200, default: 50)</td></tr>
                    <tr><td className="p-2 font-mono">sort</td><td className="p-2">string</td><td className="p-2">Campo: created_at, nombre, edad, estado (default: created_at)</td></tr>
                    <tr><td className="p-2 font-mono">order</td><td className="p-2">string</td><td className="p-2">asc | desc (default: desc)</td></tr>
                  </tbody>
                </table>
              </div>
              <h4 className="font-semibold mt-4">Ejemplo</h4>
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <code className="text-gray-300">curl &quot;https://reportavnzla.com/api/v1/personas?q=González&amp;estado=buscado&amp;limit=10&quot;</code>
              </div>
              <h4 className="font-semibold mt-4">Respuesta</h4>
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-xs overflow-x-auto">
                <pre className="text-green-300">{`{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "nombre": "María",
      "apellido": "González",
      "cedula": "V-12345678",
      "edad": 35,
      "genero": "femenino",
      "estado": "buscado",
      "ultimaUbicacion": "La Guaira",
      "descripcion": "Última vez vista en...",
      "fotoUrl": "https://...",
      "lat": 10.5,
      "lng": -66.9,
      "externalId": null,
      "reportadoPorNombre": "Juan Pérez",
      "createdAt": "2026-06-25T...",
      "updatedAt": "2026-06-25T..."
    }
  ],
  "pagination": {
    "total": 150,
    "page": 0,
    "limit": 10,
    "totalPages": 15,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}`}</pre>
              </div>
            </div>
          </div>

          {/* GET /personas/[id] */}
          <div className="bg-white rounded-xl shadow-sm border mb-6 overflow-hidden">
            <div className="flex items-center gap-3 bg-green-50 px-6 py-3 border-b">
              <span className="bg-green-600 text-white px-2 py-0.5 rounded text-xs font-bold">GET</span>
              <code className="font-mono text-sm">/api/v1/personas/:id</code>
              <span className="text-gray-500 text-sm ml-auto">Obtener persona por ID</span>
            </div>
            <div className="p-6">
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <code className="text-gray-300">curl &quot;https://reportavnzla.com/api/v1/personas/UUID_AQUI&quot;</code>
              </div>
            </div>
          </div>

          {/* POST /personas */}
          <div className="bg-white rounded-xl shadow-sm border mb-6 overflow-hidden">
            <div className="flex items-center gap-3 bg-blue-50 px-6 py-3 border-b">
              <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs font-bold">POST</span>
              <code className="font-mono text-sm">/api/v1/personas</code>
              <span className="text-gray-500 text-sm ml-auto">Registrar persona(s)</span>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-600">
                Crea uno o múltiples registros. Acepta un objeto individual o un array (batch, max 100).
              </p>
              <h4 className="font-semibold">Body (single)</h4>
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-xs overflow-x-auto">
                <pre className="text-yellow-300">{`{
  "nombre": "María",
  "apellido": "González",
  "cedula": "V-12345678",
  "edad": 35,
  "genero": "femenino",
  "estado": "buscado",
  "ultima_ubicacion": "La Guaira, sector Catia La Mar",
  "descripcion": "Llevaba ropa roja...",
  "foto_url": "https://ejemplo.com/foto.jpg",
  "lat": 10.5,
  "lng": -66.9,
  "external_id": "tu-plataforma-12345",
  "reportado_por_nombre": "Juan Pérez",
  "reportado_por_telefono": "+58 412 1234567"
}`}</pre>
              </div>
              <h4 className="font-semibold">Body (batch)</h4>
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-xs overflow-x-auto">
                <pre className="text-yellow-300">{`[
  { "nombre": "Persona 1", "apellido": "Apellido 1", ... },
  { "nombre": "Persona 2", "apellido": "Apellido 2", ... }
]`}</pre>
              </div>
              <p className="text-sm text-gray-500">
                💡 <strong>external_id</strong> es clave para deduplicación cruzada. Usa el ID de tu plataforma.
              </p>
            </div>
          </div>

          {/* PATCH /personas/[id] */}
          <div className="bg-white rounded-xl shadow-sm border mb-6 overflow-hidden">
            <div className="flex items-center gap-3 bg-yellow-50 px-6 py-3 border-b">
              <span className="bg-yellow-600 text-white px-2 py-0.5 rounded text-xs font-bold">PATCH</span>
              <code className="font-mono text-sm">/api/v1/personas/:id</code>
              <span className="text-gray-500 text-sm ml-auto">Actualizar persona</span>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-xs overflow-x-auto">
                <pre className="text-yellow-300">{`curl -X PATCH "https://reportavnzla.com/api/v1/personas/UUID" \\
  -H "Content-Type: application/json" \\
  -d '{"estado": "encontrado", "notas": "Encontrada en hospital"}'`}</pre>
              </div>
            </div>
          </div>

          {/* GET /stats */}
          <div className="bg-white rounded-xl shadow-sm border mb-6 overflow-hidden">
            <div className="flex items-center gap-3 bg-green-50 px-6 py-3 border-b">
              <span className="bg-green-600 text-white px-2 py-0.5 rounded text-xs font-bold">GET</span>
              <code className="font-mono text-sm">/api/v1/stats</code>
              <span className="text-gray-500 text-sm ml-auto">Estadísticas</span>
            </div>
            <div className="p-6">
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-xs overflow-x-auto">
                <pre className="text-green-300">{`{
  "success": true,
  "data": {
    "total": 15000,
    "buscados": 14000,
    "encontrados": 800,
    "fallecidos": 200
  }
}`}</pre>
              </div>
            </div>
          </div>

          {/* POST /sync */}
          <div className="bg-white rounded-xl shadow-sm border mb-6 overflow-hidden">
            <div className="flex items-center gap-3 bg-purple-50 px-6 py-3 border-b">
              <span className="bg-purple-600 text-white px-2 py-0.5 rounded text-xs font-bold">POST</span>
              <code className="font-mono text-sm">/api/v1/sync</code>
              <span className="text-gray-500 text-sm ml-auto">Sincronizar datos entre plataformas</span>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-600">
                Envía un batch de registros desde tu plataforma. Los registros con <code>external_id</code> existente 
                se <strong>actualizan</strong> automáticamente (deduplicación). Nuevos registros se <strong>insertan</strong>.
              </p>
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-xs overflow-x-auto">
                <pre className="text-yellow-300">{`{
  "source": "venezuelatebusca.com",
  "url": "https://venezuelatebusca.com",
  "persons": [
    {
      "nombre": "Juan",
      "apellido": "Pérez",
      "external_id": "vtb-abc123",
      "cedula": "V-12345678",
      "edad": 30,
      "estado": "buscado",
      "ultima_ubicacion": "Caracas",
      "foto_url": "https://..."
    }
  ]
}`}</pre>
              </div>
              <h4 className="font-semibold">Respuesta</h4>
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-xs overflow-x-auto">
                <pre className="text-green-300">{`{
  "success": true,
  "source": "venezuelatebusca.com",
  "syncResult": {
    "inserted": 15,
    "updated": 3,
    "skipped": 2,
    "totalProcessed": 20
  }
}`}</pre>
              </div>
            </div>
          </div>

          {/* GET /sync */}
          <div className="bg-white rounded-xl shadow-sm border mb-6 overflow-hidden">
            <div className="flex items-center gap-3 bg-green-50 px-6 py-3 border-b">
              <span className="bg-green-600 text-white px-2 py-0.5 rounded text-xs font-bold">GET</span>
              <code className="font-mono text-sm">/api/v1/sync</code>
              <span className="text-gray-500 text-sm ml-auto">Exportar datos para sincronización</span>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-600">
                Exporta registros modificados desde una fecha. Los campos usan <code>snake_case</code> para compatibilidad.
              </p>
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <code className="text-gray-300">curl &quot;https://reportavnzla.com/api/v1/sync?since=2026-06-25T00:00:00Z&amp;limit=500&quot;</code>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2">Parámetro</th>
                    <th className="text-left p-2">Tipo</th>
                    <th className="text-left p-2">Descripción</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr><td className="p-2 font-mono">since</td><td className="p-2">ISO date</td><td className="p-2">Solo registros actualizados después de esta fecha</td></tr>
                  <tr><td className="p-2 font-mono">estado</td><td className="p-2">string</td><td className="p-2">Filtrar por estado</td></tr>
                  <tr><td className="p-2 font-mono">limit</td><td className="p-2">int</td><td className="p-2">Max registros (default: 100, max: 1000)</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Integration Guide */}
        <section id="integrar" className="bg-white rounded-xl shadow-sm border p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">🛠️ Guía de Integración</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-3">1. JavaScript / Fetch</h3>
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-xs overflow-x-auto">
                <pre className="text-blue-200">{`// Buscar personas
const res = await fetch(
  'https://reportavnzla.com/api/v1/personas?q=González&estado=buscado'
)
const { data, pagination } = await res.json()

// Registrar persona desde tu plataforma
await fetch('https://reportavnzla.com/api/v1/personas', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Source': 'mi-plataforma.com' },
  body: JSON.stringify({
    nombre: 'María',
    apellido: 'González',
    cedula: 'V-12345678',
    estado: 'buscado',
    external_id: 'mi-plat-123',
    foto_url: 'https://mi-plataforma.com/fotos/maria.jpg'
  })
})

// Sincronizar batch
await fetch('https://reportavnzla.com/api/v1/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    source: 'mi-plataforma.com',
    url: 'https://mi-plataforma.com',
    persons: [
      { nombre: 'Juan', apellido: 'Pérez', external_id: 'jp-001', ... },
      { nombre: 'Ana', apellido: 'López', external_id: 'al-002', ... },
    ]
  })
})`}</pre>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">2. Python</h3>
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-xs overflow-x-auto">
                <pre className="text-green-200">{`import requests

# Buscar
res = requests.get('https://reportavnzla.com/api/v1/personas', params={
    'q': 'González',
    'estado': 'buscado',
    'limit': 10
})
data = res.json()

# Exportar datos actualizados
res = requests.get('https://reportavnzla.com/api/v1/sync', params={
    'since': '2026-06-25T00:00:00Z',
    'limit': 1000
})
for person in res.json()['data']:
    print(f"{person['nombre']} {person['apellido']} - {person['estado']}")`}</pre>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">3. cURL</h3>
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-xs overflow-x-auto">
                <pre className="text-yellow-200">{`# Buscar
curl "https://reportavnzla.com/api/v1/personas?q=Pérez&limit=5"

# Crear persona
curl -X POST "https://reportavnzla.com/api/v1/personas" \\
  -H "Content-Type: application/json" \\
  -d '{"nombre":"Juan","apellido":"Pérez","estado":"buscado"}'

# Sincronizar
curl -X POST "https://reportavnzla.com/api/v1/sync" \\
  -H "Content-Type: application/json" \\
  -d '{"source":"mi-plataforma","persons":[...]}'`}</pre>
              </div>
            </div>
          </div>
        </section>

        {/* Cross-platform strategy */}
        <section className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-8 border">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">🤝 Estrategia Cruzada</h2>
          <p className="text-gray-600 mb-4">
            La API está diseñada para que <strong>múltiples plataformas compartan datos</strong> sin duplicación:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-gray-600">
            <li> Cada plataforma usa <code className="bg-white px-1 rounded">external_id</code> con su propio formato (ej: <code className="bg-white px-1 rounded">vtb-abc123</code>, <code className="bg-white px-1 rounded">dtv-456</code>)</li>
            <li> Al sincronizar, los registros con el mismo <code className="bg-white px-1 rounded">external_id</code> se actualizan en vez de duplicarse</li>
            <li> Usá <code className="bg-white px-1 rounded">GET /api/v1/sync?since=...</code> para obtener solo los cambios recientes</li>
            <li> Actualizá estados (buscado → encontrado) desde cualquier plataforma</li>
            <li> Las fotos se referencian por URL — no hay transferencia de archivos</li>
          </ol>
        </section>

        {/* Data sources */}
        <section className="bg-white rounded-xl shadow-sm border p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">📊 Fuentes de Datos</h2>
          <p className="text-gray-600 mb-4">
            ReportaVNZLA agrega datos de múltiples fuentes. Puedes contribuir la tuya:
          </p>
          <div className="space-y-3">
            {[
              { name: 'venezuelatebusca.com', desc: 'Registro público principal de desaparecidos (~21,000)', status: '✅ Sincronizado' },
              { name: 'desaparecidosterremotovenezuela.com', desc: 'Plataforma adicional (~45,700 registros)', status: '✅ Sincronizado' },
              { name: 'Tu plataforma', desc: '¿Tienes datos? Conéctate vía API', status: '⬜ Disponible' },
            ].map(src => (
              <div key={src.name} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <span className="font-semibold text-gray-800">{src.name}</span>
                <span className="text-gray-500 text-sm flex-1">{src.desc}</span>
                <span className="text-sm">{src.status}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section className="bg-white rounded-xl shadow-sm border p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">📞 Contacto para Desarrolladores</h2>
          <p className="text-gray-600 mb-4">
            ¿Necesitas ayuda con la integración? ¿Tienes una plataforma con datos que quieras compartir?
          </p>
          <div className="flex justify-center gap-4">
            <a href="https://github.com/bitupx00/reportavnzla" target="_blank" rel="noopener"
              className="bg-gray-900 text-white px-6 py-2 rounded-lg font-semibold hover:bg-gray-800 transition">
              GitHub
            </a>
            <a href="/"
              className="border-2 border-gray-900 text-gray-900 px-6 py-2 rounded-lg font-semibold hover:bg-gray-50 transition">
              Volver al Inicio
            </a>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 mt-12">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm">
          <p>API pública y gratuita para fines humanitarios — ReportaVNZLA © 2026</p>
          <p className="mt-1">Los datos son de carácter público y están destinados a la búsqueda de personas desaparecidas.</p>
        </div>
      </footer>
    </div>
  )
}
