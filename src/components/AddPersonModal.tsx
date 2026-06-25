'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'

// ── Nominatim (OpenStreetMap) address search for Venezuela ──
interface GeoResult {
  display_name: string
  lat: string
  lon: string
}

async function searchAddress(query: string): Promise<GeoResult[]> {
  if (!query || query.length < 3) return []
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Venezuela')}&countrycodes=ve&limit=5&addressdetails=1`,
      { headers: { 'Accept-Language': 'es' } }
    )
    return await res.json()
  } catch {
    return []
  }
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: FormData) => Promise<void>
}

export default function AddPersonModal({ isOpen, onClose, onSubmit }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // Location search state
  const [addressQuery, setAddressQuery] = useState('')
  const [addressResults, setAddressResults] = useState<GeoResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedLat, setSelectedLat] = useState<string>('')
  const [selectedLng, setSelectedLng] = useState<string>('')
  const [selectedAddress, setSelectedAddress] = useState<string>('')
  const [showAddressDropdown, setShowAddressDropdown] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowAddressDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Address search with debounce
  const handleAddressInput = (value: string) => {
    setAddressQuery(value)
    setSelectedLat('')
    setSelectedLng('')
    setSelectedAddress('')

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    if (value.length < 3) {
      setAddressResults([])
      setShowAddressDropdown(false)
      return
    }

    setSearching(true)
    searchTimeoutRef.current = setTimeout(async () => {
      const results = await searchAddress(value)
      setAddressResults(results)
      setShowAddressDropdown(results.length > 0)
      setSearching(false)
    }, 400)
  }

  const selectAddress = (result: GeoResult) => {
    setSelectedLat(result.lat)
    setSelectedLng(result.lon)
    // Extract short address
    const parts = result.display_name.split(',').slice(0, 3).join(',')
    setSelectedAddress(parts)
    setAddressQuery(parts)
    setShowAddressDropdown(false)

    // Also fill the ubicacion field
    const ubicacionField = formRef.current?.querySelector<HTMLInputElement>('input[name="ultimaUbicacion"]')
    if (ubicacionField) ubicacionField.value = parts
  }

  useEffect(() => {
    if (!isOpen) {
      formRef.current?.reset()
      setFotoPreview(null)
      setError('')
      setAddressQuery('')
      setAddressResults([])
      setSelectedLat('')
      setSelectedLng('')
      setSelectedAddress('')
      setShowAddressDropdown(false)
    }
  }, [isOpen])

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => setFotoPreview(ev.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)

    // Inject coordinates from address search
    if (selectedLat && selectedLng) {
      formData.set('lat', selectedLat)
      formData.set('lng', selectedLng)
    }

    try {
      await onSubmit(formData)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al publicar')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-2xl">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-gray-900">📋 Registrar persona</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Honeypot anti-bots (oculto para humanos) */}
          <input
            type="text"
            name="_hp"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute left-[-9999px] h-0 w-0 opacity-0"
          />
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
          )}

          {/* Datos de la persona */}
          <fieldset className="border border-gray-200 rounded-xl p-4 space-y-4">
            <legend className="text-sm font-semibold text-gray-700 px-2">Datos de la persona</legend>

            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              💡 Para evitar registros duplicados, coloca el <strong>nombre completo</strong> (de ser posible los
              dos nombres y dos apellidos) y la <strong>cédula</strong> si la conoces.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombres *</label>
                <input name="nombre" required maxLength={100} className="search-input" placeholder="Ej: María José" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos *</label>
                <input name="apellido" required maxLength={100} className="search-input" placeholder="Ej: Pérez Gómez" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cédula (C.I.) — opcional</label>
                <input name="cedula" maxLength={20} className="search-input" placeholder="V-12345678" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Edad</label>
                <input name="edad" type="number" min={0} max={150} className="search-input" placeholder="Edad" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Género</label>
                <select name="genero" className="search-input">
                  <option value="">No especificado</option>
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado *</label>
              <select name="estado" required className="search-input">
                <option value="buscado">🔴 Persona perdida / buscada</option>
                <option value="encontrado">🟢 Persona rescatada / encontrada</option>
                <option value="fallecido">⚫ Persona fallecida</option>
              </select>
            </div>
          </fieldset>

          {/* ── UBICACIÓN ── */}
          <fieldset className="border border-red-200 rounded-xl p-4 space-y-4 bg-red-50/30">
            <legend className="text-sm font-semibold text-red-700 px-2">📍 Ubicación</legend>

            {/* Address autocomplete */}
            <div ref={dropdownRef} className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Buscar dirección en Venezuela
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={addressQuery}
                  onChange={(e) => handleAddressInput(e.target.value)}
                  onFocus={() => addressResults.length > 0 && setShowAddressDropdown(true)}
                  className="search-input pr-10"
                  placeholder="Ej: Av. Bolívar, Caracas / Catia La Mar / Valencia..."
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  {searching ? '⏳' : '🔍'}
                </span>
              </div>

              {/* Dropdown results */}
              {showAddressDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {addressResults.map((r, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => selectAddress(r)}
                      className="w-full text-left px-4 py-2.5 hover:bg-red-50 border-b border-gray-50 last:border-0 transition-colors"
                    >
                      <div className="text-sm text-gray-800 font-medium">
                        {r.display_name.split(',')[0]}
                      </div>
                      <div className="text-xs text-gray-400 truncate mt-0.5">
                        {r.display_name.split(',').slice(1, 4).join(',').trim()}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected location indicator */}
            {selectedLat && selectedLng && (
              <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 border border-green-200">
                <span className="text-lg">✅</span>
                <div>
                  <div className="font-medium">Ubicación seleccionada</div>
                  <div className="text-xs text-green-600 mt-0.5">{selectedAddress}</div>
                  <div className="text-xs text-green-500 mt-0.5">Coordenadas: {selectedLat}, {selectedLng}</div>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedLat(''); setSelectedLng(''); setSelectedAddress(''); setAddressQuery('') }}
                  className="ml-auto text-green-400 hover:text-red-500 transition-colors"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Manual coordinates fallback */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Latitud (opcional)</label>
                <input name="lat" type="number" step="any" className="search-input"
                  placeholder="10.49" defaultValue={selectedLat || ''} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Longitud (opcional)</label>
                <input name="lng" type="number" step="any" className="search-input"
                  placeholder="-66.88" defaultValue={selectedLng || ''} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Último lugar visto / descripción de la zona</label>
              <input name="ultimaUbicacion" maxLength={500} className="search-input"
                placeholder="Ej: Edificio Torre Principal, piso 5, Catia La Mar" />
            </div>
          </fieldset>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea name="descripcion" maxLength={2000} rows={3} className="search-input resize-none"
              placeholder="Descripción física, ropa que llevaba, circunstancias..." />
          </div>

          {/* Foto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Foto</label>
            {fotoPreview ? (
              <div className="relative inline-block">
                <img src={fotoPreview} alt="Preview" className="w-32 h-32 rounded-xl object-cover border-2 border-gray-200" />
                <button type="button" onClick={() => { setFotoPreview(null); if (fileRef.current) fileRef.current.value = '' }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">&times;</button>
              </div>
            ) : (
              <label className="block w-32 h-32 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-red-300 transition-colors">
                <input ref={fileRef} name="foto" type="file" accept="image/*" onChange={handleFotoChange} className="hidden" />
                <div className="text-center">
                  <div className="text-2xl">📷</div>
                  <div className="text-xs text-gray-400 mt-1">Subir foto</div>
                </div>
              </label>
            )}
          </div>

          {/* Datos del reportante */}
          <fieldset className="border border-gray-200 rounded-xl p-4 space-y-4">
            <legend className="text-sm font-semibold text-gray-700 px-2">Tus datos (quien reporta)</legend>

            <div className="flex items-center gap-2 mb-2">
              <input type="checkbox" id="anonimo" onChange={(e) => {
                const inputs = formRef.current?.querySelectorAll('.reportante-field') as NodeListOf<HTMLInputElement>
                inputs?.forEach(inp => { inp.required = !e.target.checked; inp.value = e.target.checked ? '' : inp.value })
              }} />
              <label htmlFor="anonimo" className="text-sm text-gray-600">Reportar de forma anónima</label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tu nombre</label>
                <input name="reportadoPorNombre" maxLength={150} className="search-input reportante-field" placeholder="Tu nombre completo (o anónimo)" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input name="reportadoPorTelefono" maxLength={30} className="search-input reportante-field" placeholder="+58 412 1234567" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input name="reportadoPorEmail" type="email" maxLength={150} className="search-input reportante-field" placeholder="tu@email.com" />
            </div>
          </fieldset>

          <button type="submit" disabled={loading} className="btn-primary w-full text-center">
            {loading ? '⏳ Publicando...' : '📢 Publicar registro'}
          </button>
        </form>
      </div>
    </div>
  )
}
