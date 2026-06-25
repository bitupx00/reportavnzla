'use client'

import { cn, formatDate, formatCedula, statusColor } from '@/lib/utils'

interface Persona {
  id: string
  nombre: string
  apellido: string
  cedula: string | null
  edad: number | null
  genero: string | null
  ultimaUbicacion: string | null
  estado: string
  fotoUrl: string | null
  createdAt: string
}

interface Props {
  personas: Persona[]
  onSelect: (id: string) => void
}

export default function PersonCard({ personas, onSelect }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {personas.map((p) => (
        <Card key={p.id} persona={p} onClick={() => onSelect(p.id)} />
      ))}
    </div>
  )
}

function Card({ persona: p, onClick }: { persona: Persona; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'persona-card',
        p.estado === 'buscado' && 'status-buscado',
        p.estado === 'encontrado' && 'status-encontrado',
        p.estado === 'fallecido' && 'status-fallecido'
      )}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Photo */}
        <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-gray-200">
          {p.fotoUrl ? (
            <img
              src={p.fotoUrl}
              alt={`${p.nombre} ${p.apellido}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="text-2xl">👤</span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <span className={cn('inline-block text-xs font-semibold px-2 py-0.5 rounded-full border mb-1', statusColor(p.estado))}>
            {p.estado === 'buscado' && '🔴 Buscado/a'}
            {p.estado === 'encontrado' && '🟢 Encontrado/a'}
            {p.estado === 'fallecido' && '⚫ Fallecido/a'}
          </span>
          <h3 className="font-semibold text-gray-900 truncate">
            {p.nombre} {p.apellido}
          </h3>
          <div className="text-sm text-gray-500 mt-0.5">
            {[p.cedula ? `C.I. ${formatCedula(p.cedula)}` : null, p.edad ? `${p.edad} años` : null, p.genero]
              .filter(Boolean)
              .join(' · ')}
          </div>
          {p.ultimaUbicacion && (
            <div className="text-sm text-gray-500 mt-1 truncate">
              📍 {p.ultimaUbicacion}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-100">
        <span className="text-xs text-gray-400">{formatDate(p.createdAt, 'relative')}</span>
        <button className="text-xs text-red-600 hover:text-red-700 font-medium">
          Ver ficha →
        </button>
      </div>
    </div>
  )
}
