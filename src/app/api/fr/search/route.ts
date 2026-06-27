import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const raw = process.env.FR_API_URL || ''
const FR = (/^https?:\/\//i.test(raw) ? raw : `http://${raw}`).replace(/\/+$/, '')
const KEY = process.env.FR_API_KEY || ''

export async function POST(req: Request) {
  if (!KEY) return NextResponse.json({ ok: false, error: 'FR no configurado.' }, { status: 503 })
  let file: FormDataEntryValue | null
  try { file = (await req.formData()).get('file') } catch { return NextResponse.json({ ok: false, error: 'Solicitud inválida.' }, { status: 400 }) }
  if (!(file instanceof Blob)) return NextResponse.json({ ok: false, error: 'Falta la imagen.' }, { status: 400 })
  const fd = new FormData(); fd.append('file', file, 'q.jpg')
  try {
    const r = await fetch(`${FR}/v1/search`, { method: 'POST', headers: { 'X-API-Key': KEY }, body: fd })
    return new NextResponse(await r.text(), { status: r.status, headers: { 'content-type': 'application/json' } })
  } catch { return NextResponse.json({ ok: false, error: 'No se pudo conectar con el FR-API.' }, { status: 502 }) }
}
