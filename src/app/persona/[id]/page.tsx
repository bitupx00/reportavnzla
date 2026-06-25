import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { sqlRaw } from '@/db'
import { fixPhotoUrl, formatCedula } from '@/lib/utils'

export const dynamic = 'force-dynamic'

interface PersonaRow {
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
  createdAt: string
}

async function getPersona(id: string): Promise<PersonaRow | null> {
  try {
    const sql = sqlRaw()
    const rows = (await sql`
      SELECT id, nombre, apellido, cedula, edad, genero,
             ultima_ubicacion AS "ultimaUbicacion", descripcion,
             foto_url AS "fotoUrl", estado, created_at AS "createdAt"
      FROM personas WHERE id = ${id} LIMIT 1`) as PersonaRow[]
    return rows[0] || null
  } catch {
    return null
  }
}

const estadoTxt: Record<string, string> = {
  buscado: 'EN BÚSQUEDA',
  encontrado: 'ENCONTRADO/A',
  fallecido: 'Fallecido/a',
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const p = await getPersona(params.id)
  if (!p) return { title: 'Persona no encontrada — ReportaVNZLA' }
  const nombre = `${p.nombre} ${p.apellido}`.trim()
  const est = estadoTxt[p.estado] || p.estado
  const desc = `${est}${p.ultimaUbicacion ? ` · Última vez vista: ${p.ultimaUbicacion}` : ''}. Ayúdanos a encontrar a ${nombre} — ReportaVNZLA.`
  const foto = fixPhotoUrl(p.fotoUrl)
  const title = `${nombre} — ${est} | ReportaVNZLA`
  const images = [foto || '/og-image.png']
  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      type: 'profile',
      url: `https://reportavnzla.com/persona/${p.id}`,
      images,
    },
    twitter: { card: 'summary_large_image', title, description: desc, images },
  }
}

export default async function PersonaPage({ params }: { params: { id: string } }) {
  const p = await getPersona(params.id)
  if (!p) notFound()
  const foto = fixPhotoUrl(p.fotoUrl)
  const est = estadoTxt[p.estado] || p.estado
  const estadoColor =
    p.estado === 'buscado'
      ? 'bg-red-600'
      : p.estado === 'encontrado'
        ? 'bg-green-600'
        : 'bg-gray-500'
  const nombre = `${p.nombre} ${p.apellido}`.trim()
  const shareText = `🔴 Ayúdanos a encontrar a ${nombre}.${p.ultimaUbicacion ? ` Última vez vista: ${p.ultimaUbicacion}.` : ''}`
  const url = `https://reportavnzla.com/persona/${p.id}`

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/reportavnzla.jpg" alt="ReportaVNZLA" width={40} height={40} className="h-10 w-10 rounded-lg object-cover" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">ReportaVNZLA</h1>
              <p className="text-xs text-gray-500">Venezuela Te Encuentra</p>
            </div>
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <article className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-[260px_1fr]">
            <div className="bg-gray-100">
              {foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto} alt={`Foto de ${nombre}`} className="aspect-[250/351] w-full object-cover sm:h-full" />
              ) : (
                <div className="flex aspect-[250/351] w-full items-center justify-center text-6xl">👤</div>
              )}
            </div>

            <div className="p-6 space-y-4">
              <div>
                <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold text-white ${estadoColor}`}>{est}</span>
                <h2 className="mt-2 text-2xl font-bold text-gray-900">{nombre}</h2>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {p.cedula && (
                  <div className="rounded-lg bg-gray-50 p-3">
                    <div className="text-xs text-gray-400">Cédula</div>
                    <div className="font-semibold">{formatCedula(p.cedula)}</div>
                  </div>
                )}
                {p.edad != null && (
                  <div className="rounded-lg bg-gray-50 p-3">
                    <div className="text-xs text-gray-400">Edad</div>
                    <div className="font-semibold">{p.edad} años</div>
                  </div>
                )}
              </div>

              {p.ultimaUbicacion && (
                <div className="rounded-lg border border-red-100 bg-red-50 p-3">
                  <div className="text-xs text-red-400">📍 Última vez vista</div>
                  <div className="font-semibold text-sm text-red-800">{p.ultimaUbicacion}</div>
                </div>
              )}

              {p.descripcion && (
                <p className="rounded-lg bg-gray-50 p-3 text-sm leading-relaxed text-gray-600">{p.descripcion}</p>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + url)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
                >
                  🟢 Compartir por WhatsApp
                </a>
                <Link
                  href={`/?p=${p.id}`}
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Ver en el mapa y más info →
                </Link>
              </div>
            </div>
          </div>
        </article>

        <p className="mt-4 text-center text-xs text-gray-400">
          Plataforma humanitaria sin fines de lucro · <Link href="/" className="hover:text-gray-600">reportavnzla.com</Link>
        </p>
      </div>
    </main>
  )
}
