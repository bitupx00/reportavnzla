'use client'

import { useState, useEffect, useCallback } from 'react'
import { fixPhotoUrl, AVATAR_FALLBACK } from '@/lib/utils'
import { compressImageToDataUrl } from '@/lib/image'

interface Item {
  id: string
  fotoUrl: string | null
  estado: string
  ultimaUbicacion: string | null
}

const EMPTY = {
  estado: 'encontrado',
  nombre: '',
  apellido: '',
  ultimaUbicacion: '',
  descripcion: '',
  contactoNombre: '',
  contactoTelefono: '',
}

export default function PorIdentificar({ onSelect }: { onSelect?: (id: string) => void }) {
  const [items, setItems] = useState<Item[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pendingFoto, setPendingFoto] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY })

  const load = useCallback(() => {
    fetch('/api/por-identificar')
      .then((r) => r.json())
      .then((d) => setItems(d.data || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // 1) Toma/sube la foto -> obtiene url -> abre el formulario
  const handleCapture = async (file: File) => {
    setUploading(true)
    try {
      const dataUrl = await compressImageToDataUrl(file)
      setPendingFoto(dataUrl)
      setForm({ ...EMPTY })
    } catch {
      alert('No se pudo procesar la foto')
    } finally {
      setUploading(false)
    }
  }

  // 2) Guarda con los datos opcionales
  const handleSave = async () => {
    if (!pendingFoto) return
    setSaving(true)
    try {
      await fetch('/api/por-identificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fotoUrl: pendingFoto, ...form }),
      })
      setPendingFoto(null)
      setForm({ ...EMPTY })
      load()
    } catch {
      alert('No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-amber-900">🔍 Personas por identificar</h3>
          <p className="mt-0.5 text-sm text-amber-700/90">
            ¿Encontraste a alguien y no sabes quién es? Toma una foto. Puedes añadir datos si los conoces; si no, déjalo
            en blanco y su familia podrá completarlos.
          </p>
        </div>
        {!pendingFoto && (
          <label className="cursor-pointer whitespace-nowrap rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700">
            {uploading ? 'Subiendo…' : '📷 Tomar / subir foto'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleCapture(f)
                e.currentTarget.value = ''
              }}
            />
          </label>
        )}
      </div>

      {/* Formulario con datos opcionales tras tomar la foto */}
      {pendingFoto && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-white p-4">
          <div className="flex gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pendingFoto} alt="Foto tomada" className="h-32 w-24 shrink-0 rounded-lg object-cover" />
            <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
              <select
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
                className="search-input"
              >
                <option value="encontrado">🟢 Encontrada con vida</option>
                <option value="fallecido">⚫ Fallecida</option>
              </select>
              <input className="search-input" placeholder="Nombre (opcional)" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              <input className="search-input" placeholder="Apellido (opcional)" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} />
              <input className="search-input" placeholder="¿Dónde la encontraste?" value={form.ultimaUbicacion} onChange={(e) => setForm({ ...form, ultimaUbicacion: e.target.value })} />
              <input className="search-input sm:col-span-2" placeholder="Descripción (ropa, señas, circunstancias)" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
              <input className="search-input" placeholder="Tu nombre (contacto, opcional)" value={form.contactoNombre} onChange={(e) => setForm({ ...form, contactoNombre: e.target.value })} />
              <input className="search-input" placeholder="Tu teléfono (contacto, opcional)" value={form.contactoTelefono} onChange={(e) => setForm({ ...form, contactoTelefono: e.target.value })} />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? 'Guardando…' : 'Publicar'}
            </button>
            <button onClick={() => setPendingFoto(null)} className="btn-secondary">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {items.length > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {items.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect?.(p.id)}
              className="group overflow-hidden rounded-xl border-2 border-amber-300 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              aria-label="Ver persona por identificar"
              title="¿La reconoces? Haz click para añadir o completar su información"
            >
              <img
                src={fixPhotoUrl(p.fotoUrl) || AVATAR_FALLBACK}
                alt="Persona por identificar"
                loading="lazy"
                className="aspect-[250/351] w-full object-cover transition-transform group-hover:scale-105"
                onError={(e) => {
                  e.currentTarget.onerror = null
                  e.currentTarget.src = AVATAR_FALLBACK
                }}
              />
            </button>
          ))}
        </div>
      ) : (
        !pendingFoto && (
          <p className="mt-3 text-xs text-amber-600/80">
            Aún no hay personas por identificar. Si encuentras a alguien, su foto aparecerá aquí.
          </p>
        )
      )}
    </section>
  )
}
