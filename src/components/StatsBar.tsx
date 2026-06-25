'use client'

import { cn, formatDate, formatCedula, statusColor } from '@/lib/utils'

interface Stats {
  total: number
  buscados: number
  encontrados: number
  fallecidos: number
}

interface Props {
  stats: Stats
}

export default function StatsBar({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="stat-card bg-white border-gray-200">
        <div className="stat-number text-gray-900">{stats.total}</div>
        <div className="text-sm text-gray-500 mt-1">Personas registradas</div>
      </div>
      <div className="stat-card bg-red-50 border-red-200">
        <div className="stat-number text-red-600">{stats.buscados}</div>
        <div className="text-sm text-red-500 mt-1">🔴 Aún buscados</div>
      </div>
      <div className="stat-card bg-green-50 border-green-200">
        <div className="stat-number text-green-600">{stats.encontrados}</div>
        <div className="text-sm text-green-500 mt-1">🟢 Rescatados ✓</div>
      </div>
      <div className="stat-card bg-gray-50 border-gray-300">
        <div className="stat-number text-gray-600">{stats.fallecidos}</div>
        <div className="text-sm text-gray-400 mt-1">⚫ Fallecidos</div>
      </div>
    </div>
  )
}
