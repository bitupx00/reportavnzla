'use client'

import { useState } from 'react'

const HASHTAGS = ['ReportaVNZLA', 'TerremotoVenezuela2026', 'VenezuelaTeEncuentra']
const HT_TAGS = HASHTAGS.map((h) => '#' + h).join(' ')

const SHARE_TEXT = `🚨 Tras lo ocurrido en Venezuela, muchas familias buscan información sobre sus seres queridos.

Si conoces a una persona desaparecida o tienes información que pueda ayudar, utiliza y comparte 👉 https://reportavnzla.com/

Juntos podemos conectar a las familias
#ReportaVnzla`

export default function SocialWall() {
  const [copied, setCopied] = useState(false)

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
    </div>
  )
}
