import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const raw = process.env.FR_API_URL || ''
const FR = (/^https?:\/\//i.test(raw) ? raw : `http://${raw}`).replace(/\/+$/, '')
const KEY = process.env.FR_API_KEY || ''

export async function GET(req: Request) {
  if (!KEY) return NextResponse.json({ ok: false, error: 'FR no configurado.' }, { status: 503 })
  const u = new URL(req.url)
  const min = u.searchParams.get('min_score') || '0.6'
  const limit = u.searchParams.get('limit') || '200'
  try {
    const r = await fetch(`${FR}/v1/duplicates?source=reportavnzla&min_score=${min}&limit=${limit}`, { headers: { 'X-API-Key': KEY } })
    return new NextResponse(await r.text(), { status: r.status, headers: { 'content-type': 'application/json' } })
  } catch { return NextResponse.json({ ok: false, error: 'No se pudo conectar con el FR-API.' }, { status: 502 }) }
}
