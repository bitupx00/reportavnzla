'use client'

import { useState, useEffect } from 'react'
import { formatDate, formatCedula, statusColor, fixPhotoUrl, AVATAR_FALLBACK } from '@/lib/utils'
import { compressImageToDataUrl } from '@/lib/image'

interface Familiar {
  id: string
  nombre: string
  telefono: string | null
  email: string | null
  mensaje: string | null
  createdAt: string
}

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
  lat: number | null
  lng: number | null
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
  onMarkFound: (id: string, estado: string, notas: string) => Promise<void>
  onLocate?: (persona: Persona) => void
}

export default function PersonDetail({ persona, isOpen, onClose, onMarkFound, onLocate }: Props) {
  const [loading, setLoading] = useState(false)
  const [notasEncontrado, setNotasEncontrado] = useState('')
  const [showFoundForm, setShowFoundForm] = useState(false)
  const [estadoResol, setEstadoResol] = useState('encontrado')
  const [zoom, setZoom] = useState(false)
  const [avisos, setAvisos] = useState<Familiar[]>([])
  const [showFamForm, setShowFamForm] = useState(false)
  const [famForm, setFamForm] = useState({ nombre: '', telefono: '', email: '' })
  const [savingFam, setSavingFam] = useState(false)
  const [localFoto, setLocalFoto] = useState<string | null>(null)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const pid = persona?.id
  useEffect(() => {
    setLocalFoto(null)
    if (!pid) {
      setAvisos([])
      return
    }
    fetch(`/api/avisos?personaId=${pid}`)
      .then((r) => r.json())
      .then((d) => setAvisos(d.data || []))
      .catch(() => setAvisos([]))
  }, [pid])

  if (!isOpen || !persona) return null

  const reloadAvisos = () =>
    fetch(`/api/avisos?personaId=${persona.id}`)
      .then((r) => r.json())
      .then((d) => setAvisos(d.data || []))
      .catch(() => {})

  const handleAddFamiliar = async () => {
    if (!famForm.nombre.trim()) return
    setSavingFam(true)
    try {
      await fetch('/api/avisos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId: persona.id, ...famForm }),
      })
      setFamForm({ nombre: '', telefono: '', email: '' })
      setShowFamForm(false)
      reloadAvisos()
    } catch {
      alert('No se pudo guardar el contacto')
    } finally {
      setSavingFam(false)
    }
  }

  const handleAddFoto = async (file: File) => {
    setUploadingFoto(true)
    try {
      const dataUrl = await compressImageToDataUrl(file)
      await fetch('/api/personas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: persona.id, fotoUrl: dataUrl }),
      })
      setLocalFoto(dataUrl)
    } catch {
      alert('No se pudo subir la foto')
    } finally {
      setUploadingFoto(false)
    }
  }

  const fotoActual = fixPhotoUrl(localFoto || persona.fotoUrl)

  // Enlace para compartir: usa el ID del registro
  const shareUrl =
    (typeof window !== 'undefined' ? window.location.origin : 'https://reportavnzla.com') +
    `/persona/${persona.id}`
  const shareText = `🔴 Ayúdanos a encontrar a ${persona.nombre} ${persona.apellido}.${
    persona.ultimaUbicacion ? ` Última vez vista: ${persona.ultimaUbicacion}.` : ''
  } ReportaVNZLA:`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard no disponible */
    }
  }

  const handleShare = async () => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> }
    if (nav.share) {
      try {
        await nav.share({ title: `${persona.nombre} ${persona.apellido}`, text: shareText, url: shareUrl })
        return
      } catch {
        /* cancelado */
      }
    }
    setShareOpen((o) => !o)
  }

  const handleMarkFound = async () => {
    if (!notasEncontrado.trim()) return
    setLoading(true)
    try {
      await onMarkFound(persona.id, estadoResol, notasEncontrado)
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
          <div className="relative flex items-center gap-1">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
              title="Compartir"
            >
              🔗 Compartir
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-1">&times;</button>

            {/* Menú de compartir (fallback si no hay share nativo) */}
            {shareOpen && (
              <div className="absolute right-0 top-10 z-20 w-52 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShareOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-gray-50"
                >
                  🟢 WhatsApp
                </a>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShareOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-gray-50"
                >
                  ✖️ X (Twitter)
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShareOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-gray-50"
                >
                  🔵 Facebook
                </a>
                <button
                  onClick={() => {
                    handleCopy()
                    setShareOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50"
                >
                  📋 Copiar enlace
                </button>
              </div>
            )}
          </div>
        </div>

        {copied && (
          <div className="px-6 pt-2 text-center text-xs font-medium text-green-600">✓ Enlace copiado</div>
        )}

        <div className="p-6 space-y-5">
          {/* Photo (click para ampliar) */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-[200px] max-w-full aspect-[250/351] rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden border-4 border-gray-200">
              {fotoActual ? (
                <img
                  src={fotoActual}
                  alt={`Foto de ${persona.nombre} ${persona.apellido}`}
                  className="w-full h-full object-cover cursor-zoom-in"
                  title="Click para ampliar"
                  onClick={() => setZoom(true)}
                  onError={(e) => {
                    e.currentTarget.onerror = null
                    e.currentTarget.src = AVATAR_FALLBACK
                  }}
                />
              ) : (
                <span className="text-5xl">👤</span>
              )}
            </div>
            {/* Añadir foto si no tiene */}
            {!fotoActual && (
              <label className="cursor-pointer rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-red-300 hover:text-red-600">
                {uploadingFoto ? 'Subiendo…' : '📷 Añadir foto'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingFoto}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleAddFoto(f)
                  }}
                />
              </label>
            )}
          </div>

          {/* Lightbox / zoom de la foto */}
          {zoom && fotoActual && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 cursor-zoom-out"
              onClick={() => setZoom(false)}
            >
              <img
                src={fotoActual}
                alt={`Foto de ${persona.nombre} ${persona.apellido}`}
                className="max-h-[92vh] max-w-[95vw] rounded-lg object-contain shadow-2xl"
                onError={(e) => {
                  e.currentTarget.onerror = null
                  e.currentTarget.src = AVATAR_FALLBACK
                }}
              />
              <button
                onClick={() => setZoom(false)}
                aria-label="Cerrar"
                className="absolute top-4 right-4 text-3xl leading-none text-white/90 hover:text-white"
              >
                &times;
              </button>
            </div>
          )}

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
              <div className="text-xs text-red-400">📍 Última vez vista aquí</div>
              <div className="font-semibold text-sm text-red-800">{persona.ultimaUbicacion}</div>
              {onLocate && (
                <button
                  onClick={() => onLocate(persona)}
                  className="mt-2 inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                >
                  🗺️ Ver en el mapa
                </button>
              )}
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

          {/* Familiares / contactos */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-blue-800">👨‍👩‍👧 Familiares y contactos</h4>
              <button
                onClick={() => setShowFamForm((s) => !s)}
                className="text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                {showFamForm ? 'Cancelar' : '+ Añadir'}
              </button>
            </div>

            {avisos.length > 0 ? (
              <ul className="space-y-2 mb-2">
                {avisos.map((a) => (
                  <li key={a.id} className="rounded-lg bg-white border border-blue-100 px-3 py-2 text-sm">
                    <div className="font-medium text-gray-800">{a.nombre}</div>
                    {a.telefono && <div className="text-xs text-gray-600">📞 {a.telefono}</div>}
                    {a.email && <div className="text-xs text-gray-600">✉️ {a.email}</div>}
                    {a.mensaje && a.mensaje !== 'Familiar / contacto' && (
                      <div className="text-xs text-gray-500 mt-0.5">{a.mensaje}</div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              !showFamForm && (
                <p className="text-xs text-blue-500/80 mb-1">
                  ¿Eres familiar? Añade tus datos de contacto para que puedan comunicarse contigo.
                </p>
              )
            )}

            {showFamForm && (
              <div className="space-y-2">
                <input
                  value={famForm.nombre}
                  onChange={(e) => setFamForm({ ...famForm, nombre: e.target.value })}
                  placeholder="Nombre del familiar *"
                  className="search-input"
                />
                <input
                  value={famForm.telefono}
                  onChange={(e) => setFamForm({ ...famForm, telefono: e.target.value })}
                  placeholder="Teléfono de contacto"
                  className="search-input"
                />
                <input
                  type="email"
                  value={famForm.email}
                  onChange={(e) => setFamForm({ ...famForm, email: e.target.value })}
                  placeholder="Correo de contacto"
                  className="search-input"
                />
                <button
                  onClick={handleAddFamiliar}
                  disabled={savingFam || !famForm.nombre.trim()}
                  className="btn-primary w-full text-center disabled:opacity-40"
                >
                  {savingFam ? 'Guardando…' : 'Guardar contacto'}
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          {persona.estado === 'buscado' && (
            <div className="space-y-3">
              {!showFoundForm ? (
                <button
                  onClick={() => setShowFoundForm(true)}
                  className="btn-success w-full text-center"
                >
                  ✓ Actualizar estado (encontrado / fallecido)
                </button>
              ) : (
                <div className="space-y-3 bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-gray-700">¿Cómo se resolvió este caso?</h4>

                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { v: 'encontrado', label: '🟢 Encontrado/a con vida (rescatado/a)' },
                      { v: 'fallecido', label: '⚫ Fallecido/a' },
                    ].map((o) => (
                      <label
                        key={o.v}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                          estadoResol === o.v ? 'border-red-500 bg-white font-semibold' : 'border-gray-200 bg-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name="estadoResol"
                          value={o.v}
                          checked={estadoResol === o.v}
                          onChange={() => setEstadoResol(o.v)}
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>

                  <textarea
                    value={notasEncontrado}
                    onChange={(e) => setNotasEncontrado(e.target.value)}
                    rows={3}
                    className="search-input resize-none"
                    placeholder="Descripción: cómo fue localizada, detalles, fuente…"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleMarkFound}
                      disabled={loading || !notasEncontrado.trim()}
                      className={`flex-1 text-center ${estadoResol === 'fallecido' ? 'btn-secondary' : 'btn-success'}`}
                    >
                      {loading ? 'Actualizando…' : '✓ Confirmar'}
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
