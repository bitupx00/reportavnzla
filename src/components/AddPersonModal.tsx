'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: FormData) => Promise<void>
}

export default function AddPersonModal({ isOpen, onClose, onSubmit }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!isOpen) {
      formRef.current?.reset()
      setFotoPreview(null)
      setError('')
    }
  }, [isOpen])

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => setFotoPreview(ev.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await onSubmit(new FormData(e.currentTarget))
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al publicar')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-2xl">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900">📋 Registrar persona</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
          )}

          {/* Datos de la persona */}
          <fieldset className="border border-gray-200 rounded-xl p-4 space-y-4">
            <legend className="text-sm font-semibold text-gray-700 px-2">Datos de la persona</legend>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input name="nombre" required maxLength={100} className="search-input" placeholder="Nombre" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Apellido *</label>
                <input name="apellido" required maxLength={100} className="search-input" placeholder="Apellido" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cédula (C.I.)</label>
                <input name="cedula" maxLength={20} className="search-input" placeholder="V-12345678" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Edad</label>
                <input name="edad" type="number" min="0" max="150" className="search-input" placeholder="Edad" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Género</label>
                <select name="genero" className="search-input">
                  <option value="">No especificado</option>
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado *</label>
              <select name="estado" required className="search-input">
                <option value="buscado">🔴 Persona perdida / buscada</option>
                <option value="encontrado">🟢 Persona rescatada / encontrada</option>
                <option value="fallecido">⚫ Persona fallecida</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Último lugar visto / ubicación</label>
              <input name="ultimaUbicacion" maxLength={500} className="search-input" placeholder="Ej: Caracas, Edificio Torre Principal, piso 5" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea name="descripcion" maxLength={2000} rows={3} className="search-input resize-none" placeholder="Descripción física, ropa que llevaba, circunstancias..." />
            </div>

            {/* Foto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Foto</label>
              {fotoPreview ? (
                <div className="relative inline-block">
                  <img src={fotoPreview} alt="Preview" className="w-32 h-32 rounded-xl object-cover border-2 border-gray-200" />
                  <button type="button" onClick={() => { setFotoPreview(null); if (fileRef.current) fileRef.current.value = '' }} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">&times;</button>
                </div>
              ) : (
                <label className="block w-32 h-32 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-red-300 transition-colors">
                  <input ref={fileRef} name="foto" type="file" accept="image/*" onChange={handleFotoChange} className="hidden" />
                  <div className="text-center">
                    <div className="text-2xl">📷</div>
                    <div className="text-xs text-gray-400 mt-1">Subir foto</div>
                  </div>
                </label>
              )}
            </div>
          </fieldset>

          {/* Datos del reportante */}
          <fieldset className="border border-gray-200 rounded-xl p-4 space-y-4">
            <legend className="text-sm font-semibold text-gray-700 px-2">Tus datos (quien reporta)</legend>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tu nombre *</label>
                <input name="reportadoPorNombre" required maxLength={150} className="search-input" placeholder="Tu nombre completo" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input name="reportadoPorTelefono" maxLength={30} className="search-input" placeholder="+58 412 1234567" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input name="reportadoPorEmail" type="email" maxLength={150} className="search-input" placeholder="tu@email.com" />
            </div>
          </fieldset>

          <button type="submit" disabled={loading} className="btn-primary w-full text-center">
            {loading ? '⏳ Publicando...' : '📢 Publicar registro'}
          </button>
        </form>
      </div>
    </div>
  )
}
