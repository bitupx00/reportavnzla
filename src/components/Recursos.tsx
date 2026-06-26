'use client'

import { useState, useEffect, useCallback } from 'react'

interface Recurso {
  id: string
  tipo: string
  nombre: string
  direccion: string | null
  recibe: string | null
  nivelDano: string | null
  descripcion: string | null
  contacto: string | null
}

const NIVELES = ['leve', 'moderado', 'severo', 'colapsado']
const nivelColor: Record<string, string> = {
  leve: 'bg-yellow-100 text-yellow-800',
  moderado: 'bg-orange-100 text-orange-800',
  severo: 'bg-red-100 text-red-800',
  colapsado: 'bg-gray-800 text-white',
}

const EMPTY = { nombre: '', direccion: '', recibe: '', nivelDano: 'moderado', descripcion: '', contacto: '' }

export default function Recursos() {
  const [tipo, setTipo] = useState<'centro_acopio' | 'estructura'>('centro_acopio')
  const [items, setItems] = useState<Recurso[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)

  const load = useCallback((t: string) => {
    fetch(`/api/recursos?tipo=${t}`)
      .then((r) => r.json())
      .then((d) => setItems(d.data || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    load(tipo)
  }, [tipo, load])

  const guardar = async () => {
    if (!form.nombre.trim()) return
    setSaving(true)
    try {
      const r = await fetch('/api/recursos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, ...form }),
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

  const esCentro = tipo === 'centro_acopio'

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
        <div className="mb-4 grid grid-cols-1 gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:grid-cols-2">
          <input className="search-input" placeholder={esCentro ? 'Nombre del centro *' : 'Lugar / edificación *'} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <input className="search-input" placeholder="Dirección / zona" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
          {esCentro ? (
            <input className="search-input sm:col-span-2" placeholder="¿Qué reciben? (agua, alimentos, ropa, medicinas…)" value={form.recibe} onChange={(e) => setForm({ ...form, recibe: e.target.value })} />
          ) : (
            <select className="search-input" value={form.nivelDano} onChange={(e) => setForm({ ...form, nivelDano: e.target.value })}>
              {NIVELES.map((n) => (
                <option key={n} value={n}>
                  Daño: {n}
                </option>
              ))}
            </select>
          )}
          <input className="search-input" placeholder="Contacto (teléfono)" value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} />
          <input className="search-input sm:col-span-2" placeholder="Descripción / horario / detalles" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          <button onClick={guardar} disabled={saving || !form.nombre.trim()} className="btn-primary sm:col-span-2 disabled:opacity-50">
            {saving ? 'Guardando…' : 'Publicar'}
          </button>
        </div>
      )}

      {/* Lista */}
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-400">
          Aún no hay {esCentro ? 'centros de acopio' : 'estructuras'} registradas. Agrega la primera con “+ Agregar”.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((r) => (
            <div key={r.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-gray-800">{r.nombre}</span>
                {r.nivelDano && (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${nivelColor[r.nivelDano] || 'bg-gray-100'}`}>{r.nivelDano}</span>
                )}
              </div>
              {r.direccion && <div className="mt-1 text-xs text-gray-600">📍 {r.direccion}</div>}
              {r.recibe && <div className="mt-1 text-xs text-green-700">📦 Recibe: {r.recibe}</div>}
              {r.descripcion && <div className="mt-1 text-xs text-gray-500">{r.descripcion}</div>}
              {r.contacto && <div className="mt-1 text-xs text-gray-600">📞 {r.contacto}</div>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
