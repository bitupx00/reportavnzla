'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { fixPhotoUrl, avatarFallback } from '@/lib/utils'

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

const PAGE = 100

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
 * Slider superior de fotos de personas.
 * - Muestra `perView` a la vez (6 desktop / 4 tablet / 3 móvil / 2 móvil chico).
 * - Rota grupos completos cada 4 s (pausa al interactuar / reduce-motion).
 * - Deslizable: swipe táctil + arrastre con mouse + flechas + teclado.
 * - Carga paginada: trae más personas a medida que te acercas al final (≈todas).
 */
export default function PersonasSlider({
  personas,
  onSelect,
}: {
  personas: Persona[]
  onSelect: (id: string) => void
}) {
  const [items, setItems] = useState<Persona[]>(() =>
    personas.filter((p) => fixPhotoUrl(p.fotoUrl))
  )
  const [page, setPage] = useState(-1)
  const [hasMore, setHasMore] = useState(true)
  const loadingRef = useRef(false)
  const perView = usePerView()
  const groups = Math.max(1, Math.ceil(items.length / perView))
  const [group, setGroup] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduceMotion = useRef(false)

  const loadPage = useCallback(async (pg: number) => {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const res = await fetch(`/api/personas?page=${pg}&limit=${PAGE}`)
      const data = await res.json()
      const arr = (data.data || data) as Persona[]
      const withPhoto = Array.isArray(arr) ? arr.filter((p) => fixPhotoUrl(p.fotoUrl)) : []
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id))
        return [...prev, ...withPhoto.filter((p) => !seen.has(p.id))]
      })
      setPage(pg)
      if (!arr || arr.length < PAGE) setHasMore(false)
    } catch {
      /* silencioso */
    } finally {
      loadingRef.current = false
    }
  }, [])

  // Primera página al montar
  useEffect(() => {
    loadPage(0)
  }, [loadPage])

  useEffect(() => {
    reduceMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  useEffect(() => {
    if (group >= groups) setGroup(Math.max(0, groups - 1))
  }, [groups, group])

  // Cargar más cuando nos acercamos al final
  useEffect(() => {
    if (hasMore && group >= groups - 2) loadPage(page + 1)
  }, [group, groups, hasMore, page, loadPage])

  // Auto-rotación cada 4 s
  useEffect(() => {
    if (paused || groups <= 1 || reduceMotion.current) return
    const id = setInterval(() => setGroup((g) => (g + 1) % groups), 4000)
    return () => clearInterval(id)
  }, [paused, groups])

  const go = useCallback(
    (dir: number) => {
      setGroup((g) => Math.min(groups - 1, Math.max(0, g + dir)))
    },
    [groups]
  )

  // Swipe (táctil) + arrastre (mouse) vía pointer events
  const dragX = useRef<number | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    dragX.current = e.clientX
    setPaused(true)
  }
  const onPointerUp = (e: React.PointerEvent) => {
    if (dragX.current !== null) {
      const dx = e.clientX - dragX.current
      if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
    }
    dragX.current = null
  }

  if (items.length === 0) return null

  return (
    <section
      aria-label="Personas reportadas recientemente"
      aria-roledescription="carrusel"
      className="relative rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1)
        if (e.key === 'ArrowLeft') go(-1)
      }}
      tabIndex={0}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">
          🧑‍🤝‍🧑 Personas reportadas — desliza para ver más
        </h2>
        <span className="text-xs text-gray-400">
          {items.length}
          {hasMore ? '+' : ''} con foto
        </span>
      </div>

      <div className="relative">
        {/* Flecha anterior */}
        {group > 0 && (
          <button
            type="button"
            aria-label="Anteriores"
            onClick={() => go(-1)}
            className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow ring-1 ring-gray-200 hover:bg-white"
          >
            <span className="block h-5 w-5 text-gray-700">‹</span>
          </button>
        )}
        {/* Flecha siguiente */}
        {group < groups - 1 && (
          <button
            type="button"
            aria-label="Siguientes"
            onClick={() => go(1)}
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow ring-1 ring-gray-200 hover:bg-white"
          >
            <span className="block h-5 w-5 text-gray-700">›</span>
          </button>
        )}

        <div
          className="overflow-hidden touch-pan-y"
          style={{ touchAction: 'pan-y' }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          <div
            className="flex transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(-${group * 100}%)` }}
          >
            {Array.from({ length: groups }).map((_, gi) => (
              <div
                key={gi}
                className="grid w-full shrink-0 gap-3 px-1"
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
                    <div
                      className={`aspect-[250/351] w-full overflow-hidden rounded-xl border-4 bg-gray-100 ${
                        statusBorder[p.estado] ?? 'border-gray-300'
                      }`}
                    >
                      <img
                        src={fixPhotoUrl(p.fotoUrl)!}
                        alt={`Foto de ${p.nombre} ${p.apellido}`}
                        loading="lazy"
                        draggable={false}
                        width={250}
                        height={351}
                        onError={(e) => {
                          e.currentTarget.onerror = null
                          e.currentTarget.src = avatarFallback(p.nombre, p.apellido)
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
      </div>

      {groups > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          <span className="text-xs text-gray-400">
            {group + 1}/{groups}
            {hasMore ? '+' : ''}
          </span>
        </div>
      )}
    </section>
  )
}
