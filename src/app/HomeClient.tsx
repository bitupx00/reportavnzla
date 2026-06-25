'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import StatsBar from '@/components/StatsBar'
import SearchBar from '@/components/SearchBar'
import PersonCard from '@/components/PersonCard'
import PersonDetail from '@/components/PersonDetail'
import AddPersonModal from '@/components/AddPersonModal'

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
  const [addingLocation, setAddingLocation] = useState(false)
  const [pickedLat, setPickedLat] = useState<number | null>(null)
  const [pickedLng, setPickedLng] = useState<number | null>(null)

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

      // Also fetch updated stats
      const statsRes = await fetch('/api/stats')
      const statsData = await statsRes.json()
      if (statsData.total !== undefined) setStats(statsData)
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

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setPickedLat(lat)
    setPickedLng(lng)
    setAddingLocation(false)
    setShowAddModal(true)
  }, [])

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
      reportadoPorNombre: formData.get('reportadoPorNombre'),
      reportadoPorTelefono: formData.get('reportadoPorTelefono') || null,
      reportadoPorEmail: formData.get('reportadoPorEmail') || null,
    }

    // Use picked coordinates from map if available
    if (pickedLat !== null && pickedLng !== null) {
      body.lat = pickedLat
      body.lng = pickedLng
    } else if (formData.get('lat')) {
      body.lat = parseFloat(formData.get('lat') as string)
      body.lng = parseFloat(formData.get('lng') as string)
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

    setPickedLat(null)
    setPickedLng(null)
    await fetchPersonas(searchParams.q, searchParams.estado, 0)
  }, [fetchPersonas, searchParams, pickedLat, pickedLng])

  // Map markers: only persons with coordinates
  const mapMarkers = personas
    .filter(p => p.lat && p.lng)
    .map(p => ({
      id: p.id,
      nombre: p.nombre,
      apellido: p.apellido,
      cedula: p.cedula,
      edad: p.edad,
      estado: p.estado,
      lat: p.lat!,
      lng: p.lng!,
      ultimaUbicacion: p.ultimaUbicacion,
      descripcion: p.descripcion,
      fotoUrl: p.fotoUrl,
      createdAt: p.createdAt,
    }))

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
            <span className="text-3xl">🇻🇪</span>
            <div>
              <h1 className="text-xl font-bold text-gray-900">ReportaVNZLA</h1>
              <p className="text-xs text-gray-500">Venezuela Te Encuentra — Sin fines de lucro</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAddingLocation(!addingLocation)}
              className={`text-sm px-3 py-2 rounded-lg border transition-all ${addingLocation ? 'bg-yellow-500 border-yellow-600 text-black font-bold' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              📍 {addingLocation ? 'Seleccionando...' : 'Marcar en mapa'}
            </button>
            <button
              onClick={() => { setPickedLat(null); setPickedLng(null); setShowAddModal(true) }}
              className="btn-primary text-sm sm:text-base"
            >
              📢 + Registrar persona
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
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
          </div>
          <Map
            personas={mapMarkers}
            zonas={zonas}
            onSelectPersona={handleSelectPersona}
            onAddLocation={handleMapClick}
            addingLocation={addingLocation}
          />
          {pickedLat !== null && (
            <div className="mt-2 text-sm text-yellow-700 bg-yellow-50 rounded-lg px-3 py-2 border border-yellow-200">
              📍 Ubicación seleccionada: {pickedLat.toFixed(4)}, {pickedLng?.toFixed(4)} — Se usará al registrar una persona
            </div>
          )}
        </section>

        {/* ═══ SEARCH + LIST ═══ */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">
              📋 Listado de personas ({stats.total})
            </h3>
            <button onClick={() => { setPickedLat(null); setPickedLng(null); setShowAddModal(true) }} className="text-sm text-red-600 hover:text-red-700 font-medium">
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
              <p className="text-gray-400 text-sm">
                Sé el primero en reportar una persona. Cada registro cuenta.
              </p>
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

        {/* ═══ DATA SOURCES ═══ */}
        <section className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
          <h3 className="font-semibold text-blue-800 mb-2">🔄 Fuentes de datos</h3>
          <p className="text-sm text-blue-600">
            Esta plataforma sincroniza datos de múltiples fuentes públicas: venezuelatebusca.com y otras plataformas
            de registro. Si representas un centro de datos u ONG y deseas integrar tu información,
            contáctanos. Los datos se actualizan automáticamente.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full">venezuelatebusca.com</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full">Reportes ciudadanos</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full">Análisis IA (GLM-5)</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full">+ Fuentes por agregar</span>
          </div>
        </section>
      </div>

      {/* ═══ FOOTER ═══ */}
      <footer className="bg-gray-900 text-gray-400 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h4 className="text-white font-semibold mb-3">🇻🇪 ReportaVNZLA</h4>
              <p className="text-sm leading-relaxed">
                Iniciativa solidaria, gratuita y sin fines de lucro.
                Nuestro único objetivo es ayudar a reunir familias.
              </p>
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
            <p className="mt-1">Datos abiertos para la comunidad · Código abierto en GitHub</p>
          </div>
        </div>
      </footer>

      {/* ═══ MODALS ═══ */}
      <AddPersonModal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setPickedLat(null); setPickedLng(null) }}
        onSubmit={handleAddPerson}
        prefillLat={pickedLat}
        prefillLng={pickedLng}
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
