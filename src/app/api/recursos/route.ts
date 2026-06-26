import { NextRequest, NextResponse } from 'next/server'
import { sqlRaw } from '@/db'
import { motivoRechazo } from '@/lib/antispam'
import { rateLimit, getIp } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

/**
 * Recursos de la comunidad:
 *  - tipo 'centro_acopio'  -> centros de acopio (qué reciben, contacto, horario).
 *  - tipo 'estructura'     -> estructuras destruidas/afectadas (nivel de daño).
 */
async function ensureSchema() {
  const sql = sqlRaw()
  await sql`
    CREATE TABLE IF NOT EXISTS recursos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tipo varchar(20) NOT NULL,
      nombre varchar(160) NOT NULL,
      direccion text,
      lat real,
      lng real,
      recibe text,
      nivel_dano varchar(20),
      descripcion text,
      contacto varchar(120),
      activo boolean NOT NULL DEFAULT true,
      created_at timestamptz DEFAULT now()
    )`
}

// GET /api/recursos?tipo=centro_acopio|estructura
export async function GET(request: NextRequest) {
  try {
    const tipo = new URL(request.url).searchParams.get('tipo') || 'centro_acopio'
    await ensureSchema()
    const sql = sqlRaw()
    const rows = await sql`
      SELECT id, tipo, nombre, direccion, lat, lng, recibe,
             nivel_dano AS "nivelDano", descripcion, contacto, created_at AS "createdAt"
      FROM recursos WHERE activo = true AND tipo = ${tipo}
      ORDER BY created_at DESC LIMIT 500`
    return NextResponse.json({ data: rows })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

// POST /api/recursos
export async function POST(request: NextRequest) {
  try {
    const b = await request.json()
    if (b._hp) return NextResponse.json({ ok: true }, { status: 200 }) // honeypot
    const tipo = b.tipo === 'estructura' ? 'estructura' : 'centro_acopio'
    const nombre = String(b.nombre || '').trim()
    if (!nombre) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })

    const rl = await rateLimit(getIp(request))
    if (!rl.ok) return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta en unos minutos.' }, { status: 429 })

    const motivo = motivoRechazo({
      nombre,
      descripcion: b.descripcion,
      ultimaUbicacion: b.direccion,
      reportadoPorNombre: b.contacto,
    })
    if (motivo) return NextResponse.json({ error: motivo }, { status: 400 })

    await ensureSchema()
    const sql = sqlRaw()
    const lat = b.lat != null && !Number.isNaN(parseFloat(b.lat)) ? parseFloat(b.lat) : null
    const lng = b.lng != null && !Number.isNaN(parseFloat(b.lng)) ? parseFloat(b.lng) : null
    const nivelDano = ['leve', 'moderado', 'severo', 'colapsado'].includes(b.nivelDano) ? b.nivelDano : null

    const rows = (await sql`
      INSERT INTO recursos (tipo, nombre, direccion, lat, lng, recibe, nivel_dano, descripcion, contacto)
      VALUES (${tipo}, ${nombre.slice(0, 160)}, ${b.direccion ? String(b.direccion).slice(0, 500) : null},
              ${lat}, ${lng},
              ${tipo === 'centro_acopio' && b.recibe ? String(b.recibe).slice(0, 500) : null},
              ${tipo === 'estructura' ? nivelDano : null},
              ${b.descripcion ? String(b.descripcion).slice(0, 1000) : null},
              ${b.contacto ? String(b.contacto).slice(0, 120) : null})
      RETURNING id`) as Array<{ id: string }>
    return NextResponse.json({ ok: true, id: rows[0]?.id }, { status: 201 })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

// DELETE /api/recursos?id= (moderación)
export async function DELETE(request: NextRequest) {
  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    await ensureSchema()
    const sql = sqlRaw()
    const rows = (await sql`UPDATE recursos SET activo = false WHERE id = ${id} RETURNING id`) as Array<{ id: string }>
    if (!rows[0]) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
