import { NextRequest, NextResponse } from 'next/server'
import { sqlRaw } from '@/db'
import { motivoRechazo } from '@/lib/antispam'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Importa las personas "localizado" (encontradas/rescatadas) desde
 * desaparecidosterremotovenezuela.com (API: theempire.tech) hacia personas.
 *
 *  GET /api/admin/import-localizados?from=1&pages=10[&apply=1]
 *   - Procesa `pages` páginas (pageSize=100) a partir de la página `from`.
 *   - Sin apply=1 => DRY-RUN (cuenta, no inserta).
 *   - Dedup: tag external_id='dtv-<id>' (índice único) + SE SALTA cualquier
 *     nombre+apellido+ubicación que ya exista (de cualquier fuente). Sin duplicados.
 *   - Estado importado: 'encontrado'. Devuelve nextPage para continuar.
 */
const API = 'https://desaparecidos-terremoto-api.theempire.tech/api'

function splitNombre(full: string): { nombre: string; apellido: string } {
  const parts = (full || '').trim().split(/\s+/)
  if (parts.length <= 1) return { nombre: parts[0] || 'Sin nombre', apellido: '' }
  // Heurística: primeras 2 palabras = nombre(s), resto = apellido(s); si solo 2, 1 y 1
  if (parts.length === 2) return { nombre: parts[0], apellido: parts[1] }
  const nombre = parts.slice(0, 2).join(' ')
  const apellido = parts.slice(2).join(' ')
  return { nombre, apellido }
}

const norm = (s: string) => (s || '').trim().toLowerCase()
const keyOf = (n: string, a: string, u: string) => `${norm(n)}|${norm(a)}|${norm(u)}`

export async function GET(request: NextRequest) {
  try {
    const sp = new URL(request.url).searchParams
    const from = Math.max(1, parseInt(sp.get('from') || '1', 10) || 1)
    const pages = Math.min(Math.max(1, parseInt(sp.get('pages') || '10', 10) || 10), 30)
    const apply = sp.get('apply') === '1'
    const sql = sqlRaw()

    let fetched = 0
    let localizado = 0
    let spam = 0
    let totalPages = 0
    const candidatos: Array<{
      nombre: string; apellido: string; ubicacion: string; descripcion: string | null
      foto: string | null; edad: number | null; notas: string | null; extId: string; key: string
    }> = []

    for (let p = from; p < from + pages; p++) {
      const resp = await fetch(`${API}/personas?pageSize=100&page=${p}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'reportavnzla-import/1.0' },
      })
      if (!resp.ok) break
      const data = (await resp.json()) as any
      totalPages = data.totalPages || totalPages
      const items: any[] = data.items || []
      if (items.length === 0) break
      fetched += items.length
      for (const it of items) {
        if (it.estado !== 'localizado') continue
        localizado++
        const { nombre, apellido } = splitNombre(String(it.nombre || ''))
        const ubicacion = String(it.ubicacion || '').trim()
        // Anti-spam: la API de origen está contaminada (p.ej. TRUSTEDF57/infinityhotel.it x cientos)
        if (motivoRechazo({ nombre: `${nombre} ${apellido}`, descripcion: it.descripcion, ultimaUbicacion: ubicacion })) { spam++; continue }
        const notasParts: string[] = []
        if (it.localizadoPor) notasParts.push(`Localizado por ${it.localizadoPor}${it.localizadoRelacion ? ` (${it.localizadoRelacion})` : ''}`)
        if (it.localizadoNota) notasParts.push(String(it.localizadoNota))
        candidatos.push({
          nombre,
          apellido,
          ubicacion,
          descripcion: it.descripcion ? String(it.descripcion).slice(0, 2000) : null,
          foto: it.foto && String(it.foto).trim() ? String(it.foto).trim() : null,
          edad: it.edad != null && !Number.isNaN(parseInt(it.edad)) ? parseInt(it.edad) : null,
          notas: notasParts.length ? notasParts.join('. ').slice(0, 1000) : null,
          extId: `dtv-${it.id}`,
          key: keyOf(nombre, apellido, ubicacion),
        })
      }
    }

    if (candidatos.length === 0) {
      return NextResponse.json({ apply, from, pages, fetched, localizado, spam, insertados: 0, yaExistian: 0, totalPages, nextPage: from + pages > totalPages ? null : from + pages, fin: from + pages > totalPages })
    }

    // Dedup dentro del lote (por key y por extId)
    const seenKey = new Set<string>()
    const seenExt = new Set<string>()
    const lote = candidatos.filter((c) => {
      if (seenKey.has(c.key) || seenExt.has(c.extId)) return false
      seenKey.add(c.key); seenExt.add(c.extId); return true
    })

    // Dedup contra lo existente (cualquier fuente) por nombre+apellido+ubicación
    const keys = lote.map((c) => c.key)
    const exist = (await sql.query(
      `SELECT lower(trim(nombre))||'|'||lower(trim(apellido))||'|'||lower(trim(coalesce(ultima_ubicacion,''))) AS k
       FROM personas
       WHERE lower(trim(nombre))||'|'||lower(trim(apellido))||'|'||lower(trim(coalesce(ultima_ubicacion,''))) = ANY($1)`,
      [keys]
    )) as Array<{ k: string }>
    const existSet = new Set(exist.map((r) => r.k))
    const nuevos = lote.filter((c) => !existSet.has(c.key))
    const yaExistian = lote.length - nuevos.length

    let insertados = 0
    if (apply && nuevos.length) {
      // INSERT multi-fila con ON CONFLICT (external_id) DO NOTHING (índice único dtv)
      const cols = ['nombre', 'apellido', 'ultima_ubicacion', 'descripcion', 'foto_url', 'estado', 'edad', 'notas', 'external_id']
      const params: any[] = []
      const tuples: string[] = []
      nuevos.forEach((c, i) => {
        const b = i * 9
        tuples.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9})`)
        params.push(c.nombre.slice(0, 200) || 'Sin nombre', c.apellido.slice(0, 200), c.ubicacion.slice(0, 300) || null,
          c.descripcion, c.foto, 'encontrado', c.edad, c.notas, c.extId)
      })
      const res = (await sql.query(
        `INSERT INTO personas (${cols.join(',')}) VALUES ${tuples.join(',')}
         ON CONFLICT (external_id) WHERE external_id IS NOT NULL AND external_id <> '' DO NOTHING
         RETURNING id`,
        params
      )) as Array<{ id: string }>
      insertados = res.length
    }

    const nextPage = from + pages > totalPages ? null : from + pages
    return NextResponse.json({
      apply, from, pages, fetched, localizado, spam,
      candidatosUnicos: lote.length, yaExistian, nuevos: nuevos.length, insertados,
      totalPages, nextPage, fin: nextPage === null,
    })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
