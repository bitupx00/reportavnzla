'use client'

import { useEffect, useRef } from 'react'

/**
 * Espacio para publicaciones de X (Twitter) y otras redes.
 * Para mostrar tweets, agrega sus URLs aquí (ej:
 *   'https://twitter.com/usuario/status/1234567890').
 * Se renderizan con el widget oficial de X.
 */
const SOCIAL_TWEETS: string[] = []

export default function SocialFeed() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (SOCIAL_TWEETS.length === 0) return
    const id = 'twitter-wjs'
    const existing = document.getElementById(id) as HTMLScriptElement | null
    if (!existing) {
      const s = document.createElement('script')
      s.id = id
      s.src = 'https://platform.twitter.com/widgets.js'
      s.async = true
      document.body.appendChild(s)
    } else {
      // ya cargado: re-procesar los embeds nuevos
      ;(window as unknown as { twttr?: { widgets?: { load: (el?: HTMLElement | null) => void } } }).twttr?.widgets?.load(
        ref.current
      )
    }
  }, [])

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6">
      <h3 className="mb-1 font-semibold text-gray-800">📣 Redes sociales y noticias</h3>
      <p className="mb-4 text-sm text-gray-500">
        Actualizaciones desde X (Twitter) y otras redes sobre el terremoto y la búsqueda de personas.
      </p>

      {SOCIAL_TWEETS.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-400">
          Aún no hay publicaciones cargadas. Se pueden agregar URLs de tweets de X en{' '}
          <code className="rounded bg-gray-100 px-1 text-gray-500">SOCIAL_TWEETS</code> (
          <code className="text-gray-500">src/components/SocialFeed.tsx</code>) y aparecerán aquí.
        </div>
      ) : (
        <div ref={ref} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {SOCIAL_TWEETS.map((url) => (
            <blockquote key={url} className="twitter-tweet" data-dnt="true">
              <a href={url}>{url}</a>
            </blockquote>
          ))}
        </div>
      )}
    </section>
  )
}
