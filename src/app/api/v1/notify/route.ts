import { NextRequest, NextResponse } from 'next/server'
import { sqlRaw } from '@/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const estadoEmoji: Record<string, string> = { buscado: '🔴', encontrado: '🟢', fallecido: '⚫' }

function autorizado(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') || ''
  const secret = new URL(req.url).searchParams.get('secret') || ''
  const cron = process.env.CRON_SECRET
  const notify = process.env.NOTIFY_SECRET
  if (cron && auth === `Bearer ${cron}`) return true
  if (notify && secret === notify) return true
  return false
}

async function telegramSend(token: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: false }),
  }).catch(() => {})
}

// GET /api/v1/notify  (cron o manual con ?secret=) — envía nuevas personas a los suscriptores
export async function GET(request: NextRequest) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: 'No autorizado (configura CRON_SECRET o NOTIFY_SECRET)' }, { status: 401 })
  }
  try {
    const sql = sqlRaw()
    const subs = (await sql`
      SELECT id, canal, telegram_bot_token AS "botToken", telegram_chat_id AS "chatId",
             webhook_url AS "webhookUrl", filtro_q AS "q", filtro_estado AS "estado",
             ultimo_check AS "ultimoCheck"
      FROM notif_suscripciones WHERE activo = true`) as Array<Record<string, any>>

    let enviados = 0
    for (const s of subs) {
      const conds: string[] = ['greatest(created_at, updated_at) > $1']
      const params: unknown[] = [new Date(s.ultimoCheck).toISOString()]
      if (s.estado) {
        params.push(s.estado)
        conds.push(`estado = $${params.length}`)
      }
      if (s.q) {
        params.push(`%${s.q}%`)
        conds.push(`(nombre ILIKE $${params.length} OR apellido ILIKE $${params.length})`)
      }
      params.push(10)
      const nuevas = (await sql.query(
        `SELECT id, nombre, apellido, estado, ultima_ubicacion AS "ultimaUbicacion"
         FROM personas WHERE ${conds.join(' AND ')}
         ORDER BY greatest(created_at, updated_at) ASC LIMIT $${params.length}`,
        params
      )) as Array<Record<string, any>>

      if (nuevas.length > 0) {
        if (s.canal === 'telegram' && s.botToken && s.chatId) {
          for (const p of nuevas) {
            const txt = `${estadoEmoji[p.estado] || ''} <b>${p.nombre} ${p.apellido}</b>\n${p.ultimaUbicacion ? '📍 ' + p.ultimaUbicacion + '\n' : ''}https://reportavnzla.com/persona/${p.id}`
            await telegramSend(s.botToken, s.chatId, txt)
            enviados++
          }
        } else if (s.canal === 'webhook' && s.webhookUrl) {
          await fetch(s.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              suscripcionId: s.id,
              personas: nuevas.map((p) => ({ ...p, url: `https://reportavnzla.com/persona/${p.id}` })),
            }),
          }).catch(() => {})
          enviados += nuevas.length
        }
      }
      await sql`UPDATE notif_suscripciones SET ultimo_check = now() WHERE id = ${s.id}`
    }

    return NextResponse.json({ success: true, suscripciones: subs.length, notificacionesEnviadas: enviados })
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
