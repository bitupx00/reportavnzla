'use client'

import { useState, useEffect, useRef } from 'react'
import { fixPhotoUrl, AVATAR_FALLBACK } from '@/lib/utils'

interface Persona {
  id: string
  nombre: string
  apellido: string
  fotoUrl: string | null
  estado: string
}

const statusBorder: Record<string, string> = {
  buscado: 'border-red-500',
  encontrado: 'border-green-500',
  fallecido: 'border-gray-400',
}

/** Fotos visibles a la vez según el ancho de pantalla (responsive). */
function usePerView() {
  const [n, setN] = useState(6)
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth
      setN(w < 480 ? 2 : w < 768 ? 3 : w < 1024 ? 4 : 6)
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])
  return n
}

/**
 * Slider superior de fotos de personas reportadas.
 * Muestra `perView` a la vez (6 en desktop) y rota grupos completos cada 4 s.
 * Pausa al hover/foco, respeta prefers-reduced-motion, accesible y con fallback.
 */
export default function PersonasSlider({
  personas,
  onSelect,
}: {
  personas: Persona[]
  onSelect: (id: string) => void
}) {
  const items = personas.filter((p) => fixPhotoUrl(p.fotoUrl)).slice(0, 36) // solo con foto, máx 36
  const perView = usePerView()
  const groups = Math.max(1, Math.ceil(items.length / perView))
  const [group, setGroup] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduceMotion = useRef(false)

  useEffect(() => {
    reduceMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  useEffect(() => {
    if (group >= groups) setGroup(0)
  }, [groups, group])

  useEffect(() => {
    if (paused || groups <= 1 || reduceMotion.current) return
    const id = setInterval(() => setGroup((g) => (g + 1) % groups), 4000)
    return () => clearInterval(id)
  }, [paused, groups])

  if (items.length === 0) return null

  return (
    <section
      aria-label="Personas reportadas recientemente"
      aria-roledescription="carrusel"
      className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">
          🧑‍🤝‍🧑 Personas reportadas — ayúdanos a reconocerlas
        </h2>
        <span className="text-xs text-gray-400">{items.length} con foto</span>
      </div>

      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${group * 100}%)` }}
        >
          {Array.from({ length: groups }).map((_, gi) => (
            <div
              key={gi}
              className="grid w-full shrink-0 gap-3"
              style={{ gridTemplateColumns: `repeat(${perView}, minmax(0,1fr))` }}
              aria-hidden={gi !== group}
            >
              {items.slice(gi * perView, gi * perView + perView).map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelect(p.id)}
                  tabIndex={gi === group ? 0 : -1}
                  className="group flex w-full flex-col items-center gap-1.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  aria-label={`Ver a ${p.nombre} ${p.apellido} — estado: ${p.estado}`}
                >
                  {/* Foto en retrato 250x351 (object-cover) para que la cara se vea bien */}
                  <div
                    className={`aspect-[250/351] w-full overflow-hidden rounded-xl border-4 bg-gray-100 ${
                      statusBorder[p.estado] ?? 'border-gray-300'
                    }`}
                  >
                    <img
                      src={fixPhotoUrl(p.fotoUrl)!}
                      alt={`Foto de ${p.nombre} ${p.apellido}`}
                      loading="lazy"
                      width={250}
                      height={351}
                      onError={(e) => {
                        e.currentTarget.onerror = null
                        e.currentTarget.src = AVATAR_FALLBACK
                      }}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <span className="w-full truncate text-center text-xs font-medium text-gray-700">
                    {p.nombre} {p.apellido}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {groups > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5" role="tablist" aria-label="Grupos">
          {Array.from({ length: groups }).map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === group}
              aria-label={`Mostrar grupo ${i + 1} de ${groups}`}
              onClick={() => setGroup(i)}
              className={`h-2 rounded-full transition-all ${
                i === group ? 'w-6 bg-red-600' : 'w-2 bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  )
}
