'use client'

import { useState, useEffect, useCallback } from 'react'
import { compressImageToDataUrl } from '@/lib/image'
import { AVATAR_FALLBACK } from '@/lib/utils'

interface Item {
  id: string
  nombre: string
  direccion: string | null
  ciudad?: string | null
  lat: number | null
  lng: number | null
  recibe?: string | null
  nivelDano?: string | null
  nivelDanio?: string | null
  descripcion?: string | null
  notas?: string | null
  contacto?: string | null
  fotoUrl?: string | null
  nombresAtrapados?: string | null
  tieneDesaparecidos?: boolean
}

// Centros: leve/moderado/severo/colapsado · Estructuras (edificios): total/severo/parcial/leve
const NIVELES_CENTRO = ['leve', 'moderado', 'severo', 'colapsado']
const NIVELES_EST = ['total', 'severo', 'parcial', 'leve']
const nivelColor: Record<string, string> = {
  leve: 'bg-yellow-100 text-yellow-800',
  parcial: 'bg-orange-100 text-orange-800',
  moderado: 'bg-orange-100 text-orange-800',
  severo: 'bg-red-100 text-red-800',
  colapsado: 'bg-gray-800 text-white',
  total: 'bg-gray-800 text-white',
}

const EMPTY = { nombre: '', direccion: '', ciudad: '', recibe: '', nivelDano: 'moderado', descripcion: '', contacto: '' }

function mapsUrl(r: Item): string {
  if (r.lat != null && r.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`
  }
  const q = [r.nombre, r.direccion, r.ciudad].filter(Boolean).join(', ') + ', Venezuela'
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

export default function Recursos() {
  const [tipo, setTipo] = useState<'centro_acopio' | 'estructura'>('centro_acopio')
  const [items, setItems] = useState<Item[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [q, setQ] = useState('')
  const [subiendo, setSubiendo] = useState<string | null>(null)

  const esCentro = tipo === 'centro_acopio'

  const load = useCallback((t: string) => {
    const url = t === 'estructura' ? '/api/edificios' : `/api/recursos?tipo=${t}`
    fetch(url)
      .then((r) => r.json())
      .then((d) => setItems(d.data || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    load(tipo)
    setQ('')
  }, [tipo, load])

  const guardar = async () => {
    if (!form.nombre.trim()) return
    setSaving(true)
    try {
      const url = esCentro ? '/api/recursos' : '/api/edificios'
      const body = esCentro
        ? { tipo, ...form }
        : { nombre: form.nombre, direccion: form.direccion, ciudad: form.ciudad, nivelDanio: form.nivelDano, notas: form.descripcion }
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (r.ok) {
        alert('✓ ¡Gracias! Tu aporte fue publicado.')
        setForm({ ...EMPTY })
        setShowForm(false)
        load(tipo)
      } else {
        const d = await r.json()
        alert('⚠️ ' + (d.error || 'No se pudo guardar'))
      }
    } catch {
      alert('⚠️ No se pudo guardar. Revisa tu conexión.')
    } finally {
      setSaving(false)
    }
  }

  const subirFoto = async (id: string, file: File) => {
    setSubiendo(id)
    try {
      const dataUrl = await compressImageToDataUrl(file)
      const r = await fetch('/api/edificios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, fotoUrl: dataUrl }),
      })
      if (r.ok) {
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, fotoUrl: dataUrl } : it)))
      } else {
        alert('⚠️ No se pudo subir la foto')
      }
    } catch {
      alert('⚠️ No se pudo subir la foto')
    } finally {
      setSubiendo(null)
    }
  }

  const term = q.trim().toLowerCase()
  const visibles = term
    ? items.filter((r) =>
        [r.nombre, r.direccion, r.ciudad, r.recibe, r.descripcion, r.notas, r.contacto]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term)
      )
    : items

  const niveles = esCentro ? NIVELES_CENTRO : NIVELES_EST

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5">
      <h3 className="mb-1 font-semibold text-gray-800">🏚️ Centros de acopio y estructuras afectadas</h3>
      <p className="mb-3 text-sm text-gray-500">
        Dónde llevar o recibir ayuda, y qué edificaciones resultaron dañadas. Aporta la información que conozcas.
      </p>

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTipo('centro_acopio')}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${esCentro ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          📦 Centros de acopio
        </button>
        <button
          onClick={() => setTipo('estructura')}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${!esCentro ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          🏚️ Estructuras afectadas
        </button>
        <button onClick={() => setShowForm((s) => !s)} className="ml-auto text-sm font-medium text-red-600 hover:text-red-700">
          {showForm ? 'Cancelar' : '+ Agregar'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <input className="search-input" placeholder={esCentro ? 'Nombre del centro *' : 'Lugar / edificación *'} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <input className="search-input" placeholder="Dirección / zona" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
          {!esCentro && (
            <input className="search-input" placeholder="Ciudad (ej. Caracas, La Guaira)" value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} />
          )}
          {esCentro ? (
            <input className="search-input" placeholder="¿Qué reciben? (agua, alimentos, ropa, medicinas…)" value={form.recibe} onChange={(e) => setForm({ ...form, recibe: e.target.value })} />
          ) : (
            <select className="search-input" value={form.nivelDano} onChange={(e) => setForm({ ...form, nivelDano: e.target.value })}>
              {niveles.map((n) => (
                <option key={n} value={n}>
                  Daño: {n}
                </option>
              ))}
            </select>
          )}
          {esCentro && (
            <input className="search-input" placeholder="Contacto (teléfono)" value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} />
          )}
          <input className="search-input" placeholder="Descripción / detalles" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          <button onClick={guardar} disabled={saving || !form.nombre.trim()} className="btn-primary disabled:opacity-50">
            {saving ? 'Guardando…' : 'Publicar'}
          </button>
        </div>
      )}

      {/* Buscador por ciudad / estado / texto */}
      <div className="relative mb-3">
        <input
          className="search-input pl-8"
          placeholder={esCentro ? 'Buscar centro, ciudad…' : 'Buscar edificio, ciudad, zona… (ej. Caracas, La Guaira)'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
        {q && (
          <button onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label="Limpiar búsqueda">
            ✕
          </button>
        )}
      </div>

      {/* Conteo */}
      <p className="mb-2 text-xs text-gray-400">
        {visibles.length} {esCentro ? 'centros' : 'estructuras'}{term ? ' (filtrados)' : ''}
      </p>

      {/* Lista */}
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-400">
          Aún no hay {esCentro ? 'centros de acopio' : 'estructuras'} registradas. Agrega la primera con “+ Agregar”.
        </p>
      ) : visibles.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-400">
          Sin resultados para “{q}”.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {visibles.map((r) => {
            const nivel = r.nivelDano || r.nivelDanio
            return (
              <div key={r.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-gray-800">{r.nombre}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    {nivel && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${nivelColor[nivel] || 'bg-gray-100'}`}>{nivel}</span>
                    )}
                    <a
                      href={mapsUrl(r)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir en Google Maps"
                      className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100"
                    >
                      🗺️ Mapa
                    </a>
                  </div>
                </div>

                {/* Foto (solo estructuras) */}
                {!esCentro && r.fotoUrl && (
                  <img
                    src={r.fotoUrl}
                    alt={r.nombre}
                    loading="lazy"
                    className="mt-2 h-32 w-full rounded-lg object-cover"
                    onError={(e) => {
                      e.currentTarget.onerror = null
                      e.currentTarget.src = AVATAR_FALLBACK
                    }}
                  />
                )}

                {(r.direccion || r.ciudad) && (
                  <div className="mt-1 text-xs text-gray-600">📍 {[r.direccion, r.ciudad].filter(Boolean).join(', ')}</div>
                )}
                {r.recibe && <div className="mt-1 text-xs text-green-700">📦 Recibe: {r.recibe}</div>}
                {r.tieneDesaparecidos && <div className="mt-1 text-xs font-semibold text-red-600">🚨 Tiene personas desaparecidas</div>}
                {r.nombresAtrapados && <div className="mt-1 text-xs text-amber-700">Nombres reportados: {r.nombresAtrapados}</div>}
                {(r.descripcion || r.notas) && <div className="mt-1 text-xs text-gray-500">{r.descripcion || r.notas}</div>}
                {r.contacto && <div className="mt-1 text-xs text-gray-600">📞 {r.contacto}</div>}

                {/* Añadir foto (solo estructuras sin foto) */}
                {!esCentro && !r.fotoUrl && (
                  <label className="mt-2 inline-flex cursor-pointer items-center gap-1 rounded-lg border border-dashed border-gray-300 px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:border-red-300 hover:text-red-600">
                    {subiendo === r.id ? 'Subiendo…' : '📷 Añadir foto'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={subiendo === r.id}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) subirFoto(r.id, f)
                      }}
                    />
                  </label>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
