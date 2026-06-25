import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { db } from '@/db'
import { medios } from '@/db/schema'

export const dynamic = 'force-dynamic'

// POST /api/medios — upload photo or video for a person
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const personaId = formData.get('personaId') as string
    const tipo = (formData.get('tipo') as string) || 'foto'
    const descripcion = formData.get('descripcion') as string | null
    const file = formData.get('file') as File | null

    if (!personaId || !file) {
      return NextResponse.json({ error: 'personaId y archivo requeridos' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const filename = `${tipo}s/${personaId}/${Date.now()}.${ext}`

    const blob = await put(filename, bytes, {
      access: 'public',
      addRandomSuffix: true,
    })

    // Solo registrar en `medios` si el personaId es un UUID real (no 'temp').
    // El blob ya está subido; devolvemos la URL en todos los casos.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(personaId)
    if (isUuid) {
      try {
        await db().insert(medios).values({
          personaId,
          tipo: tipo as 'foto' | 'video',
          url: blob.url,
          descripcion: descripcion || null,
        })
      } catch {
        /* no bloquear la subida si falla el registro en medios */
      }
    }

    return NextResponse.json({ url: blob.url }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
