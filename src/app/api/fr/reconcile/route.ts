import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const raw = process.env.FR_API_URL || ''
const FR = (/^https?:\/\//i.test(raw) ? raw : `http://${raw}`).replace(/\/+$/, '')
const KEY = process.env.FR_API_KEY || ''

// Conciliación entre bases distintas: la misma persona reportada en varias
// plataformas. Devuelve grupos cross-source con las imágenes de cada base.
export async function GET(req: Request) {
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
