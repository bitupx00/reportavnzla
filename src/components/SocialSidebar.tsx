'use client'

import Recursos from './Recursos'

/**
 * Sidebar izquierdo desplegable con los CENTROS DE ACOPIO / estructuras afectadas.
 * - Desktop: acoplado a la izquierda; el contenido principal se desplaza.
 * - Móvil: cajón (drawer) con fondo oscuro.
 * - Pestaña "📦 Acopios" para abrir cuando está colapsado.
 */
export default function SocialSidebar({
  open,
  setOpen,
}: {
  open: boolean
  setOpen: (v: boolean) => void
}) {
  return (
    <>
      {/* Pestaña para abrir (cuando está colapsado) */}
      <button
        onClick={() => setOpen(true)}
        className={`fixed left-0 top-1/3 z-30 rounded-r-lg bg-red-600 px-1.5 py-4 text-xs font-bold tracking-wide text-white shadow-lg transition-opacity hover:bg-red-700 ${
          open ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
        style={{ writingMode: 'vertical-rl' }}
        aria-label="Abrir centros de acopio"
      >
        📦 Acopios
      </button>

      {/* Fondo (solo móvil) — por encima del header */}
      {open && <div className="fixed inset-0 z-[55] bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Panel — por encima del header (z-40) para que no lo tape en móvil */}
      <aside
        className={`fixed left-0 top-0 z-[60] flex h-screen w-[86vw] max-w-[360px] flex-col border-r border-gray-200 bg-gray-100 shadow-2xl transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <span className="font-semibold text-gray-800">📦 Centros de acopio</span>
          <button
            onClick={() => setOpen(false)}
            className="text-2xl leading-none text-gray-400 hover:text-gray-600"
            aria-label="Colapsar"
            title="Colapsar"
          >
            ‹
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <Recursos />
        </div>
      </aside>
    </>
  )
}
