import { NextRequest, NextResponse } from 'next/server'
import { sqlRaw } from '@/db'

export const dynamic = 'force-dynamic'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

async function ensureSchema() {
  const sql = sqlRaw()
  await sql`
    CREATE TABLE IF NOT EXISTS notif_suscripciones (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      canal varchar(20) NOT NULL,
      telegram_bot_token text,
      telegram_chat_id varchar(60),
      webhook_url text,
      filtro_q text,
      filtro_estado varchar(20),
      token uuid NOT NULL DEFAULT gen_random_uuid(),
      activo boolean NOT NULL DEFAULT true,
      ultimo_check timestamptz DEFAULT now(),
      created_at timestamptz DEFAULT now()
    )`
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors })
}

// POST /api/v1/subscriptions — registrar una suscripción de notificaciones
// body telegram: { canal:'telegram', telegramBotToken, telegramChatId, q?, estado? }
// body webhook:  { canal:'webhook', webhookUrl, q?, estado? }
export async function POST(request: NextRequest) {
  try {
    const b = await request.json()
    const canal = b.canal === 'webhook' ? 'webhook' : 'telegram'
    const q = b.q ? String(b.q).slice(0, 120) : null
    const estado = ['buscado', 'encontrado', 'fallecido'].includes(b.estado) ? b.estado : null

    if (canal === 'telegram') {
      if (!b.telegramBotToken || !b.telegramChatId) {
        return NextResponse.json({ success: false, error: 'telegramBotToken y telegramChatId requeridos' }, { status: 400, headers: cors })
      }
    } else if (!b.webhookUrl || !/^https:\/\//i.test(b.webhookUrl)) {
      return NextResponse.json({ success: false, error: 'webhookUrl https requerido' }, { status: 400, headers: cors })
    }

    await ensureSchema()
    const sql = sqlRaw()
    const rows = (await sql`
      INSERT INTO notif_suscripciones (canal, telegram_bot_token, telegram_chat_id, webhook_url, filtro_q, filtro_estado)
      VALUES (${canal},
              ${canal === 'telegram' ? String(b.telegramBotToken) : null},
              ${canal === 'telegram' ? String(b.telegramChatId) : null},
              ${canal === 'webhook' ? String(b.webhookUrl) : null},
              ${q}, ${estado})
      RETURNING id, token`) as Array<{ id: string; token: string }>

    return NextResponse.json(
      { success: true, id: rows[0].id, token: rows[0].token, mensaje: 'Guarda el token para gestionar o eliminar la suscripción.' },
      { status: 201, headers: cors }
    )
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500, headers: cors })
  }
}

// GET /api/v1/subscriptions?id=&token= — ver estado de una suscripción
export async function GET(request: NextRequest) {
  try {
    const sp = new URL(request.url).searchParams
    const id = sp.get('id')
    const token = sp.get('token')
    if (!id || !token) return NextResponse.json({ success: false, error: 'id y token requeridos' }, { status: 400, headers: cors })
    await ensureSchema()
    const sql = sqlRaw()
    const rows = (await sql`
      SELECT id, canal, telegram_chat_id AS "telegramChatId", webhook_url AS "webhookUrl",
             filtro_q AS "q", filtro_estado AS "estado", activo, created_at AS "createdAt"
      FROM notif_suscripciones WHERE id = ${id} AND token = ${token}`) as Array<Record<string, unknown>>
    if (!rows[0]) return NextResponse.json({ success: false, error: 'No encontrada' }, { status: 404, headers: cors })
    return NextResponse.json({ success: true, suscripcion: rows[0] }, { headers: cors })
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500, headers: cors })
  }
}

// DELETE /api/v1/subscriptions?id=&token= — desactivar
export async function DELETE(request: NextRequest) {
  try {
    const sp = new URL(request.url).searchParams
    const id = sp.get('id')
    const token = sp.get('token')
    if (!id || !token) return NextResponse.json({ success: false, error: 'id y token requeridos' }, { status: 400, headers: cors })
    await ensureSchema()
    const sql = sqlRaw()
    const rows = (await sql`
      UPDATE notif_suscripciones SET activo = false WHERE id = ${id} AND token = ${token} RETURNING id`) as Array<{ id: string }>
    if (!rows[0]) return NextResponse.json({ success: false, error: 'No encontrada' }, { status: 404, headers: cors })
    return NextResponse.json({ success: true, mensaje: 'Suscripción desactivada' }, { headers: cors })
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500, headers: cors })
  }
}
