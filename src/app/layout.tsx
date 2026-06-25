import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ReportaVNZLA — Venezuela Te Encuentra 🇻🇪',
  description: 'Plataforma humanitaria sin fines de lucro. Registro de personas perdidas, rescatadas y fallecidas tras el terremoto de Venezuela 2026. Mapa interactivo, datos abiertos, reporte ciudadano.',
  keywords: ['venezuela', 'terremoto', 'desaparecidos', 'rescate', 'emergencia', 'reporta', 'sismo'],
  authors: [{ name: 'ReportaVNZLA - Iniciativa Solidaria' }],
  openGraph: {
    title: 'ReportaVNZLA — Venezuela Te Encuentra 🇻🇪',
    description: 'Registro centralizado de personas afectadas por el terremoto Venezuela 2026.',
    type: 'website',
    locale: 'es_VE',
    siteName: 'ReportaVNZLA',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ReportaVNZLA — Venezuela Te Encuentra',
    description: 'Plataforma solidaria para reportar personas afectadas por el terremoto.',
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#dc2626',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  )
}
