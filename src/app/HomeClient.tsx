'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import StatsBar from '@/components/StatsBar'
import SearchBar from '@/components/SearchBar'
import PersonCard from '@/components/PersonCard'
import PersonDetail from '@/components/PersonDetail'
import AddPersonModal from '@/components/AddPersonModal'
import PersonasSlider from '@/components/PersonasSlider'
import { approxCoords } from '@/lib/utils'

// Dynamic import for Map (no SSR for Leaflet)
const Map = dynamic(() => import('@/components/Map'), { ssr: false, loading: () => <div className="bg-gray-200 animate-pulse rounded-xl map-container" /> })

interface Persona {
  id: string
  nombre: string
  apellido: string
  cedula: string | null
  edad: number | null
  genero: string | null
  ultimaUbicacion: string | null
  descripcion: string | null
  fotoUrl: string | null
  estado: string
  fechaEncontrado: string | null
  notas: string | null
  reportadoPorNombre: string | null
  reportadoPorTelefono: string | null
  reportadoPorEmail: string | null
  lat: number | null
  lng: number | null
  createdAt: string
  updatedAt: string
}

interface Stats {
  total: number
  buscados: number
  encontrados: number
  fallecidos: number
}

interface Zona {
  id: string
  nombre: string
  lat: number
  lng: number
  radioKm: number | null
  severidad: string
}

interface Props {
  initialStats: Stats
  initialPersonas: Persona[]
  initialZonas: Zona[]
}

export default function HomeClient({ initialStats, initialPersonas, initialZonas }: Props) {
  const [stats, setStats] = useState<Stats>(initialStats)
  const [personas, setPersonas] = useState<Persona[]>(initialPersonas)
  const [zonas] = useState<Zona[]>(initialZonas)
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(0)
  const [searchParams, setSearchParams] = useState({ q: '', estado: '' })

  // ── Fetch personas on mount (not just initial) ──
  const fetchPersonas = useCallback(async (q = '', estado = '', page = 0) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (estado) params.set('estado', estado)
      params.set('page', page.toString())
      params.set('limit', '24')

      const res = await fetch(`/api/personas?${params}`)
      const data = await res.json()
      setPersonas(data.data || [])
      setTotalPages(data.totalPages || 1)
      setCurrentPage(page)

      // Also fetch updated stats. /api/v1/stats devuelve { success, data: {...} };
      // toleramos ambas formas (plana o envuelta en .data) para no quedar en 0.
      const statsRes = await fetch('/api/v1/stats')
      const statsJson = await statsRes.json()
      const statsData = statsJson?.data ?? statsJson
      if (statsData && statsData.total !== undefined) setStats(statsData)
    } catch (err) {
      console.error('Error fetching:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load data on first render
  useEffect(() => {
    fetchPersonas()
  }, [fetchPersonas])

  const handleSearch = useCallback((params: { q: string; estado: string }) => {
    setSearchParams(params)
    fetchPersonas(params.q, params.estado, 0)
  }, [fetchPersonas])

  const handleSelectPersona = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/personas/${id}`)
      const data = await res.json()
      setSelectedPersona(data)
    } catch (err) {
      console.error('Error fetching persona:', err)
    }
  }, [])

  const handleMarkFound = useCallback(async (id: string, notas: string) => {
    const res = await fetch('/api/personas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, estado: 'encontrado', notas }),
    })
    if (!res.ok) throw new Error('Error al actualizar')
    await fetchPersonas(searchParams.q, searchParams.estado, currentPage)
    setSelectedPersona(null)
  }, [fetchPersonas, searchParams, currentPage])

  const handleAddPerson = useCallback(async (formData: FormData) => {
    const foto = formData.get('foto') as File | null
    let fotoUrl: string | null = null

    if (foto && foto.size > 0) {
      const mediaForm = new FormData()
      mediaForm.append('personaId', 'temp')
      mediaForm.append('tipo', 'foto')
      mediaForm.append('file', foto)

      const mediaRes = await fetch('/api/medios', { method: 'POST', body: mediaForm })
      if (mediaRes.ok) {
        const mediaData = await mediaRes.json()
        fotoUrl = mediaData.url
      }
    }

    const body: any = {
      nombre: formData.get('nombre'),
      apellido: formData.get('apellido'),
      cedula: formData.get('cedula') || null,
      edad: formData.get('edad') || null,
      genero: formData.get('genero') || null,
      estado: formData.get('estado') || 'buscado',
      ultimaUbicacion: formData.get('ultimaUbicacion') || null,
      descripcion: formData.get('descripcion') || null,
      fotoUrl,
      reportadoPorNombre: formData.get('reportadoPorNombre') || null,
      reportadoPorTelefono: formData.get('reportadoPorTelefono') || null,
      reportadoPorEmail: formData.get('reportadoPorEmail') || null,
    }

    // Coordinates from the address lookup in the form
    const lat = formData.get('lat') as string
    const lng = formData.get('lng') as string
    if (lat && lng) {
      body.lat = parseFloat(lat)
      body.lng = parseFloat(lng)
    }

    const res = await fetch('/api/personas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || 'Error al publicar')
    }

    await fetchPersonas(searchParams.q, searchParams.estado, 0)
  }, [fetchPersonas, searchParams])

  // Map markers: only persons with coordinates
  const mapMarkers = personas
    .map((p) => {
      // Coordenada real si existe; si no, aproximada por localidad (texto).
      let lat = p.lat
      let lng = p.lng
      let aproximada = false
      if (!(lat && lng)) {
        const a = approxCoords(p.ultimaUbicacion, p.id)
        if (a) {
          lat = a.lat
          lng = a.lng
          aproximada = true
        }
      }
      if (!(lat && lng)) return null
      return {
        id: p.id,
        nombre: p.nombre,
        apellido: p.apellido,
        cedula: p.cedula,
        edad: p.edad,
        estado: p.estado,
        lat,
        lng,
        ultimaUbicacion: p.ultimaUbicacion,
        descripcion: p.descripcion,
        fotoUrl: p.fotoUrl,
        createdAt: p.createdAt,
        aproximada,
      }
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)

  return (
    <main className="min-h-screen">
      {/* ═══ EMERGENCY BANNER ═══ */}
      <div className="emergency-banner bg-red-600 text-white text-center py-2 px-4 text-sm font-semibold">
        🆘 EMERGENCIA — Terremoto Venezuela 2026 — Plataforma solidaria para buscar personas afectadas
      </div>

      {/* ═══ HEADER ═══ */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/reportavnzla.jpg"
              alt="ReportaVNZLA"
              width={44}
              height={44}
              className="h-11 w-11 rounded-lg object-cover shadow-sm"
            />
            <div>
              <h1 className="text-xl font-bold text-gray-900">ReportaVNZLA</h1>
              <p className="text-xs text-gray-500">Venezuela Te Encuentra — Sin fines de lucro</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary text-sm sm:text-base"
          >
            📢 + Registrar persona
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* ═══ SLIDER DE FOTOS DE PERSONAS ═══ */}
        <PersonasSlider personas={personas} onSelect={handleSelectPersona} />

        {/* ═══ HERO / NON-PROFIT STATEMENT ═══ */}
        <section className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-100 rounded-2xl p-6 sm:p-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              Cada nombre aquí es una familia esperando.
            </h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-4">
              <strong>ReportaVNZLA</strong> es una plataforma <strong>gratuita y sin fines de lucro</strong> que centraliza
              el registro de personas perdidas, rescatadas y fallecidas tras el terremoto.
              Los datos son públicos y accesibles para facilitar labores de rescate y reencuentro familiar.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500">
              <span>🔒 Datos públicos y abiertos</span>
              <span>💰 100% gratuito</span>
              <span>🤝 Iniciativa solidaria</span>
            </div>
          </div>
        </section>

        {/* ═══ STATS ═══ */}
        <StatsBar stats={stats} />

        {/* ═══ MAP ═══ */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">🗺️ Mapa interactivo — Zonas afectadas y ubicaciones</h3>
            <a href="https://github.com/bitupx00/reportavnzla" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-gray-600">
              Código abierto ↗
            </a>
          </div>
          <Map
            personas={mapMarkers}
            zonas={zonas}
            onSelectPersona={handleSelectPersona}
          />
        </section>

        {/* ═══ SEARCH + LIST ═══ */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">
              📋 Listado de personas ({stats.total})
            </h3>
            <button onClick={() => setShowAddModal(true)} className="text-sm text-red-600 hover:text-red-700 font-medium">
              + Registrar nueva persona
            </button>
          </div>

          <div className="mb-4">
            <SearchBar onSearch={handleSearch} />
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-400">
              <div className="animate-spin text-3xl mb-3">⏳</div>
              Cargando registros...
            </div>
          ) : personas.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
              <div className="text-4xl mb-3">📋</div>
              <h4 className="font-semibold text-gray-700 mb-1">No hay registros aún</h4>
              <p className="text-gray-400 text-sm mb-4">
                Sé el primero en reportar una persona. Cada registro cuenta.
              </p>
              <button onClick={() => setShowAddModal(true)} className="btn-primary">
                📢 Registrar persona
              </button>
            </div>
          ) : (
            <>
              <PersonCard personas={personas} onSelect={handleSelectPersona} />

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-6">
                  <button
                    onClick={() => fetchPersonas(searchParams.q, searchParams.estado, currentPage - 1)}
                    disabled={currentPage === 0}
                    className="btn-secondary disabled:opacity-30"
                  >
                    ← Anterior
                  </button>
                  <span className="text-sm text-gray-500">
                    Página {currentPage + 1} de {totalPages}
                  </span>
                  <button
                    onClick={() => fetchPersonas(searchParams.q, searchParams.estado, currentPage + 1)}
                    disabled={currentPage >= totalPages - 1}
                    className="btn-secondary disabled:opacity-30"
                  >
                    Siguiente →
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* ═══ DATA SOURCES + EXTERNAL LINKS ═══ */}
        <section className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
          <h3 className="font-semibold text-blue-800 mb-2">🔄 Fuentes de datos y recursos</h3>
          <p className="text-sm text-blue-600 mb-4">
            Esta plataforma sincroniza datos de múltiples fuentes públicas. Si representas un centro de datos
            u ONG y deseas integrar tu información, contáctanos.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a href="https://desaparecidosterremotovenezuela.com" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm bg-white rounded-lg px-4 py-3 border border-blue-100 hover:border-blue-300 hover:shadow-sm transition-all">
              <span className="text-lg">🌐</span>
              <div>
                <div className="font-medium text-gray-800">Desaparecidos Terremoto VE</div>
                <div className="text-xs text-gray-400">45,700+ registros</div>
              </div>
              <span className="ml-auto text-blue-400">↗</span>
            </a>
            <a href="/desarrolladores"
              className="flex items-center gap-2 text-sm bg-white rounded-lg px-4 py-3 border border-blue-100 hover:border-blue-300 hover:shadow-sm transition-all">
              <span className="text-lg">🔧</span>
              <div>
                <div className="font-medium text-gray-800">API para Desarrolladores</div>
                <div className="text-xs text-gray-400">Documentación REST API</div>
              </div>
              <span className="ml-auto text-blue-400">→</span>
            </a>
            <a href="https://venezuelatebusca.com" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm bg-white rounded-lg px-4 py-3 border border-blue-100 hover:border-blue-300 hover:shadow-sm transition-all">
              <span className="text-lg">🔍</span>
              <div>
                <div className="font-medium text-gray-800">Venezuela Te Busca</div>
                <div className="text-xs text-gray-400">venezuelatebusca.com</div>
              </div>
              <span className="ml-auto text-blue-400">↗</span>
            </a>
            <a href="https://github.com/bitupx00/reportavnzla" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm bg-white rounded-lg px-4 py-3 border border-blue-100 hover:border-blue-300 hover:shadow-sm transition-all">
              <span className="text-lg">💻</span>
              <div>
                <div className="font-medium text-gray-800">Código en GitHub</div>
                <div className="text-xs text-gray-400">Contribuye al proyecto</div>
              </div>
              <span className="ml-auto text-blue-400">↗</span>
            </a>
            <a href="https://www.protencioncivil.gob.ve" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm bg-white rounded-lg px-4 py-3 border border-blue-100 hover:border-blue-300 hover:shadow-sm transition-all">
              <span className="text-lg">🛡️</span>
              <div>
                <div className="font-medium text-gray-800">Protección Civil Venezuela</div>
                <div className="text-xs text-gray-400">Información oficial</div>
              </div>
              <span className="ml-auto text-blue-400">↗</span>
            </a>
            <a href="https://funvisis.gob.ve" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm bg-white rounded-lg px-4 py-3 border border-blue-100 hover:border-blue-300 hover:shadow-sm transition-all">
              <span className="text-lg">🌐</span>
              <div>
                <div className="font-medium text-gray-800">FUNVISIS</div>
                <div className="text-xs text-gray-400">Fundación Venezolana de Sismología</div>
              </div>
              <span className="ml-auto text-blue-400">↗</span>
            </a>
          </div>
        </section>
      </div>

      {/* ═══ FOOTER ═══ */}
      <footer className="bg-gray-900 text-gray-400 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h4 className="text-white font-semibold mb-3">🇻🇪 ReportaVNZLA</h4>
              <p className="text-sm leading-relaxed">
                Iniciativa solidaria, gratuita y sin fines de lucro.
                Nuestro único objetivo es ayudar a reunir familias.
              </p>
              <div className="flex gap-3 mt-3">
                <a href="https://github.com/bitupx00/reportavnzla" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors">
                  GitHub
                </a>
              </div>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">📞 Emergencias</h4>
              <ul className="text-sm space-y-1">
                <li>171 — Emergencias nacionales</li>
                <li>911 — Policía / Bomberos</li>
                <li>*1 — Protección Civil</li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">🔗 Enlaces útiles</h4>
              <ul className="text-sm space-y-1">
                <li><a href="https://venezuelatebusca.com" target="_blank" className="hover:text-white">Venezuela Te Busca</a></li>
                <li><a href="https://desaparecidosterremotovenezuela.com" target="_blank" className="hover:text-white">Desaparecidos Terremoto VE</a></li>
                <li><a href="https://funvisis.gob.ve" target="_blank" className="hover:text-white">FUNVISIS</a></li>
                <li><a href="/desarrolladores" className="hover:text-white">API para Desarrolladores</a></li>
                <li><a href="https://github.com/bitupx00/reportavnzla" target="_blank" className="hover:text-white">GitHub (código abierto)</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">⚖️ Legal</h4>
              <p className="text-sm leading-relaxed">
                Los datos publicados son responsabilidad exclusiva de quien los envía.
                Esta plataforma no verifica la información ni se hace responsable
                por el uso que terceros hagan de ella.
              </p>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-6 pt-6 text-center text-xs text-gray-500">
            <p>ReportaVNZLA · Iniciativa solidaria · Sin fines de lucro · Terremoto Venezuela 2026</p>
            <p className="mt-1">Datos abiertos para la comunidad · <a href="https://github.com/bitupx00/reportavnzla" className="hover:text-white">Código abierto en GitHub</a></p>
          </div>
        </div>
      </footer>

      {/* ═══ MODALS ═══ */}
      <AddPersonModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddPerson}
      />

      <PersonDetail
        persona={selectedPersona}
        isOpen={!!selectedPersona}
        onClose={() => setSelectedPersona(null)}
        onMarkFound={handleMarkFound}
      />
    </main>
  )
}
