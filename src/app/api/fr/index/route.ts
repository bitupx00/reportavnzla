import { NextResponse } from 'next/server'
import { frAdminOk, frAdminDenied } from '@/lib/frAdmin'
import { rateLimit, getIp } from '@/lib/ratelimit'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const raw = process.env.FR_API_URL || ''
const FR = (/^https?:\/\//i.test(raw) ? raw : `http://${raw}`).replace(/\/+$/, '')
const KEY = process.env.FR_API_KEY || ''

export async function POST(req: Request) {
  // ESCRITURA en el índice real (40k+ personas): solo admin (anti-poisoning).
  if (!frAdminOk(req)) return frAdminDenied()
  const rl = await rateLimit(getIp(req), 30)
  if (!rl.ok) return NextResponse.json({ ok: false, error: 'Demasiadas solicitudes.' }, { status: 429 })
  if (!KEY) return NextResponse.json({ ok: false, error: 'FR no configurado.' }, { status: 503 })
  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ ok: false, error: 'Solicitud inválida.' }, { status: 400 }) }
  const fd = new FormData()
  for (const k of ['external_id', 'person_name', 'last_seen_location', 'image_url']) {
    const v = form.get(k); if (v != null) fd.append(k, v as string)
  }
  const file = form.get('file'); if (file instanceof Blob) fd.append('file', file, 'foto.jpg')
  fd.append('source', 'reportavnzla')
  try {
    const r = await fetch(`${FR}/v1/index`, { method: 'POST', headers: { 'X-API-Key': KEY }, body: fd })
    return new NextResponse(await r.text(), { status: r.status, headers: { 'content-type': 'application/json' } })
  } catch { return NextResponse.json({ ok: false, error: 'No se pudo conectar con el FR-API.' }, { status: 502 }) }
}
