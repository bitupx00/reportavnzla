'use client'

import { useState, useEffect, useCallback } from 'react'
import { fixPhotoUrl, AVATAR_FALLBACK } from '@/lib/utils'

interface Item {
  id: string
  fotoUrl: string | null
  estado: string
  ultimaUbicacion: string | null
}

export default function PorIdentificar({ onSelect }: { onSelect?: (id: string) => void }) {
  const [items, setItems] = useState<Item[]>([])
  const [uploading, setUploading] = useState(false)

  const load = useCallback(() => {
    fetch('/api/por-identificar')
      .then((r) => r.json())
      .then((d) => setItems(d.data || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCapture = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('personaId', 'temp')
      fd.append('tipo', 'foto')
      fd.append('file', file)
      const r = await fetch('/api/medios', { method: 'POST', body: fd })
      const d = await r.json()
      if (d.url) {
        await fetch('/api/por-identificar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fotoUrl: d.url, estado: 'encontrado' }),
        })
        load()
      } else {
        alert('No se pudo subir la foto')
      }
    } catch {
      alert('Error al subir la foto')
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-amber-900">🔍 Personas por identificar</h3>
          <p className="mt-0.5 text-sm text-amber-700/90">
            ¿Encontraste a alguien y no sabes quién es? Toma una foto para que su familia pueda reconocerla.
          </p>
        </div>
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
      </div>

      {items.length > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {items.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect?.(p.id)}
              className="group overflow-hidden rounded-xl border-2 border-amber-300 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              aria-label="Ver persona por identificar"
              title="¿La reconoces? Haz click para añadir su información"
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
        <p className="mt-3 text-xs text-amber-600/80">
          Aún no hay personas por identificar. Si encuentras a alguien sin datos, su foto aparecerá aquí.
        </p>
      )}
    </section>
  )
}
