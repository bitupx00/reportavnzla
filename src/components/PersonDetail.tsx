'use client'

import { useState } from 'react'
import { formatDate, formatCedula, statusColor, fixPhotoUrl, AVATAR_FALLBACK } from '@/lib/utils'

interface Persona {
  id: string
  nombre: string
  apellido: string
  cedula: string | null
  edad: number | null
  genero: string | null
  ultimaUbicacion: string | null
  descripcion: string | null
  fotoUrl: string | null
  estado: string
  fechaEncontrado: string | null
  notas: string | null
  reportadoPorNombre: string | null
  reportadoPorTelefono: string | null
  reportadoPorEmail: string | null
  createdAt: string
}

interface Props {
  persona: Persona | null
  isOpen: boolean
  onClose: () => void
  onMarkFound: (id: string, notas: string) => Promise<void>
}

export default function PersonDetail({ persona, isOpen, onClose, onMarkFound }: Props) {
  const [loading, setLoading] = useState(false)
  const [notasEncontrado, setNotasEncontrado] = useState('')
  const [showFoundForm, setShowFoundForm] = useState(false)

  if (!isOpen || !persona) return null

  const handleMarkFound = async () => {
    if (!notasEncontrado.trim()) return
    setLoading(true)
    try {
      await onMarkFound(persona.id, notasEncontrado)
      onClose()
    } catch (err) {
      alert('Error al actualizar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-lg">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{persona.nombre} {persona.apellido}</h2>
            <span className={statusColor(persona.estado)}>
              {persona.estado === 'buscado' && '🔴 Aún buscado/a'}
              {persona.estado === 'encontrado' && '🟢 Encontrado/a'}
              {persona.estado === 'fallecido' && '⚫ Fallecido/a'}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Photo */}
          <div className="flex justify-center">
            <div className="w-28 h-28 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border-4 border-gray-200">
              {fixPhotoUrl(persona.fotoUrl) ? (
                <img
                  src={fixPhotoUrl(persona.fotoUrl)!}
                  alt={`Foto de ${persona.nombre} ${persona.apellido}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.onerror = null
                    e.currentTarget.src = AVATAR_FALLBACK
                  }}
                />
              ) : (
                <span className="text-5xl">👤</span>
              )}
            </div>
          </div>

          {/* Data grid */}
          <div className="grid grid-cols-2 gap-3">
            {persona.cedula && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400">Cédula</div>
                <div className="font-semibold text-sm">{formatCedula(persona.cedula)}</div>
              </div>
            )}
            {persona.edad && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400">Edad</div>
                <div className="font-semibold text-sm">{persona.edad} años</div>
              </div>
            )}
            {persona.genero && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400">Género</div>
                <div className="font-semibold text-sm capitalize">{persona.genero}</div>
              </div>
            )}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400">Registrado el</div>
              <div className="font-semibold text-sm">{formatDate(persona.createdAt, 'long')}</div>
            </div>
          </div>

          {/* Location */}
          {persona.ultimaUbicacion && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3">
              <div className="text-xs text-red-400">📍 Último lugar visto</div>
              <div className="font-semibold text-sm text-red-800">{persona.ultimaUbicacion}</div>
            </div>
          )}

          {/* Description */}
          {persona.descripcion && (
            <div>
              <h4 className="text-sm font-semibold text-gray-600 mb-2">Descripción</h4>
              <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-3">{persona.descripcion}</p>
            </div>
          )}

          {/* Found notes */}
          {persona.estado === 'encontrado' && persona.notas && (
            <div className="bg-green-50 border border-green-100 rounded-lg p-3">
              <div className="text-xs text-green-500 font-semibold">✓ Cómo fue encontrado/a</div>
              <p className="text-sm text-green-800 mt-1">{persona.notas}</p>
            </div>
          )}

          {/* Reporter contact */}
          {persona.reportadoPorNombre && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-600 mb-2">Reportado por</h4>
              <div className="text-sm space-y-1">
                <div className="font-medium">{persona.reportadoPorNombre}</div>
                {persona.reportadoPorTelefono && <div>📞 {persona.reportadoPorTelefono}</div>}
                {persona.reportadoPorEmail && <div>✉️ {persona.reportadoPorEmail}</div>}
              </div>
            </div>
          )}

          {/* Actions */}
          {persona.estado === 'buscado' && (
            <div className="space-y-3">
              {!showFoundForm ? (
                <button
                  onClick={() => setShowFoundForm(true)}
                  className="btn-success w-full text-center"
                >
                  ✓ Marcar como encontrado/a
                </button>
              ) : (
                <div className="space-y-3 bg-green-50 border border-green-200 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-green-700">¿Cómo fue encontrada esta persona?</h4>
                  <textarea
                    value={notasEncontrado}
                    onChange={(e) => setNotasEncontrado(e.target.value)}
                    rows={3}
                    className="search-input resize-none"
                    placeholder="Describe brevemente cómo fue localizada..."
                  />
                  <div className="flex gap-2">
                    <button onClick={handleMarkFound} disabled={loading || !notasEncontrado.trim()} className="btn-success flex-1 text-center">
                      {loading ? 'Actualizando...' : '✓ Confirmar'}
                    </button>
                    <button onClick={() => setShowFoundForm(false)} className="btn-secondary">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {persona.estado === 'encontrado' && (
            <p className="text-green-600 font-medium text-sm text-center py-2">
              ✓ Esta persona fue encontrada. Gracias a Dios. 🙏
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
