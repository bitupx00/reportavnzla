'use client'

import { useState, useCallback } from 'react'

interface Props {
  onSearch: (params: { q: string; estado: string }) => void
  initialQuery?: string
  initialEstado?: string
}

const ESTADOS: Array<{ v: string; label: string }> = [
  { v: '', label: 'Todos' },
  { v: 'buscado', label: '🔴 Buscados' },
  { v: 'encontrado', label: '🟢 Encontrados' },
  { v: 'fallecido', label: '⚫ Fallecidos' },
]

export default function SearchBar({ onSearch, initialQuery = '', initialEstado = '' }: Props) {
  const [query, setQuery] = useState(initialQuery)
  const [estado, setEstado] = useState(initialEstado)

  const run = useCallback((q: string, e: string) => onSearch({ q, estado: e }), [onSearch])

  return (
    <div className="rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-orange-50 p-4 sm:p-5">
      <h3 className="text-base font-bold text-gray-900">🔍 ¿Buscas a un familiar o conocido?</h3>
      <p className="mb-3 mt-0.5 text-xs text-gray-500">
        Escribe su nombre, apellido o cédula y filtra por estado. Cada búsqueda puede ayudar a un reencuentro.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run(query, estado)}
            placeholder="Nombre, apellido o cédula…"
            className="search-input pl-10"
            aria-label="Buscar persona"
          />
        </div>
        <button onClick={() => run(query, estado)} className="btn-primary whitespace-nowrap">
          Buscar
        </button>
      </div>

      {/* Filtros rápidos por estado (chips) */}
      <div className="mt-3 flex flex-wrap gap-2">
        {ESTADOS.map((e) => {
          const active = estado === e.v
          return (
            <button
              key={e.v}
              type="button"
              onClick={() => {
                setEstado(e.v)
                run(query, e.v)
              }}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'border-red-600 bg-red-600 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-red-300'
              }`}
              aria-pressed={active}
            >
              {e.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
