import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors })
}

// POST /api/v1/telegram — envía un mensaje de prueba con el bot del usuario
// body: { botToken, chatId, message? }
export async function POST(request: NextRequest) {
  try {
    const { botToken, chatId, message } = await request.json()
    if (!botToken || !chatId) {
      return NextResponse.json({ success: false, error: 'botToken y chatId requeridos' }, { status: 400, headers: cors })
    }
    const text = message || '✅ ReportaVNZLA conectado. Tu bot recibirá novedades de personas.'
    const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    const data = await r.json()
    if (!data.ok) {
      return NextResponse.json({ success: false, error: data.description || 'Telegram rechazó el envío' }, { status: 400, headers: cors })
    }
    return NextResponse.json({ success: true, mensaje: 'Mensaje enviado a Telegram' }, { headers: cors })
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500, headers: cors })
  }
}
