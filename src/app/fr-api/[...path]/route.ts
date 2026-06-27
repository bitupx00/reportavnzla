import { NextRequest, NextResponse } from 'next/server'

// Gateway público del FR-API bajo reportavnzla.com.
// Los partners llaman https://reportavnzla.com/fr-api/<ruta> con SU propia
// API key (header X-API-Key); este proxy la reenvía tal cual al FR-API. Así el
// origen real (IP/host) nunca se expone y todo va por HTTPS. La autenticación y
// el rate-limit los aplica el FR-API contra la key de cada partner.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const raw = process.env.FR_API_URL || ''
const FR = (/^https?:\/\//i.test(raw) ? raw : `http://${raw}`).replace(/\/+$/, '')

async function forward(req: NextRequest, path: string[]) {
  const url = new URL(req.url)
  const target = `${FR}/${(path || []).join('/')}${url.search}`
  const headers: Record<string, string> = {}
  const key = req.headers.get('x-api-key'); if (key) headers['x-api-key'] = key
  const auth = req.headers.get('authorization'); if (auth) headers['authorization'] = auth
  const ct = req.headers.get('content-type'); if (ct) headers['content-type'] = ct

  const init: RequestInit = { method: req.method, headers }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = Buffer.from(await req.arrayBuffer())
  }
  try {
    const r = await fetch(target, init)
    const body = await r.arrayBuffer()
    return new NextResponse(body, {
      status: r.status,
      headers: { 'content-type': r.headers.get('content-type') || 'application/json' },
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'No se pudo conectar con el FR-API.' }, { status: 502 })
  }
}

type Ctx = { params: Promise<{ path: string[] }> }
export async function GET(req: NextRequest, { params }: Ctx) { return forward(req, (await params).path) }
export async function POST(req: NextRequest, { params }: Ctx) { return forward(req, (await params).path) }
