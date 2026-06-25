'use client'

import { useState, useCallback } from 'react'

interface Props {
  onSearch: (params: { q: string; estado: string }) => void
  initialQuery?: string
  initialEstado?: string
}

export default function SearchBar({ onSearch, initialQuery = '', initialEstado = '' }: Props) {
  const [query, setQuery] = useState(initialQuery)
  const [estado, setEstado] = useState(initialEstado)

  const handleSearch = useCallback(() => {
    onSearch({ q: query, estado })
  }, [query, estado, onSearch])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="flex-1 relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar por nombre, apellido o cédula..."
          className="search-input pl-10"
        />
      </div>
      <select
        value={estado}
        onChange={(e) => { setEstado(e.target.value); }}
        className="px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none text-gray-700 min-w-[160px]"
      >
        <option value="">Todos los estados</option>
        <option value="buscado">🔴 Aún buscados</option>
        <option value="encontrado">🟢 Encontrados</option>
        <option value="fallecido">⚫ Fallecidos</option>
      </select>
      <button onClick={handleSearch} className="btn-primary whitespace-nowrap">
        Buscar
      </button>
    </div>
  )
}
