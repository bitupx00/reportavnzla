import { NextRequest, NextResponse } from 'next/server'
import { sqlRaw } from '@/db'

export const dynamic = 'force-dynamic'

// La tabla `avisos` ya tiene nombre_aviso/telefono_aviso/mensaje; añadimos email
// de forma idempotente para guardar el correo de contacto del familiar.
async function ensureSchema() {
  const sql = sqlRaw()
  await sql`ALTER TABLE avisos ADD COLUMN IF NOT EXISTS email_aviso varchar(150)`
}

// GET /api/avisos?personaId=... — familiares/contactos de una persona
export async function GET(request: NextRequest) {
  try {
    const personaId = new URL(request.url).searchParams.get('personaId')
    if (!personaId) return NextResponse.json({ data: [] })
    await ensureSchema()
    const sql = sqlRaw()
    const rows = await sql`
      SELECT id,
             nombre_aviso  AS "nombre",
             telefono_aviso AS "telefono",
             email_aviso   AS "email",
             mensaje,
             created_at    AS "createdAt"
      FROM avisos
      WHERE persona_id = ${personaId}
      ORDER BY created_at DESC`
    return NextResponse.json({ data: rows })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/avisos — agrega un familiar/contacto a una persona
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { personaId, nombre, telefono, email, mensaje } = body
    if (!personaId || !nombre || !String(nombre).trim()) {
      return NextResponse.json({ error: 'personaId y nombre son requeridos' }, { status: 400 })
    }
    await ensureSchema()
    const sql = sqlRaw()
    const result = (await sql`
      INSERT INTO avisos (persona_id, nombre_aviso, telefono_aviso, email_aviso, mensaje)
      VALUES (
        ${personaId},
        ${String(nombre).trim().slice(0, 150)},
        ${telefono ? String(telefono).trim().slice(0, 30) : null},
        ${email ? String(email).trim().slice(0, 150) : null},
        ${mensaje ? String(mensaje).trim() : 'Familiar / contacto'}
      )
      RETURNING id`) as Array<{ id: string }>
    return NextResponse.json({ ok: true, id: result[0]?.id }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
