import { sqlRaw } from '@/db'

/**
 * Rate-limit por IP basado en la BD (sin servicios externos).
 * Ventana fija de 10 minutos; si una IP supera `limite` solicitudes, se rechaza.
 * Devuelve { ok, conteo }.
 */
export async function rateLimit(ip: string, limite = 25): Promise<{ ok: boolean; conteo: number }> {
  try {
    const sql = sqlRaw()
    await sql`CREATE TABLE IF NOT EXISTS rate_limit (ip text PRIMARY KEY, conteo int NOT NULL, ventana timestamptz NOT NULL)`
    const rows = (await sql`
      INSERT INTO rate_limit (ip, conteo, ventana) VALUES (${ip}, 1, now())
      ON CONFLICT (ip) DO UPDATE SET
        conteo  = CASE WHEN rate_limit.ventana < now() - interval '10 minutes' THEN 1 ELSE rate_limit.conteo + 1 END,
        ventana = CASE WHEN rate_limit.ventana < now() - interval '10 minutes' THEN now() ELSE rate_limit.ventana END
      RETURNING conteo`) as Array<{ conteo: number }>
    const conteo = rows[0]?.conteo ?? 1
    return { ok: conteo <= limite, conteo }
  } catch {
    // Si falla el rate-limit (BD), no bloqueamos el alta legítima.
    return { ok: true, conteo: 0 }
  }
}

/** IP del request (Vercel pone x-forwarded-for). */
export function getIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'desconocida'
}
