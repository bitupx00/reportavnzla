import { NextResponse } from 'next/server'

// Proxy server-side al FR-API (reconocimiento facial). La API key vive solo en
// el servidor (env). El navegador llama a esta ruta same-origin (HTTPS) y aquí
// reenviamos la foto al FR-API con la clave. Evita exponer la clave y el
// mixed-content (HTTPS -> HTTP).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FR_URL = process.env.FR_API_URL || 'http://201.189.205.53:8808'
const FR_KEY = process.env.FR_API_KEY || ''

export async function POST(req: Request) {
  if (!FR_KEY) {
    return NextResponse.json({ ok: false, error: 'FR no configurado (FR_API_KEY).' }, { status: 503 })
  }
  let file: FormDataEntryValue | null
  try {
    file = (await req.formData()).get('file')
  } catch {
    return NextResponse.json({ ok: false, error: 'Solicitud inválida.' }, { status: 400 })
  }
  if (!(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: 'Falta la imagen (campo "file").' }, { status: 400 })
  }
  const fd = new FormData()
  fd.append('file', file, 'foto.jpg')
  try {
    const r = await fetch(`${FR_URL}/v1/check-duplicate`, {
      method: 'POST',
      headers: { 'X-API-Key': FR_KEY },
      body: fd,
    })
    const body = await r.text()
    return new NextResponse(body, { status: r.status, headers: { 'content-type': 'application/json' } })
  } catch {
    return NextResponse.json({ ok: false, error: 'No se pudo conectar con el servicio de rostro.' }, { status: 502 })
  }
}
