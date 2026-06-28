import { NextResponse } from 'next/server'
import { frAdminOk, frAdminDenied } from '@/lib/frAdmin'
import { rateLimit, getIp } from '@/lib/ratelimit'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const raw = process.env.FR_API_URL || ''
const FR = (/^https?:\/\//i.test(raw) ? raw : `http://${raw}`).replace(/\/+$/, '')
const KEY = process.env.FR_API_KEY || ''

// Conciliación entre bases distintas: la misma persona reportada en varias
// plataformas. Devuelve grupos cross-source con las imágenes de cada base.
// VUELCA datos de personas de TODAS las fuentes → solo admin (no público).
export async function GET(req: Request) {
  if (!frAdminOk(req)) return frAdminDenied()
  const rl = await rateLimit(getIp(req), 15)
  if (!rl.ok) return NextResponse.json({ ok: false, error: 'Demasiadas solicitudes.' }, { status: 429 })
  if (!KEY) return NextResponse.json({ ok: false, error: 'FR no configurado.' }, { status: 503 })
  const u = new URL(req.url)
  const min = u.searchParams.get('min_score') || '0.55'
  const limit = u.searchParams.get('limit') || '800'
  const sources = u.searchParams.get('sources') || ''
  const qs = new URLSearchParams({ min_score: min, limit })
  if (sources) qs.set('sources', sources)
  try {
    const r = await fetch(`${FR}/v1/reconcile?${qs.toString()}`, { headers: { 'X-API-Key': KEY } })
    return new NextResponse(await r.text(), { status: r.status, headers: { 'content-type': 'application/json' } })
  } catch { return NextResponse.json({ ok: false, error: 'No se pudo conectar con el FR-API.' }, { status: 502 }) }
}
