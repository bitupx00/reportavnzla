import { NextRequest, NextResponse } from 'next/server'
import { sqlRaw } from '@/db'
import { motivoRechazo } from '@/lib/antispam'

export const dynamic = 'force-dynamic'

// Personas encontradas SIN datos (foto tomada en sitio) para que su familia las
// reconozca. Se marcan con la columna `sin_identificar` (idempotente).
async function ensureSchema() {
  const sql = sqlRaw()
  await sql`ALTER TABLE personas ADD COLUMN IF NOT EXISTS sin_identificar boolean DEFAULT false`
}

// DELETE /api/por-identificar?id=<id> — elimina una entrada por identificar
// (solo borra registros sin_identificar = true, nunca personas reportadas normales)
export async function DELETE(request: NextRequest) {
  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    await ensureSchema()
    const sql = sqlRaw()
    const rows = (await sql`
      DELETE FROM personas WHERE id = ${id} AND sin_identificar = true RETURNING id`) as Array<{ id: string }>
    if (!rows[0]) return NextResponse.json({ error: 'No encontrada (o no es por-identificar)' }, { status: 404 })
    return NextResponse.json({ ok: true, eliminado: rows[0].id })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

// GET /api/por-identificar — lista de personas por identificar
export async function GET() {
  try {
    await ensureSchema()
    const sql = sqlRaw()
    const rows = await sql`
      SELECT id, foto_url AS "fotoUrl", estado,
             ultima_ubicacion AS "ultimaUbicacion", created_at AS "createdAt"
      FROM personas
      WHERE sin_identificar = true
      ORDER BY created_at DESC
      LIMIT 200`
    return NextResponse.json({ data: rows })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

// POST /api/por-identificar — registra una persona encontrada (foto + datos opcionales)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      fotoUrl,
      estado,
      nombre,
      apellido,
      ultimaUbicacion,
      descripcion,
      contactoNombre,
      contactoTelefono,
      contactoEmail,
    } = body
    if (!fotoUrl) {
      return NextResponse.json({ error: 'fotoUrl requerido' }, { status: 400 })
    }
    const motivo = motivoRechazo({ nombre, apellido, descripcion, ultimaUbicacion, reportadoPorNombre: contactoNombre })
    if (motivo) return NextResponse.json({ error: motivo }, { status: 400 })
    await ensureSchema()
    const sql = sqlRaw()
    const est = estado === 'fallecido' ? 'fallecido' : 'encontrado'
    const nom = nombre && String(nombre).trim() ? String(nombre).trim().slice(0, 100) : 'Por identificar'
    const ape = apellido && String(apellido).trim() ? String(apellido).trim().slice(0, 100) : ''
    // sin_identificar = true si NO dieron nombre real
    const sinId = nom === 'Por identificar'
    const rows = (await sql`
      INSERT INTO personas (nombre, apellido, estado, foto_url, ultima_ubicacion, descripcion, sin_identificar)
      VALUES (${nom}, ${ape}, ${est}, ${fotoUrl}, ${ultimaUbicacion || null}, ${descripcion || null}, ${sinId})
      RETURNING id`) as Array<{ id: string }>
    const id = rows[0]?.id

    // Contacto opcional -> aviso/familiar
    if (id && contactoNombre && String(contactoNombre).trim()) {
      await sql`ALTER TABLE avisos ADD COLUMN IF NOT EXISTS email_aviso varchar(150)`
      await sql`
        INSERT INTO avisos (persona_id, nombre_aviso, telefono_aviso, email_aviso, mensaje)
        VALUES (${id}, ${String(contactoNombre).trim().slice(0, 150)},
                ${contactoTelefono ? String(contactoTelefono).trim().slice(0, 30) : null},
                ${contactoEmail ? String(contactoEmail).trim().slice(0, 150) : null},
                'Contacto de quien la encontró')`
    }

    return NextResponse.json({ ok: true, id }, { status: 201 })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
