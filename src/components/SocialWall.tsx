'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

const HASHTAGS = ['ReportaVNZLA', 'TerremotoVenezuela2026', 'VenezuelaTeEncuentra']
const HT_TAGS = HASHTAGS.map((h) => '#' + h).join(' ')

const SHARE_TEXT = `🚨 Tras lo ocurrido en Venezuela, muchas familias buscan información sobre sus seres queridos.

Si conoces a una persona desaparecida o tienes información que pueda ayudar, utiliza y comparte 👉 https://reportavnzla.com/

Juntos podemos conectar a las familias
#ReportaVnzla`

interface Post {
  id: string
  url: string
  plataforma: string
}

function PostEmbed({ url, plataforma }: { url: string; plataforma: string }) {
  if (plataforma === 'x') {
    return (
      <blockquote className="twitter-tweet" data-dnt="true" data-width="100%">
        <a href={url}>{url}</a>
      </blockquote>
    )
  }
  if (plataforma === 'instagram') {
    const clean = url.split('?')[0].replace(/\/$/, '')
    return (
      <iframe
        src={`${clean}/embed`}
        className="w-full rounded-xl border border-gray-200 bg-white"
        height={520}
        loading="lazy"
        title="Instagram"
        scrolling="no"
      />
    )
  }
  return (
    <iframe
      src={`https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&width=350`}
      className="w-full rounded-xl border border-gray-200 bg-white"
      height={520}
      loading="lazy"
      title="Facebook"
      scrolling="no"
    />
  )
}

export default function SocialWall() {
  const ref = useRef<HTMLDivElement>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [url, setUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const load = useCallback(() => {
    fetch('/api/social-posts')
      .then((r) => r.json())
      .then((d) => setPosts(d.data || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // (Re)procesar embeds de X cuando cambian los posts
  useEffect(() => {
    if (!posts.some((p) => p.plataforma === 'x')) return
    const id = 'twitter-wjs'
    const w = window as unknown as { twttr?: { widgets?: { load: (el?: HTMLElement | null) => void } } }
    if (!document.getElementById(id)) {
      const s = document.createElement('script')
      s.id = id
      s.src = 'https://platform.twitter.com/widgets.js'
      s.async = true
      s.onload = () => w.twttr?.widgets?.load(ref.current)
      document.body.appendChild(s)
    } else {
      w.twttr?.widgets?.load(ref.current)
    }
  }, [posts])

  const addPost = async () => {
    const u = url.trim()
    if (!u) return
    setAdding(true)
    setError('')
    try {
      const r = await fetch('/api/social-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u }),
      })
      const d = await r.json()
      if (!r.ok) {
        setError(d.error || 'No se pudo agregar')
      } else {
        setUrl('')
        load()
      }
    } catch {
      setError('No se pudo agregar')
    } finally {
      setAdding(false)
    }
  }

  const copyMensaje = async () => {
    try {
      await navigator.clipboard.writeText(SHARE_TEXT)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* noop */
    }
  }

  const redes = [
    { label: 'X', emoji: '✖️', href: `https://x.com/search?q=${encodeURIComponent(HT_TAGS)}&f=live` },
    { label: 'Instagram', emoji: '📸', href: `https://www.instagram.com/explore/tags/${HASHTAGS[0].toLowerCase()}/` },
    { label: 'Facebook', emoji: '🔵', href: `https://www.facebook.com/hashtag/${HASHTAGS[0].toLowerCase()}` },
    { label: 'TikTok', emoji: '🎵', href: `https://www.tiktok.com/tag/${HASHTAGS[0].toLowerCase()}` },
  ]

  return (
    <div className="space-y-4">
      {/* Agregar publicación (arriba) */}
      <div className="rounded-xl border border-gray-200 bg-white p-3">
        <p className="mb-2 text-xs font-semibold text-gray-700">➕ Agregar una publicación</p>
        <p className="mb-2 text-[11px] leading-snug text-gray-400">
          Pega el enlace de un post de X, Instagram o Facebook y se mostrará aquí.
        </p>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addPost()}
          placeholder="https://x.com/.../status/…"
          className="search-input text-sm"
          inputMode="url"
        />
        <button onClick={addPost} disabled={adding} className="btn-primary mt-2 w-full text-center text-sm disabled:opacity-50">
          {adding ? 'Agregando…' : 'Agregar publicación'}
        </button>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

      {/* Accesos a hashtags en vivo */}
      <div className="grid grid-cols-2 gap-2">
        {redes.map((r) => (
          <a
            key={r.label}
            href={r.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs font-medium text-gray-700 hover:border-red-300"
          >
            <span>{r.emoji}</span> {r.label}
          </a>
        ))}
      </div>

      {/* Compartir con el mensaje sugerido */}
      <div className="rounded-xl bg-red-50 p-3 text-xs">
        <p className="mb-1.5 font-medium text-red-800">📢 Ayuda a difundir:</p>
        <p className="mb-2 whitespace-pre-line rounded-lg bg-white p-2 text-[11px] leading-snug text-gray-600">
          {SHARE_TEXT}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(SHARE_TEXT)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-green-600 px-2 py-1.5 text-center font-semibold text-white hover:bg-green-700"
          >
            WhatsApp
          </a>
          <a
            href={`https://x.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-gray-900 px-2 py-1.5 text-center font-semibold text-white hover:bg-black"
          >
            X (Twitter)
          </a>
        </div>
        <button onClick={copyMensaje} className="mt-2 w-full rounded-lg border border-red-200 bg-white px-2 py-1.5 font-semibold text-red-700 hover:bg-red-50">
          {copied ? '✓ Mensaje copiado' : 'Copiar mensaje'}
        </button>
      </div>

      {/* Publicaciones agregadas */}
      <div ref={ref} className="space-y-3">
        {posts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-center text-xs text-gray-400">
            Sé el primero en compartir una publicación de redes pegando su enlace arriba.
          </p>
        ) : (
          posts.map((p) => <PostEmbed key={p.id} url={p.url} plataforma={p.plataforma} />)
        )}
      </div>
    </div>
  )
}
