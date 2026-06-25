'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Muro de redes sociales.
 *
 * - Enlaces en vivo a los hashtags en X, Instagram, Facebook y TikTok.
 * - Publicaciones CURADAS incrustadas inline (X via widgets.js; Instagram y
 *   Facebook via iframe oficial). Para mostrar posts, agrega sus URLs en POSTS.
 * - CTA para compartir con los hashtags.
 *
 * Nota: la agregación automática de TODO lo de un hashtag requiere las APIs
 * pagas de cada red; aquí mostramos posts curados + accesos a los hashtags.
 */

const HASHTAGS = ['ReportaVNZLA', 'TerremotoVenezuela2026', 'VenezuelaTeEncuentra']

// Publicaciones a mostrar (cualquier red; se detecta por la URL).
// Ej: 'https://twitter.com/u/status/123', 'https://www.instagram.com/p/ABC/',
//     'https://www.facebook.com/u/posts/123'
const POSTS: string[] = []

const HT = HASHTAGS.join(' ')
const HT_TAGS = HASHTAGS.map((h) => '#' + h).join(' ')

function tweetId(url: string): string | null {
  const m = url.match(/status\/(\d+)/)
  return m ? m[1] : null
}

function PostEmbed({ url }: { url: string }) {
  if (/twitter\.com|x\.com/.test(url)) {
    return (
      <blockquote className="twitter-tweet" data-dnt="true">
        <a href={url}>{url}</a>
      </blockquote>
    )
  }
  if (/instagram\.com/.test(url)) {
    const clean = url.split('?')[0].replace(/\/$/, '')
    return (
      <iframe
        src={`${clean}/embed`}
        className="w-full rounded-xl border border-gray-200"
        height={560}
        loading="lazy"
        title="Instagram"
        scrolling="no"
      />
    )
  }
  if (/facebook\.com/.test(url)) {
    return (
      <iframe
        src={`https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&width=500`}
        className="w-full rounded-xl border border-gray-200"
        height={560}
        loading="lazy"
        title="Facebook"
        scrolling="no"
      />
    )
  }
  return null
}

export default function SocialWall() {
  const ref = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  // Cargar widgets.js de X solo si hay tweets curados
  useEffect(() => {
    if (!POSTS.some((u) => /twitter\.com|x\.com/.test(u))) return
    const id = 'twitter-wjs'
    if (!document.getElementById(id)) {
      const s = document.createElement('script')
      s.id = id
      s.src = 'https://platform.twitter.com/widgets.js'
      s.async = true
      document.body.appendChild(s)
    } else {
      ;(window as unknown as { twttr?: { widgets?: { load: (el?: HTMLElement | null) => void } } }).twttr?.widgets?.load(
        ref.current
      )
    }
  }, [])

  const redes: Array<{ label: string; emoji: string; href: string; cls: string }> = [
    { label: 'X (Twitter)', emoji: '✖️', cls: 'hover:border-gray-800', href: `https://x.com/search?q=${encodeURIComponent(HT_TAGS)}&f=live` },
    { label: 'Instagram', emoji: '📸', cls: 'hover:border-pink-400', href: `https://www.instagram.com/explore/tags/${HASHTAGS[0].toLowerCase()}/` },
    { label: 'Facebook', emoji: '🔵', cls: 'hover:border-blue-500', href: `https://www.facebook.com/hashtag/${HASHTAGS[0].toLowerCase()}` },
    { label: 'TikTok', emoji: '🎵', cls: 'hover:border-gray-800', href: `https://www.tiktok.com/tag/${HASHTAGS[0].toLowerCase()}` },
  ]

  const copyHashtags = async () => {
    try {
      await navigator.clipboard.writeText(HT_TAGS)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* noop */
    }
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6">
      <h3 className="mb-1 font-semibold text-gray-800">📣 Redes sociales</h3>
      <p className="mb-4 text-sm text-gray-500">
        Publicaciones e imágenes relacionadas con{' '}
        <span className="font-medium text-gray-700">{HT_TAGS}</span> y otros hashtags del terremoto.
      </p>

      {/* Accesos a los hashtags en vivo */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {redes.map((r) => (
          <a
            key={r.label}
            href={r.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors ${r.cls}`}
          >
            <span>{r.emoji}</span> Ver en {r.label}
          </a>
        ))}
      </div>

      {/* Publicaciones curadas */}
      {POSTS.length > 0 ? (
        <div ref={ref} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {POSTS.map((u) => (
            <PostEmbed key={u} url={u} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center text-sm text-gray-400">
          Toca un botón de arriba para ver las publicaciones en vivo de cada red. Para fijar publicaciones
          destacadas aquí, agrega sus URLs en <code className="rounded bg-gray-100 px-1">POSTS</code>{' '}
          (<code>src/components/SocialWall.tsx</code>).
        </div>
      )}

      {/* CTA compartir */}
      <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl bg-red-50 p-4">
        <span className="text-sm font-medium text-red-800">¿Quieres ayudar a difundir? Publica con:</span>
        <code className="rounded bg-white px-2 py-1 text-xs text-red-700">{HT_TAGS}</code>
        <button onClick={copyHashtags} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700">
          {copied ? '✓ Copiado' : 'Copiar hashtags'}
        </button>
        <a
          href={`https://x.com/intent/tweet?text=${encodeURIComponent('Ayudemos a reunir familias tras el terremoto. ' + HT_TAGS + ' ')}&url=${encodeURIComponent('https://reportavnzla.com')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
        >
          Publicar en X
        </a>
      </div>
    </section>
  )
}
