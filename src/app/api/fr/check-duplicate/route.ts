import { NextResponse } from 'next/server'

// Proxy server-side al FR-API (reconocimiento facial). La API key vive solo en
// el servidor (env). El navegador llama a esta ruta same-origin (HTTPS) y aquí
// reenviamos la foto al FR-API con la clave. Evita exponer la clave y el
// mixed-content (HTTPS -> HTTP).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Tolerante: si FR_API_URL viene sin esquema (p. ej. "host:8808"), le anteponemos
// http:// para evitar el error "unknown scheme" de fetch. Quita slashes finales.
const FR_RAW = process.env.FR_API_URL || ''
const FR_URL = (/^https?:\/\//i.test(FR_RAW) ? FR_RAW : `http://${FR_RAW}`).replace(/\/+$/, '')
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
  // Reenvía ?min_score= si el cliente lo manda (ajusta el piso por petición).
  const min = new URL(req.url).searchParams.get('min_score')
  const qs = min ? `?min_score=${encodeURIComponent(min)}` : ''
  try {
    const r = await fetch(`${FR_URL}/v1/check-duplicate${qs}`, {
      method: 'POST',
      headers: { 'X-API-Key': FR_KEY },
      body: fd,
    })
    if (r.status === 401 || r.status === 403) {
      // Diagnóstico server-side: la causa #1 es una FR_API_KEY truncada/incorrecta.
      console.error(`[FR] auth rechazada (${r.status}). Revisa FR_API_KEY en el entorno: debe tener 48 caracteres (recibidos ${FR_KEY.length}).`)
    }
    const body = await r.text()
    return new NextResponse(body, { status: r.status, headers: { 'content-type': 'application/json' } })
  } catch {
    return NextResponse.json({ ok: false, error: 'No se pudo conectar con el servicio de rostro.' }, { status: 502 })
  }
}
